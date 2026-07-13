import { createHash, createPublicKey, verify as verifySignature } from "node:crypto";

const checkpointSchemaVersion = 1;
const checkpointTimeoutMs = 2_500;
const maxCheckpointResponseBytes = 2_048;
const maxRotationCertificateBytes = 4_096;
const keyIdPattern = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;
const namespacePattern = /^[A-Za-z0-9][A-Za-z0-9:._-]{0,127}$/;
const sha256Pattern = /^[a-f0-9]{64}$/;
const signaturePattern = /^[A-Za-z0-9_-]{86}$/;
const publicKeyPattern = /^(?:[A-Za-z0-9_-]{43,512}|[A-Za-z0-9+/]{40,512}={0,2})$/;
const isoUtcPattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/;
const ed25519SpkiPrefix = Buffer.from("302a300506032b6570032100", "hex");
const rotationPurpose = "fenrua-observation-key-rotation";
const rotationFields = [
  "chain",
  "from_key_id",
  "from_payload_sha256",
  "from_public_key_b64",
  "from_sequence",
  "issued_at",
  "purpose",
  "signature",
  "to_key_id",
  "to_public_key_b64",
  "version",
];
const transitionSuccessReasons = new Set(["initialized", "idempotent", "advanced", "rotated"]);

export const checkpointTransitionLua = String.raw`
local candidate = cjson.decode(ARGV[1])
local rotation = nil
if ARGV[2] ~= "" then
  rotation = cjson.decode(ARGV[2])
end

local function reject(reason)
  return {"rejected", reason}
end

local function valid_digest(value)
  return type(value) == "string" and string.len(value) == 64 and string.match(value, "^[0-9a-f]+$") ~= nil
end

local function valid_key_id(value)
  return type(value) == "string"
    and string.len(value) >= 1
    and string.len(value) <= 64
    and string.match(value, "^[A-Za-z0-9][A-Za-z0-9._-]*$") ~= nil
end

local function valid_nonnegative_integer(value)
  return type(value) == "number" and value >= 0 and value <= 9007199254740991 and math.floor(value) == value
end

local function valid_positive_integer(value)
  return valid_nonnegative_integer(value) and value >= 1
end

local function valid_seen_keys(value)
  if type(value) ~= "table" or #value < 1 then
    return false
  end
  for _, fingerprint in ipairs(value) do
    if not valid_digest(fingerprint) then
      return false
    end
  end
  return true
end

local function valid_checkpoint(value)
  return type(value) == "table"
    and value.version == 1
    and type(value.chain) == "string"
    and valid_key_id(value.key_id)
    and valid_digest(value.key_sha256)
    and valid_positive_integer(value.sequence)
    and valid_nonnegative_integer(value.observed_at_ms)
    and (value.last_confirmed_block == cjson.null or valid_nonnegative_integer(value.last_confirmed_block))
    and valid_digest(value.payload_sha256)
end

local function valid_candidate(value)
  return valid_checkpoint(value) and type(value.bootstrap_allowed) == "boolean"
end

local function valid_stored_checkpoint(value)
  return valid_checkpoint(value)
    and valid_seen_keys(value.seen_key_sha256)
    and (value.last_rotation_sha256 == cjson.null or valid_digest(value.last_rotation_sha256))
end

if not valid_candidate(candidate) then
  return reject("candidate-schema")
end

local current_raw = redis.call("GET", KEYS[1])
if not current_raw then
  if candidate.bootstrap_allowed ~= true then
    return reject("bootstrap-not-confirmed")
  end
  if rotation ~= nil then
    return reject("rotation-bootstrap")
  end
  candidate.bootstrap_allowed = nil
  candidate.seen_key_sha256 = {candidate.key_sha256}
  candidate.last_rotation_sha256 = cjson.null
  redis.call("SET", KEYS[1], cjson.encode(candidate))
  return {"accepted", "initialized"}
end

local ok, previous = pcall(cjson.decode, current_raw)
if not ok or not valid_stored_checkpoint(previous) then
  return reject("checkpoint-schema")
end
if previous.chain ~= candidate.chain then
  return reject("chain-mismatch")
end

local function carries_monotonic_state()
  if candidate.observed_at_ms < previous.observed_at_ms then
    return false, "time-rollback"
  end
  if previous.last_confirmed_block ~= cjson.null
    and candidate.last_confirmed_block ~= cjson.null
    and candidate.last_confirmed_block < previous.last_confirmed_block then
    return false, "block-rollback"
  end
  return true, nil
end

if candidate.key_id == previous.key_id then
  if candidate.key_sha256 ~= previous.key_sha256 then
    return reject("key-material-change")
  end
  if rotation ~= nil then
    if previous.last_rotation_sha256 == cjson.null
      or previous.last_rotation_sha256 ~= rotation.certificate_sha256
      or rotation.to_key_id ~= candidate.key_id
      or rotation.to_key_sha256 ~= candidate.key_sha256 then
      return reject("rotation-anchor")
    end
  end
  if candidate.sequence < previous.sequence then
    return reject("sequence-rollback")
  end
  if candidate.sequence == previous.sequence then
    if candidate.payload_sha256 ~= previous.payload_sha256 then
      return reject("equivocation")
    end
    return {"accepted", "idempotent"}
  end

  local monotonic, reason = carries_monotonic_state()
  if not monotonic then
    return reject(reason)
  end
  if candidate.last_confirmed_block == cjson.null then
    candidate.last_confirmed_block = previous.last_confirmed_block
  end
  candidate.bootstrap_allowed = nil
  candidate.seen_key_sha256 = previous.seen_key_sha256
  candidate.last_rotation_sha256 = previous.last_rotation_sha256
  redis.call("SET", KEYS[1], cjson.encode(candidate))
  return {"accepted", "advanced"}
end

if rotation == nil then
  return reject("unannounced-key-change")
end
if rotation.from_key_id ~= previous.key_id
  or rotation.from_key_sha256 ~= previous.key_sha256
  or rotation.from_sequence ~= previous.sequence
  or rotation.from_payload_sha256 ~= previous.payload_sha256
  or rotation.to_key_id ~= candidate.key_id
  or rotation.to_key_sha256 ~= candidate.key_sha256 then
  return reject("rotation-anchor")
end
if candidate.sequence <= previous.sequence then
  return reject("rotation-sequence")
end
for _, fingerprint in ipairs(previous.seen_key_sha256) do
  if fingerprint == candidate.key_sha256 then
    return reject("retired-key-reuse")
  end
end

local monotonic, reason = carries_monotonic_state()
if not monotonic then
  return reject(reason)
end
if candidate.last_confirmed_block == cjson.null then
  candidate.last_confirmed_block = previous.last_confirmed_block
end
candidate.bootstrap_allowed = nil
candidate.seen_key_sha256 = previous.seen_key_sha256
table.insert(candidate.seen_key_sha256, candidate.key_sha256)
candidate.last_rotation_sha256 = rotation.certificate_sha256
redis.call("SET", KEYS[1], cjson.encode(candidate))
return {"accepted", "rotated"}
`;

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isPositiveSafeInteger(value) {
  return Number.isSafeInteger(value) && value >= 1;
}

