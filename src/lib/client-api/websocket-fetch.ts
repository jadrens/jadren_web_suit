import { Code, ConnectError } from "@connectrpc/connect";
import {
  decodeRpcFrame, encodeRpcFrame, MAX_BODY_BYTES, MAX_FRAME_BYTES, MAX_PENDING_CALLS,
  needsCookieTransport, RPC_METHOD_PATH, RPC_WEBSOCKET_PATH, RPC_WEBSOCKET_PROTOCOL,
} from "@lib/rpc/websocket-protocol";

interface PendingCall {
  frame: Uint8Array;
  sent: boolean;
  resolve: (response: Response) => void;
  reject: (error: unknown) => void;
  cleanup: () => void;
}

/** One lazy, multiplexed socket per page, shared by anonymous and authenticated clients. */
export function createWebSocketFetch(options: {
  origin?: () => string;
  createSocket?: (url: string, protocol: string) => WebSocket;
  httpFetch?: typeof globalThis.fetch;
} = {}): typeof globalThis.fetch {
  let socket: WebSocket | undefined;
  let sequence = 0;
  const pending = new Map<string, PendingCall>();
  const origin = options.origin ?? (() => window.location.origin);

  const fail = (current: WebSocket, error: unknown) => {
    if (socket !== current) return;
    socket = undefined;
    for (const call of pending.values()) { call.cleanup(); call.reject(error); }
    pending.clear();
    current.close();
  };

  const send = (current: WebSocket, call: PendingCall) => {
    if (current.bufferedAmount + call.frame.byteLength > MAX_FRAME_BYTES) {
      fail(current, new ConnectError("WebSocket send buffer is full", Code.ResourceExhausted));
      return;
    }
    try { current.send(call.frame); call.sent = true; }
    catch { fail(current, new ConnectError("WebSocket send failed", Code.Unavailable)); }
  };

  const connect = () => {
    if (socket) return socket;
    const url = new URL(RPC_WEBSOCKET_PATH, origin());
    url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
    const current = options.createSocket ? options.createSocket(url.href, RPC_WEBSOCKET_PROTOCOL) : new WebSocket(url, RPC_WEBSOCKET_PROTOCOL);
    socket = current;
    current.binaryType = "arraybuffer";
    current.onopen = () => {
      if (socket !== current) return;
      if (current.protocol !== RPC_WEBSOCKET_PROTOCOL) {
        fail(current, new ConnectError("Unsupported RPC WebSocket protocol", Code.Unavailable));
        return;
      }
      for (const call of pending.values()) { if (socket !== current) break; if (!call.sent) send(current, call); }
    };
    current.onmessage = (event: MessageEvent) => {
      if (socket !== current) return;
      try {
        if (!(event.data instanceof ArrayBuffer)) throw new Error("Expected a binary RPC frame");
        const { header, body } = decodeRpcFrame(new Uint8Array(event.data));
        if (header.type !== "response") throw new Error("Expected an RPC response");
        const call = pending.get(header.id);
        if (!call) return; // A canceled call may already have completed on the server.
        const response = new Response(body.byteLength ? new Uint8Array(body) : null, { status: header.status, headers: header.headers });
        pending.delete(header.id);
        call.cleanup();
        call.resolve(response);
      } catch {
        fail(current, new ConnectError("Invalid RPC WebSocket response", Code.DataLoss));
      }
    };
    current.onerror = () => fail(current, new ConnectError("RPC WebSocket connection failed", Code.Unavailable));
    current.onclose = () => fail(current, new ConnectError("RPC WebSocket disconnected; the request was not replayed", Code.Unavailable));
    return current;
  };

  const websocketFetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const request = new Request(input instanceof Request ? input : new URL(String(input), origin()), init);
    const url = new URL(request.url);
    if (url.origin !== origin() || !RPC_METHOD_PATH.test(url.pathname) || url.search || request.method !== "POST") {
      throw new ConnectError("Unsupported WebSocket RPC request", Code.InvalidArgument);
    }
    // Only actual HTTP responses can set or clear HttpOnly cookies. Never put
    // refresh cookies into frames, localStorage, or application-visible tokens.
    if (needsCookieTransport(url.pathname)) return (options.httpFetch ?? globalThis.fetch)(request);
    request.signal.throwIfAborted();
    const body = new Uint8Array(await request.arrayBuffer());
    request.signal.throwIfAborted();
    if (body.byteLength > MAX_BODY_BYTES || pending.size >= MAX_PENDING_CALLS) throw new ConnectError("Too many RPC calls or request too large", Code.ResourceExhausted);
    const id = String(++sequence);
    const frame = encodeRpcFrame({ type: "request", id, path: url.pathname, headers: Array.from(request.headers.entries()) }, body);
    return new Promise<Response>((resolve, reject) => {
      const abort = () => {
        const call = pending.get(id);
        if (!call) return;
        pending.delete(id);
        call.cleanup();
        if (call.sent && socket?.readyState === WebSocket.OPEN) {
          try { socket.send(encodeRpcFrame({ type: "cancel", id })); } catch { /* disconnect will fail the other calls */ }
        }
        reject(request.signal.reason);
        if (!pending.size && socket?.readyState === WebSocket.CONNECTING) {
          const current = socket;
          socket = undefined;
          current.close();
        }
      };
      pending.set(id, { frame, sent: false, resolve, reject, cleanup: () => request.signal.removeEventListener("abort", abort) });
      request.signal.addEventListener("abort", abort, { once: true });
      try {
        const current = connect();
        if (current.readyState === WebSocket.OPEN) send(current, pending.get(id)!);
      } catch (error) {
        pending.delete(id);
        request.signal.removeEventListener("abort", abort);
        reject(error);
      }
    });
  };
  return websocketFetch as typeof globalThis.fetch;
}

export const rpcWebSocketFetch = createWebSocketFetch();
