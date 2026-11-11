import type { IncomingMessage, Server } from "node:http";
import type { Duplex } from "node:stream";
import { WebSocket, WebSocketServer } from "ws";
import {
  decodeRpcFrame, encodeRpcFrame, MAX_BODY_BYTES, MAX_FRAME_BYTES, MAX_PENDING_CALLS,
  needsCookieTransport, RPC_WEBSOCKET_PATH, RPC_WEBSOCKET_PROTOCOL,
} from "../websocket-protocol";

const allowedRequestHeaders = ["authorization", "content-type", "connect-protocol-version", "connect-timeout-ms", "accept"];
const trustedRequestHeaders = ["host", "user-agent", "x-real-ip", "x-forwarded-for", "x-forwarded-proto"];
const allowedResponseHeaders = ["content-type", "retry-after", "cache-control", "connect-content-encoding"];

function rejectUpgrade(socket: Duplex, status: number, message: string) {
  socket.end(`HTTP/1.1 ${status} ${message}\r\nConnection: close\r\nContent-Length: 0\r\n\r\n`);
}

/** Browsers must come from the exact public origin, including behind nginx TLS. */
export function validWebSocketOrigin(request: IncomingMessage) {
  try {
    const scheme = request.headers["x-forwarded-proto"] ?? "http";
    if (scheme !== "http" && scheme !== "https") return false;
    return typeof request.headers.origin === "string" && request.headers.origin === `${scheme}://${request.headers.host}`;
  } catch { return false; }
}

async function readBody(response: Response) {
  const reader = response.body?.getReader();
  if (!reader) return new Uint8Array();
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > MAX_BODY_BYTES) throw new Error("RPC response too large");
      chunks.push(value);
    }
  } finally { await reader.cancel().catch(() => undefined); }
  const body = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) { body.set(chunk, offset); offset += chunk.byteLength; }
  return body;
}

/** Terminate WS on the same port; loopback dispatch keeps Next's request/cache context intact. */
export function attachRpcWebSocket(server: Server, options: { upstreamOrigin: () => string }) {
  const wss = new WebSocketServer({
    noServer: true,
    maxPayload: MAX_FRAME_BYTES,
    perMessageDeflate: false,
    handleProtocols: (protocols) => protocols.has(RPC_WEBSOCKET_PROTOCOL) ? RPC_WEBSOCKET_PROTOCOL : false,
  });

  const upgrade = (request: IncomingMessage, socket: Duplex, head: Buffer) => {
    if (request.url?.split("?")[0] !== RPC_WEBSOCKET_PATH) return;
    if (request.url !== RPC_WEBSOCKET_PATH || !validWebSocketOrigin(request)) return rejectUpgrade(socket, 403, "Forbidden");
    const protocols = String(request.headers["sec-websocket-protocol"] ?? "").split(",").map((value) => value.trim());
    if (!protocols.includes(RPC_WEBSOCKET_PROTOCOL)) return rejectUpgrade(socket, 400, "Unsupported Protocol");
    wss.handleUpgrade(request, socket, head, (ws) => wss.emit("connection", ws, request));
  };
  server.on("upgrade", upgrade);

  const alive = new WeakSet<WebSocket>();
  wss.on("connection", (ws, request) => {
    alive.add(ws);
    ws.on("pong", () => alive.add(ws));
    const pending = new Map<string, AbortController>();
    // Includes canceled calls until their loopback handler settles, bounding work
    // even when a client rapidly sends request/cancel pairs.
    const active = new Set<AbortController>();

    const reply = (id: string, status: number, headers: [string, string][], body: Uint8Array) => {
      if (ws.readyState !== WebSocket.OPEN) return;
      const frame = encodeRpcFrame({ type: "response", id, status, headers }, body);
      if (ws.bufferedAmount + frame.byteLength > MAX_FRAME_BYTES) { ws.close(1013, "RPC send buffer full"); return; }
      ws.send(frame);
    };
    const failure = (id: string, status: number, code: string, message: string) =>
      reply(id, status, [["content-type", "application/json"]], new TextEncoder().encode(JSON.stringify({ code, message })));

    ws.on("message", (data, binary) => {
      let frame: ReturnType<typeof decodeRpcFrame>;
      try {
        if (!binary) throw new Error("Binary frames required");
        const bytes = Array.isArray(data) ? Buffer.concat(data) : data instanceof ArrayBuffer ? new Uint8Array(data) : data;
        frame = decodeRpcFrame(bytes);
        if (frame.header.type === "response") throw new Error("Unexpected response");
      } catch { ws.close(1002, "Invalid RPC frame"); return; }
      const { header, body } = frame;
      if (header.type === "cancel") {
        pending.get(header.id)?.abort();
        pending.delete(header.id);
        return;
      }
      if (header.type !== "request") return;
      if (pending.has(header.id)) { ws.close(1002, "Duplicate RPC ID"); return; }
      if (active.size >= MAX_PENDING_CALLS) { failure(header.id, 429, "resource_exhausted", "Too many pending RPC calls"); return; }
      if (needsCookieTransport(header.path)) { failure(header.id, 400, "invalid_argument", "This method requires HTTP cookie transport"); return; }
      let headers: Headers;
      try {
        const supplied = new Headers(header.headers);
        headers = new Headers();
        for (const name of allowedRequestHeaders) { const value = supplied.get(name); if (value !== null) headers.set(name, value); }
        // Never trust client-supplied forwarding metadata or cookies in frames.
        for (const name of trustedRequestHeaders) {
          const value = request.headers[name];
          if (typeof value === "string") headers.set(name, value);
        }
        headers.set("accept-encoding", "identity");
      } catch { ws.close(1002, "Invalid RPC metadata"); return; }
      const controller = new AbortController();
      pending.set(header.id, controller);
      active.add(controller);
      const deadline = setTimeout(() => controller.abort(), 60_000);
      void (async () => {
        try {
          // The destination is fixed by the listening server, never by Host,
          // Origin, RPC metadata, or any other caller-controlled URL.
          const response = await fetch(new URL(header.path, options.upstreamOrigin()), {
            method: "POST", headers, body: new Uint8Array(body),
            signal: controller.signal, redirect: "error",
          });
          const responseBody = await readBody(response);
          if (pending.get(header.id) !== controller) return;
          const responseHeaders: [string, string][] = [];
          for (const name of allowedResponseHeaders) { const value = response.headers.get(name); if (value !== null) responseHeaders.push([name, value]); }
          reply(header.id, response.status, responseHeaders, responseBody);
        } catch {
          if (pending.get(header.id) === controller) failure(header.id, controller.signal.aborted ? 504 : 503, controller.signal.aborted ? "deadline_exceeded" : "unavailable", "RPC dispatch failed");
        } finally {
          clearTimeout(deadline);
          active.delete(controller);
          if (pending.get(header.id) === controller) pending.delete(header.id);
        }
      })();
    });
    const abortAll = () => { for (const controller of active) controller.abort(); pending.clear(); };
    ws.on("close", abortAll);
    ws.on("error", abortAll);
  });

  // Ping frames keep nginx's 60-second idle timeout from dropping healthy sockets.
  const heartbeat = setInterval(() => {
    for (const ws of wss.clients) {
      if (!alive.has(ws)) { ws.terminate(); continue; }
      alive.delete(ws);
      ws.ping();
    }
  }, 25_000);
  heartbeat.unref();

  return () => {
    clearInterval(heartbeat);
    server.off("upgrade", upgrade);
    for (const ws of wss.clients) ws.terminate();
    wss.close();
  };
}
