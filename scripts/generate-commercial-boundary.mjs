import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourcePath = path.join(root, "data", "site-evidence.json");
const outputPath = path.join(root, "docs", "ACCESS_ONLY_COMMERCIAL_BOUNDARY.md");
const checkMode = process.argv.includes("--check");
const siteEvidence = JSON.parse(readFileSync(sourcePath, "utf8"));
const boundary = siteEvidence.commercialBoundary;

if (!boundary || !Array.isArray(boundary.paragraphs) || boundary.paragraphs.length !== 3) {
  throw new Error("data/site-evidence.json must define the three-paragraph commercial boundary.");
}

for (const key of ["serviceAgreementBoundary", "paymentBoundary", "communityBoundary"]) {
  if (!Array.isArray(boundary[key]) || boundary[key].length === 0) {
    throw new Error(`data/site-evidence.json must define commercialBoundary.${key}.`);
  }
}

function section(title, paragraphs) {
  return `## ${title}\n\n${paragraphs.join("\n\n")}\n`;
}

const evidenceBoundary = [
  "Public evidence pages expose point-in-time, content-hashed snapshots of allowlisted public artifacts. Some snapshots are refreshed periodically only after automated validation succeeds. A refresh validates the published records and their internal bindings; it does not rerun the underlying research, differential, sanitizer, circuit, or review campaigns.",
  "Each public record is limited to its named artifacts, revisions, timestamps, hashes, validation steps, maturity, and stated limitations. Public evidence does not attest to live services, protected systems, private client environments, signing keys, private gateways, validators, private meshes, or production security beyond the record's stated scope.",
];

const rendered = `# ${boundary.title}\n\nStatus: ${boundary.status}  \nLast reviewed: ${boundary.lastReviewed}\n\n${boundary.paragraphs.join("\n\n")}\n\n${section("Service and agreement boundary", boundary.serviceAgreementBoundary)}\n${section("Payment and settlement boundary", boundary.paymentBoundary)}\n${section("Community activity boundary", boundary.communityBoundary)}\n${section("Evidence boundary", evidenceBoundary)}\n## Company record\n\nThe canonical operator identity and official registry links are published in the [Legal and Company Centre](/legal) and the machine-readable [company identity record](/data/company-identity.json).\n\nThis statement is a public description of service scope. It is not financial product, investment, legal, or tax advice and does not replace applicable subscription terms, a client-specific agreement, or a compliance-approved privacy notice.\n`;

if (checkMode) {
  if (!existsSync(outputPath) || readFileSync(outputPath, "utf8") !== rendered) {
    throw new Error("docs/ACCESS_ONLY_COMMERCIAL_BOUNDARY.md is stale. Run npm run generate:policy.");
  }
} else {
  writeFileSync(outputPath, rendered);
}

console.log(JSON.stringify({ status: "ok", mode: checkMode ? "check" : "write", output: path.relative(root, outputPath) }));
