import {
  checkSchemaMetadata,
  checkSourceReferences,
  contextRanges,
  documentRecordIds,
  duplicates,
  expect,
  finish,
  isDate,
  isMain,
  isNonEmptyString,
  mainTextFromHtml,
  occurrenceInRanges,
  readJson,
  readText,
  requireFields,
  scanFiles,
  termOccurrences,
} from "./check-product-ontology.mjs";

const REQUIRED_TERMS = [
  "observed",
  "signed",
  "anchored",
  "tested",
  "validated",
  "reproduced",
  "verified",
  "reviewed",
  "independently reviewed",
  "audited",
  "attested",
  "certified",
  "formally verified",
  "production-approved",
];

const CONTRACT_FIELDS = ["term", "level", "permittedEvidenceClasses", "requires", "prohibitedWithout", "doesNotMean", "scan"];
const ALLOWANCE_CONTEXT_TYPES = new Set(["claim", "explanatory", "historical", "fixture"]);

function validateStringArray(errors, value, label) {
  expect(errors, Array.isArray(value), `${label} must be an array`);
  if (!Array.isArray(value)) return;
  expect(errors, value.length > 0, `${label} must not be empty`);
  for (const [index, item] of value.entries()) {
    expect(errors, isNonEmptyString(item), `${label}[${index}] must be a non-empty string`);
  }
  for (const duplicate of duplicates(value)) errors.push(`${label} contains duplicate ${duplicate}`);
}

function registerAllowanceMatches(errors, allowance, file, text, allowedByTerm) {
  const ranges = contextRanges(text, allowance.context);
  expect(errors, ranges.length > 0, `assurance allowance for ${allowance.term} has no matching context in ${file}`);
  const matches = termOccurrences(text, allowance.term).filter((occurrence) => occurrenceInRanges(occurrence, ranges));
  expect(errors, matches.length >= allowance.minimumMatches, `assurance allowance for ${allowance.term} in ${file} expected at least ${allowance.minimumMatches} matches but found ${matches.length}`);
  if (allowance.maximumMatches !== null) {
    expect(errors, matches.length <= allowance.maximumMatches, `assurance allowance for ${allowance.term} in ${file} expected at most ${allowance.maximumMatches} matches but found ${matches.length}`);
  }
  const positions = allowedByTerm.get(allowance.term) ?? new Set();
  for (const occurrence of matches) positions.add(occurrence.index);
  allowedByTerm.set(allowance.term, positions);
}