function isNonNegativeSafeInteger(value) {
  return Number.isSafeInteger(value) && value >= 0;
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function readHttpsUrl(value) {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash) return null;
    return url.toString().replace(/\/$/, "");
  } catch {
    return null;
  }
}

function normalizeEd25519PublicKey(encoded) {
  if (typeof encoded !== "string" || !publicKeyPattern.test(encoded)) return null;

  try {
    const bytes = Buffer.from(encoded, "base64url");
    const der = bytes.length === 32 ? Buffer.concat([ed25519SpkiPrefix, bytes]) : bytes;
    const key = createPublicKey({ key: der, format: "der", type: "spki" });
    if (key.asymmetricKeyType !== "ed25519") return null;
    const canonicalDer = key.export({ type: "spki", format: "der" });
    return {
      key,
      canonical: canonicalDer.toString("base64url"),
      sha256: sha256(canonicalDer),
    };
  } catch {
    return null;
  }
}

function canonicalRotationPayload(certificate) {
  return JSON.stringify({
    chain: certificate.chain,
    from_key_id: certificate.from_key_id,
    from_payload_sha256: certificate.from_payload_sha256,
    from_public_key_b64: certificate.from_public_key_b64,
    from_sequence: certificate.from_sequence,
    issued_at: certificate.issued_at,
    purpose: certificate.purpose,
    to_key_id: certificate.to_key_id,
    to_public_key_b64: certificate.to_public_key_b64,
    version: certificate.version,
  });
}

