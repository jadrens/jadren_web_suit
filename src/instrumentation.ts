export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const { prepareDatabases } = await import("./lib/database/startup");
  await prepareDatabases();
}
