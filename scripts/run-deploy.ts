import { readdir } from "node:fs/promises";
import path from "node:path";

const deployDirectory = path.join(import.meta.dir, "deploy");
const supportedExtensions = new Set([".ts", ".js", ".sh"]);
const scripts = (await readdir(deployDirectory, { withFileTypes: true }))
  .filter((entry) => entry.isFile() && supportedExtensions.has(path.extname(entry.name)))
  .map((entry) => entry.name)
  .sort((left, right) => left.localeCompare(right));

if (scripts.length === 0) {
  console.info("No deployment scripts to run.");
}

for (const script of scripts) {
  const scriptPath = path.join(deployDirectory, script);
  const command = script.endsWith(".sh")
    ? ["bash", scriptPath]
    : ["bun", scriptPath];
  console.info(`Running deployment script: ${script}`);
  const process = Bun.spawn(command, {
    cwd: path.resolve(import.meta.dir, ".."),
    env: Bun.env,
    stdin: "inherit",
    stdout: "inherit",
    stderr: "inherit",
  });
  const exitCode = await process.exited;
  if (exitCode !== 0) {
    throw new Error(`Deployment script ${script} exited with code ${exitCode}`);
  }
}
