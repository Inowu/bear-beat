/* eslint-disable no-console */
/**
 * Generate `dist/sitemap.xml` with an updated <lastmod> date at build time.
 *
 * Why: `frontend/public/sitemap.xml` is a static template (kept stable in git),
 * but search engines benefit from a fresh lastmod on deploy.
 */

const fs = require("node:fs");
const path = require("node:path");

function isoDateUtc() {
  return new Date().toISOString().slice(0, 10);
}

function main() {
  const cwd = process.cwd(); // expected: <repo>/frontend (npm workspace)
  const templatePath = path.join(cwd, "public", "sitemap.xml");
  const outPath = path.join(cwd, "dist", "sitemap.xml");

  if (!fs.existsSync(templatePath)) {
    throw new Error(`Missing sitemap template: ${templatePath}`);
  }

  const template = fs.readFileSync(templatePath, "utf8");
  const date = isoDateUtc();

  const lastmodRegex = new RegExp("<lastmod>[^<]*</lastmod>", "g");
  const next = template.replace(lastmodRegex, `<lastmod>${date}</lastmod>`);

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, next, "utf8");
  console.log(`[sitemap] wrote dist/sitemap.xml (lastmod=${date})`);
}

main();
