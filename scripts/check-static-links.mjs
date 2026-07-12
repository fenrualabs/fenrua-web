import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const htmlFiles = ["index.html", "toolchain/index.html"];
const linkPattern = /\b(?:href|src)="([^"]+)"/g;
const missing = [];

for (const htmlFile of htmlFiles) {
  const htmlPath = resolve(root, htmlFile);
  const html = readFileSync(htmlPath, "utf8");
  const base = dirname(htmlPath);

  for (const match of html.matchAll(linkPattern)) {
    const target = match[1];

    if (
      target === "/" ||
      target.startsWith("#") ||
      target.startsWith("https://") ||
      target.startsWith("http://") ||
      target.startsWith("mailto:")
    ) {
      continue;
    }

    const [path] = target.split("#");
    const resolved = path.startsWith("/") ? resolve(root, `.${path}`) : resolve(base, path);
    if (!existsSync(resolved)) {
      missing.push(`${htmlFile}: ${target}`);
    }
  }
}

if (missing.length > 0) {
  console.error(`Missing static links:\n${missing.map((item) => `- ${item}`).join("\n")}`);
  process.exit(1);
}

console.log("Static links OK");
