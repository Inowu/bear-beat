import "./_loadEnv";
import fs from "fs";
import path from "path";
import { spawn } from "child_process";
import * as ts from "typescript";
import { chromium, type Browser, type BrowserContext, type Locator, type Page } from "playwright";
import AxeBuilder from "@axe-core/playwright";

type RouteType = "public" | "auth" | "app" | "admin";

type ScreenshotStatus = "captured" | "captured_masked" | "skipped_pii" | "failed";

type AuthTokens = {
  token: string;
  refreshToken: string;
};

type RouteMapEntry = {
  path: string;
  type: RouteType;
  requiresAuth: boolean;
  requiresRole: "admin" | null;
  sourceFile: string;
  notes: string[];
};

type UiInventoryInteractive = {
  route: string;
  tagName: string;
  role: string | null;
  type: string | null;
  accessibleName: string;
  visibleText: string;
  ariaLabel: string | null;
  nameAttr: string | null;
  id: string | null;
  href: string | null;
  disabled: boolean;
  required: boolean;
  placeholder: string | null;
  testId: string | null;
  selector: string;
  hasIcon: boolean;
  isIconOnly: boolean;
};

type UiInventoryRouteResult = {
  path: string;
  authState: "anonymous" | "authenticated";
  finalUrl: string;
  title: string;
  status: "ok" | "error" | "auth_redirect" | "role_mismatch";
  error?: string;
  console: Array<{ type: string; text: string }>;
  httpErrors: Array<{ url: string; method: string; status: number; statusText: string }>;
  failedRequests: Array<{ url: string; method: string; failure: string }>;
  blockedWrites: Array<{ url: string; method: string; reason: string }>;
  interactive: UiInventoryInteractive[];
  interactiveDesktop?: UiInventoryInteractive[];
  interactiveMobile?: UiInventoryInteractive[];
  iconOnlyMissingLabel: Array<{
    selector: string;
    route: string;
    tagName: string;
  }>;
  iconOnlyMissingLabelDesktop?: Array<{
    selector: string;
    route: string;
    tagName: string;
  }>;
  iconOnlyMissingLabelMobile?: Array<{
    selector: string;
    route: string;
    tagName: string;
  }>;
  screenshotStatusDesktop?: ScreenshotStatus;
  screenshotStatusMobile?: ScreenshotStatus;
  screenshotMasked: boolean;
  screenshots: { desktop: string; mobile: string } | null;
  a11y: {
    violationCount: number;
    byImpact: Record<string, number>;
    violations: Array<{
      id: string;
      impact: string | null;
      description: string;
      help: string;
      helpUrl: string;
      nodes: Array<{ target: string; failureSummary?: string }>;
    }>;
  } | null;
  a11yDesktop?: {
    violationCount: number;
    byImpact: Record<string, number>;
    violations: Array<{
      id: string;
      impact: string | null;
      description: string;
      help: string;
      helpUrl: string;
      nodes: Array<{ target: string; failureSummary?: string }>;
    }>;
  } | null;
  a11yMobile?: {
    violationCount: number;
    byImpact: Record<string, number>;
    violations: Array<{
      id: string;
      impact: string | null;
      description: string;
      help: string;
      helpUrl: string;
      nodes: Array<{ target: string; failureSummary?: string }>;
    }>;
  } | null;
};

type UiInventoryReport = {
  generatedAt: string;
  baseUrl: string;
  routes: UiInventoryRouteResult[];
};

const REPO_ROOT = path.resolve(__dirname, "..", "..");
const FRONTEND_INDEX = path.resolve(REPO_ROOT, "frontend", "src", "index.tsx");
// Default artifacts:
// - Reports live under docs (tracked).
// - Screenshots live under /audit/screenshots (gitignored, may contain PII depending on DB).
//
// Production audits must write to an explicit AUDIT_ARTIFACTS_DIR (gitignored) and apply
// a read-only network guard + privacy masking for screenshots.
// Keep PII redacted in textual artifacts (see sanitizeText()).
const DEFAULT_DOCS_AUDIT_DIR = path.resolve(REPO_ROOT, "docs", "audit");
const DEFAULT_SCREENSHOTS_DIR = path.resolve(REPO_ROOT, "audit", "screenshots");

const AUDIT_ARTIFACTS_DIR = process.env.AUDIT_ARTIFACTS_DIR?.trim() || "";
const ARTIFACTS_DIR = AUDIT_ARTIFACTS_DIR
  ? path.resolve(REPO_ROOT, AUDIT_ARTIFACTS_DIR)
  : DEFAULT_DOCS_AUDIT_DIR;
const SCREENSHOTS_DIR = AUDIT_ARTIFACTS_DIR
  ? path.join(ARTIFACTS_DIR, "screenshots")
  : DEFAULT_SCREENSHOTS_DIR;

const READ_ONLY = process.env.AUDIT_READ_ONLY === "1";
const PRIVACY_MASK = process.env.AUDIT_PRIVACY_MASK === "1" || READ_ONLY;
const AUDIT_EXTRA_HEADERS = READ_ONLY ? { "x-bb-audit-readonly": "1" } : undefined;

function ensureDir(p: string) {
  fs.mkdirSync(p, { recursive: true });
}

function writeJson(filePath: string, data: unknown) {
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

function writeText(filePath: string, data: string) {
  fs.writeFileSync(filePath, data, "utf8");
}

function sanitizeText(value: string): string {
  const raw = `${value ?? ""}`;
  if (!raw) return "";
  let out = raw;

  // Redact emails and phones to avoid leaking PII into committed audit artifacts.
  out = out.replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "<redacted-email>");
  out = out.replace(/\+\d{1,4}\s\d{4,14}/g, "<redacted-phone>");

  out = out.replace(/\s+/g, " ").trim();
  if (out.length > 160) out = `${out.slice(0, 157)}...`;
  return out;
}

function sanitizeUrlForArtifact(rawUrl: string): string {
  // Strip query/hash to avoid leaking tokens in audit artifacts.
  // Still keeps the information needed for finalUrl/path mismatch checks.
  try {
    const u = new URL(rawUrl);
    return `${u.origin}${u.pathname}`;
  } catch {
    return sanitizeText(rawUrl);
  }
}

let cachedTrpcMutationProcedures: Set<string> | null = null;

function getTrpcMutationProcedures(): Set<string> {
  if (!READ_ONLY) return new Set<string>();
  if (cachedTrpcMutationProcedures) return cachedTrpcMutationProcedures;

  const { spawnSync } = require("child_process") as typeof import("child_process");
  const res = spawnSync(
    "rg",
    ["-oN", "trpc\\.[A-Za-z0-9_$.]+\\.mutate(?:Async)?\\b", "frontend/src"],
    { cwd: REPO_ROOT, encoding: "utf8" },
  );
  const output = `${res.stdout ?? ""}`;
  const lines = output.split("\n").filter(Boolean);

  const set = new Set<string>();
  for (const line of lines) {
    const idx = line.indexOf(":trpc.");
    const rawExpr = idx >= 0 ? line.slice(idx + 1) : line.trim();
    const expr = rawExpr.trim();
    if (!expr.startsWith("trpc.")) continue;
    const pathExpr = expr
      .replace(/^trpc\./, "")
      .replace(/\.mutate(?:Async)?$/, "")
      .replace(/\?\./g, ".");
    if (!pathExpr) continue;
    set.add(pathExpr);
  }

  cachedTrpcMutationProcedures = set;
  return set;
}

function getAllowedTrpcMutations(): Set<string> {
  // Production audits are READ-ONLY, but authentication is allowed.
  // Keep this allowlist minimal.
  const allow = new Set<string>(["auth.login"]);
  const extra = process.env.AUDIT_READ_ONLY_TRPC_ALLOW_MUTATIONS?.trim();
  if (extra) {
    for (const p of extra.split(",").map((s) => s.trim()).filter(Boolean)) {
      allow.add(p);
    }
  }
  return allow;
}