function canonicalRotationCertificate(certificate) {
  return JSON.stringify({
    chain: certificate.chain,
    from_key_id: certificate.from_key_id,
    from_payload_sha256: certificate.from_payload_sha256,
    from_public_key_b64: certificate.from_public_key_b64,
    from_sequence: certificate.from_sequence,
    issued_at: certificate.issued_at,
    purpose: certificate.purpose,
    signature: certificate.signature,
    to_key_id: certificate.to_key_id,
    to_public_key_b64: certificate.to_public_key_b64,
    version: certificate.version,
  });
}

export function verifyRotationCertificate({ encodedCertificate, target, observation, currentPublicKey }) {
  if (!encodedCertificate) return { state: "absent", rotation: null };
  if (
    typeof encodedCertificate !== "string" ||
    encodedCertificate.length > Math.ceil((maxRotationCertificateBytes * 4) / 3) + 8 ||
    !/^[A-Za-z0-9_-]+$/.test(encodedCertificate)
  ) {
    return { state: "invalid", rotation: null };
  }

  let certificate;
  try {
    const bytes = Buffer.from(encodedCertificate, "base64url");
    if (
      bytes.length === 0 ||
      bytes.length > maxRotationCertificateBytes ||
      bytes.toString("base64url") !== encodedCertificate
    ) {
      return { state: "invalid", rotation: null };
    }
    certificate = JSON.parse(bytes.toString("utf8"));
  } catch {
    return { state: "invalid", rotation: null };
  }

  if (!isPlainObject(certificate)) return { state: "invalid", rotation: null };
  const fields = Object.keys(certificate).sort();
  if (fields.length !== rotationFields.length || fields.some((field, index) => field !== rotationFields[index])) {
    return { state: "invalid", rotation: null };
  }
  if (
    certificate.version !== 1 ||
    certificate.purpose !== rotationPurpose ||
    certificate.chain !== target.chain ||
    certificate.to_key_id !== observation.key_id ||
    !keyIdPattern.test(certificate.from_key_id) ||
    !keyIdPattern.test(certificate.to_key_id) ||
    certificate.from_key_id === certificate.to_key_id ||
    !isPositiveSafeInteger(certificate.from_sequence) ||
    !sha256Pattern.test(certificate.from_payload_sha256) ||
    typeof certificate.issued_at !== "string" ||
    !isoUtcPattern.test(certificate.issued_at) ||
    !Number.isFinite(Date.parse(certificate.issued_at)) ||
    Date.parse(certificate.issued_at) > Date.now() + 30_000 ||
    !signaturePattern.test(certificate.signature) ||
    Buffer.from(certificate.signature, "base64url").toString("base64url") !== certificate.signature
  ) {
    return { state: "invalid", rotation: null };
  }

  const fromPublicKey = normalizeEd25519PublicKey(certificate.from_public_key_b64);
  const toPublicKey = normalizeEd25519PublicKey(certificate.to_public_key_b64);
  if (
    !fromPublicKey ||
    !toPublicKey ||
    fromPublicKey.sha256 === toPublicKey.sha256 ||
    toPublicKey.canonical !== currentPublicKey.canonical
  ) {
    return { state: "invalid", rotation: null };
  }

  try {
    const valid = verifySignature(
      null,
      Buffer.from(canonicalRotationPayload(certificate), "utf8"),
      fromPublicKey.key,
      Buffer.from(certificate.signature, "base64url")
    );
    if (!valid) return { state: "invalid", rotation: null };
  } catch {
    return { state: "invalid", rotation: null };
  }

  return {
    state: "valid",
    rotation: {
      certificate_sha256: sha256(canonicalRotationCertificate(certificate)),
      from_key_id: certificate.from_key_id,
      from_key_sha256: fromPublicKey.sha256,
      from_payload_sha256: certificate.from_payload_sha256,
      from_sequence: certificate.from_sequence,
      to_key_id: certificate.to_key_id,
      to_key_sha256: toPublicKey.sha256,
    },
  };
}