export function validateAssuranceLanguage() {
  const errors = [];
  const schema = readJson("schemas/assurance-language.v1.schema.json");
  const data = readJson("data/assurance-language.json");
  const taxonomy = readJson("data/evidence-taxonomy.json");
  const claims = readJson("data/claim-register.json");
  const evidenceClassIds = new Set((taxonomy.classes ?? []).map((entry) => entry.id));
  const claimsById = new Map((claims.claims ?? []).map((claim) => [claim.id, claim]));

  checkSchemaMetadata(
    errors,
    schema,
    "https://fenrua.ai/schemas/assurance-language.v1.schema.json",
    "fenrua.assurance-language.v1",
    ["schemaVersion", "lastReviewed", "sourceReferences", "contracts", "contentScan"]
  );
  requireFields(errors, data, ["schemaVersion", "lastReviewed", "sourceReferences", "contracts", "contentScan"], "assurance language");
  expect(errors, data.schemaVersion === "fenrua.assurance-language.v1", "assurance language has an unexpected schemaVersion");
  expect(errors, isDate(data.lastReviewed), "assurance language lastReviewed must be an ISO date");
  checkSourceReferences(errors, data, documentRecordIds(), "assurance language");
  expect(errors, Array.isArray(data.contracts), "assurance language contracts must be an array");
  if (!Array.isArray(data.contracts)) return errors;

  const contractsByTerm = new Map();
  const levels = [];
  for (const contract of data.contracts) {
    const label = `assurance contract ${contract?.term ?? "<unknown>"}`;
    requireFields(errors, contract, CONTRACT_FIELDS, label);
    expect(errors, isNonEmptyString(contract?.term), `${label}.term must be a non-empty string`);
    expect(errors, !contractsByTerm.has(contract?.term), `assurance contract ${contract?.term} is duplicated`);
    contractsByTerm.set(contract?.term, contract);
    expect(errors, Number.isInteger(contract?.level) && contract.level >= 0 && contract.level <= 100, `${label}.level must be an integer from 0 to 100`);
    levels.push(contract?.level);
    validateStringArray(errors, contract?.permittedEvidenceClasses, `${label}.permittedEvidenceClasses`);
    validateStringArray(errors, contract?.requires, `${label}.requires`);
    validateStringArray(errors, contract?.doesNotMean, `${label}.doesNotMean`);
    expect(errors, isNonEmptyString(contract?.prohibitedWithout), `${label}.prohibitedWithout must be a non-empty string`);
    expect(errors, typeof contract?.scan === "boolean", `${label}.scan must be boolean`);
    for (const evidenceClass of contract?.permittedEvidenceClasses ?? []) {
      expect(errors, evidenceClassIds.has(evidenceClass), `${label} references unknown evidence class ${evidenceClass}`);
    }
  }
  for (const duplicate of duplicates(levels)) errors.push(`assurance language repeats level ${duplicate}`);
  for (const term of REQUIRED_TERMS) expect(errors, contractsByTerm.has(term), `assurance language is missing required term ${term}`);
  expect(errors, contractsByTerm.has("published"), "assurance language must define published because claim records use it");

  const scan = data.contentScan;
  requireFields(errors, scan, ["root", "allowances"], "assurance language contentScan");
  expect(errors, scan?.root === "public", "assurance language must scan generated public output");
  expect(errors, Array.isArray(scan?.allowances), "assurance language allowances must be an array");
  if (!Array.isArray(scan?.allowances)) return errors;

  const generatedFiles = scanFiles("public", (absolutePath) => absolutePath.endsWith("/index.html") || absolutePath.endsWith("\\index.html"));
  expect(errors, generatedFiles.length > 0, "No generated public HTML files were found for assurance scanning");
  const textByFile = new Map(generatedFiles.map((file) => [file, mainTextFromHtml(readText(file))]));
  const allowanceKeys = [];
  const allowancesByFile = new Map();
  for (const allowance of scan.allowances) {
    const label = `assurance allowance for ${allowance?.term ?? "<unknown>"}`;
    requireFields(errors, allowance, ["files", "term", "context", "claimId", "contextType", "minimumMatches", "maximumMatches"], label);
    expect(errors, Array.isArray(allowance?.files) && allowance.files.length > 0, `${label}.files must contain explicit generated paths`);
    for (const file of allowance?.files ?? []) {
      expect(errors, isNonEmptyString(file) && !file.includes("*"), `${label} file must be an explicit path`);
      expect(errors, generatedFiles.includes(file), `${label} references non-generated file ${file}`);
      allowanceKeys.push(`${file}\u0000${allowance?.term}\u0000${allowance?.context}`);
      const fileAllowances = allowancesByFile.get(file) ?? [];
      fileAllowances.push(allowance);
      allowancesByFile.set(file, fileAllowances);
    }
    const contract = contractsByTerm.get(allowance?.term);
    expect(errors, contract !== undefined && contract.scan === true, `${label} must reference a scanned assurance term`);
    expect(errors, isNonEmptyString(allowance?.context), `${label}.context must be a non-empty string`);
    expect(errors, allowance?.context?.toLocaleLowerCase("en-AU").includes(allowance?.term?.toLocaleLowerCase("en-AU")), `${label}.context must contain its assurance term`);
    const claim = claimsById.get(allowance?.claimId);
    expect(errors, claim !== undefined, `${label} references unknown claim ${allowance?.claimId}`);
    expect(errors, ALLOWANCE_CONTEXT_TYPES.has(allowance?.contextType), `${label}.contextType is invalid`);
    if (allowance?.contextType === "claim") expect(errors, claim?.assuranceVerb === allowance.term, `${label} must use a claim with matching assurance verb`);
    expect(errors, Number.isInteger(allowance?.minimumMatches) && allowance.minimumMatches > 0, `${label}.minimumMatches must be a positive integer`);
    expect(errors, allowance?.maximumMatches === null || (Number.isInteger(allowance?.maximumMatches) && allowance.maximumMatches >= allowance.minimumMatches), `${label}.maximumMatches must be null or at least minimumMatches`);
  }
  for (const duplicate of duplicates(allowanceKeys)) errors.push(`assurance language has duplicate path-specific allowance ${duplicate.replaceAll("\u0000", " | ")}`);

  const scannedTerms = [...contractsByTerm.values()].filter((contract) => contract.scan).map((contract) => contract.term);
  for (const file of generatedFiles) {
    const text = textByFile.get(file);
    const allowedByTerm = new Map();
    for (const allowance of allowancesByFile.get(file) ?? []) registerAllowanceMatches(errors, allowance, file, text, allowedByTerm);
    for (const term of scannedTerms) {
      const allowedPositions = allowedByTerm.get(term) ?? new Set();
      for (const occurrence of termOccurrences(text, term)) {
        expect(errors, allowedPositions.has(occurrence.index), `assurance term ${term} appears without an approved claim context in ${file}`);
      }
    }
  }

  return errors;
}

if (isMain(import.meta.url)) finish(validateAssuranceLanguage(), "check-assurance-language");
