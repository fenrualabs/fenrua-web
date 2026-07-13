import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const result = spawnSync(process.execPath, ["scripts/deploy-production.mjs"], {
  cwd: root,
  encoding: "utf8",
  env: { ...process.env, FENRUA_DEPLOY_DRY_RUN: "1" },
});

assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
const record = JSON.parse(result.stdout);
assert.match(record.sourceCommit, /^[0-9a-f]{40}$/);
assert.ok(
  record.args.includes(`VERCEL_GIT_COMMIT_SHA=${record.sourceCommit}`),
  "The production deployment must pass the exact approved source commit to the Vercel build.",
);
console.log(JSON.stringify({ status: "ok", scope: "production-deployment-source-commit-binding" }));
