const kernelStatus = {
  repositoryUrl: "https://github.com/fenrualabs/fenrua-kernel",
  auditLogUrl: "docs/SECURITY_AUDIT_LOG.md",
  genesisManifestUrl: "docs/GENESIS_MANIFEST.md",
  ciUrl: "https://github.com/fenrualabs/fenrua-kernel/actions",
  regressionUrl: "docs/REGRESSION_HISTORY.md",
  versionCommitUrl: "https://github.com/fenrualabs/fenrua-kernel/commit/390f7ae",
  versionTag: "v.390f7ae",
  buildStatus: "PASS",
  auditResolution: "7/7 Findings Resolved",
  genesisIntegrity: "14/14 Genesis Files Verified",
  ciOutput: "Hardening: PASS",
  regressionCoverage: "Active",
  statusSource: "kernel-status.js",
  lastSynced: "DayZero static manifest",
  evidence: [
    {
      artifact: "Bedrock Source",
      hashReference: "85ecc97c...",
      sourceLabel: "Link to Source",
      sourceUrl: "https://github.com/fenrualabs/fenrua-kernel/commit/85ecc97c",
      copyValue: "85ecc97c",
    },
    {
      artifact: "Evidence Commit",
      hashReference: "dc36d1f2...",
      sourceLabel: "Link to Evidence",
      sourceUrl: "https://github.com/fenrualabs/fenrua-kernel/commit/dc36d1f2",
      copyValue: "dc36d1f2",
    },
    {
      artifact: "Genesis Manifest",
      hashReference: "bd9ec111...",
      sourceLabel: "Link to Log",
      sourceUrl: "docs/GENESIS_MANIFEST.md",
      copyValue: "bd9ec111",
    },
    {
      artifact: "Audit Report",
      hashReference: "9d9eeffc...",
      sourceLabel: "Link to JSON",
      sourceUrl: "docs/audit-report.json",
      copyValue: "9d9eeffc",
    },
  ],
};

function setText(selector, value) {
  document.querySelectorAll(selector).forEach((node) => {
    node.textContent = value;
  });
}

function setHref(selector, value) {
  document.querySelectorAll(selector).forEach((node) => {
    node.setAttribute("href", value);
  });
}

function makeCell(text) {
  const cell = document.createElement("td");
  cell.textContent = text;
  return cell;
}

function copyHash(value, button) {
  const setCopied = () => {
    button.textContent = "Copied";
    window.setTimeout(() => {
      button.textContent = "Copy";
    }, 1400);
  };

  if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard.writeText(value).then(setCopied).catch(() => fallbackCopy(value, button));
    return;
  }

  fallbackCopy(value, button);
}

function fallbackCopy(value, button) {
  const textarea = document.createElement("textarea");
  textarea.value = value;
  textarea.setAttribute("readonly", "readonly");
  textarea.className = "copy-buffer";
  document.body.append(textarea);
  textarea.select();
  document.execCommand("copy");
  textarea.remove();
  button.textContent = "Copied";
  window.setTimeout(() => {
    button.textContent = "Copy";
  }, 1400);
}

function hydrateRegistry() {
  const registry = document.querySelector("#evidence-registry");
  if (!registry) return;

  registry.replaceChildren(
    ...kernelStatus.evidence.map((record) => {
      const row = document.createElement("tr");
      const hashCell = makeCell("");
      const hash = document.createElement("code");
      const sourceCell = makeCell("");
      const source = document.createElement("a");
      const copyCell = makeCell("");
      const button = document.createElement("button");

      row.dataset.search = `${record.artifact} ${record.hashReference} ${record.sourceLabel}`.toLowerCase();
      hash.textContent = record.hashReference;
      hashCell.append(hash);
      source.href = record.sourceUrl;
      source.textContent = record.sourceLabel;
      sourceCell.append(source);
      button.type = "button";
      button.textContent = "Copy";
      button.addEventListener("click", () => copyHash(record.copyValue, button));
      copyCell.append(button);

      row.append(makeCell(record.artifact), hashCell, sourceCell, copyCell);
      return row;
    })
  );
}

