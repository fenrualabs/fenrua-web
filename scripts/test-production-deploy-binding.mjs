import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const packageJson = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8"));
const vercel = JSON.parse(readFileSync(resolve(root, "vercel.json"), "utf8"));
const deploymentNotes = readFileSync(resolve(root, "docs/VERCEL.md"), "utf8");

assert.equal(packageJson.devDependencies?.vercel, undefined, "The vulnerable Vercel CLI tree must not be installed in this repository.");
assert.equal(packageJson.scripts?.["release:production-check"], "node scripts/require-node24.mjs && node scripts/require-main-branch.mjs && npm run release:check");
assert.equal(vercel.buildCommand, "npm run build:release");
assert.equal(vercel.outputDirectory, "public");
assert.match(deploymentNotes, /Vercel Git integration/i);
assert.match(deploymentNotes, /VERCEL_GIT_COMMIT_SHA/);
assert.doesNotMatch(deploymentNotes, /deploy:production:node24|locked `vercel` CLI/i);

console.log(JSON.stringify({ status: "ok", scope: "production-git-deployment-binding" }));
