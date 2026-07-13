import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (relativePath) => readFileSync(resolve(root, relativePath), "utf8");
const evidence = JSON.parse(read("data/site-evidence.json"));
const company = JSON.parse(read("data/company-identity.json"));
const register = JSON.parse(read("data/public-document-register.json"));
const vercel = JSON.parse(read("vercel.json"));

assert.equal(evidence.schemaVersion, "fenrua.site-evidence.v1");
assert.deepEqual(evidence.commercialBoundary?.paragraphs, [
  "Fenrua Labs Pty Ltd provides access to AI security infrastructure software, related technology services, and evidence-aware intelligence workflows through tiered service subscriptions and client-specific business agreements only.",
  "Fenrua Labs Pty Ltd does not offer investments, token crowdfunding, securities, bonds, equity, debt, managed investment interests, profit-sharing arrangements, revenue-sharing arrangements, yield products, exchange products, trading products, or any financial-return scheme. Neither a subscription nor a client-specific business agreement gives, promises, expects, entitles, or represents profit, return, token appreciation, token allocation, liquidity, resale value, dividends, buyback rights, or ownership in Fenrua Labs Pty Ltd.",
  "Fenrua Labs Pty Ltd does not operate a market, exchange, order book, trading venue, or public swap product. It does not provide financial, investment, legal, tax, professional, or other advice, or any recommendation to buy, sell, hold, trade, or rely on an asset for financial gain.",
]);
assert.match(evidence.commercialBoundary.paragraphs.join(" "), /does not offer investments, token crowdfunding, securities/i);
assert.match(evidence.commercialBoundary.paragraphs.join(" "), /does not operate a market, exchange, order book, trading venue, or public swap product/i);
assert.match(evidence.commercialBoundary.serviceAgreementBoundary.join(" "), /does not itself activate an account, accept payment, connect a wallet/i);
assert.match(evidence.commercialBoundary.paymentBoundary.join(" "), /payment or bounded-settlement rail only/i);
assert.match(evidence.commercialBoundary.communityBoundary.join(" "), /XP is non-transferable community reputation metadata only/i);
assert.equal(company.schemaVersion, "fenrua.company-identity.v1");
assert.equal(company.legalName, "FENRUA LABS PTY LTD");
assert.equal(company.abn, "62 700 182 663");
assert.equal(company.acn, "700 182 663");
assert.equal(company.gstStatus, "Registered from 2026-07-13");

assert.equal(register.schemaVersion, "fenrua.public-document-register.v1");
for (const record of register.records) {
  assert.ok(["active", "archived", "superseded"].includes(record.status), `Unexpected document status for ${record.id}.`);
  assert.ok(existsSync(resolve(root, record.path)), `Registered document is missing: ${record.path}`);
  if (record.artifactSha256) {
    const actual = createHash("sha256").update(readFileSync(resolve(root, record.path))).digest("hex");
    assert.equal(record.artifactSha256, actual, `Registered artifact hash is stale: ${record.path}`);
  }
  if (record.originalContentSha256) {
    assert.match(read(record.path), new RegExp(record.originalContentSha256), `Archive must bind the original content hash: ${record.path}`);
  }
  if (record.formerPath) {
    assert.ok(!existsSync(resolve(root, record.formerPath)), `Superseded source file must be removed: ${record.formerPath}`);
  }
}