function readMode(environment) {
  const configured = environment.FENRUA_OBSERVATION_CHECKPOINT_MODE?.trim();
  const production = environment.VERCEL_ENV === "production";
  if (!configured) return { state: "valid", mode: production ? "required" : "optional" };
  if (configured !== "optional" && configured !== "required") return { state: "invalid", mode: null };
  if (production && configured !== "required") return { state: "invalid", mode: null };
  return { state: "valid", mode: configured };
}

function selectCredential(primary, compatibility) {
  const first = primary?.trim();
  const second = compatibility?.trim();
  if (first && second && first !== second) return { state: "conflict", value: null };
  return { state: "ok", value: first || second || "" };
}

function readStoreConfig(environment) {
  const url = selectCredential(
    environment.UPSTASH_REDIS_REST_URL,
    environment.KV_REST_API_URL
  );
  const token = selectCredential(
    environment.UPSTASH_REDIS_REST_TOKEN,
    environment.KV_REST_API_TOKEN
  );
  const namespace = environment.FENRUA_OBSERVATION_CHECKPOINT_NAMESPACE?.trim() || "";
  if (url.state !== "ok" || token.state !== "ok") return { state: "invalid" };

  const present = [Boolean(url.value), Boolean(token.value), Boolean(namespace)];
  if (present.every((value) => !value)) return { state: "missing" };
  if (!present.every(Boolean)) return { state: "invalid" };
  if (
    token.value.length < 16 ||
    token.value.length > 4_096 ||
    !namespacePattern.test(namespace)
  ) {
    return { state: "invalid" };
  }

  const endpoint = readHttpsUrl(url.value);
  if (!endpoint) return { state: "invalid" };
  return { state: "configured", endpoint, token: token.value, namespace };
}

function validateCheckpoint(value) {
  return (
    isPlainObject(value) &&
    value.version === checkpointSchemaVersion &&
    typeof value.chain === "string" &&
    keyIdPattern.test(value.key_id) &&
    sha256Pattern.test(value.key_sha256) &&
    isPositiveSafeInteger(value.sequence) &&
    isNonNegativeSafeInteger(value.observed_at_ms) &&
    (value.last_confirmed_block === null || isNonNegativeSafeInteger(value.last_confirmed_block)) &&
    sha256Pattern.test(value.payload_sha256) &&
    Array.isArray(value.seen_key_sha256) &&
    value.seen_key_sha256.length >= 1 &&
    value.seen_key_sha256.every((fingerprint) => sha256Pattern.test(fingerprint)) &&
    (value.last_rotation_sha256 === null || sha256Pattern.test(value.last_rotation_sha256))
  );
}

function validateCandidate(value) {
  return (
    isPlainObject(value) &&
    value.version === checkpointSchemaVersion &&
    typeof value.chain === "string" &&
    keyIdPattern.test(value.key_id) &&
    sha256Pattern.test(value.key_sha256) &&
    isPositiveSafeInteger(value.sequence) &&
    isNonNegativeSafeInteger(value.observed_at_ms) &&
    (value.last_confirmed_block === null || isNonNegativeSafeInteger(value.last_confirmed_block)) &&
    sha256Pattern.test(value.payload_sha256) &&
    typeof value.bootstrap_allowed === "boolean"
  );
}

function persistedCheckpoint(candidate, additionalState) {
  const { bootstrap_allowed: _bootstrapAllowed, ...checkpoint } = candidate;
  return { ...checkpoint, ...additionalState };
}

function monotonicFailure(previous, candidate) {
  if (candidate.observed_at_ms < previous.observed_at_ms) return "time-rollback";
  if (
    previous.last_confirmed_block !== null &&
    candidate.last_confirmed_block !== null &&
    candidate.last_confirmed_block < previous.last_confirmed_block
  ) {
    return "block-rollback";
  }
  return null;
}

