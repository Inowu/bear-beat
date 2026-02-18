/* eslint-disable no-console */
/**
 * Head prerender for public routes:
 * - Uses `dist/index.html` as template.
 * - Writes route-specific HTML to `dist/<route>/index.html`.
 * - Replaces only `<head>` SEO tags (title, description, canonical, og/twitter, robots).
 */

const fs = require("node:fs");
const path = require("node:path");

function readSeoConfig(cwd) {
  const configPath = path.join(cwd, "src", "seo", "routes.json");
  return JSON.parse(fs.readFileSync(configPath, "utf8"));
}

const REQUIRED_PRERENDER_PUBLIC_PATHS = ["/", "/planes", "/legal"];

function normalizePath(pathname) {
  const base = String(pathname || "/").split("?")[0].split("#")[0] || "/";
  if (base === "/") return "/";
  const withSlash = base.startsWith("/") ? base : `/${base}`;
  return withSlash.endsWith("/") ? withSlash.slice(0, -1) : withSlash;
}

function toAbsoluteUrl(baseUrl, pathOrUrl) {
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
  const normalizedPath = normalizePath(pathOrUrl);
  return normalizedPath === "/" ? `${baseUrl}/` : `${baseUrl}${normalizedPath}`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function replaceOrInsert(html, regex, replacement) {
  if (regex.test(html)) return html.replace(regex, replacement);
  return html.replace("</head>", `  ${replacement}\n</head>`);
}

function applyHead(html, route, config) {
  const canonicalUrl = toAbsoluteUrl(
    config.baseUrl,
    route.canonical || route.canonicalPath || route.path,
  );
  const title = route.title || config.defaultMeta.title;
  const description = route.description || config.defaultMeta.description;
  const ogImage = route.ogImage || config.defaultMeta.ogImage;
  const twitterImage = route.twitterImage || ogImage;
  const robots = route.indexable ? "index, follow" : "noindex, nofollow";

  let result = html;
  result = replaceOrInsert(result, /<title[\s\S]*?<\/title>/i, `<title>${escapeHtml(title)}</title>`);
  result = replaceOrInsert(
    result,
    /<meta[^>]*name=["']description["'][^>]*>/i,
    `<meta name="description" content="${escapeHtml(description)}" />`,
  );
  result = replaceOrInsert(
    result,
    /<meta[^>]*name=["']robots["'][^>]*>/i,
    `<meta name="robots" content="${escapeHtml(robots)}" />`,
  );
  result = replaceOrInsert(
    result,
    /<meta[^>]*name=["']googlebot["'][^>]*>/i,
    `<meta name="googlebot" content="${escapeHtml(robots)}" />`,
  );
  result = replaceOrInsert(
    result,
    /<link[^>]*rel=["']canonical["'][^>]*>/i,
    `<link rel="canonical" href="${escapeHtml(canonicalUrl)}" />`,
  );
  result = replaceOrInsert(
    result,
    /<meta[^>]*property=["']og:title["'][^>]*>/i,
    `<meta property="og:title" content="${escapeHtml(title)}" />`,
  );
  result = replaceOrInsert(
    result,
    /<meta[^>]*property=["']og:description["'][^>]*>/i,
    `<meta property="og:description" content="${escapeHtml(description)}" />`,
  );
  result = replaceOrInsert(
    result,
    /<meta[^>]*property=["']og:url["'][^>]*>/i,
    `<meta property="og:url" content="${escapeHtml(canonicalUrl)}" />`,
  );
  result = replaceOrInsert(
    result,
    /<meta[^>]*property=["']og:image["'][^>]*>/i,
    `<meta property="og:image" content="${escapeHtml(ogImage)}" />`,
  );
  result = replaceOrInsert(
    result,
    /<meta[^>]*name=["']twitter:title["'][^>]*>/i,
    `<meta name="twitter:title" content="${escapeHtml(title)}" />`,
  );
  result = replaceOrInsert(
    result,
    /<meta[^>]*name=["']twitter:description["'][^>]*>/i,
    `<meta name="twitter:description" content="${escapeHtml(description)}" />`,
  );
  result = replaceOrInsert(
    result,
    /<meta[^>]*name=["']twitter:url["'][^>]*>/i,
    `<meta name="twitter:url" content="${escapeHtml(canonicalUrl)}" />`,
  );
  result = replaceOrInsert(
    result,
    /<meta[^>]*name=["']twitter:image["'][^>]*>/i,
    `<meta name="twitter:image" content="${escapeHtml(twitterImage)}" />`,
  );

  return result;
}

function routeOutputPath(distDir, routePath) {
  const normalizedPath = normalizePath(routePath);
  if (normalizedPath === "/") return path.join(distDir, "index.html");
  return path.join(distDir, normalizedPath.slice(1), "index.html");
}

function main() {
  const cwd = process.cwd();
  const config = readSeoConfig(cwd);
  const distDir = path.join(cwd, "dist");
  const templatePath = path.join(distDir, "index.html");

  if (!fs.existsSync(templatePath)) {
    throw new Error("dist/index.html not found. Run vite build first.");
  }

  const template = fs.readFileSync(templatePath, "utf8");
  const prerenderRoutes = (config.routes || [])
    .filter((route) => route && route.prerender === true && route.indexable === true)
    .filter((route) => typeof route.path === "string" && !route.path.includes("*"));

  const prerenderPathSet = new Set(prerenderRoutes.map((route) => normalizePath(route.path)));
  const missingRequired = REQUIRED_PRERENDER_PUBLIC_PATHS.filter(
    (requiredPath) => !prerenderPathSet.has(requiredPath),
  );
  if (missingRequired.length > 0) {
    throw new Error(
      `Missing required prerender public routes: ${missingRequired.join(", ")}`,
    );
  }

  if (prerenderRoutes.length === 0) {
    console.log("[prerender:head] No prerender routes configured.");
    return;
  }

  for (const route of prerenderRoutes) {
    const outputPath = routeOutputPath(distDir, route.path);
    const outputHtml = applyHead(template, route, config);
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, outputHtml, "utf8");
    console.log(`[prerender:head] wrote ${path.relative(cwd, outputPath)} (${route.path})`);
  }
}

main();