function bindRegistrySearch() {
  const input = document.querySelector("#registry-search");
  const registry = document.querySelector("#evidence-registry");
  if (!input || !registry) return;

  input.addEventListener("input", () => {
    const query = input.value.trim().toLowerCase();
    registry.querySelectorAll("tr").forEach((row) => {
      row.hidden = query.length > 0 && !row.dataset.search.includes(query);
    });
  });
}

function hydrateKernelStatus() {
  Object.entries(kernelStatus).forEach(([key, value]) => {
    if (typeof value === "string") {
      setText(`[data-kernel-field="${key}"]`, value);
    }
  });

  setHref('[data-link="repository"]', kernelStatus.repositoryUrl);
  setHref('[data-link="audit"]', kernelStatus.auditLogUrl);
  setHref('[data-link="genesis"]', kernelStatus.genesisManifestUrl);
  setHref('[data-link="ci"]', kernelStatus.ciUrl);
  setHref('[data-link="regression"]', kernelStatus.regressionUrl);
  setHref('[data-link="version"]', kernelStatus.versionCommitUrl);

  hydrateRegistry();
  bindRegistrySearch();
}

const chainFieldMap = {
  978: {
    status: '[data-chain-field="978-status"]',
    chainId: '[data-chain-field="978-chain-id"]',
    block: '[data-chain-field="978-block"]',
    latency: '[data-chain-field="978-latency"]',
    checked: '[data-chain-field="978-checked"]',
    card: '[data-chain-card="978"]',
  },
  521: {
    status: '[data-chain-field="521-status"]',
    chainId: '[data-chain-field="521-chain-id"]',
    block: '[data-chain-field="521-block"]',
    latency: '[data-chain-field="521-latency"]',
    checked: '[data-chain-field="521-checked"]',
    card: '[data-chain-card="521"]',
  },
};

function formatNumber(value) {
  return Number.isSafeInteger(value) ? new Intl.NumberFormat("en-US").format(value) : "Reading";
}

function formatCheckedAt(value) {
  if (!value) return "pending";

  try {
    return new Intl.DateTimeFormat("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }).format(new Date(value));
  } catch {
    return "pending";
  }
}

function chainStatusText(chain) {
  if (chain.status === "online" && Number.isSafeInteger(chain.blockNumber)) {
    return "Block progress live";
  }

  if (chain.status === "wrong-chain") {
    return "Chain mismatch";
  }

  return "Reading progress";
}

function updateChainCard(chain) {
  const fields = chainFieldMap[chain.expectedChainId];
  if (!fields) return;

  setText(fields.status, chainStatusText(chain));
  setText(fields.chainId, `${chain.chainId ?? chain.expectedChainId} / 0x${chain.expectedChainId.toString(16)}`);
  setText(fields.block, formatNumber(chain.blockNumber));
  setText(fields.latency, Number.isSafeInteger(chain.latencyMs) ? `${chain.latencyMs}ms` : "pending");
  setText(fields.checked, formatCheckedAt(chain.checkedAt));

  document.querySelectorAll(fields.card).forEach((card) => {
    card.dataset.status = chain.status || "offline";
  });
}

async function readChainProgress() {
  const response = await fetch("/api/chain-progress", { cache: "no-store" });
  if (!response.ok) throw new Error(`Chain progress HTTP ${response.status}`);
  const payload = await response.json();
  if (!Array.isArray(payload.chains)) throw new Error("Missing chain progress");
  payload.chains.forEach(updateChainCard);
  return Number.isSafeInteger(payload.refreshMs) ? payload.refreshMs : 15_000;
}

function hydrateChainProgress() {
  if (!document.querySelector("[data-chain-card]")) return;

  let interval = 15_000;

  const read = async () => {
    try {
      interval = await readChainProgress();
    } catch {
      document.querySelectorAll("[data-chain-card]").forEach((card) => {
        card.dataset.status = "offline";
      });
    }
  };

  void read();
  window.setInterval(() => void read(), interval);
}

hydrateKernelStatus();
hydrateChainProgress();