export function evaluateCheckpointTransition(previous, candidate, rotation = null) {
  if (!validateCandidate(candidate)) {
    return { accepted: false, reason: "candidate-schema", next: previous };
  }

  if (previous === null) {
    if (!candidate.bootstrap_allowed) return { accepted: false, reason: "bootstrap-not-confirmed", next: null };
    if (rotation) return { accepted: false, reason: "rotation-bootstrap", next: null };
    return {
      accepted: true,
      reason: "initialized",
      next: persistedCheckpoint(candidate, {
        seen_key_sha256: [candidate.key_sha256],
        last_rotation_sha256: null,
      }),
    };
  }
  if (!validateCheckpoint(previous)) return { accepted: false, reason: "checkpoint-schema", next: previous };
  if (previous.chain !== candidate.chain) return { accepted: false, reason: "chain-mismatch", next: previous };

  if (candidate.key_id === previous.key_id) {
    if (candidate.key_sha256 !== previous.key_sha256) {
      return { accepted: false, reason: "key-material-change", next: previous };
    }
    if (
      rotation &&
      (
        previous.last_rotation_sha256 !== rotation.certificate_sha256 ||
        rotation.to_key_id !== candidate.key_id ||
        rotation.to_key_sha256 !== candidate.key_sha256
      )
    ) {
      return { accepted: false, reason: "rotation-anchor", next: previous };
    }
    if (candidate.sequence < previous.sequence) {
      return { accepted: false, reason: "sequence-rollback", next: previous };
    }
    if (candidate.sequence === previous.sequence) {
      return candidate.payload_sha256 === previous.payload_sha256
        ? { accepted: true, reason: "idempotent", next: previous }
        : { accepted: false, reason: "equivocation", next: previous };
    }

    const failure = monotonicFailure(previous, candidate);
    if (failure) return { accepted: false, reason: failure, next: previous };
    return {
      accepted: true,
      reason: "advanced",
      next: persistedCheckpoint(candidate, {
        last_confirmed_block: candidate.last_confirmed_block ?? previous.last_confirmed_block,
        seen_key_sha256: [...previous.seen_key_sha256],
        last_rotation_sha256: previous.last_rotation_sha256,
      }),
    };
  }

  if (!rotation) return { accepted: false, reason: "unannounced-key-change", next: previous };
  if (
    rotation.from_key_id !== previous.key_id ||
    rotation.from_key_sha256 !== previous.key_sha256 ||
    rotation.from_sequence !== previous.sequence ||
    rotation.from_payload_sha256 !== previous.payload_sha256 ||
    rotation.to_key_id !== candidate.key_id ||
    rotation.to_key_sha256 !== candidate.key_sha256
  ) {
    return { accepted: false, reason: "rotation-anchor", next: previous };
  }
  if (candidate.sequence <= previous.sequence) {
    return { accepted: false, reason: "rotation-sequence", next: previous };
  }
  if (previous.seen_key_sha256.includes(candidate.key_sha256)) {
    return { accepted: false, reason: "retired-key-reuse", next: previous };
  }

  const failure = monotonicFailure(previous, candidate);
  if (failure) return { accepted: false, reason: failure, next: previous };
  return {
    accepted: true,
    reason: "rotated",
    next: persistedCheckpoint(candidate, {
      last_confirmed_block: candidate.last_confirmed_block ?? previous.last_confirmed_block,
      seen_key_sha256: [...previous.seen_key_sha256, candidate.key_sha256],
      last_rotation_sha256: rotation.certificate_sha256,
    }),
  };
}

async function readBoundedResponse(response, controller) {
  const contentLength = response.headers?.get?.("content-length");
  if (contentLength && (!/^\d+$/.test(contentLength) || Number(contentLength) > maxCheckpointResponseBytes)) {
    controller.abort();
    try {
      await response.body?.cancel?.("Checkpoint response exceeded byte limit");
    } catch {
      // Aborting the response is the required fail-closed outcome.
    }
    return null;
  }

  const reader = response.body?.getReader?.();
  if (!reader) return null;
  const chunks = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!(value instanceof Uint8Array)) return null;
      total += value.byteLength;
      if (total > maxCheckpointResponseBytes) {
        controller.abort();
        try {
          await reader.cancel("Checkpoint response exceeded byte limit");
        } catch {
          // The abort may already have errored the stream.
        }
        return null;
      }
      chunks.push(Buffer.from(value));
    }
    return Buffer.concat(chunks, total).toString("utf8");
  } finally {
    reader.releaseLock?.();
  }
}

