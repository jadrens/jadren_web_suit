/** A binary message is a uint32 JSON-header length, UTF-8 header, then raw Protobuf bytes. */
export const RPC_WEBSOCKET_PATH = "/rpc/ws";
export const RPC_WEBSOCKET_PROTOCOL = "jadren.rpc.v1";
export const MAX_HEADER_BYTES = 16 * 1024;
export const MAX_BODY_BYTES = 8 * 1024 * 1024;
export const MAX_FRAME_BYTES = 4 + MAX_HEADER_BYTES + MAX_BODY_BYTES;
export const MAX_PENDING_CALLS = 64;
export const RPC_METHOD_PATH = /^\/rpc\/[A-Za-z_][\w]*(?:\.[A-Za-z_][\w]*)+\/[A-Za-z_][\w]*$/;

const cookieMethods = new Set(["Login", "Register", "ResetPassword", "Refresh", "Logout"]);
export function needsCookieTransport(path: string) {
  return path.startsWith("/rpc/jadren.v1.AuthService/") && cookieMethods.has(path.slice(path.lastIndexOf("/") + 1));
}

type HeaderPairs = [string, string][];
export type RpcFrameHeader =
  | { type: "request"; id: string; path: string; headers: HeaderPairs }
  | { type: "cancel"; id: string }
  | { type: "response"; id: string; status: number; headers: HeaderPairs };

function headerPairs(value: unknown): value is HeaderPairs {
  return Array.isArray(value) && value.every((pair) => Array.isArray(pair) && pair.length === 2 && pair.every((item) => typeof item === "string"));
}

function isHeader(value: unknown): value is RpcFrameHeader {
  if (!value || typeof value !== "object" || !("type" in value) || !("id" in value) || typeof value.id !== "string" || !/^[1-9]\d{0,15}$/.test(value.id)) return false;
  switch (value.type) {
    case "cancel": return true;
    case "request": return "path" in value && typeof value.path === "string" && RPC_METHOD_PATH.test(value.path) && "headers" in value && headerPairs(value.headers);
    case "response": return "status" in value && Number.isInteger(value.status) && Number(value.status) >= 200 && Number(value.status) <= 599 && "headers" in value && headerPairs(value.headers);
    default: return false;
  }
}

export function encodeRpcFrame(header: RpcFrameHeader, body: Uint8Array = new Uint8Array()): Uint8Array {
  const json = new TextEncoder().encode(JSON.stringify(header));
  if (json.byteLength > MAX_HEADER_BYTES || body.byteLength > MAX_BODY_BYTES) throw new Error("RPC frame exceeds its size limit");
  const bytes = new Uint8Array(4 + json.byteLength + body.byteLength);
  new DataView(bytes.buffer).setUint32(0, json.byteLength);
  bytes.set(json, 4);
  bytes.set(body, 4 + json.byteLength);
  return bytes;
}

export function decodeRpcFrame(bytes: Uint8Array): { header: RpcFrameHeader; body: Uint8Array } {
  if (bytes.byteLength < 4 || bytes.byteLength > MAX_FRAME_BYTES) throw new Error("Invalid RPC frame length");
  const length = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(0);
  if (length > MAX_HEADER_BYTES || length > bytes.byteLength - 4 || bytes.byteLength - 4 - length > MAX_BODY_BYTES) throw new Error("Invalid RPC header length");
  const header: unknown = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes.subarray(4, 4 + length)));
  if (!isHeader(header)) throw new Error("Invalid RPC frame header");
  const body = bytes.subarray(4 + length);
  if (header.type === "cancel" && body.byteLength !== 0) throw new Error("Cancel frames cannot contain a body");
  return { header, body };
}
