/* eslint-disable no-console */
/**
 * Generate `dist/sitemap.xml` with only public/indexable routes.
 * Keep this list aligned with ROUTE_SEO indexable=true in src/utils/seo.ts.
 */

const fs = require("node:fs");
const path = require("node:path");

const BASE_URL = "https://thebearbeat.com";
const INDEXABLE_ROUTES = [
  { path: "/", changefreq: "weekly", priority: "1.0" },
  { path: "/planes", changefreq: "weekly", priority: "0.9" },
  { path: "/instrucciones", changefreq: "monthly", priority: "0.7" },
  { path: "/legal", changefreq: "monthly", priority: "0.6" },
];

function isoDateUtc() {
  return new Date().toISOString().slice(0, 10);
}

function escapeXml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function buildSitemapXml(lastmod) {
  const urls = INDEXABLE_ROUTES.map(({ path: routePath, changefreq, priority }) => {
    const loc = routePath === "/" ? `${BASE_URL}/` : `${BASE_URL}${routePath}`;
    return [
      "  <url>",
      `    <loc>${escapeXml(loc)}</loc>`,
      `    <lastmod>${escapeXml(lastmod)}</lastmod>`,
      `    <changefreq>${escapeXml(changefreq)}</changefreq>`,
      `    <priority>${escapeXml(priority)}</priority>`,
      "  </url>",
    ].join("\n");
  }).join("\n");

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    urls,
    "</urlset>",
    "",
  ].join("\n");
}

function main() {
  const cwd = process.cwd(); // expected: <repo>/frontend (npm workspace)
  const outPath = path.join(cwd, "dist", "sitemap.xml");
  const date = isoDateUtc();
  const xml = buildSitemapXml(date);

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, xml, "utf8");
  console.log(`[sitemap] wrote dist/sitemap.xml (lastmod=${date})`);
}

main();
