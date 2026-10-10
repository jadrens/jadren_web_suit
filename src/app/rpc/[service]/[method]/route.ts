import { rpcHandlerFor } from "@lib/rpc/server/router";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function handle(request: Request, context: { params: Promise<{ service: string; method: string }> }) {
  const { service, method } = await context.params;
  const handler = rpcHandlerFor(`/${service}/${method}`);
  if (!handler) return Response.json({ code: "unimplemented", message: "Unknown RPC" }, { status: 404 });
  return handler(request);
}

// Connect uses POST for every RPC and GET for side-effect-free ones.
export { handle as GET, handle as POST };