function parseTrpcProceduresFromUrl(rawUrl: string): string[] {
  try {
    const u = new URL(rawUrl);
    const path = u.pathname;
    const idx = path.indexOf("/trpc/");
    if (idx === -1) return [];
    const segment = path.slice(idx + "/trpc/".length);
    if (!segment) return [];
    return segment
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  } catch {
    return [];
  }
}

function isTurnstileUrl(u: URL): boolean {
  return u.hostname === "challenges.cloudflare.com";
}

async function installReadOnlyGuard(
  page: Page,
  blockedWrites: UiInventoryRouteResult["blockedWrites"],
): Promise<void> {
  if (!READ_ONLY) return;

  const mutationProcedures = getTrpcMutationProcedures();
  const allowedMutations = getAllowedTrpcMutations();

  await page.route("**/*", async (route) => {
    const req = route.request();
    const method = req.method().toUpperCase();
    if (method === "GET" || method === "HEAD" || method === "OPTIONS") {
      await route.continue();
      return;
    }

    const rawUrl = req.url();
    let u: URL | null = null;
    try {
      u = new URL(rawUrl);
    } catch {
      blockedWrites.push({ url: sanitizeText(rawUrl), method, reason: "blocked_invalid_url" });
      await route.abort("blockedbyclient");
      return;
    }

    // Allow Turnstile/Cloudflare challenge endpoints when present (auth anti-bot).
    if (isTurnstileUrl(u)) {
      await route.continue();
      return;
    }

    // Allow TRPC queries (POST) required for navigation/data fetching, but block any known mutation procedures.
    if (method === "POST" && u.pathname.includes("/trpc")) {
      const procedures = parseTrpcProceduresFromUrl(rawUrl);
      if (procedures.length === 0) {
        blockedWrites.push({ url: sanitizeText(rawUrl), method, reason: "blocked_trpc_unknown_procedure" });
        await route.abort("blockedbyclient");
        return;
      }

      const blockedProc = procedures.find((p) => mutationProcedures.has(p) && !allowedMutations.has(p));
      if (blockedProc) {
        blockedWrites.push({
          url: sanitizeText(rawUrl),
          method,
          reason: `blocked_trpc_mutation:${sanitizeText(blockedProc)}`,
        });
        await route.abort("blockedbyclient");
        return;
      }

      await route.continue();
      return;
    }

    // Default: block all other non-GET methods (production audits are read-only).
    blockedWrites.push({
      url: sanitizeText(rawUrl),
      method,
      reason: "blocked_non_get",
    });
    await route.abort("blockedbyclient");
  });
}

async function applyPrivacyMaskForScreenshots(page: Page): Promise<void> {
  if (!PRIVACY_MASK) return;
  await page.evaluate(() => {
    const STYLE_ID = "audit-privacy-mask-style";
    if (!document.getElementById(STYLE_ID)) {
      const style = document.createElement("style");
      style.id = STYLE_ID;
      style.textContent = `
        [data-audit-mask=\"1\"] { filter: blur(10px) !important; }
        [data-audit-mask=\"1\"] * { filter: blur(10px) !important; }
      `;
      document.head.appendChild(style);
    }

    const mark = (el: Element | null) => {
      if (!el) return;
      try {
        (el as HTMLElement).setAttribute("data-audit-mask", "1");
      } catch {
        // noop
      }
    };

    // Route-specific/class-based masking (stable selectors from the codebase).
    const selectors = [
      // MyAccount
      ".ma-user-name",
      ".ma-user-meta",
      ".ma-ftp-value",
      ".ma-card-number",
      ".ma-card-date",
      ".ma-ftp-row",

      // Admin (usuarios + common table/card patterns)
      ".admin-cell-email",
      ".admin-cell-phone",
      ".admin-cell-value",
      ".admin-user-inline__name",
      ".admin-mobile-card__email",
      ".admin-mobile-card__name",
      ".admin-table td",
      ".admin-mobile-card",
    ];
    for (const sel of selectors) {
      document.querySelectorAll(sel).forEach(mark);
    }

    const emailRe = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\\.[A-Z]{2,}/i;
    const phoneRe = /\\+\\d{1,4}\\s\\d{4,14}/;

    // Generic: mask leaf elements that contain email/phone-like strings.
    const els = Array.from(document.querySelectorAll("body *"));
    for (const el of els) {
      if (!(el instanceof HTMLElement)) continue;
      if (el.childElementCount > 0) continue;
      const text = (el.innerText || el.textContent || "").trim();
      if (text.length < 4 || text.length > 90) continue;
      if (emailRe.test(text) || phoneRe.test(text)) mark(el);
      const title = el.getAttribute("title") || "";
      if (title && title.length <= 120 && (emailRe.test(title) || phoneRe.test(title))) mark(el);
    }
  });
}

function getScreenshotMaskLocators(page: Page, route: RouteMapEntry): Locator[] {
  if (!PRIVACY_MASK) return [];
  // Public screenshots are safe to keep readable. Any other surface (auth/app/admin)
  // can contain typed values (email/password) or account data; always mask inputs.
  if (route.type === "public") return [];

  const masks: Locator[] = [];

  // Forms can contain typed values (email/phone, etc).
  masks.push(page.locator("input, textarea, [contenteditable='true']"));

  // App: MyAccount (email/phone/FTP values)
  masks.push(
    page.locator(
      [
        ".ma-user-name",
        ".ma-user-meta",
        ".ma-ftp-row",
        ".ma-ftp-value",
        ".ma-card-number",
        ".ma-card-date",
      ].join(", "),
    ),
  );

  // Admin: user lists and table-like pages
  masks.push(
    page.locator(
      [
        ".admin-table",
        ".admin-mobile-card",
        ".admin-user-inline",
        ".admin-user-inline__name",
        ".admin-cell-email",
        ".admin-cell-phone",
        ".admin-mobile-card__name",
        ".admin-mobile-card__email",
      ].join(", "),
    ),
  );

  // Heuristic: anything visibly containing email/phone-like patterns.
  masks.push(page.locator("text=/@/"));
  masks.push(page.locator("text=/\\+\\d{1,4}\\s\\d{4,14}/"));

  // Admin pages frequently contain PII; mask the entire main content for safety.
  if (route.type === "admin") {
    masks.push(page.locator("main"));
  }

  return masks;
}

function stableSlug(input: string): string {
  const normalized = input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return normalized || "root";
}

function joinPaths(parent: string, child: string): string {
  const p = parent === "/" ? "" : parent.replace(/\/+$/g, "");
  const c = child.replace(/^\/+/g, "");

  if (child === "*") return `${p || ""}/*` || "/*";
  if (child === "") return p || "/";
  return `${p}/${c}`.replace(/\/+/g, "/");
}

function isJsxWrappingAuthRoute(node: ts.Expression | undefined): boolean {
  if (!node) return false;
  const text = node.getText();
  return /<AuthRoute\b/.test(text);
}

function isJsxWrappingNotAuthRoute(node: ts.Expression | undefined): boolean {
  if (!node) return false;
  const text = node.getText();
  return /<NotAuthRoute\b/.test(text);
}

function routeTypeFor(pathname: string, requiresAuth: boolean): RouteType {
  if (pathname.startsWith("/admin")) return "admin";
  if (pathname.startsWith("/auth")) return "auth";
  if (!requiresAuth) return "public";
  return "app";
}

