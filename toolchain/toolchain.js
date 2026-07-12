const registryUrl = "../data/toolchain-registry.json";
const registryBody = document.querySelector("#toolchain-registry");
const searchInput = document.querySelector("#tool-search");
const emptyState = document.querySelector("#toolchain-empty");
const filterButtons = Array.from(document.querySelectorAll("[data-filter]"));
const pipelineGrid = document.querySelector("#pipeline-grid");
let registry = null;
let activeFilter = "all";

function setMeta(name, value) {
  document.querySelectorAll(`[data-toolchain-meta="${name}"]`).forEach((node) => {
    node.textContent = value;
  });
}

function makeCell(value) {
  const cell = document.createElement("td");
  cell.textContent = value;
  return cell;
}

function statusBadge(status) {
  const badge = document.createElement("span");
  badge.className = "status-badge";
  badge.textContent = status;
  return badge;
}

function commandList(commands) {
  const wrapper = document.createElement("div");
  wrapper.className = "command-list";
  for (const command of commands ?? []) {
    const code = document.createElement("code");
    code.textContent = command;
    wrapper.append(code);
  }
  return wrapper;
}

function rowText(tool) {
  return [
    tool.tool,
    tool.detectedVersion,
    tool.category,
    tool.function,
    tool.installationMode,
    tool.status,
    tool.evidencePath,
    tool.limitations,
    ...(tool.commands ?? []),
    ...(tool.pipeline ?? []),
  ].join(" ").toLowerCase();
}

function matchesFilter(tool) {
  if (activeFilter === "all") return true;
  if (activeFilter === "native") return tool.installationMode.includes("native");
  if (activeFilter === "container") return tool.installationMode.includes("container");
  if (activeFilter === "project-local") return tool.installationMode.includes("project-local");
  if (activeFilter === "installed") return tool.installed;
  if (activeFilter === "executed") return tool.executed;
  if (activeFilter === "evidence") return tool.evidenceProduced;
  if (activeFilter === "exploratory") return tool.status.includes("EXPLORATORY");
  if (activeFilter === "canonical") return tool.evidenceProduced || tool.pipeline?.includes("application-security");
  if (activeFilter === "superseded") return tool.status.includes("SUPERSEDED");
  if (activeFilter === "current") return !tool.status.includes("SUPERSEDED") && !tool.status.includes("DEPRECATED");
  if (activeFilter === "version-review") return tool.status.includes("VERSION_REVIEW_REQUIRED");
  if (activeFilter === "solidity") return tool.category.includes("Solidity");
  if (activeFilter === "zk") return tool.category.includes("Zero-knowledge");
  if (activeFilter === "cryptography") return tool.category.includes("cryptography");
  if (activeFilter === "application") return tool.category.includes("Application");
  if (activeFilter === "infrastructure") return tool.category.includes("Infrastructure");
  if (activeFilter === "database") return tool.pipeline?.includes("database") || tool.category.includes("database");
  if (activeFilter === "chain-clients") return tool.pipeline?.includes("chain-clients");
  if (activeFilter === "native-compilation") return tool.category.includes("Languages and native compilation");
  if (activeFilter === "source-control") return tool.category.includes("source control");
  return true;
}

function renderPipelines() {
  if (!pipelineGrid || !registry) return;
  pipelineGrid.replaceChildren(
    ...registry.pipelines.map((pipeline) => {
      const article = document.createElement("article");
      const span = document.createElement("span");
      const title = document.createElement("h3");
      const body = document.createElement("p");
      span.textContent = pipeline.id;
      title.textContent = pipeline.label;
      body.textContent = pipeline.flow;
      article.append(span, title, body);
      return article;
    })
  );
}

function renderRows() {
  if (!registryBody || !registry) return;
  const query = searchInput?.value.trim().toLowerCase() ?? "";
  const rows = registry.tools.filter((tool) => matchesFilter(tool) && (!query || rowText(tool).includes(query)));

  registryBody.replaceChildren(
    ...rows.map((tool) => {
      const row = document.createElement("tr");
      const toolCell = makeCell(tool.tool);
      const statusCell = makeCell("");
      const evidenceCell = makeCell(tool.evidenceProduced ? "yes" : "no");
      const commandCell = makeCell("");

      toolCell.append(document.createElement("br"));
      const small = document.createElement("small");
      small.textContent = tool.function;
      toolCell.append(small);
      statusCell.append(statusBadge(tool.status));
      commandCell.append(commandList(tool.commands));

      row.append(
        toolCell,
        makeCell(tool.detectedVersion),
        makeCell(tool.category),
        makeCell(tool.installationMode),
        statusCell,
        evidenceCell,
        commandCell,
        makeCell(tool.limitations)
      );
      return row;
    })
  );
  if (emptyState) emptyState.hidden = rows.length > 0;
}

function count(predicate) {
  return registry.tools.filter(predicate).length.toLocaleString("en-US");
}

function hydrateMeta() {
  const semgrep = registry.tools.find((tool) => tool.tool === "Semgrep");
  setMeta("tool-count", `${registry.tools.length.toLocaleString("en-US")} tools`);
  setMeta("installed-count", count((tool) => tool.installed));
  setMeta("evidence-count", count((tool) => tool.evidenceProduced));
  setMeta("container-count", count((tool) => tool.installationMode.includes("container")));
  setMeta("exploratory-count", count((tool) => tool.status.includes("EXPLORATORY")));
  setMeta("project-count", count((tool) => tool.installationMode.includes("project-local")));
  setMeta("native-count", count((tool) => tool.installationMode.includes("native")));
  setMeta("superseded-count", count((tool) => tool.status.includes("SUPERSEDED")));
  setMeta("semgrep-version", semgrep?.detectedVersion ?? "unavailable");
}

function bindFilters() {
  filterButtons.forEach((button) => {
    button.addEventListener("click", () => {
      activeFilter = button.dataset.filter;
      filterButtons.forEach((item) => item.setAttribute("aria-pressed", String(item === button)));
      renderRows();
    });
  });
  searchInput?.addEventListener("input", renderRows);
}

async function hydrateToolchain() {
  try {
    const response = await fetch(registryUrl);
    if (!response.ok) throw new Error("registry unavailable");
    registry = await response.json();
    renderPipelines();
    hydrateMeta();
    bindFilters();
    renderRows();
  } catch {
    setMeta("tool-count", "unavailable");
    if (registryBody) {
      registryBody.replaceChildren();
      const row = document.createElement("tr");
      row.append(makeCell("Registry unavailable"), makeCell("Retry from the JSON link"), makeCell(""), makeCell(""), makeCell(""), makeCell(""), makeCell(""), makeCell(""));
      registryBody.append(row);
    }
  }
}

void hydrateToolchain();