async function executeCheckpoint(config, target, candidate, rotation, fetchImpl) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), checkpointTimeoutMs);
  try {
    const response = await fetchImpl(config.endpoint, {
      method: "POST",
      headers: {
        accept: "application/json",
        authorization: `Bearer ${config.token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify([
        "EVAL",
        checkpointTransitionLua,
        1,
        `${config.namespace}:${target.chain}`,
        JSON.stringify(candidate),
        rotation ? JSON.stringify(rotation) : "",
      ]),
      cache: "no-store",
      redirect: "error",
      signal: controller.signal,
    });
    if (!response.ok) {
      controller.abort();
      try {
        await response.body?.cancel?.("Checkpoint store returned a non-success response");
      } catch {
        // The response is rejected regardless of cancellation state.
      }
      return { accepted: false, reason: "store-response" };
    }

    const text = await readBoundedResponse(response, controller);
    if (text === null) return { accepted: false, reason: "store-response" };
    const payload = JSON.parse(text);
    if (
      !isPlainObject(payload) ||
      Object.keys(payload).length !== 1 ||
      !Array.isArray(payload.result) ||
      payload.result.length !== 2
    ) {
      return { accepted: false, reason: "store-response" };
    }
    const [decision, reason] = payload.result;
    if (decision === "accepted" && transitionSuccessReasons.has(reason)) {
      return { accepted: true, reason };
    }
    if (decision === "rejected" && typeof reason === "string") {
      return { accepted: false, reason };
    }
    return { accepted: false, reason: "store-response" };
  } catch {
    return { accepted: false, reason: "store-unavailable" };
  } finally {
    clearTimeout(timeout);
  }
}

export async function enforceObservationContinuity({
  target,
  observation,
  canonicalPayload,
  freshnessSeconds,
  environment = process.env,
  fetchImpl = globalThis.fetch,
}) {
  if (!isPlainObject(observation) || !signaturePattern.test(observation.signature)) {
    return { accepted: false, reason: "signed-observation-required" };
  }

  const mode = readMode(environment);
  if (mode.state !== "valid") return { accepted: false, reason: "mode-invalid" };

  const store = readStoreConfig(environment);
  if (store.state === "missing") {
    return mode.mode === "optional"
      ? { accepted: true, reason: "optional-not-configured" }
      : { accepted: false, reason: "store-missing" };
  }
  if (store.state !== "configured") return { accepted: false, reason: "store-invalid" };
  if (typeof fetchImpl !== "function") return { accepted: false, reason: "store-unavailable" };

  const currentPublicKey = normalizeEd25519PublicKey(environment[target.env.publicKey]?.trim());
  if (!currentPublicKey) return { accepted: false, reason: "key-invalid" };
  const encodedCertificate = environment[target.env.rotationCertificate]?.trim() || "";
  const rotationResult = verifyRotationCertificate({
    encodedCertificate,
    target,
    observation,
    currentPublicKey,
  });
  if (rotationResult.state === "invalid") return { accepted: false, reason: "rotation-invalid" };

  const observedAtMs = Date.parse(observation.observed_at);
  if (!isNonNegativeSafeInteger(observedAtMs)) return { accepted: false, reason: "time-invalid" };
  const candidate = {
    version: checkpointSchemaVersion,
    chain: target.chain,
    key_id: observation.key_id,
    key_sha256: currentPublicKey.sha256,
    sequence: observation.sequence,
    observed_at_ms: observedAtMs,
    last_confirmed_block: observation.status === "confirmed" ? observation.observed_block : null,
    payload_sha256: sha256(Buffer.from(canonicalPayload, "utf8")),
    bootstrap_allowed:
      observation.status === "confirmed" &&
      observation.staleness_seconds <= freshnessSeconds &&
      rotationResult.state === "absent",
  };

  const decision = await executeCheckpoint(
    store,
    target,
    candidate,
    rotationResult.rotation,
    fetchImpl
  );
  if (!decision.accepted || rotationResult.state !== "valid") return decision;

  return {
    ...decision,
    keyRotation: {
      version: 1,
      certificate_sha256: rotationResult.rotation.certificate_sha256,
      from_key_id: rotationResult.rotation.from_key_id,
      from_payload_sha256: rotationResult.rotation.from_payload_sha256,
      from_sequence: rotationResult.rotation.from_sequence,
      to_key_id: rotationResult.rotation.to_key_id,
    },
  };
}

export const observationContinuityInternals = Object.freeze({
  canonicalRotationCertificate,
  canonicalRotationPayload,
  normalizeEd25519PublicKey,
  readMode,
  readStoreConfig,
  rotationPurpose,
});
