import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  readKernelFile,
  sourceByteLimits,
  sourcePaths,
} from "./sync-kernel-status.mjs";

const temporaryDirectory = await mkdtemp(path.join(os.tmpdir(), "fenrua-kernel-sync-filesystem-"));
const kernelDirectory = path.join(temporaryDirectory, "kernel");
const outsideFile = path.join(temporaryDirectory, "outside.md");
const outsideTree = path.join(temporaryDirectory, "outside-tree");
const allowlistedPath = sourcePaths.auditLog;
const sourceFile = path.join(kernelDirectory, allowlistedPath);

try {
  await mkdir(kernelDirectory, { recursive: true });

  const regularPayload = Buffer.from("# Security Audit Log\n", "utf8");
  await writeFile(sourceFile, regularPayload);
  const accepted = await readKernelFile(kernelDirectory, allowlistedPath);
  assert.equal(accepted.bytes, regularPayload.length, "A bounded allowlisted regular file must be accepted.");
  assert.deepEqual(accepted.payload, regularPayload, "The accepted payload must be read without mutation.");
  assert.match(accepted.sha256, /^[a-f0-9]{64}$/, "The accepted file must receive a lowercase SHA-256 digest.");

  await rm(sourceFile);
  await writeFile(outsideFile, regularPayload);
  await symlink(outsideFile, sourceFile);
  await assert.rejects(
    readKernelFile(kernelDirectory, allowlistedPath),
    /symbolic links are not accepted/,
    "A symlink at an allowlisted path must be rejected."
  );

  await assert.rejects(
    readKernelFile(kernelDirectory, "../outside.md"),
    /unsafe source path/,
    "A lexical path that escapes the kernel checkout must be rejected."
  );

  await rm(sourceFile);
  const escapedManifest = path.join(outsideTree, "genesis/reports/manifest.json");
  await mkdir(path.dirname(escapedManifest), { recursive: true });
  await writeFile(escapedManifest, Buffer.from("{}\n", "utf8"));
  await symlink(outsideTree, path.join(kernelDirectory, "tests"));
  await assert.rejects(
    readKernelFile(kernelDirectory, sourcePaths.manifest),
    /source resolves outside kernel checkout/,
    "A regular file reached through a symlinked parent directory must be rejected as a realpath escape."
  );
  await rm(path.join(kernelDirectory, "tests"));

  const byteLimit = sourceByteLimits[allowlistedPath];
  assert.ok(Number.isSafeInteger(byteLimit) && byteLimit > 0, "The test fixture must use an explicit source byte limit.");
  await writeFile(sourceFile, Buffer.alloc(byteLimit + 1, 0x61));
  await assert.rejects(
    readKernelFile(kernelDirectory, allowlistedPath),
    new RegExp(`source exceeds ${byteLimit} bytes`),
    "An oversized file at an allowlisted path must be rejected."
  );

  console.log(
    JSON.stringify({
      status: "ok",
      scope: "kernel-sync-filesystem-boundary",
      cases: 5,
    })
  );
} finally {
  await rm(temporaryDirectory, { force: true, recursive: true });
}
