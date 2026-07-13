import { createHash } from "node:crypto";

export const RELEASE_MANIFEST_SCHEMA = "fenrua.web.release-evidence.v1";
export const RELEASE_MANIFEST_CANONICALIZATION = "sorted UTF-8 JSON object keys";
export const RELEASE_CANONICAL_ORIGIN = "https://fenrua.ai";
export const MAX_RELEASE_MANIFEST_BYTES = 1024 * 1024;
export const MAX_RELEASE_ARTIFACTS = 256;
export const MAX_RELEASE_DECLARED_BYTES = 64 * 1024 * 1024;
export const RELEASE_PUBLISHER = Object.freeze({
  legalName: "FENRUA LABS PTY LTD",
  abn: "62 700 182 663",
  acn: "700 182 663",
});

const commitPattern = /^[0-9a-f]{40}$/;
const sha256Pattern = /^[0-9a-f]{64}$/;

export function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

// The manifest only uses JSON primitives. Sorting object keys gives a stable
// UTF-8 representation for integrity checks without claiming a signature or
// runtime attestation.
export function canonicalJson(value) {
  if (value === null || typeof value === "boolean" || typeof value === "string") return JSON.stringify(value);
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new TypeError("Release manifest cannot contain a non-finite number.");
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map((item) => canonicalJson(item)).join(",")}]`;
  if (typeof value === "object") {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`)
      .join(",")}}`;
  }
  throw new TypeError(`Unsupported release manifest value: ${typeof value}`);
}

function assertPlainObject(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new TypeError(`${label} must be an object.`);
}

function assertExactKeys(value, expected, label) {
  assertPlainObject(value, label);
  const actual = Object.keys(value).sort();
  const required = [...expected].sort();
  if (actual.length !== required.length || actual.some((key, index) => key !== required[index])) {
    throw new TypeError(`${label} must contain exactly: ${required.join(", ")}.`);
  }
}

function assertNonemptyString(value, label) {
  if (typeof value !== "string" || value.trim() !== value || value.length === 0) {
    throw new TypeError(`${label} must be a nonempty, trimmed string.`);
  }
}

function normalizedCanonicalOrigin(value, label) {
  assertNonemptyString(value, label);
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    throw new TypeError(`${label} must be an absolute URL origin.`);
  }
  if (parsed.protocol !== "https:" || parsed.username || parsed.password || value !== parsed.origin) {
    throw new TypeError(`${label} must be a canonical HTTPS origin without credentials, path, query, or fragment.`);
  }
  return parsed.origin;
}

function assertNormalizedRoute(route, label) {
  assertNonemptyString(route, label);
  if (!route.startsWith("/") || route.includes("//") || route.includes("\\") || route.includes("?") || route.includes("#") || route.includes("%") || /[\u0000-\u001f\u007f]/u.test(route)) {
    throw new TypeError(`${label} must be an absolute same-origin path without query, fragment, or backslash.`);
  }
  const parsed = new URL(route, "https://release-route.invalid");
  if (parsed.origin !== "https://release-route.invalid" || parsed.pathname !== route || (route !== "/" && route.endsWith("/"))) {
    throw new TypeError(`${label} must be a normalized route without dot segments or a trailing slash.`);
  }
}

export function releaseArtifactAggregateSha256(artifacts) {
  return sha256(artifacts.map((item) => `${item.route}\0${item.bytes}\0${item.sha256}\n`).join(""));
}

export function verifyReleaseManifest(manifest, { expectedCanonicalOrigin = RELEASE_CANONICAL_ORIGIN } = {}) {
  assertExactKeys(manifest, ["record", "integrity"], "Manifest");
  assertExactKeys(manifest.record, ["schema", "release", "publicArtifactSet", "validation", "limitations"], "Manifest record");
  if (manifest.record.schema !== RELEASE_MANIFEST_SCHEMA) throw new TypeError("Unsupported release manifest schema.");

  const release = manifest.record.release;
  assertExactKeys(release, ["canonicalUrl", "project", "sourceCommit", "sourceEvidenceGeneratedAt", "publisher"], "Manifest release");
  const expectedOrigin = normalizedCanonicalOrigin(expectedCanonicalOrigin, "Expected canonical origin");
  if (normalizedCanonicalOrigin(release.canonicalUrl, "Manifest canonical URL") !== expectedOrigin) {
    throw new TypeError("Release manifest canonical URL does not match the expected origin.");
  }
  if (release.project !== "fenrua-web") throw new TypeError("Unsupported release manifest project.");
  if (typeof release.sourceCommit !== "string" || !commitPattern.test(release.sourceCommit)) {
    throw new TypeError("Release manifest source commit must be a full 40-character lowercase Git SHA.");
  }
  assertNonemptyString(release.sourceEvidenceGeneratedAt, "Release evidence timestamp");
  if (!Number.isFinite(Date.parse(release.sourceEvidenceGeneratedAt))) throw new TypeError("Release evidence timestamp must be valid.");
  assertExactKeys(release.publisher, ["legalName", "abn", "acn"], "Release publisher");
  for (const field of ["legalName", "abn", "acn"]) {
    if (release.publisher[field] !== RELEASE_PUBLISHER[field]) throw new TypeError(`Release publisher ${field} does not match the registered company identity.`);
  }

  const artifactSet = manifest.record.publicArtifactSet;
  assertExactKeys(artifactSet, ["algorithm", "aggregateSha256", "artifacts"], "Public artifact set");
  if (artifactSet.algorithm !== "sha256") throw new TypeError("Unsupported public artifact algorithm.");
  if (typeof artifactSet.aggregateSha256 !== "string" || !sha256Pattern.test(artifactSet.aggregateSha256)) {
    throw new TypeError("Public artifact aggregate must be a lowercase SHA-256 digest.");
  }
  if (!Array.isArray(artifactSet.artifacts) || artifactSet.artifacts.length === 0) {
    throw new TypeError("Release manifest must contain at least one public artifact.");
  }
  if (artifactSet.artifacts.length > MAX_RELEASE_ARTIFACTS) {
    throw new TypeError(`Release manifest exceeds the ${MAX_RELEASE_ARTIFACTS}-artifact verification limit.`);
  }
  let previousRoute = "";
  const routes = new Set();
  let declaredBytes = 0;
  for (const [index, artifact] of artifactSet.artifacts.entries()) {
    const label = `Public artifact ${index}`;
    assertExactKeys(artifact, ["route", "bytes", "sha256"], label);
    assertNormalizedRoute(artifact.route, `${label} route`);
    if (routes.has(artifact.route)) throw new TypeError(`Duplicate public artifact route: ${artifact.route}.`);
    if (previousRoute && previousRoute.localeCompare(artifact.route) >= 0) {
      throw new TypeError("Public artifact routes must be strictly sorted and unique.");
    }
    if (!Number.isSafeInteger(artifact.bytes) || artifact.bytes <= 0) throw new TypeError(`${label} bytes must be a positive safe integer.`);
    declaredBytes += artifact.bytes;
    if (!Number.isSafeInteger(declaredBytes) || declaredBytes > MAX_RELEASE_DECLARED_BYTES) {
      throw new TypeError(`Release manifest exceeds the ${MAX_RELEASE_DECLARED_BYTES}-byte aggregate verification limit.`);
    }
    if (typeof artifact.sha256 !== "string" || !sha256Pattern.test(artifact.sha256)) {
      throw new TypeError(`${label} sha256 must be a lowercase SHA-256 digest.`);
    }
    routes.add(artifact.route);
    previousRoute = artifact.route;
  }
  if (releaseArtifactAggregateSha256(artifactSet.artifacts) !== artifactSet.aggregateSha256) {
    throw new TypeError("Public artifact aggregate hash does not match its artifact records.");
  }

  assertExactKeys(manifest.record.validation, ["requiredCommand", "scope"], "Manifest validation");
  assertNonemptyString(manifest.record.validation.requiredCommand, "Manifest validation command");
  assertNonemptyString(manifest.record.validation.scope, "Manifest validation scope");
  if (!Array.isArray(manifest.record.limitations) || manifest.record.limitations.length === 0) {
    throw new TypeError("Manifest limitations must be a nonempty array.");
  }
  for (const [index, limitation] of manifest.record.limitations.entries()) {
    assertNonemptyString(limitation, `Manifest limitation ${index}`);
  }

  assertExactKeys(manifest.integrity, ["algorithm", "canonicalization", "recordSha256"], "Manifest integrity");
  if (manifest.integrity.algorithm !== "sha256") throw new TypeError("Unsupported release manifest integrity algorithm.");
  if (manifest.integrity.canonicalization !== RELEASE_MANIFEST_CANONICALIZATION) {
    throw new TypeError("Unsupported release manifest canonicalization.");
  }
  if (typeof manifest.integrity.recordSha256 !== "string" || !sha256Pattern.test(manifest.integrity.recordSha256)) {
    throw new TypeError("Release manifest record hash must be a lowercase SHA-256 digest.");
  }
  const expected = sha256(canonicalJson(manifest.record));
  if (manifest.integrity.recordSha256 !== expected) throw new TypeError("Release manifest record hash does not match.");
  return expected;
}

export function parseReleaseManifestBody(value, options = {}) {
  const maxBytes = options.maxBytes ?? MAX_RELEASE_MANIFEST_BYTES;
  if (!Number.isSafeInteger(maxBytes) || maxBytes <= 0) throw new TypeError("Manifest body cap must be a positive safe integer.");
  const bytes = typeof value === "string" ? Buffer.from(value, "utf8") : Buffer.from(value || []);
  if (bytes.length === 0) throw new TypeError("Release manifest body is empty.");
  if (bytes.length > maxBytes) throw new TypeError(`Release manifest exceeds the ${maxBytes}-byte limit.`);
  let source;
  try {
    source = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw new TypeError("Release manifest is not valid UTF-8.");
  }
  if (source.trim().length === 0) throw new TypeError("Release manifest body is empty.");
  let manifest;
  try {
    manifest = JSON.parse(source);
  } catch {
    throw new TypeError("Release manifest is not complete valid JSON.");
  }
  verifyReleaseManifest(manifest, options);
  return manifest;
}
