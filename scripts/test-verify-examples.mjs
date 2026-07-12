import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";

const requiredResults = [
  "PASS",
  "PASS_WITH_LIMITATIONS",
  "INCOMPLETE",
  "STALE",
  "POLICY_VIOLATION",
  "INTEGRITY_MISMATCH",
  "SIGNATURE_INVALID",
  "RUNTIME_UNVERIFIED",
  "REVOKED",
  "FAIL_CLOSED",
  "UNSUPPORTED_SCHEMA",
  "ERROR",
];

const dir = new URL("../examples/verification-results/", import.meta.url);
const files = (await readdir(dir)).filter((file) => file.endsWith(".json"));
const seen = new Set();

for (const file of files) {
  const fixture = JSON.parse(await readFile(new URL(file, dir), "utf8"));
  assert.equal(fixture.schema, "fenrua.verification-result.v1", `${file} has wrong schema`);
  assert.ok(requiredResults.includes(fixture.result), `${file} result is not recognized`);
  assert.equal(typeof fixture.inputFixture, "string", `${file} must identify input fixture`);
  assert.equal(typeof fixture.trigger, "string", `${file} must identify trigger`);
  assert.ok(Array.isArray(fixture.evidenceSupplied), `${file} must list supplied evidence`);
  assert.ok(Array.isArray(fixture.evidenceAbsent), `${file} must list absent evidence`);
  assert.equal(typeof fixture.safetyConsequence, "string", `${file} must state safety consequence`);
  assert.equal(typeof fixture.continueExecution, "boolean", `${file} must state execution decision`);
  assert.equal(typeof fixture.humanReviewRequired, "boolean", `${file} must state review decision`);
  seen.add(fixture.result);
}

assert.deepEqual([...seen].sort(), [...requiredResults].sort());

console.log(JSON.stringify({ status: "ok", scope: "verify-result-corpus", results: seen.size }));
