import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { resolve, dirname, extname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const linkPattern = /\b(?:href|src)="([^"]+)"/g;
const missing = [];
const htmlIdCache = new Map();

function htmlIds(path) {
  if (htmlIdCache.has(path)) return htmlIdCache.get(path);
  const ids = new Set();
  if (extname(path) === ".html" && existsSync(path)) {
    const source = readFileSync(path, "utf8");
    for (const match of source.matchAll(/\b(?:id|name)="([^"]+)"/g)) ids.add(match[1]);
  }
  htmlIdCache.set(path, ids);
  return ids;
}

function htmlFiles(dir = root) {
  const files = [];
  for (const entry of readdirSync(dir)) {
    if (entry === ".git" || entry === "deliverables" || entry === "node_modules" || entry === "playwright-report" || entry === "public" || entry === "test-results") continue;
    const full = resolve(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) files.push(...htmlFiles(full));
    else if (entry.endsWith(".html")) files.push(full);
  }
  return files;
}

for (const htmlPath of htmlFiles()) {
  const htmlFile = htmlPath.slice(root.length + 1);
  const html = readFileSync(htmlPath, "utf8");
  const base = dirname(htmlPath);

  for (const match of html.matchAll(linkPattern)) {
    const target = match[1];

    // This file is intentionally generated only by the release build, after
    // the deterministic static-surface checks have passed.
    if (target === "/.well-known/fenrua-release.json") continue;

    if (
      target.startsWith("https://") ||
      target.startsWith("http://") ||
      target.startsWith("mailto:")
    ) {
      continue;
    }

    const [pathAndQuery, encodedFragment] = target.split("#", 2);
    const path = pathAndQuery.split("?", 1)[0];
    const resolvedPath = path === "" ? htmlPath : path.endsWith("/") ? `${path}index.html` : path;
    let resolved = resolvedPath === htmlPath
      ? htmlPath
      : resolvedPath.startsWith("/")
        ? resolve(root, `.${resolvedPath}`)
        : resolve(base, resolvedPath);
    if (!existsSync(resolved) && resolvedPath.startsWith("/") && !extname(resolvedPath)) {
      resolved = resolve(root, `.${resolvedPath}`, "index.html");
    }
    if (!existsSync(resolved)) {
      missing.push(`${htmlFile}: ${target}`);
      continue;
    }

    if (encodedFragment !== undefined && extname(resolved) === ".html") {
      let fragment;
      try {
        fragment = decodeURIComponent(encodedFragment);
      } catch {
        missing.push(`${htmlFile}: ${target} (invalid fragment encoding)`);
        continue;
      }
      if (fragment && !htmlIds(resolved).has(fragment)) {
        missing.push(`${htmlFile}: ${target} (missing fragment target)`);
      }
    }
  }
}

if (missing.length > 0) {
  console.error(`Missing static links:\n${missing.map((item) => `- ${item}`).join("\n")}`);
  process.exit(1);
}

console.log("Static links OK");
