import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const registerPath = path.join(root, "data", "public-document-register.json");
const evidencePath = path.join(root, "data", "site-evidence.json");
const checkMode = process.argv.includes("--check");
const register = JSON.parse(readFileSync(registerPath, "utf8"));
const evidence = JSON.parse(readFileSync(evidencePath, "utf8"));
const digestPattern = /^[a-f0-9]{64}$/;

if (!Array.isArray(register.records)) throw new Error("Public document register must contain records.");
if (typeof evidence.generatedAt !== "string" || !Number.isFinite(Date.parse(evidence.generatedAt))) {
  throw new Error("Site evidence must contain a valid generatedAt timestamp.");
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function resolvePublicPath(relativePath) {
  if (typeof relativePath !== "string" || relativePath.startsWith("/") || relativePath.includes("..")) {
    throw new Error(`Unsafe public document path: ${relativePath}`);
  }
  const resolved = path.resolve(root, relativePath);
  if (!resolved.startsWith(`${root}${path.sep}`)) throw new Error(`Public document escapes repository root: ${relativePath}`);
  return resolved;
}

let changed = false;
for (const record of register.records) {
  if (record.contentSha256) {
    if (record.status === "active") record.artifactSha256 ??= record.contentSha256;
    else record.originalContentSha256 ??= record.contentSha256;
    delete record.contentSha256;
    changed = true;
  }

  const file = resolvePublicPath(record.path);
  if (!existsSync(file)) throw new Error(`Registered public document is missing: ${record.path}`);

  if (file === registerPath) {
    if (record.artifactSha256) throw new Error("The public document register cannot hash itself without a circular record.");
    record.hashBinding = "self-excluded from artifact digest to avoid a circular hash";
    continue;
  }

  const bytes = readFileSync(file);
  const actual = sha256(bytes);
  if (record.artifactSha256 !== actual) {
    if (checkMode) throw new Error(`Registered artifact hash is stale: ${record.path}`);
    record.artifactSha256 = actual;
    changed = true;
  }

  if (record.originalContentSha256) {
    if (!digestPattern.test(record.originalContentSha256)) throw new Error(`Invalid original content hash: ${record.id}`);
    if (!bytes.toString("utf8").includes(record.originalContentSha256)) {
      throw new Error(`Archive envelope does not bind its original content hash: ${record.path}`);
    }
  }
}

if (register.artifactsVerifiedAt !== evidence.generatedAt) {
  if (checkMode) throw new Error("Public document register verification timestamp is stale.");
  register.artifactsVerifiedAt = evidence.generatedAt;
  changed = true;
}

if (!checkMode && changed) writeFileSync(registerPath, `${JSON.stringify(register, null, 2)}\n`);
console.log(JSON.stringify({ status: "ok", mode: checkMode ? "check" : "write", records: register.records.length }));
