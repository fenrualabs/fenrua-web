import { execFileSync, spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const commitPattern = /^[0-9a-f]{40}$/;

function sourceCommit() {
  const supplied = (process.env.VERCEL_GIT_COMMIT_SHA || "").trim().toLowerCase();
  let checkout = "";
  try {
    checkout = execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim().toLowerCase();
  } catch {
    if (!supplied) throw new Error("Production deployment requires a Git checkout or VERCEL_GIT_COMMIT_SHA.");
  }

  if (supplied && checkout && supplied !== checkout) {
    throw new Error("VERCEL_GIT_COMMIT_SHA does not match the checked-out source commit.");
  }
  const resolved = supplied || checkout;
  if (!commitPattern.test(resolved)) throw new Error("Production deployment requires a 40-character source commit.");
  return resolved;
}

const commit = sourceCommit();
const args = [
  "exec",
  "--no",
  "--",
  "vercel",
  "deploy",
  "--prod",
  "--yes",
  "--project",
  "fenrua-web",
  "--build-env",
  `VERCEL_GIT_COMMIT_SHA=${commit}`,
];

if (process.env.FENRUA_DEPLOY_DRY_RUN === "1") {
  console.log(JSON.stringify({ command: process.platform === "win32" ? "npm.cmd" : "npm", args, sourceCommit: commit }));
} else {
  const result = spawnSync(process.platform === "win32" ? "npm.cmd" : "npm", args, {
    cwd: root,
    env: process.env,
    stdio: "inherit",
  });
  if (result.error) throw result.error;
  process.exitCode = result.status ?? 1;
}
