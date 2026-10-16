import { spawn } from "node:child_process";
import { dirname, resolve } from "node:path";
import { loadEnvFile } from "node:process";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

try {
  loadEnvFile(resolve(repoRoot, ".env"));
} catch (error) {
  if (error?.code !== "ENOENT") throw error;
}

const api = spawn("go", ["-C", "apps/api", "run", "./cmd/api"], {
  cwd: repoRoot,
  env: process.env,
  stdio: "inherit",
});

api.on("error", (error) => {
  console.error(`Unable to start API: ${error.message}`);
  process.exitCode = 1;
});

api.on("close", (code) => {
  process.exitCode = code ?? 1;
});
