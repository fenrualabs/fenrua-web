import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { spawn, spawnSync } from "node:child_process";
import { checkpointTransitionLua } from "../server/observation-continuity.js";

const image = process.env.FENRUA_REDIS_TEST_IMAGE || "redis:7-alpine";
const container = `fenrua-observation-continuity-${process.pid}-${randomBytes(4).toString("hex")}`;

function dockerSync(args, options = {}) {
  const result = spawnSync("docker", args, {
    encoding: "utf8",
    timeout: 120_000,
    ...options,
  });
  if (result.error || result.status !== 0) {
    throw new Error(
      [result.error?.message, result.stdout, result.stderr].filter(Boolean).join("\n") ||
        `docker ${args[0]} failed`
    );
  }
  return result.stdout.trim();
}

function transitionArguments(key, candidate, rotation = null) {
  return [
    "exec",
    "-i",
    container,
    "redis-cli",
    "--raw",
    "--eval",
    "/dev/stdin",
    key,
    ",",
    JSON.stringify(candidate),
    rotation ? JSON.stringify(rotation) : "",
  ];
}

function evaluate(key, candidate, rotation = null) {
  return dockerSync(transitionArguments(key, candidate, rotation), {
    input: checkpointTransitionLua,
  }).split(/\r?\n/);
}

function evaluateAsync(key, candidate, rotation = null) {
  return new Promise((resolve, reject) => {
    const child = spawn("docker", transitionArguments(key, candidate, rotation), {
      stdio: ["pipe", "pipe", "pipe"],
    });
    const stdout = [];
    const stderr = [];
    child.stdout.on("data", (chunk) => stdout.push(chunk));
    child.stderr.on("data", (chunk) => stderr.push(chunk));
    child.on("error", reject);
    child.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(Buffer.concat(stderr).toString("utf8") || `docker exec exited ${code}`));
        return;
      }
      resolve(Buffer.concat(stdout).toString("utf8").trim().split(/\r?\n/));
    });
    child.stdin.end(checkpointTransitionLua);
  });
}

function candidate(overrides = {}) {
  return {
    version: 1,
    chain: "978",
    key_id: "observation-v1",
    key_sha256: "1".repeat(64),
    sequence: 10,
    observed_at_ms: 1_784_000_000_000,
    last_confirmed_block: 500,
    payload_sha256: "a".repeat(64),
    bootstrap_allowed: true,
    ...overrides,
  };
}

try {
  dockerSync(["run", "--detach", "--rm", "--name", container, image]);
  let ready = false;
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const ping = spawnSync("docker", ["exec", container, "redis-cli", "PING"], {
      encoding: "utf8",
      timeout: 2_000,
    });
    if (ping.status === 0 && ping.stdout.trim() === "PONG") {
      ready = true;
      break;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  assert.equal(ready, true, "Ephemeral Redis did not become ready.");

  const primaryKey = "fenrua:test:observation:978";
  assert.deepEqual(evaluate(primaryKey, candidate()), ["accepted", "initialized"]);
  const initialized = JSON.parse(
    dockerSync(["exec", container, "redis-cli", "--raw", "GET", primaryKey])
  );
  assert.equal(Object.hasOwn(initialized, "bootstrap_allowed"), false);
  assert.equal(initialized.sequence, 10);

  assert.deepEqual(
    evaluate(primaryKey, candidate({ payload_sha256: "b".repeat(64) })),
    ["rejected", "equivocation"]
  );
  assert.deepEqual(
    evaluate(primaryKey, candidate({
      sequence: 11,
      observed_at_ms: 1_784_000_001_000,
      last_confirmed_block: null,
      payload_sha256: "c".repeat(64),
      bootstrap_allowed: false,
    })),
    ["accepted", "advanced"]
  );
  assert.deepEqual(
    evaluate(primaryKey, candidate({ sequence: 10 })),
    ["rejected", "sequence-rollback"]
  );

  const concurrentCandidates = ["d", "e"].map((digest, index) =>
    candidate({
      sequence: 12,
      observed_at_ms: 1_784_000_002_000,
      last_confirmed_block: 501 + index,
      payload_sha256: digest.repeat(64),
      bootstrap_allowed: false,
    })
  );
  const concurrent = await Promise.all(
    concurrentCandidates.map((record) => evaluateAsync(primaryKey, record))
  );
  assert.equal(concurrent.filter(([decision]) => decision === "accepted").length, 1);
  assert.deepEqual(
    concurrent.find(([decision]) => decision === "rejected"),
    ["rejected", "equivocation"]
  );

  const rotationKey = "fenrua:test:observation:rotation:978";
  assert.deepEqual(evaluate(rotationKey, candidate()), ["accepted", "initialized"]);
  const rotation = {
    certificate_sha256: "9".repeat(64),
    from_key_id: "observation-v1",
    from_key_sha256: "1".repeat(64),
    from_payload_sha256: "a".repeat(64),
    from_sequence: 10,
    to_key_id: "observation-v2",
    to_key_sha256: "2".repeat(64),
  };
  assert.deepEqual(
    evaluate(
      rotationKey,
      candidate({
        key_id: "observation-v2",
        key_sha256: "2".repeat(64),
        sequence: 11,
        observed_at_ms: 1_784_000_001_000,
        last_confirmed_block: 501,
        payload_sha256: "f".repeat(64),
        bootstrap_allowed: false,
      }),
      rotation
    ),
    ["accepted", "rotated"]
  );
  assert.deepEqual(
    evaluate(
      rotationKey,
      candidate({
        sequence: 12,
        observed_at_ms: 1_784_000_002_000,
        last_confirmed_block: 502,
        payload_sha256: "8".repeat(64),
        bootstrap_allowed: false,
      }),
      {
        certificate_sha256: "7".repeat(64),
        from_key_id: "observation-v2",
        from_key_sha256: "2".repeat(64),
        from_payload_sha256: "f".repeat(64),
        from_sequence: 11,
        to_key_id: "observation-v1",
        to_key_sha256: "1".repeat(64),
      }
    ),
    ["rejected", "retired-key-reuse"]
  );

  console.log(
    JSON.stringify({
      status: "ok",
      scope: "real-redis-observation-continuity",
      image,
      cases: 8,
      atomicConcurrency: true,
      authenticatedRotation: true,
    })
  );
} finally {
  spawnSync("docker", ["rm", "--force", container], {
    encoding: "utf8",
    timeout: 30_000,
  });
}