const archiveHeader = vercel.headers.find((entry) => entry.source === "/docs/archive/(.*)");
assert.ok(archiveHeader?.headers.some((header) => header.key === "X-Robots-Tag" && header.value === "noindex, nofollow, noarchive"));
const globalHeaders = vercel.headers.find((entry) => entry.source === "/(.*)")?.headers ?? [];
const headerValue = (key) => globalHeaders.find((header) => header.key === key)?.value;
assert.equal(headerValue("Strict-Transport-Security"), "max-age=63072000");
assert.equal(headerValue("X-Frame-Options"), "DENY");
assert.equal(headerValue("Cross-Origin-Opener-Policy"), "same-origin");
assert.equal(headerValue("Cross-Origin-Resource-Policy"), "same-origin");
assert.match(headerValue("Content-Security-Policy"), /upgrade-insecure-requests/);
const wwwRedirect = vercel.redirects.find(
  (entry) => entry.destination === "https://fenrua.ai/$1" && entry.has?.[0]?.value === "www\\.fenrua\\.ai"
);
assert.equal(wwwRedirect?.source, "/(.*)");
assert.equal(wwwRedirect?.permanent, true);
assert.deepEqual(wwwRedirect?.has, [{ type: "header", key: "host", value: "www\\.fenrua\\.ai" }]);
const vercelAliasRedirect = vercel.redirects.find(
  (entry) => entry.has?.[0]?.value === "(?:fenrua-web(?:-[a-z0-9-]+)?|fenrua-[a-z0-9]+-fenrualabs-projects)\\.vercel\\.app"
);
assert.equal(vercelAliasRedirect?.source, "/(.*)");
assert.equal(vercelAliasRedirect?.destination, "https://fenrua.ai/$1");
assert.equal(vercelAliasRedirect?.permanent, true);
for (const [source, destination] of [
  ["/nexus", "/architecture"],
  ["/nexus/fenchain", "/status"],
  ["/nexus/n521", "/research/pn521-cross-limb-borrow"],
  ["/nexus/trust", "/evidence"],
  ["/nexus/audit", "/audit"],
  ["/nexus/monitoring", "/status"],
  ["/explorer", "/status"],
  ["/explorer/c978", "/status"],
  ["/explorer/n521", "/status"],
]) {
  const redirect = vercel.redirects.find((entry) => entry.source === source);
  assert.equal(redirect?.destination, destination, `${source} must redirect to ${destination}.`);
  assert.equal(redirect?.permanent, true, `${source} redirect must be permanent.`);
}
for (const source of ["/fenswap", "/fenpresale", "/wallet", "/privacy", "/terms"]) {
  assert.equal(
    vercel.redirects.find((entry) => entry.source === source),
    undefined,
    `${source} has no honest successor and must not redirect to a current page.`,
  );
  const rewrite = vercel.rewrites.find((entry) => entry.source === source);
  assert.equal(rewrite?.destination, "/api/legacy-gone", `${source} must resolve through the HTTP 410 handler.`);
}
for (const record of register.records.filter((record) => record.formerPath)) {
  const redirect = vercel.redirects.find((entry) => entry.source === `/${record.formerPath}`);
  assert.equal(redirect?.destination, `/${record.path}`, `Former document must redirect to archive: ${record.formerPath}`);
  assert.equal(redirect?.permanent, true, `Former document redirect must be permanent: ${record.formerPath}`);
}
for (const record of register.records.filter((record) => record.status !== "active")) {
  assert.match(record.path, /^docs\/archive\/2026-07-13\//, `Archived record must be stored under the cutover archive: ${record.id}`);
  assert.match(read(record.path), /\b(?:archived|superseded)\b/i, `Archive notice must state its status: ${record.id}`);
}

const sitemap = read("sitemap.xml");
assert.doesNotMatch(sitemap, /docs\/archive\//, "Archived records must not be discoverable through the sitemap.");

const reportPolicy = read("docs/EXTERNAL_ARTIFACT_POLICY.md");
assert.match(reportPolicy, /must be created and retained outside this source repository/i);
assert.match(reportPolicy, /must not be\s+committed, staged into the public output/i);

const audit = read("audit/index.html");
assert.match(audit, /Fenrua Labs Pty Ltd — Access-Only Services/);
assert.match(audit, /does not offer investments, token crowdfunding, securities/i);
assert.match(audit, /does not operate a market, exchange, order book, trading venue, or public swap product/i);
assert.match(audit, /does not attest to dynamic observations, live block-card data, or protected systems/i);
assert.match(audit, /ABN 62 700 182 663/);

console.log(JSON.stringify({ status: "ok", scope: "access-only-boundary-and-archive-policy", documents: register.records.length }));
