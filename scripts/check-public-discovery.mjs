import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [html, robots, sitemap, llms, securityText] = await Promise.all([
  readFile(new URL("../index.html", import.meta.url), "utf8"),
  readFile(new URL("../robots.txt", import.meta.url), "utf8"),
  readFile(new URL("../sitemap.xml", import.meta.url), "utf8"),
  readFile(new URL("../llms.txt", import.meta.url), "utf8"),
  readFile(new URL("../.well-known/security.txt", import.meta.url), "utf8"),
]);

const structuredData = [...html.matchAll(/<script type="application\/ld\+json">\s*([\s\S]*?)\s*<\/script>/g)];
assert.equal(structuredData.length, 2, "Organization and page-discovery JSON-LD must be present.");

const organization = JSON.parse(structuredData[0][1]);
assert.equal(organization["@type"], "Organization");
assert.equal(organization.name, "FENRUA LABS PTY LTD");
assert.equal(organization.legalName, "FENRUA LABS PTY LTD");
assert.equal(organization.taxID, "ABN 62 700 182 663");
assert.deepEqual(
  organization.identifier.map(({ propertyID, value }) => [propertyID, value]),
  [
    ["ABN", "62 700 182 663"],
    ["ACN", "700 182 663"],
  ]
);
assert.equal(organization.address.addressLocality, "Ultimo");
assert.equal(organization.address.addressRegion, "NSW");
assert.equal(organization.address.postalCode, "2007");
assert.equal(organization.contactPoint.email, "partnerships@fenrua.ai");
assert.equal(organization.url, "https://fenrua.ai/");
assert.ok(organization.sameAs?.includes("https://github.com/fenrualabs"));

const discovery = JSON.parse(structuredData[1][1]);
const graphByType = new Map(discovery["@graph"].map((entry) => [entry["@type"], entry]));
assert.equal(graphByType.get("WebSite")?.url, "https://fenrua.ai/");
assert.equal(graphByType.get("WebSite")?.publisher?.["@id"], "https://fenrua.ai/#organization");
assert.equal(graphByType.get("WebPage")?.url, "https://fenrua.ai/");
assert.equal(graphByType.get("WebPage")?.inLanguage, "en-AU");
assert.deepEqual(graphByType.get("BreadcrumbList")?.itemListElement?.[0], {
  "@type": "ListItem",
  position: 1,
  name: "Home",
  item: "https://fenrua.ai/",
});

for (const crawler of [
  "Google-Extended",
  "OAI-SearchBot",
  "GPTBot",
  "ChatGPT-User",
  "ClaudeBot",
  "Claude-SearchBot",
]) {
  assert.match(robots, new RegExp(`User-agent: ${crawler}\\nAllow: /`));
}

assert.match(robots, /Sitemap: https:\/\/fenrua\.ai\/sitemap\.xml/);
assert.match(sitemap, /<loc>https:\/\/fenrua\.ai\/<\/loc>/);
assert.match(sitemap, /<loc>https:\/\/fenrua\.ai\/architecture<\/loc>/);
assert.match(sitemap, /<loc>https:\/\/fenrua\.ai\/toolchain<\/loc>/);
assert.match(sitemap, /<loc>https:\/\/fenrua\.ai\/audit<\/loc>/);
assert.match(sitemap, /<loc>https:\/\/fenrua\.ai\/legal<\/loc>/);
assert.match(sitemap, /<loc>https:\/\/fenrua\.ai\/security<\/loc>/);
assert.doesNotMatch(sitemap, /<loc>https:\/\/fenrua\.ai\/[^<]+\/<\/loc>/, "Non-root sitemap URLs must be slashless.");
assert.match(html, /<link rel="canonical" href="https:\/\/fenrua\.ai\/" \/>/);
assert.match(html, /<link rel="alternate" hreflang="en-AU" href="https:\/\/fenrua\.ai\/" \/>/);
assert.match(html, /<meta property="og:url" content="https:\/\/fenrua\.ai\/" \/>/);
assert.match(html, /<meta name="googlebot" content="index,follow,max-snippet:-1,max-image-preview:large,max-video-preview:-1" \/>/);
assert.match(llms, /FENRUA LABS PTY LTD/);
assert.match(llms, /https:\/\/fenrua\.ai\/legal/);
assert.doesNotMatch(llms, /token allocation|financial-return product is offered/i);
assert.match(securityText, /Canonical: https:\/\/fenrua\.ai\/\.well-known\/security\.txt/);
assert.match(securityText, /Policy: https:\/\/fenrua\.ai\/security/);

console.log(
  JSON.stringify({
    status: "ok",
    scope: "public-discovery",
    canonical: organization.url,
    crawlersAllowed: 6,
  })
);
