import { createServer } from "node:http";
import next from "next";
import { attachRpcWebSocket } from "../src/lib/rpc/server/websocket";
import { RPC_WEBSOCKET_PATH } from "../src/lib/rpc/websocket-protocol";

const args = process.argv.slice(2).filter((arg) => arg !== "--");
function argument(short: string, long: string) {
  const index = args.findIndex((arg) => arg === short || arg === long);
  return index < 0 ? undefined : args[index + 1];
}
const dev = process.env.NODE_ENV !== "production";
const port = Number(argument("-p", "--port") ?? process.env.PORT ?? 3000);
const hostname = argument("-H", "--hostname") ?? process.env.HOSTNAME_BIND ?? "0.0.0.0";
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("Invalid port");

const app = next({ dev, hostname, port, webpack: args.includes("--webpack"), turbopack: args.includes("--turbopack") });
const handle = app.getRequestHandler();
await app.prepare();
const server = createServer((request, response) => {
  if (request.url?.split("?")[0] === RPC_WEBSOCKET_PATH) {
    response.writeHead(426, { "Content-Type": "text/plain", Upgrade: "websocket" });
    response.end("WebSocket upgrade required");
    return;
  }
  void handle(request, response).catch((error: unknown) => {
    console.error(error);
    if (!response.headersSent) response.writeHead(500);
    response.end();
  });
});
const closeWebSockets = attachRpcWebSocket(server, {
  upstreamOrigin: () => {
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("HTTP listener unavailable");
    const host = address.address === "0.0.0.0" ? "127.0.0.1" : address.address === "::" ? "::1" : address.address;
    return `http://${host.includes(":") ? `[${host}]` : host}:${address.port}`;
  },
});
// getRequestHandler() installs Next's HMR upgrade listener on its first HTTP
// request. Do not install a second one: both would try to upgrade the same socket.
server.listen(port, hostname, () => console.info(`> Ready on http://${hostname}:${port} (${dev ? "development" : "production"}, RPC over WebSocket)`));

let stopping = false;
function shutdown() {
  if (stopping) return;
  stopping = true;
  closeWebSockets();
  // Close Next/HMR concurrently: waiting for the HTTP listener first can leave
  // upgraded or idle keepalive connections preventing its callback forever.
  const closed = new Promise<void>((resolve) => server.close(() => resolve()));
  server.closeIdleConnections();
  void Promise.all([closed, app.close()]).then(() => process.exit(0)).catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  });
  setTimeout(() => { server.closeAllConnections(); process.exit(0); }, 10_000).unref();
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
