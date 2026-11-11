import { afterEach, describe, expect, test } from "bun:test";
import { createServer } from "node:http";
import { once } from "node:events";
import { WebSocket as NodeWebSocket } from "ws";
import { Code, ConnectError, createClient, createConnectRouter } from "@connectrpc/connect";
import { createFetchHandler } from "@connectrpc/connect/protocol";
import { createConnectTransport } from "@connectrpc/connect-web";
import { AuthService } from "@gen/jadren/v1/auth_pb";
import { ToolsService } from "@gen/jadren/v1/tools_pb";
import { ErrorDetailSchema } from "@gen/jadren/v1/common_pb";
import { authInterceptor, createApiClient } from "@lib/client-api/rpc-transport";
import { createWebSocketFetch } from "@lib/client-api/websocket-fetch";
import { attachRpcWebSocket } from "./server/websocket";
import { decodeRpcFrame, encodeRpcFrame, MAX_BODY_BYTES, MAX_HEADER_BYTES, RPC_WEBSOCKET_PROTOCOL } from "./websocket-protocol";

const cleanups: (() => Promise<void>)[] = [];
afterEach(async () => { for (const cleanup of cleanups.splice(0).reverse()) await cleanup(); });

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => { resolve = done; });
  return { promise, resolve };
}

async function fixture() {
  let origin = "";
  let connections = 0;
  let meCalls = 0;
  let requestHeaders = new Headers();
  const started = deferred();
  const release = deferred();
  const canceled = deferred();
  const router = createConnectRouter();
  router.service(AuthService, {
    me: async (_input, context) => {
      meCalls++;
      requestHeaders = new Headers(context.requestHeader);
      const token = requestHeaders.get("authorization") ?? "anonymous";
      if (token === "Bearer slow") { started.resolve(); await release.promise; }
      if (token === "Bearer cancel") {
        started.resolve();
        await new Promise<void>((resolve) => context.signal.addEventListener("abort", () => { canceled.resolve(); resolve(); }, { once: true }));
      }
      if (token === "Bearer expired") {
        throw new ConnectError("Expired token", Code.Unauthenticated, { "retry-after": "5" }, [{ desc: ErrorDetailSchema, value: { code: "invalid_token" } }]);
      }
      return { user: { userId: token } };
    },
  });
  router.service(ToolsService, {
    synthesizePronunciation: () => ({ audio: new Uint8Array([0, 255, 128, 1]), contentType: "audio/mpeg" }),
  });
  const handlers = new Map(router.handlers.map((handler) => [handler.requestPath, createFetchHandler(handler)]));
  const server = createServer(async (request, response) => {
    const handler = handlers.get(request.url!.replace(/^\/rpc/, ""));
    if (!handler) { response.writeHead(404); response.end(); return; }
    const chunks = [];
    for await (const chunk of request) chunks.push(Buffer.from(chunk));
    const controller = new AbortController();
    response.on("close", () => { if (!response.writableEnded) controller.abort(); });
    const headers = new Headers();
    for (const [key, value] of Object.entries(request.headers)) if (typeof value === "string") headers.set(key, value);
    const result = await handler(new Request(new URL(request.url!, origin), {
      method: "POST", headers, body: Buffer.concat(chunks), signal: controller.signal,
    }));
    response.writeHead(result.status, Object.fromEntries(result.headers));
    response.end(Buffer.from(await result.arrayBuffer()));
  });
  const close = attachRpcWebSocket(server, { upstreamOrigin: () => origin });
  server.on("upgrade", () => { connections++; });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  origin = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  cleanups.push(async () => {
    release.resolve();
    close();
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });
  const sockets: NodeWebSocket[] = [];
  const websocketFetch = createWebSocketFetch({
    origin: () => origin,
    createSocket: (url, protocol) => {
      const ws = new NodeWebSocket(url, protocol, { headers: { origin, "x-real-ip": "192.0.2.1" } });
      sockets.push(ws);
      return ws as unknown as WebSocket;
    },
  });
  const transport = (interceptors = [] as ReturnType<typeof authInterceptor>[]) => createConnectTransport({
    baseUrl: `${origin}/rpc`, useBinaryFormat: true, defaultTimeoutMs: 2000, fetch: websocketFetch, interceptors,
  });
  const raw = async (headers: Record<string, string> = {}, protocol = RPC_WEBSOCKET_PROTOCOL) => {
    const ws = new NodeWebSocket(`${origin.replace("http:", "ws:")}/rpc/ws`, protocol, { headers: { origin, ...headers } });
    sockets.push(ws);
    await once(ws, "open");
    return ws;
  };
  return { server, origin, transport, raw, sockets, websocketFetch, started, release, canceled,
    connections: () => connections, calls: () => meCalls, headers: () => requestHeaders };
}

