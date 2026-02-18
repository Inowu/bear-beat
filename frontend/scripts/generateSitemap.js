/* eslint-disable no-console */
/**
 * Generate `dist/sitemap.xml` from src/seo/routes.json.
 * Emits only public + indexable routes and hard-excludes private sections.
 */

const fs = require("node:fs");
const path = require("node:path");

function readSeoConfig(cwd) {
  const configPath = path.join(cwd, "src", "seo", "routes.json");
  const raw = fs.readFileSync(configPath, "utf8");
  return JSON.parse(raw);
}

const REQUIRED_PUBLIC_PATHS = ["/", "/planes", "/legal"];
const PRIVATE_ROUTE_PREFIXES = [
  "/auth",
  "/admin",
  "/micuenta",
  "/descargas",
  "/comprar",
  "/actualizar-planes",
];

function normalizePath(pathname) {
  const base = String(pathname || "/").split("?")[0].split("#")[0] || "/";
  if (base === "/") return "/";
  const withSlash = base.startsWith("/") ? base : `/${base}`;
  return withSlash.endsWith("/") ? withSlash.slice(0, -1) : withSlash;
}

function isPrivatePath(pathname) {
  const normalized = normalizePath(pathname);
  return PRIVATE_ROUTE_PREFIXES.some(
    (prefix) => normalized === prefix || normalized.startsWith(`${prefix}/`),
  );
}

function buildAbsoluteUrl(baseUrl, pathOrUrl) {
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
  const normalizedPath = normalizePath(pathOrUrl);
  return normalizedPath === "/" ? `${baseUrl}/` : `${baseUrl}${normalizedPath}`;
}

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

function buildSitemapXml(routes, lastmod) {
  const urls = routes
    .map((route) => {
      const changefreq = route.changefreq || "monthly";
      const priority = route.priority || "0.5";
      return [
        "  <url>",
        `    <loc>${escapeXml(route.loc)}</loc>`,
        `    <lastmod>${escapeXml(lastmod)}</lastmod>`,
        `    <changefreq>${escapeXml(changefreq)}</changefreq>`,
        `    <priority>${escapeXml(priority)}</priority>`,
        "  </url>",
      ].join("\n");
    })
    .join("\n");

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    urls,
    "</urlset>",
    "",
  ].join("\n");
}

function buildSitemapRoutes(config) {
  const routeMap = (config.routes || [])
    .filter((route) => route && route.inSitemap === true && route.indexable === true)
    .filter((route) => typeof route.path === "string" && !route.path.includes("*"))
    .map((route) => ({
      path: normalizePath(route.canonicalPath || route.path),
      changefreq: route.changefreq,
      priority: route.priority,
    }))
    .filter((route) => !isPrivatePath(route.path))
    .reduce((acc, route) => {
      if (!acc.has(route.path)) acc.set(route.path, route);
      return acc;
    }, new Map());

  const missingRequired = REQUIRED_PUBLIC_PATHS.filter((requiredPath) => !routeMap.has(requiredPath));
  if (missingRequired.length > 0) {
    throw new Error(
      `Missing required public routes in sitemap config: ${missingRequired.join(", ")}`,
    );
  }

  return Array.from(routeMap.values());
}

function main() {
  const cwd = process.cwd(); // expected: <repo>/frontend (npm workspace)
  const config = readSeoConfig(cwd);
  const baseUrl = String(config.baseUrl || "").trim();
  if (!baseUrl) {
    throw new Error("Missing baseUrl in src/seo/routes.json");
  }

  const sitemapRoutes = buildSitemapRoutes(config).map((route) => ({
    loc: buildAbsoluteUrl(baseUrl, route.path),
    changefreq: route.changefreq,
    priority: route.priority,
  }));

  const distPath = path.join(cwd, "dist", "sitemap.xml");
  const publicPath = path.join(cwd, "public", "sitemap.xml");
  const date = isoDateUtc();
  const xml = buildSitemapXml(sitemapRoutes, date);

  fs.mkdirSync(path.dirname(distPath), { recursive: true });
  fs.writeFileSync(distPath, xml, "utf8");
  fs.mkdirSync(path.dirname(publicPath), { recursive: true });
  fs.writeFileSync(publicPath, xml, "utf8");
  console.log(
    `[sitemap] wrote dist/public sitemap.xml (lastmod=${date}, urls=${sitemapRoutes.length})`,
  );
}

main();