function parseRouteMapFromFrontendIndex(): RouteMapEntry[] {
  const code = fs.readFileSync(FRONTEND_INDEX, "utf8");
  const sourceFile = ts.createSourceFile(
    FRONTEND_INDEX,
    code,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );

  let routerArg: ts.ArrayLiteralExpression | null = null;

  const visit = (node: ts.Node) => {
    if (ts.isCallExpression(node)) {
      const callee = node.expression;
      if (ts.isIdentifier(callee) && callee.text === "createBrowserRouter") {
        const [firstArg] = node.arguments;
        if (firstArg && ts.isArrayLiteralExpression(firstArg)) {
          routerArg = firstArg;
        }
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);

  if (!routerArg) {
    throw new Error("No se encontró createBrowserRouter([...]) en frontend/src/index.tsx");
  }
  const routerArray = routerArg as unknown as ts.ArrayLiteralExpression;

  const out: RouteMapEntry[] = [];

  const walk = (node: ts.ObjectLiteralExpression, parentPath: string) => {
    let routePath = "";
    let children: ts.ArrayLiteralExpression | null = null;
    let elementExpr: ts.Expression | undefined;

    for (const prop of node.properties) {
      if (!ts.isPropertyAssignment(prop)) continue;
      const name = prop.name;
      const key = ts.isIdentifier(name)
        ? name.text
        : ts.isStringLiteral(name)
          ? name.text
          : null;

      if (key === "path") {
        if (ts.isStringLiteral(prop.initializer)) {
          routePath = prop.initializer.text;
        }
      }

      if (key === "children") {
        if (ts.isArrayLiteralExpression(prop.initializer)) {
          children = prop.initializer;
        }
      }

      if (key === "element") {
        elementExpr = prop.initializer;
      }
    }

    const fullPath = joinPaths(parentPath, routePath);
    const wrappedAuth = isJsxWrappingAuthRoute(elementExpr);
    const wrappedNotAuth = isJsxWrappingNotAuthRoute(elementExpr);

    // AuthRoute wrapper is the source of truth for "requiresAuth" at router-level.
    // Admin routes additionally enforce role inside the admin pages.
    const requiresAuth = fullPath.startsWith("/admin") ? true : wrappedAuth;
    const requiresRole = fullPath.startsWith("/admin") ? "admin" : null;

    const notes: string[] = [];
    if (wrappedAuth) notes.push("Wrapped with <AuthRoute> (redirects to /auth if no token).");
    if (wrappedNotAuth) notes.push("Wrapped with <NotAuthRoute> (redirects to / if already logged in).");
    if (fullPath.startsWith("/admin")) {
      notes.push("Admin pages also check currentUser.role === 'admin' inside each page component.");
    }

    const type = routeTypeFor(fullPath, requiresAuth);

    out.push({
      path: fullPath,
      type,
      requiresAuth,
      requiresRole,
      sourceFile: path.relative(REPO_ROOT, FRONTEND_INDEX),
      notes,
    });

    if (children) {
      for (const el of (children as unknown as ts.ArrayLiteralExpression).elements) {
        if (ts.isObjectLiteralExpression(el)) {
          walk(el, fullPath);
        }
      }
    }
  };

  for (const el of routerArray.elements) {
    if (ts.isObjectLiteralExpression(el)) {
      walk(el, "");
    }
  }

  // De-dup (router has some "path: ''" entries we flatten).
  const seen = new Set<string>();
  const unique = out.filter((r) => {
    if (seen.has(r.path)) return false;
    seen.add(r.path);
    return true;
  });

  // Sort for stable diffs.
  unique.sort((a, b) => a.path.localeCompare(b.path, "en"));
  return unique;
}

async function waitForHttpOk(url: string, timeoutMs: number): Promise<void> {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const res = await fetch(url, { redirect: "follow" as any });
      if (res.ok) return;
    } catch {
      // ignore
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`Timeout esperando server en ${url}`);
}

function spawnDevServersIfNeeded(baseUrl: string): { child: ReturnType<typeof spawn> | null } {
  const shouldStart = process.env.AUDIT_START_SERVERS === "1";
  if (!shouldStart) return { child: null };

  const cmd = process.env.AUDIT_START_CMD?.trim() || "npm start";
  const env = {
    ...process.env,
    // Make dev server quieter and more deterministic where possible.
    BROWSER: "none",
  };

  // Avoid `shell: true` for the default `npm start`, otherwise the "child.pid"
  // is the shell and `process.kill(-pid)` won't terminate the actual npm/dev servers.
  const isDefaultNpmStart = cmd === "npm start";
  const child = isDefaultNpmStart
    ? spawn(process.platform === "win32" ? "npm.cmd" : "npm", ["start"], {
        cwd: REPO_ROOT,
        detached: true,
        env,
        stdio: "ignore",
      })
    : spawn(cmd, {
        cwd: REPO_ROOT,
        shell: true,
        detached: true,
        env,
        stdio: "ignore",
      });

  // Prevent orphaned process on parent exit.
  child.unref();
  return { child };
}

function safeKill(child: ReturnType<typeof spawn> | null) {
  if (!child?.pid) return;
  try {
    // Kill the whole process group (concurrently -> FE+BE).
    // `process.kill(-pid)` is POSIX-only; keep a best-effort fallback for Windows.
    if (process.platform === "win32") child.kill("SIGTERM");
    else process.kill(-child.pid, "SIGTERM");
  } catch {
    // ignore
  }
}

async function withBrowser<T>(fn: (browser: Browser) => Promise<T>): Promise<T> {
  const browser = await chromium.launch({ headless: true });
  try {
    return await fn(browser);
  } finally {
    await browser.close();
  }
}

async function collectRouteResult(
  ctx: BrowserContext,
  baseUrl: string,
  route: RouteMapEntry,
  authState: "anonymous" | "authenticated",
  authTokens?: AuthTokens,
): Promise<UiInventoryRouteResult> {
  const page = await ctx.newPage();

  const consoleEvents: Array<{ type: string; text: string }> = [];
  const httpErrors: Array<{ url: string; method: string; status: number; statusText: string }> = [];
  const failedRequests: Array<{ url: string; method: string; failure: string }> = [];
  const blockedWrites: Array<{ url: string; method: string; reason: string }> = [];

  page.on("console", (msg) => {
    const type = msg.type();
    const text = sanitizeText(msg.text());

    // Audits run with a read-only guard that aborts writes (mutations, pixels, analytics).
    // The browser emits noisy console errors like `net::ERR_BLOCKED_BY_CLIENT` for those aborts.
    // Keep them out of "console errors" so findings focus on real app issues.
    if (/ERR_BLOCKED_BY_CLIENT/i.test(text)) return;

    consoleEvents.push({ type, text });
  });

  page.on("response", (res) => {
    const status = res.status();
    if (status < 400) return;
    try {
      const req = res.request();
      const url = sanitizeText(res.url());
      const method = req.method();
      const statusText = sanitizeText(res.statusText());
      const key = `${method} ${url} ${status}`;
      // De-dupe to keep artifacts readable.
      if (httpErrors.some((e) => `${e.method} ${e.url} ${e.status}` === key)) return;
      httpErrors.push({ url, method, status, statusText });
    } catch {
      // noop
    }
  });

  page.on("requestfailed", (req) => {
    const failure = req.failure();
    const url = sanitizeText(req.url());
    const method = req.method();
    if (blockedWrites.some((b) => b.url === url && b.method === method)) return;
    failedRequests.push({
      url,
      method,
      failure: sanitizeText(failure?.errorText ?? "unknown"),
    });
  });

  const resultBase: UiInventoryRouteResult = {
    path: route.path,
    authState,
    finalUrl: "",
    title: "",
    status: "ok",
    console: consoleEvents,
    httpErrors,
    failedRequests,
    blockedWrites,
    interactive: [],
    iconOnlyMissingLabel: [],
    screenshotMasked: false,
    screenshots: null,
    a11y: null,
  };

  const slug = stableSlug(route.path.replace(/\//g, "-"));
  const desktopPath = path.join(SCREENSHOTS_DIR, `${slug}--desktop.png`);
  const mobilePath = path.join(SCREENSHOTS_DIR, `${slug}--mobile.png`);

  const evaluateInventory = async (): Promise<{
    interactive: UiInventoryInteractive[];
    iconOnlyMissingLabel: Array<{ selector: string; tagName: string }>;
  }> => {
    return await page.evaluate(() => {
      const isVisible = (el: Element): boolean => {
        const style = window.getComputedStyle(el as HTMLElement);
        if (style.visibility === "hidden" || style.display === "none") return false;
        const rect = (el as HTMLElement).getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      };

      const sanitize = (value: string): string => {
        const raw = `${value ?? ""}`;
        if (!raw) return "";
        let out = raw;
        out = out.replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "<redacted-email>");
        out = out.replace(/\+\d{1,4}\s\d{4,14}/g, "<redacted-phone>");
        out = out.replace(/\s+/g, " ").trim();
        if (out.length > 160) out = `${out.slice(0, 157)}...`;
        return out;
      };

      const getLabelText = (el: HTMLElement): string => {
        const ariaLabel = el.getAttribute("aria-label");
        if (ariaLabel) return ariaLabel;
        const labelledBy = el.getAttribute("aria-labelledby");
        if (labelledBy) {
          const parts = labelledBy.split(/\s+/g).filter(Boolean);
          const texts = parts
            .map((id) => document.getElementById(id))
            .filter(Boolean)
            .map((node) => (node as HTMLElement).innerText || node?.textContent || "")
            .map((t) => t.trim())
            .filter(Boolean);
          if (texts.length) return texts.join(" ");
        }

        const id = el.getAttribute("id");
        if (id) {
          const label = document.querySelector(`label[for=\"${CSS.escape(id)}\"]`) as HTMLLabelElement | null;
          if (label) return (label.innerText || label.textContent || "").trim();
        }

        const labelParent = el.closest("label");
        if (labelParent) return ((labelParent as HTMLLabelElement).innerText || labelParent.textContent || "").trim();
        return "";
      };

      const getVisibleText = (el: HTMLElement): string => {
        // Avoid huge text blobs.
        const text = (el.innerText || el.textContent || "").trim();
        return sanitize(text);
      };

      const buildSelector = (el: Element): string => {
        const testId = (el as HTMLElement).getAttribute("data-testid");
        if (testId) return `[data-testid=\"${CSS.escape(testId)}\"]`;
        const id = (el as HTMLElement).id;
        if (id) return `#${CSS.escape(id)}`;
        const role = (el as HTMLElement).getAttribute("role");
        const tag = el.tagName.toLowerCase();
        const classes = Array.from((el as HTMLElement).classList)
          .slice(0, 2)
          .map((c) => `.${CSS.escape(c)}`)
          .join("");
        const name = (getLabelText(el as HTMLElement) || getVisibleText(el as HTMLElement)).slice(0, 30);
        const nameAttr = name ? `[data-name~=\"${CSS.escape(name.split(" ")[0] ?? "")}\"]` : "";
        return `${tag}${classes}${role ? `[role=\"${CSS.escape(role)}\"]` : ""}${nameAttr}`;
      };

      const isInteractive = (el: Element): boolean => {
        const tag = el.tagName.toLowerCase();
        if (tag === "button") return true;
        if (tag === "a") return Boolean((el as HTMLAnchorElement).href);
        if (tag === "input" || tag === "select" || tag === "textarea") return true;
        const role = (el as HTMLElement).getAttribute("role");
        if (role === "button" || role === "link" || role === "checkbox" || role === "radio" || role === "switch") return true;
        return false;
      };

      const nodes = Array.from(document.querySelectorAll("*")).filter((el) => isInteractive(el) && isVisible(el));
      const interactive = nodes.map((el) => {
        const h = el as HTMLElement;
        const tagName = h.tagName.toLowerCase();
        const role = h.getAttribute("role");
        const type = tagName === "input" ? (h as HTMLInputElement).type : h.getAttribute("type");
        const ariaLabel = h.getAttribute("aria-label");
        const nameAttr = h.getAttribute("name");
        const id = h.getAttribute("id");
        const href = tagName === "a" ? (h as HTMLAnchorElement).getAttribute("href") : null;
        const disabled = (h as any).disabled === true || h.getAttribute("aria-disabled") === "true";
        const required = (h as any).required === true || h.getAttribute("aria-required") === "true";
        const placeholder = tagName === "input" || tagName === "textarea" ? h.getAttribute("placeholder") : null;
        const testId = h.getAttribute("data-testid");

        const visibleText = getVisibleText(h);
        const accessibleName = sanitize(getLabelText(h) || visibleText || placeholder || "");

        const hasSvg = Boolean(h.querySelector("svg"));
        // `content-visibility: auto` can keep below-the-fold text un-rendered, making `innerText` empty.
        // Fall back to `textContent` so we don't misclassify real text labels as "icon-only".
        const hasText = Boolean((h.innerText || h.textContent || "").trim());
        const isIconOnly = hasSvg && !hasText && !ariaLabel;

        return {
          route: window.location.pathname,
          tagName,
          role,
          type: type || null,
          accessibleName,
          visibleText,
          ariaLabel,
          nameAttr,
          id,
          href,
          disabled,
          required,
          placeholder,
          testId,
          selector: buildSelector(h),
          hasIcon: hasSvg,
          isIconOnly,
        };
      });

      const iconOnlyMissingLabel = interactive
        .filter((i) => i.isIconOnly)
        .map((i) => ({ selector: i.selector, tagName: i.tagName }));

      return { interactive, iconOnlyMissingLabel };
    });
  };

  type A11yResult = Exclude<UiInventoryRouteResult["a11y"], null>;

  const runA11y = async (): Promise<UiInventoryRouteResult["a11y"]> => {
    try {
      const axe = new AxeBuilder({ page });
      const analysis = await axe.analyze();
      const byImpact: Record<string, number> = {};
      for (const v of analysis.violations) {
        const impact = v.impact ?? "unknown";
        byImpact[impact] = (byImpact[impact] ?? 0) + 1;
      }

      const out: A11yResult = {
        violationCount: analysis.violations.length,
        byImpact,
        violations: analysis.violations.map((v) => ({
          id: v.id,
          impact: v.impact ?? null,
          description: v.description,
          help: v.help,
          helpUrl: v.helpUrl,
          nodes: v.nodes.slice(0, 10).map((n) => ({
            target: sanitizeText(JSON.stringify(n.target)),
            failureSummary: sanitizeText(n.failureSummary ?? ""),
          })),
        })),
      };

      return out;
    } catch (err) {
      resultBase.console.push({ type: "warning", text: `axe failed: ${sanitizeText(String(err))}` });
      return null;
    }
  };

  type ViewportCapture = {
    screenshot: string | null;
    screenshotStatus: ScreenshotStatus;
    masked: boolean;
    interactive: UiInventoryInteractive[];
    iconOnlyMissingLabel: Array<{ selector: string; route: string; tagName: string }>;
    a11y: UiInventoryRouteResult["a11y"];
  };

  const captureViewport = async (opts: {
    kind: "desktop" | "mobile";
    viewport: { width: number; height: number };
    screenshotPath: string;
  }): Promise<ViewportCapture | null> => {
    const { kind, viewport, screenshotPath } = opts;
    const masks = getScreenshotMaskLocators(page, route);
    const useMask = masks.length > 0;
    try {
      await page.setViewportSize(viewport);
      await page.waitForTimeout(200);
      if (useMask) {
        await applyPrivacyMaskForScreenshots(page).catch(() => null);
        await page.screenshot({ path: screenshotPath, fullPage: true, mask: masks });
      } else {
        await page.screenshot({ path: screenshotPath, fullPage: true });
      }
    } catch (err) {
      consoleEvents.push({
        type: "warning",
        text: `screenshot failed (${kind}): ${sanitizeText(String(err))}`,
      });
      return {
        screenshot: null,
        screenshotStatus: "failed",
        masked: useMask,
        interactive: [],
        iconOnlyMissingLabel: [],
        a11y: null,
      };
    }

    let inv: Awaited<ReturnType<typeof evaluateInventory>> | null = null;
    try {
      inv = await evaluateInventory();
    } catch (err) {
      consoleEvents.push({
        type: "warning",
        text: `inventory failed (${kind}): ${sanitizeText(String(err))}`,
      });
      inv = { interactive: [], iconOnlyMissingLabel: [] };
    }

    const a11y = await runA11y();

    const interactive = (inv?.interactive ?? []).map((i) => ({
      ...i,
      accessibleName: sanitizeText(i.accessibleName),
      visibleText: sanitizeText(i.visibleText),
    }));

    const iconOnlyMissingLabel = (inv?.iconOnlyMissingLabel ?? []).map((i) => ({
      selector: i.selector,
      route: route.path,
      tagName: i.tagName,
    }));

    return {
      screenshot: path.relative(REPO_ROOT, screenshotPath),
      screenshotStatus: useMask ? "captured_masked" : "captured",
      masked: useMask,
      interactive,
      iconOnlyMissingLabel,
      a11y,
    };
  };

  const mergeA11y = (
    desktop: UiInventoryRouteResult["a11y"],
    mobile: UiInventoryRouteResult["a11y"],
  ): UiInventoryRouteResult["a11y"] => {
    if (!desktop && !mobile) return null;
    const all = [...(desktop?.violations ?? []), ...(mobile?.violations ?? [])];
    const seen = new Set<string>();
    const merged = all.filter((v) => {
      const key = `${v.id}|${v.impact ?? ""}|${v.nodes?.[0]?.target ?? ""}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    const byImpact: Record<string, number> = {};
    for (const v of merged) {
      const impact = v.impact ?? "unknown";
      byImpact[impact] = (byImpact[impact] ?? 0) + 1;
    }
    return {
      violationCount: merged.length,
      byImpact,
      violations: merged,
    };
  };

  try {
    await installReadOnlyGuard(page, blockedWrites).catch((err) => {
      consoleEvents.push({
        type: "warning",
        text: `read-only guard failed: ${sanitizeText(String(err))}`,
      });
    });

    // Auth tokens are stored in sessionStorage (per-tab). When we audit with new pages
    // we must pre-seed sessionStorage BEFORE the app mounts, otherwise AuthRoute redirects.
    if (authTokens) {
      await page.addInitScript(
        (tokens: { token: string; refreshToken: string }) => {
          try {
            window.sessionStorage.setItem("token", tokens.token);
            window.sessionStorage.setItem("refreshToken", tokens.refreshToken);
          } catch {
            // noop
          }
        },
        { token: authTokens.token, refreshToken: authTokens.refreshToken },
      );
    }

    const url = new URL(route.path, baseUrl).toString();
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45_000 });
    await page.waitForTimeout(500);

    resultBase.finalUrl = sanitizeUrlForArtifact(page.url());
    resultBase.title = await page.title();

    try {
      const finalPath = new URL(resultBase.finalUrl).pathname;
      if (authState === "authenticated" && route.requiresAuth && finalPath.startsWith("/auth")) {
        resultBase.status = "auth_redirect";
        resultBase.error = `Ruta protegida redirigida a /auth (finalPath=${finalPath}).`;
      } else if (authState === "authenticated" && route.requiresRole === "admin" && !finalPath.startsWith("/admin")) {
        resultBase.status = "role_mismatch";
        resultBase.error = `Ruta admin no cargó bajo /admin (finalPath=${finalPath}).`;
      }
    } catch {
      // ignore URL parse failures here; they'll be captured in finalUrl checks
    }

    const desktop = await captureViewport({
      kind: "desktop",
      viewport: { width: 1280, height: 800 },
      screenshotPath: desktopPath,
    });
    const mobile = await captureViewport({
      kind: "mobile",
      viewport: { width: 390, height: 844 },
      screenshotPath: mobilePath,
    });

    resultBase.screenshotStatusDesktop = desktop?.screenshotStatus ?? "failed";
    resultBase.screenshotStatusMobile = mobile?.screenshotStatus ?? "failed";
    resultBase.screenshotMasked = Boolean(desktop?.masked || mobile?.masked);

    const desktopShot = desktop?.screenshot ?? null;
    const mobileShot = mobile?.screenshot ?? null;
    resultBase.screenshots = desktopShot && mobileShot ? { desktop: desktopShot, mobile: mobileShot } : null;

    resultBase.interactiveDesktop = desktop?.interactive ?? [];
    resultBase.interactiveMobile = mobile?.interactive ?? [];
    resultBase.interactive = mobile?.interactive ?? desktop?.interactive ?? [];

    resultBase.iconOnlyMissingLabelDesktop = desktop?.iconOnlyMissingLabel ?? [];
    resultBase.iconOnlyMissingLabelMobile = mobile?.iconOnlyMissingLabel ?? [];
    const combinedIcon = [...resultBase.iconOnlyMissingLabelDesktop, ...resultBase.iconOnlyMissingLabelMobile];
    const seenIcon = new Set<string>();
    resultBase.iconOnlyMissingLabel = combinedIcon.filter((i) => {
      const key = `${i.tagName}|${i.selector}`;
      if (seenIcon.has(key)) return false;
      seenIcon.add(key);
      return true;
    });

    resultBase.a11yDesktop = desktop?.a11y ?? null;
    resultBase.a11yMobile = mobile?.a11y ?? null;
    resultBase.a11y = mergeA11y(resultBase.a11yDesktop ?? null, resultBase.a11yMobile ?? null);
  } catch (err) {
    resultBase.status = "error";
    resultBase.error = sanitizeText(String(err));
    resultBase.finalUrl = sanitizeUrlForArtifact(page.url());
    resultBase.title = await page.title().catch(() => "");

    // Evidence is mandatory: try to screenshot even on errors/timeouts.
    if (!resultBase.screenshots) {
      try {
        const masks = getScreenshotMaskLocators(page, route);
        const useMask = masks.length > 0;

        await page.setViewportSize({ width: 1280, height: 800 });
        await page.waitForTimeout(200);
        if (useMask) {
          await applyPrivacyMaskForScreenshots(page).catch(() => null);
          await page.screenshot({ path: desktopPath, fullPage: true, mask: masks });
        } else {
          await page.screenshot({ path: desktopPath, fullPage: true });
        }

        await page.setViewportSize({ width: 390, height: 844 });
        await page.waitForTimeout(200);
        if (useMask) {
          await applyPrivacyMaskForScreenshots(page).catch(() => null);
          await page.screenshot({ path: mobilePath, fullPage: true, mask: masks });
        } else {
          await page.screenshot({ path: mobilePath, fullPage: true });
        }

        resultBase.screenshotStatusDesktop = useMask ? "captured_masked" : "captured";
        resultBase.screenshotStatusMobile = useMask ? "captured_masked" : "captured";
        resultBase.screenshotMasked = useMask;
        resultBase.screenshots = {
          desktop: path.relative(REPO_ROOT, desktopPath),
          mobile: path.relative(REPO_ROOT, mobilePath),
        };
      } catch (screenshotErr) {
        consoleEvents.push({
          type: "warning",
          text: `screenshot failed (error path): ${sanitizeText(String(screenshotErr))}`,
        });
        resultBase.screenshotStatusDesktop = "failed";
        resultBase.screenshotStatusMobile = "failed";
        resultBase.screenshotMasked = false;
        resultBase.screenshots = null;
      }
    }
  } finally {
    await page.close();
  }

  return resultBase;
}

async function tryLogin(ctx: BrowserContext, baseUrl: string): Promise<AuthTokens | null> {
  const email = process.env.AUDIT_LOGIN_EMAIL?.trim();
  const password = process.env.AUDIT_LOGIN_PASSWORD?.trim();
  if (!email || !password) return null;

  const page = await ctx.newPage();
  try {
    await installReadOnlyGuard(page, []).catch(() => null);
    await page.goto(new URL("/auth", baseUrl).toString(), { waitUntil: "domcontentloaded", timeout: 45_000 });
    await page.waitForTimeout(400);
    await page.fill("#username", email).catch(() => null);
    await page.fill("#password", password).catch(() => null);
    await page.click("button[type='submit']").catch(() => null);

    await page.waitForFunction(
      () => Boolean(window.sessionStorage.getItem("token")) && Boolean(window.sessionStorage.getItem("refreshToken")),
      null,
      { timeout: 20_000 },
    );

    const tokens = await page.evaluate(() => {
      return {
        token: window.sessionStorage.getItem("token"),
        refreshToken: window.sessionStorage.getItem("refreshToken"),
      };
    });

    if (typeof tokens.token === "string" && typeof tokens.refreshToken === "string" && tokens.token && tokens.refreshToken) {
      return { token: tokens.token, refreshToken: tokens.refreshToken };
    }
    return null;
  } catch {
    return null;
  } finally {
    await page.close().catch(() => null);
  }
}

function markdownA11yReport(routeResults: UiInventoryRouteResult[]): string {
  const lines: string[] = [];
  lines.push(`# A11y Report (axe)`);
  lines.push(``);
  lines.push(`Generado: ${new Date().toISOString()}`);
  lines.push(``);

  const totalsByImpact: Record<string, number> = {};
  let totalViolations = 0;

  for (const r of routeResults) {
    if (!r.a11y) continue;
    totalViolations += r.a11y.violationCount;
    for (const [impact, count] of Object.entries(r.a11y.byImpact)) {
      totalsByImpact[impact] = (totalsByImpact[impact] ?? 0) + count;
    }
  }

  lines.push(`## Resumen`);
  lines.push(`- Rutas auditadas: ${routeResults.length}`);
  lines.push(`- Violaciones totales: ${totalViolations}`);
  lines.push(`- Por severidad: ${Object.entries(totalsByImpact)
    .sort((a, b) => b[1] - a[1])
    .map(([k, v]) => `${k}: ${v}`)
    .join(" | ") || "—"}`);
  lines.push(``);

  lines.push(`## Issues Por Ruta`);
  for (const r of routeResults) {
    const count = r.a11y?.violationCount ?? 0;
    if (count === 0) continue;
    lines.push(`### \`${r.path}\` (${r.authState})`);
    lines.push(`- Final: \`${r.finalUrl}\``);
    lines.push(`- Violaciones: **${count}**`);
    lines.push(``);
    const top = (r.a11y?.violations ?? []).slice(0, 8);
    for (const v of top) {
      lines.push(`- **${v.impact ?? "unknown"}** \`${v.id}\`: ${sanitizeText(v.help)}`);
      const node = v.nodes[0];
      if (node?.target) {
        lines.push(`  - Target: \`${sanitizeText(node.target)}\``);
      }
      if (node?.failureSummary) {
        lines.push(`  - ${sanitizeText(node.failureSummary)}`);
      }
    }
    lines.push(``);
  }

  if (totalViolations === 0) {
    lines.push(`No se detectaron violaciones con axe en las rutas auditadas.`);
    lines.push(``);
  }

  return `${lines.join("\n")}\n`;
}

function extractErrorCopyStatic(): Array<{
  file: string;
  line: number;
  message: string;
  kind: "validation" | "runtime";
}> {
  const { spawnSync } = require("child_process") as typeof import("child_process");

  // Keep this focused to the main UX surfaces to avoid noisy giant catalogs.
  const patterns = [
    "required\\(\"",
    "setFieldError\\(",
    "setErrorMessage\\(",
    "setError\\(",
    "ErrorModal",
    "toast\\.error",
    "throw new Error\\(",
  ].join("|");

  const targetDirs = [
    "frontend/src/components/Auth",
    "frontend/src/pages/Checkout",
    "frontend/src/pages/Plans",
    "frontend/src/pages/Admin",
    "frontend/src/components/Modals",
  ];

  const res = spawnSync(
    "rg",
    ["-n", "--no-heading", patterns, ...targetDirs],
    { cwd: REPO_ROOT, encoding: "utf8" },
  );
  const output = res.stdout || "";
  const lines = output.split("\n").filter(Boolean);

  const items: Array<{ file: string; line: number; message: string; kind: "validation" | "runtime" }> = [];

  for (const l of lines) {
    const m = /^(.*?):(\d+):(.*)$/.exec(l);
    if (!m) continue;
    const file = m[1];
    const line = Number(m[2]);
    const text = m[3];
    const msgMatch = text.match(/\"([^\"\\]{3,120})\"/);
    const message = msgMatch ? msgMatch[1] : text.trim();
    const kind = /required\(\"|setFieldError\(/.test(text) ? "validation" : "runtime";
    items.push({ file, line, message: sanitizeText(message), kind });
  }

  // De-dup by file+line
  const seen = new Set<string>();
  return items.filter((i) => {
    const key = `${i.file}:${i.line}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function extractErrorCopyDynamic(baseUrl: string): Promise<any[]> {
  const items: any[] = [];

  await withBrowser(async (browser) => {
    const ctx = await browser.newContext({
      extraHTTPHeaders: AUDIT_EXTRA_HEADERS,
    });
    const page = await ctx.newPage();
    await installReadOnlyGuard(page, []).catch(() => null);

    const captureErrorsOnSubmit = async (route: string, submitSelector: string, formId: string) => {
      await page.goto(new URL(route, baseUrl).toString(), { waitUntil: "domcontentloaded", timeout: 45_000 });
      await page.waitForTimeout(400);
      const before = await page.evaluate(() => Array.from(document.querySelectorAll(".error-formik, .error, .alert, [role='alert']")).map((n) => (n as HTMLElement).innerText).join("\n"));
      await page.click(submitSelector).catch(() => null);
      await page.waitForTimeout(400);
      const after = await page.evaluate(() => Array.from(document.querySelectorAll(".error-formik, .error, .alert, [role='alert']")).map((n) => (n as HTMLElement).innerText).join("\n"));

      const messages = `${after}\n${before}`
        .split("\n")
        .map((s) => sanitizeText(s))
        .filter(Boolean);

      const unique = Array.from(new Set(messages)).slice(0, 25);
      for (const msg of unique) {
        items.push({
          route,
          form_id: formId,
          field: null,
          current_message: msg,
          source: "client",
          severity: "medium",
          suggested_fix: "Hacer el mensaje accionable y consistente (qué pasó + cómo corregir).",
        });
      }
    };

    // Login
    await captureErrorsOnSubmit("/auth", "button[type='submit']", "login");

    // Sign up (Turnstile is bypassed in dev on localhost; still capture client-side errors)
    await captureErrorsOnSubmit("/auth/registro", "button[type='submit']", "signup");

    // Forgot password
    await captureErrorsOnSubmit("/auth/recuperar", "button[type='submit']", "forgot_password");

    await ctx.close();
  });

  return items;
}

function buildCroFindings(routeResults: UiInventoryRouteResult[]): string {
  const lines: string[] = [];
  lines.push(`# CRO Findings (Quick Wins)`);
  lines.push(``);
  lines.push(`Generado: ${new Date().toISOString()}`);
  lines.push(``);
  lines.push(`## Hallazgos Automáticos`);
  lines.push(``);
  lines.push(`### Botones de icono sin label (a11y + confianza)`);

  const missing = routeResults.flatMap((r) => r.iconOnlyMissingLabel);
  if (missing.length === 0) {
    lines.push(`- No se detectaron icon-buttons sin label accesible en las rutas auditadas.`);
  } else {
    const grouped = new Map<string, number>();
    for (const m of missing) {
      const key = `${m.route} :: ${m.selector}`;
      grouped.set(key, (grouped.get(key) ?? 0) + 1);
    }
    const top = Array.from(grouped.entries()).slice(0, 50);
    for (const [key] of top) {
      lines.push(`- ${key}`);
    }
  }

  lines.push(``);
  lines.push(`### Consola / Network failures`);
  for (const r of routeResults) {
    const errors = r.console.filter((c) => c.type === "error");
    const httpErrorsCount = r.httpErrors.length;
    const failed = r.failedRequests.length;
    if (errors.length === 0 && httpErrorsCount === 0 && failed === 0) continue;
    lines.push(
      `- \`${r.path}\`: console errors=${errors.length}, httpErrors=${httpErrorsCount}, requestFailed=${failed}`,
    );
  }

  lines.push(``);
  lines.push(`## Hipótesis / Prioridad (manual)`);
  lines.push(`- Prioriza arreglar errores en consola en rutas de conversión (Home/Planes/Auth/Checkout).`);
  lines.push(`- Asegura microcopy consistente para límites (catálogo total vs cuota mensual) en Planes/Checkout/MyAccount.`);
  lines.push(`- Reduce fricción en admin: labels, confirmaciones, estados vacíos con CTA claro.`);
  lines.push(``);

  return `${lines.join("\n")}\n`;
}

function buildQaFullsiteReport(opts: {
  baseUrl: string;
  routeMap: RouteMapEntry[];
  routeResults: UiInventoryRouteResult[];
}): string {
  const { baseUrl, routeMap, routeResults } = opts;
  const lines: string[] = [];

  const statusCounts: Record<string, number> = {};
  let consoleErrors = 0;
  let consoleWarnings = 0;
  let httpErrors = 0;
  let failedRequests = 0;
  let blockedWrites = 0;
  let missingScreenshots = 0;

  const totalsByImpact: Record<string, number> = {};
  let totalA11y = 0;

  for (const r of routeResults) {
    statusCounts[r.status] = (statusCounts[r.status] ?? 0) + 1;
    consoleErrors += r.console.filter((c) => c.type === "error").length;
    consoleWarnings += r.console.filter((c) => c.type === "warning").length;
    httpErrors += r.httpErrors.length;
    failedRequests += r.failedRequests.length;
    blockedWrites += r.blockedWrites.length;
    if (!r.screenshots) missingScreenshots += 1;

    if (r.a11y) {
      totalA11y += r.a11y.violationCount;
      for (const [impact, count] of Object.entries(r.a11y.byImpact)) {
        totalsByImpact[impact] = (totalsByImpact[impact] ?? 0) + count;
      }
    }
  }

  const protectedRoutes = routeMap.filter((r) => r.requiresAuth && !r.path.includes("*"));
  const requiresAuthByPath = new Map(routeMap.map((r) => [r.path, r.requiresAuth] as const));
  const requiresRoleByPath = new Map(routeMap.map((r) => [r.path, r.requiresRole] as const));

  const protectedRedirects = routeResults.filter((r) => r.status === "auth_redirect");
  const roleMismatches = routeResults.filter((r) => r.status === "role_mismatch");
  const errorRoutes = routeResults.filter((r) => r.status === "error");

  const auditedProtected = routeResults.filter(
    (r) => r.authState === "authenticated" && Boolean(requiresAuthByPath.get(r.path)),
  );

  lines.push(`# QA Fullsite Report`);
  lines.push(``);
  lines.push(`Generado: ${new Date().toISOString()}`);
  lines.push(``);

  lines.push(`## Resumen`);
  lines.push(`- Base URL: \`${baseUrl}\``);
  lines.push(`- Rutas auditadas: ${routeResults.length}`);
  lines.push(
    `- Status: ${Object.entries(statusCounts)
      .sort((a, b) => b[1] - a[1])
      .map(([k, v]) => `${k}=${v}`)
      .join(" | ")}`,
  );
  lines.push(`- Rutas protegidas (router): ${protectedRoutes.length}`);
  lines.push(`- Rutas protegidas auditadas (authenticated): ${auditedProtected.length}`);
  lines.push(`- Redirects a /auth (FAIL): ${protectedRedirects.length}`);
  lines.push(`- Admin role mismatches (FAIL): ${roleMismatches.length}`);
  lines.push(`- Errores (status=error): ${errorRoutes.length}`);
  lines.push(`- Screenshots faltantes: ${missingScreenshots}`);
  lines.push(`- Axe (total violaciones): ${totalA11y}`);
  lines.push(
    `- Axe por severidad: ${Object.entries(totalsByImpact)
      .sort((a, b) => b[1] - a[1])
      .map(([k, v]) => `${k}=${v}`)
      .join(" | ") || "—"}`,
  );
  lines.push(`- Console: errors=${consoleErrors}, warnings=${consoleWarnings}`);
  lines.push(`- Network: httpErrors=${httpErrors}, failedRequests=${failedRequests}`);
  lines.push(`- Read-only guard: blockedWrites=${blockedWrites}`);
  lines.push(``);

  lines.push(`## Issues Por Ruta`);
  for (const r of routeResults) {
    const ce = r.console.filter((c) => c.type === "error").length;
    const cw = r.console.filter((c) => c.type === "warning").length;
    const issues =
      r.status !== "ok" ||
      (r.a11y?.violationCount ?? 0) > 0 ||
      ce > 0 ||
      r.httpErrors.length > 0 ||
      r.failedRequests.length > 0 ||
      r.blockedWrites.length > 0 ||
      !r.screenshots;
    if (!issues) continue;

    let finalPath = "";
    try {
      finalPath = new URL(r.finalUrl).pathname;
    } catch {
      finalPath = r.finalUrl;
    }

    const role = requiresRoleByPath.get(r.path);
    lines.push(`### \`${r.path}\` (${r.authState}${role ? `, role=${role}` : ""})`);
    lines.push(`- Final: \`${sanitizeText(finalPath)}\``);
    lines.push(`- Status: \`${r.status}\`${r.error ? ` (${sanitizeText(r.error)})` : ""}`);
    lines.push(`- Axe: ${(r.a11y?.violationCount ?? 0).toString()} violaciones`);
    lines.push(`- Console: errors=${ce}, warnings=${cw}`);
    lines.push(`- Network: httpErrors=${r.httpErrors.length}, failedRequests=${r.failedRequests.length}`);
    lines.push(`- blockedWrites=${r.blockedWrites.length}`);
    lines.push(`- screenshots=${r.screenshots ? "ok" : "missing"}`);

    if (ce > 0) {
      lines.push(`- Console errors (top 5):`);
      const top = r.console.filter((c) => c.type === "error").slice(0, 5);
      for (const c of top) lines.push(`  - ${sanitizeText(c.text)}`);
    }
    if (r.httpErrors.length > 0) {
      lines.push(`- HTTP errors (top 5):`);
      for (const e of r.httpErrors.slice(0, 5)) {
        lines.push(`  - ${e.method} ${sanitizeText(e.url)} -> ${e.status} ${sanitizeText(e.statusText)}`);
      }
    }
    if (r.failedRequests.length > 0) {
      lines.push(`- Failed requests (top 5):`);
      for (const f of r.failedRequests.slice(0, 5)) {
        lines.push(`  - ${f.method} ${sanitizeText(f.url)} -> ${sanitizeText(f.failure)}`);
      }
    }
    if (r.blockedWrites.length > 0) {
      lines.push(`- Read-only blocked writes (top 5):`);
      for (const b of r.blockedWrites.slice(0, 5)) {
        lines.push(`  - ${b.method} ${sanitizeText(b.url)} (${sanitizeText(b.reason)})`);
      }
    }

    lines.push(``);
  }

  if (routeResults.every((r) => r.status === "ok")) {
    lines.push(`No se detectaron errores de navegación (status != ok) en las rutas auditadas.`);
    lines.push(``);
  }

  return `${lines.join("\n")}\n`;
}

async function main() {
  ensureDir(ARTIFACTS_DIR);
  ensureDir(SCREENSHOTS_DIR);

  const baseUrl = process.env.AUDIT_BASE_URL?.trim() || "http://localhost:3000";
  const start = spawnDevServersIfNeeded(baseUrl);

  try {
    // CRA + TS typecheck can be slow on first boot (cold cache). Give it more time.
    await waitForHttpOk(baseUrl, 180_000);
    // If we're booting the full stack (FE+BE), wait for the backend health endpoint too.
    // This prevents early "ERR_CONNECTION_REFUSED" during the first TRPC batch request.
    const apiBaseRaw =
      process.env.REACT_APP_API_BASE_URL?.trim() ||
      process.env.AUDIT_API_BASE_URL?.trim() ||
      "";
    if (apiBaseRaw) {
      const apiBase = apiBaseRaw.endsWith("/") ? apiBaseRaw.slice(0, -1) : apiBaseRaw;
      await waitForHttpOk(`${apiBase}/api/analytics/health`, 120_000);
    }

    const routeMap = parseRouteMapFromFrontendIndex();
    writeJson(path.join(ARTIFACTS_DIR, "route-map.json"), routeMap);
    const protectedRoutes = routeMap.filter((r) => r.requiresAuth && !r.path.includes("*"));

    const uiReport: UiInventoryReport = {
      generatedAt: new Date().toISOString(),
      baseUrl,
      routes: [],
    };

    // Coverage correctness: "audit:fullsite" must include protected/app/admin routes.
    // We treat missing/failed login as a hard failure (but still emit artifacts for debugging).
    let authCoverageError: "missing_credentials" | "login_failed" | null = null;

    await withBrowser(async (browser) => {
      const anonCtx = await browser.newContext({
        viewport: { width: 1440, height: 900 },
        extraHTTPHeaders: AUDIT_EXTRA_HEADERS,
      });

      // Logged-out coverage: only public + auth routes.
      for (const route of routeMap.filter((r) => !r.requiresAuth)) {
        if (route.path.includes("*")) continue;
        const res = await collectRouteResult(anonCtx, baseUrl, route, "anonymous");
        uiReport.routes.push(res);
      }

      await anonCtx.close();

      const needsAuthCoverage = protectedRoutes.length > 0;
      if (!needsAuthCoverage) return;

      const email = process.env.AUDIT_LOGIN_EMAIL?.trim();
      const password = process.env.AUDIT_LOGIN_PASSWORD?.trim();
      if (!email || !password) {
        authCoverageError = "missing_credentials";
        return;
      }

      const authCtx = await browser.newContext({
        viewport: { width: 1440, height: 900 },
        extraHTTPHeaders: AUDIT_EXTRA_HEADERS,
      });
      const tokens = await tryLogin(authCtx, baseUrl);
      if (tokens) {
        // Authenticated coverage: audit ALL protected routes with sessionStorage pre-seeded per page.
        for (const route of protectedRoutes) {
          const res = await collectRouteResult(authCtx, baseUrl, route, "authenticated", tokens);
          uiReport.routes.push(res);
        }
      } else {
        // Capture evidence for the login page too (screenshots, console, etc.).
        const authRoute: RouteMapEntry =
          routeMap.find((r) => r.path === "/auth") ?? {
            path: "/auth",
            type: "auth",
            requiresAuth: false,
            requiresRole: null,
            sourceFile: path.relative(REPO_ROOT, FRONTEND_INDEX),
            notes: [],
          };
        const res = await collectRouteResult(authCtx, baseUrl, authRoute, "authenticated");
        res.status = "error";
        res.error = "AUDIT_LOGIN_EMAIL/AUDIT_LOGIN_PASSWORD no pudieron iniciar sesión en este entorno.";
        uiReport.routes.push(res);
        authCoverageError = "login_failed";
      }
      await authCtx.close();
    });

    writeJson(path.join(ARTIFACTS_DIR, "ui-inventory.json"), uiReport);

    // Hard fail conditions (coverage correctness):
    // - Any route marked requiresAuth that still ends at /auth after "authenticated" audit.
    // - Any admin route (requiresRole=admin) that does NOT end under /admin (role mismatch).
    // - Any route that errored without screenshots (missing evidence).
    const requiresAuthByPath = new Map(routeMap.map((r) => [r.path, r.requiresAuth] as const));
    const requiresRoleByPath = new Map(routeMap.map((r) => [r.path, r.requiresRole] as const));
    const protectedAuthRedirects = uiReport.routes.filter((r) => {
      if (r.authState !== "authenticated") return false;
      if (!requiresAuthByPath.get(r.path)) return false;
      try {
        return new URL(r.finalUrl).pathname.startsWith("/auth");
      } catch {
        return false;
      }
    });

    const adminRoleMismatches = uiReport.routes.filter((r) => {
      if (r.authState !== "authenticated") return false;
      if (requiresRoleByPath.get(r.path) !== "admin") return false;
      try {
        return !new URL(r.finalUrl).pathname.startsWith("/admin");
      } catch {
        return true;
      }
    });

    const missingEvidence = uiReport.routes.filter((r) => !r.screenshots);

    const auditedProtectedPaths = new Set(
      uiReport.routes
        .filter((r) => r.authState === "authenticated" && Boolean(requiresAuthByPath.get(r.path)))
        .map((r) => r.path),
    );
    const missingProtectedRoutes = protectedRoutes.map((r) => r.path).filter((p) => !auditedProtectedPaths.has(p));

    if (
      authCoverageError ||
      missingProtectedRoutes.length > 0 ||
      protectedAuthRedirects.length > 0 ||
      adminRoleMismatches.length > 0 ||
      missingEvidence.length > 0
    ) {
      // eslint-disable-next-line no-console
      console.error(
        `[audit:fullsite] FAIL: authCoverage=${authCoverageError ?? "ok"}, missingProtectedRoutes=${missingProtectedRoutes.length}, protectedRedirectsToAuth=${protectedAuthRedirects.length}, adminRoleMismatches=${adminRoleMismatches.length}, missingScreenshots=${missingEvidence.length}`,
      );
      if (authCoverageError === "missing_credentials") {
        // eslint-disable-next-line no-console
        console.error(
          `[audit:fullsite] Missing AUDIT_LOGIN_EMAIL/AUDIT_LOGIN_PASSWORD; protected routes in router=${protectedRoutes.length}.`,
        );
      }
      if (missingProtectedRoutes.length > 0) {
        // eslint-disable-next-line no-console
        console.error(
          `[audit:fullsite] Missing protected route results (first 15): ${missingProtectedRoutes.slice(0, 15).join(", ")}`,
        );
      }
      if (adminRoleMismatches.length > 0) {
        // eslint-disable-next-line no-console
        console.error(
          `[audit:fullsite] Admin role mismatches (first 15): ${adminRoleMismatches
            .slice(0, 15)
            .map((r) => `${r.path} -> ${r.finalUrl}`)
            .join(", ")}`,
        );
      }
      process.exitCode = 1;
    }

    // A11y report (markdown)
    writeText(path.join(ARTIFACTS_DIR, "a11y-report.md"), markdownA11yReport(uiReport.routes));

    // Error copy catalog
    const staticErrors = extractErrorCopyStatic();
    const dynamicErrors = await extractErrorCopyDynamic(baseUrl);
    writeJson(path.join(ARTIFACTS_DIR, "error-copy-catalog.json"), {
      generatedAt: new Date().toISOString(),
      static: staticErrors,
      dynamic: dynamicErrors,
    });

    // CRO findings
    writeText(path.join(ARTIFACTS_DIR, "cro-findings.md"), buildCroFindings(uiReport.routes));

    if (AUDIT_ARTIFACTS_DIR) {
      writeText(
        path.join(ARTIFACTS_DIR, "qa-fullsite.md"),
        buildQaFullsiteReport({ baseUrl, routeMap, routeResults: uiReport.routes }),
      );
    }

    // Summary (stdout): required for CI/automation without reading files.
    const statusCounts: Record<string, number> = {};
    let a11yTotal = 0;
    const totalsByImpact: Record<string, number> = {};
    let consoleErrors = 0;
    let httpErrors = 0;
    let failedRequests = 0;
    let blockedWrites = 0;

    for (const r of uiReport.routes) {
      statusCounts[r.status] = (statusCounts[r.status] ?? 0) + 1;
      a11yTotal += r.a11y?.violationCount ?? 0;
      for (const [impact, count] of Object.entries(r.a11y?.byImpact ?? {})) {
        totalsByImpact[impact] = (totalsByImpact[impact] ?? 0) + count;
      }
      consoleErrors += r.console.filter((c) => c.type === "error").length;
      httpErrors += r.httpErrors.length;
      failedRequests += r.failedRequests.length;
      blockedWrites += r.blockedWrites.length;
    }

    // eslint-disable-next-line no-console
    console.log(
      `[audit:fullsite] Summary: routes=${uiReport.routes.length}, status=${Object.entries(statusCounts)
        .map(([k, v]) => `${k}=${v}`)
        .join("|")}, a11yTotal=${a11yTotal}, a11yImpact=${Object.entries(totalsByImpact)
        .map(([k, v]) => `${k}=${v}`)
        .join("|") || "—"}, consoleErrors=${consoleErrors}, httpErrors=${httpErrors}, failedRequests=${failedRequests}, blockedWrites=${blockedWrites}`,
    );
  } finally {
    safeKill(start.child);
  }
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exitCode = 1;
});