describe("WebSocket RPC transport", () => {
  test("multiplexes out-of-order Protobuf responses over one socket", async () => {
    const f = await fixture();
    const client = createApiClient(AuthService, f.transport());
    const slow = client.me({}, { headers: { authorization: "Bearer slow" } });
    await f.started.promise;
    const fast = await client.me({}, { headers: { authorization: "Bearer fast" } });
    expect(fast.user?.userId).toBe("Bearer fast");
    f.release.resolve();
    expect((await slow).user?.userId).toBe("Bearer slow");
    const audio = await createApiClient(ToolsService, f.transport()).synthesizePronunciation({ word: "test" });
    expect(Array.from(audio.audio)).toEqual([0, 255, 128, 1]);
    expect(f.connections()).toBe(1);
  });

  test("preserves application error details and metadata", async () => {
    const f = await fixture();
    const client = createApiClient(AuthService, f.transport());
    expect(await client.me({}, { headers: { authorization: "Bearer expired" } }).catch((error: unknown) => error))
      .toMatchObject({ status: 401, code: "invalid_token", message: "Expired token" });
    const error = await createClient(AuthService, f.transport()).me({}, { headers: { authorization: "Bearer expired" } }).catch((error: unknown) => error);
    expect(error).toBeInstanceOf(ConnectError);
    expect((error as ConnectError).metadata.get("retry-after")).toBe("5");
  });

  test("refreshes the token and retries on the same WebSocket", async () => {
    const f = await fixture();
    let token = "expired";
    let refreshes = 0;
    const client = createApiClient(AuthService, f.transport([authInterceptor({
      getAccessToken: () => token,
      refreshAccessToken: async () => { refreshes++; return token = "fresh"; },
      getSessionIdentity: () => "alice",
    })]));
    expect((await client.me({})).user?.userId).toBe("Bearer fresh");
    expect(refreshes).toBe(1);
    expect(f.calls()).toBe(2);
    expect(f.connections()).toBe(1);
  });

  test("propagates cancellation to the server without closing other calls", async () => {
    const f = await fixture();
    const client = createApiClient(AuthService, f.transport());
    const controller = new AbortController();
    const pending = client.me({}, { headers: { authorization: "Bearer cancel" }, signal: controller.signal }).catch((error: unknown) => error);
    await f.started.promise;
    controller.abort();
    expect(await pending).toMatchObject({ code: Code.Canceled });
    await f.canceled.promise;
    expect((await client.me({})).user?.userId).toBe("anonymous");
    expect(f.connections()).toBe(1);
  });

  test("enforces per-call deadlines", async () => {
    const f = await fixture();
    const client = createApiClient(AuthService, f.transport());
    expect(await client.me({}, { headers: { authorization: "Bearer cancel" }, timeoutMs: 100 }).catch((error: unknown) => error))
      .toMatchObject({ status: 504 });
    await f.canceled.promise;
  });

  test("fails disconnected calls without replay and reconnects for the next call", async () => {
    const f = await fixture();
    const client = createApiClient(AuthService, f.transport());
    const pending = client.me({}, { headers: { authorization: "Bearer slow" } }).catch((error: unknown) => error);
    await f.started.promise;
    f.sockets[0].close();
    expect(await pending).toMatchObject({ status: 503 });
    expect(f.calls()).toBe(1);
    expect((await client.me({})).user?.userId).toBe("anonymous");
    expect(f.connections()).toBe(2);
  });

  test("keeps cookie-changing auth calls on HTTP", async () => {
    const f = await fixture();
    let called = "";
    const fetcher = createWebSocketFetch({ origin: () => f.origin, httpFetch: (async (request: Request) => {
      called = request.url;
      return new Response("{}", { headers: { "set-cookie": "refresh=private; HttpOnly" } });
    }) as typeof globalThis.fetch });
    await fetcher(`${f.origin}/rpc/jadren.v1.AuthService/Refresh`, { method: "POST" });
    expect(called).toEndWith("/rpc/jadren.v1.AuthService/Refresh");
    expect(f.connections()).toBe(0);
    const ws = await f.raw();
    const response = once(ws, "message");
    ws.send(encodeRpcFrame({ type: "request", id: "1", path: "/rpc/jadren.v1.AuthService/Refresh", headers: [] }));
    const [data] = await response;
    expect(decodeRpcFrame(new Uint8Array(data)).header).toMatchObject({ type: "response", status: 400 });
  });

  test("uses upgrade metadata for client IP and strips frame cookies", async () => {
    const f = await fixture();
    await createApiClient(AuthService, f.transport()).me({}, { headers: {
      "x-real-ip": "spoofed", "x-forwarded-for": "spoofed", cookie: "jadren_refresh=stolen",
    } });
    expect(f.headers().get("x-real-ip")).toBe("192.0.2.1");
    expect(f.headers().get("x-forwarded-for")).toBeNull();
    expect(f.headers().get("cookie")).toBeNull();
  });

  test("rejects cross-origin upgrades and unsupported protocols", async () => {
    const f = await fixture();
    await expect(f.raw({ origin: "https://evil.example" })).rejects.toThrow("403");
    await expect(f.raw({}, "unsupported")).rejects.toThrow("400");
  });

  test("rejects malformed frames before dispatch", async () => {
    const f = await fixture();
    const ws = await f.raw();
    const closed = once(ws, "close");
    ws.send(new Uint8Array([0, 0, 255, 255]));
    expect((await closed)[0]).toBe(1002);
    expect(f.calls()).toBe(0);
  });
});

describe("RPC WebSocket framing", () => {
  test("bounds metadata and payload sizes", () => {
    expect(() => encodeRpcFrame({ type: "cancel", id: "1" }, new Uint8Array(MAX_BODY_BYTES + 1))).toThrow();
    expect(() => encodeRpcFrame({ type: "request", id: "1", path: "/rpc/jadren.v1.AuthService/Me", headers: [["huge", "x".repeat(MAX_HEADER_BYTES)]] })).toThrow();
    const invalid = encodeRpcFrame({ type: "request", id: "1", path: "/rpc/jadren.v1.AuthService/Me", headers: [] });
    // An attacker cannot route requests to absolute URLs or non-RPC endpoints.
    const json = new TextEncoder().encode('{"type":"request","id":"1","path":"http://evil.example/","headers":[]}');
    const bytes = new Uint8Array(4 + json.length);
    new DataView(bytes.buffer).setUint32(0, json.length);
    bytes.set(json, 4);
    expect(() => decodeRpcFrame(bytes)).toThrow();
    expect(decodeRpcFrame(invalid).header.type).toBe("request");
  });
});
