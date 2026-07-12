const searchInput = document.querySelector("#tool-search");
const rows = Array.from(document.querySelectorAll("[data-tool-row]"));
const emptyState = document.querySelector("#toolchain-empty");
const filterButtons = Array.from(document.querySelectorAll("[data-filter]"));
const categoryButtons = Array.from(document.querySelectorAll("[data-category-filter]"));
const pageStatus = document.querySelector("[data-page-status]");
const pageSize = 25;
let activeFilter = "all";
let activeCategory = "";
let currentPage = 1;

function rowMatchesFilter(row) {
  const tags = row.dataset.tags || "";
  if (activeCategory && row.dataset.category !== activeCategory) return false;
  if (activeFilter === "all") return true;
  if (activeFilter === "detected") return tags.includes("DETECTED");
  if (activeFilter === "version-verified") return tags.includes("VERSION_VERIFIED");
  if (activeFilter === "smoke-tested") return tags.includes("SMOKE_TESTED");
  if (activeFilter === "campaign-executed") return tags.includes("EVIDENCE_PRODUCING");
  if (activeFilter === "evidence") return tags.includes("EVIDENCE_PRODUCING");
  if (activeFilter === "canonical-pipeline") return tags.includes("CANONICAL_PIPELINE");
  if (activeFilter === "container") return tags.includes("CONTAINER_ONLY");
  if (activeFilter === "project-local") return tags.includes("PROJECT_LOCAL");
  if (activeFilter === "exploratory") return tags.includes("EXPLORATORY");
  if (activeFilter === "superseded") return tags.includes("SUPERSEDED");
  if (activeFilter === "version-review") return tags.includes("VERSION_REVIEW_REQUIRED");
  if (activeFilter === "unavailable") return tags.includes("UNAVAILABLE");
  return true;
}

function visibleRows() {
  const query = searchInput?.value.trim().toLowerCase() ?? "";
  return rows.filter((row) => rowMatchesFilter(row) && (!query || row.dataset.search.includes(query)));
}

function renderRows() {
  const matches = visibleRows();
  const maxPage = Math.max(1, Math.ceil(matches.length / pageSize));
  currentPage = Math.min(currentPage, maxPage);
  const start = (currentPage - 1) * pageSize;
  const pageRows = new Set(matches.slice(start, start + pageSize));

  rows.forEach((row) => {
    row.hidden = !pageRows.has(row);
  });

  if (emptyState) emptyState.hidden = matches.length > 0;
  if (pageStatus) pageStatus.textContent = `Page ${currentPage} of ${maxPage} · ${matches.length} matching`;
}

function setActiveFilter(button) {
  activeFilter = button.dataset.filter;
  activeCategory = "";
  currentPage = 1;
  filterButtons.forEach((item) => item.setAttribute("aria-pressed", String(item === button)));
  categoryButtons.forEach((item) => item.setAttribute("aria-pressed", "false"));
  renderRows();
}

function setActiveCategory(button) {
  activeCategory = button.dataset.categoryFilter;
  activeFilter = "all";
  currentPage = 1;
  filterButtons.forEach((item) => item.setAttribute("aria-pressed", item.dataset.filter === "all" ? "true" : "false"));
  categoryButtons.forEach((item) => item.setAttribute("aria-pressed", String(item === button)));
  renderRows();
}

function copyValue(value, button) {
  const done = () => {
    const previous = button.textContent;
    button.textContent = "Copied";
    window.setTimeout(() => {
      button.textContent = previous;
    }, 1400);
  };

  if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard.writeText(value).then(done).catch(() => {});
  }
}

filterButtons.forEach((button) => {
  button.addEventListener("click", () => setActiveFilter(button));
});

categoryButtons.forEach((button) => {
  button.addEventListener("click", () => setActiveCategory(button));
});

searchInput?.addEventListener("input", () => {
  currentPage = 1;
  renderRows();
});

document.querySelector('[data-page-action="prev"]')?.addEventListener("click", () => {
  currentPage = Math.max(1, currentPage - 1);
  renderRows();
});

document.querySelector('[data-page-action="next"]')?.addEventListener("click", () => {
  currentPage += 1;
  renderRows();
});

document.querySelectorAll("[data-copy]").forEach((button) => {
  button.addEventListener("click", () => copyValue(button.dataset.copy, button));
});

if (rows.length) renderRows();
