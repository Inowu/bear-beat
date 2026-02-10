import "./_loadEnv";
import fs from "fs";
import path from "path";
import { spawn } from "child_process";
import * as ts from "typescript";
import { chromium, type Browser, type BrowserContext } from "playwright";
import AxeBuilder from "@axe-core/playwright";

type RouteType = "public" | "auth" | "app" | "admin";

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
// Reports live under docs (tracked). Screenshots live under /audit/screenshots (optional to commit).
// Keep PII redacted in textual artifacts (see sanitizeText()).
const DOCS_AUDIT_DIR = path.resolve(REPO_ROOT, "docs", "audit");
const SCREENSHOTS_DIR = path.resolve(REPO_ROOT, "audit", "screenshots");

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
  const child = spawn(cmd, {
    cwd: REPO_ROOT,
    shell: true,
    env: {
      ...process.env,
      // Make dev server quieter and more deterministic where possible.
      BROWSER: "none",
    },
    stdio: "ignore",
  });

  // Prevent orphaned process on parent exit.
  child.unref();
  return { child };
}

function safeKill(child: ReturnType<typeof spawn> | null) {
  if (!child) return;
  try {
    child.kill("SIGTERM");
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

  page.on("console", (msg) => {
    consoleEvents.push({
      type: msg.type(),
      text: sanitizeText(msg.text()),
    });
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
    failedRequests.push({
      url: sanitizeText(req.url()),
      method: req.method(),
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
    interactive: [],
    iconOnlyMissingLabel: [],
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
        const hasText = Boolean((h.innerText || "").trim());
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
    screenshot: string;
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
    try {
      await page.setViewportSize(viewport);
      await page.waitForTimeout(200);
      await page.screenshot({ path: screenshotPath, fullPage: true });
    } catch (err) {
      consoleEvents.push({
        type: "warning",
        text: `screenshot failed (${kind}): ${sanitizeText(String(err))}`,
      });
      return null;
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

    resultBase.finalUrl = page.url();
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

    if (desktop && mobile) {
      resultBase.screenshots = { desktop: desktop.screenshot, mobile: mobile.screenshot };
    } else {
      resultBase.screenshots = null;
    }

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
    resultBase.finalUrl = page.url();
    resultBase.title = await page.title().catch(() => "");

    // Evidence is mandatory: try to screenshot even on errors/timeouts.
    if (!resultBase.screenshots) {
      try {
        await page.setViewportSize({ width: 1280, height: 800 });
        await page.waitForTimeout(200);
        await page.screenshot({ path: desktopPath, fullPage: true });

        await page.setViewportSize({ width: 390, height: 844 });
        await page.waitForTimeout(200);
        await page.screenshot({ path: mobilePath, fullPage: true });

        resultBase.screenshots = {
          desktop: path.relative(REPO_ROOT, desktopPath),
          mobile: path.relative(REPO_ROOT, mobilePath),
        };
      } catch (screenshotErr) {
        consoleEvents.push({
          type: "warning",
          text: `screenshot failed (error path): ${sanitizeText(String(screenshotErr))}`,
        });
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
    const ctx = await browser.newContext();
    const page = await ctx.newPage();

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

async function main() {
  ensureDir(DOCS_AUDIT_DIR);
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
    writeJson(path.join(DOCS_AUDIT_DIR, "route-map.json"), routeMap);
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

    writeJson(path.join(DOCS_AUDIT_DIR, "ui-inventory.json"), uiReport);

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
    writeText(path.join(DOCS_AUDIT_DIR, "a11y-report.md"), markdownA11yReport(uiReport.routes));

    // Error copy catalog
    const staticErrors = extractErrorCopyStatic();
    const dynamicErrors = await extractErrorCopyDynamic(baseUrl);
    writeJson(path.join(DOCS_AUDIT_DIR, "error-copy-catalog.json"), {
      generatedAt: new Date().toISOString(),
      static: staticErrors,
      dynamic: dynamicErrors,
    });

    // CRO findings
    writeText(path.join(DOCS_AUDIT_DIR, "cro-findings.md"), buildCroFindings(uiReport.routes));
  } finally {
    safeKill(start.child);
  }
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exitCode = 1;
});
