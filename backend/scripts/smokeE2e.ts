import "./_loadEnv";
import path from "path";
import { spawn } from "child_process";
import { chromium } from "playwright";

/**
 * Dev-only smoke checks using Playwright (no @playwright/test runner).
 *
 * It validates critical CRO flows without completing real payments:
 * - Home renders + CTA goes to Registro
 * - Registro básico (crea un usuario nuevo)
 * - Planes → Checkout → Success (sin cobro real; en local dev el backend devuelve success_url si Stripe no está configurado)
 * - /planes renders at least one plan card (requires local seed)
 * - Optional: login + admin route loads (requires seeded admin user)
 */

const REPO_ROOT = path.resolve(__dirname, "..", "..");

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

function spawnDevServersIfNeeded(): { child: ReturnType<typeof spawn> | null } {
  const shouldStart = process.env.SMOKE_START_SERVERS === "1";
  if (!shouldStart) return { child: null };

  const cmd = process.env.SMOKE_START_CMD?.trim() || "npm start";
  const env = {
    ...process.env,
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

function resolveBaseUrl(): string {
  const base = (process.env.SMOKE_BASE_URL || "http://localhost:3000").trim();
  return base.endsWith("/") ? base.slice(0, -1) : base;
}

async function main() {
  const baseUrl = resolveBaseUrl();
  const loginEmail = process.env.SMOKE_LOGIN_EMAIL?.trim();
  const loginPassword = process.env.SMOKE_LOGIN_PASSWORD?.trim();
  const skipSignup = process.env.SMOKE_SKIP_SIGNUP === "1";
  const startingServers = process.env.SMOKE_START_SERVERS === "1";

  const { child } = spawnDevServersIfNeeded();
  try {
    // CRA + TS typecheck can be slow on first boot (cold cache). Give it more time.
    await waitForHttpOk(baseUrl, 180_000);
    const apiBaseRaw =
      process.env.REACT_APP_API_BASE_URL?.trim() ||
      process.env.SMOKE_API_BASE_URL?.trim() ||
      "";
    const inferredApiBase =
      apiBaseRaw ||
      (startingServers && baseUrl.includes("localhost:3000") ? "http://localhost:5001" : "");
    if (inferredApiBase) {
      const apiBase = inferredApiBase.endsWith("/") ? inferredApiBase.slice(0, -1) : inferredApiBase;
      await waitForHttpOk(`${apiBase}/api/analytics/health`, 120_000);
    }

    const browser = await chromium.launch({ headless: true });
    const ctx = await browser.newContext({
      viewport: { width: 1280, height: 800 },
    });
    const page = await ctx.newPage();

    // Some local environments block "local.test" (anti-fraud / disposable domains).
    // Use a neutral domain to keep smoke e2e reproducible.
    const smokeUserEmail = `smoke-${Date.now()}@gmail.com`;
    const smokeUserPassword = `Smoke-${Date.now()}-pass!`;

    if (skipSignup) {
      if (!loginEmail || !loginPassword) {
        throw new Error("SMOKE_SKIP_SIGNUP=1 requires SMOKE_LOGIN_EMAIL/SMOKE_LOGIN_PASSWORD");
      }
      await page.goto(`${baseUrl}/auth`, { waitUntil: "domcontentloaded", timeout: 60_000 });
      await page.locator("input[name='username']").fill(loginEmail);
      await page.locator("input[name='password']").fill(loginPassword);
      await page.locator("[data-testid='login-submit']").click();
      await page.waitForURL((url) => !url.pathname.startsWith("/auth"), { timeout: 40_000 });
      await page.goto(`${baseUrl}/planes`, { waitUntil: "domcontentloaded", timeout: 60_000 });
    } else {
      // AUTH (logged out): forgot password loads
      await page.goto(`${baseUrl}/auth/recuperar`, { waitUntil: "domcontentloaded", timeout: 60_000 });
      await page.getByRole("heading", { level: 1, name: /recuperar acceso/i }).waitFor({
        state: "visible",
        timeout: 15_000,
      });
      await page.locator("input[name='email']").waitFor({ state: "visible", timeout: 10_000 });

      // HOME (logged out)
      await page.goto(`${baseUrl}/`, { waitUntil: "domcontentloaded", timeout: 60_000 });
      await page.getByRole("heading", { level: 1 }).waitFor({ state: "visible", timeout: 15_000 });

      const primaryCta = page.locator("[data-testid='home-cta-primary']").first();
      await primaryCta.waitFor({ state: "visible", timeout: 10_000 });
      await primaryCta.click();
      await page.waitForURL(/\/auth\/registro/, { timeout: 20_000 });

      // REGISTRO básico (dev/local bypass Turnstile)
      await page.locator("#email").fill(smokeUserEmail);
      await page.locator("#password").fill(smokeUserPassword);
      await page.locator("#passwordConfirmation").fill(smokeUserPassword);
      await page.locator("[data-testid='signup-submit']").click();
      await page.waitForURL((url) => url.pathname === "/planes", { timeout: 40_000 });
    }

    // PLANES (logged in, requires at least 1 activated plan)
    const planCard = page.locator(".plan-card-wrapper, .plan-card-main-card").first();
    await planCard.waitFor({ state: "visible", timeout: 25_000 });

    // PLANES → CHECKOUT
    await page.locator("[data-testid^='plan-primary-cta-']").first().click();
    await page.waitForURL((url) => url.pathname === "/comprar" && url.search.includes("priceId="), {
      timeout: 25_000,
    });

    // CHECKOUT → SUCCESS (mocked in local dev if Stripe keys are missing)
    await page.getByRole("heading", { level: 1, name: /(activar|activa).*acceso/i }).waitFor({
      state: "visible",
      timeout: 25_000,
    });
    await page.locator("[data-testid='checkout-method-card']").click();
    await page.locator("[data-testid='checkout-continue']").click();
    await page.waitForURL((url) => url.pathname === "/comprar/success", { timeout: 30_000 });
    await page.getByRole("heading", { level: 1, name: /pago realizado/i }).waitFor({
      state: "visible",
      timeout: 25_000,
    });

    if (!skipSignup) {
      // LOGIN (nuevo usuario) en una tab limpia (sessionStorage es per-tab)
      const loginPage = await ctx.newPage();
      await loginPage.goto(`${baseUrl}/auth`, { waitUntil: "domcontentloaded", timeout: 60_000 });
      await loginPage.locator("input[name='username']").fill(smokeUserEmail);
      await loginPage.locator("input[name='password']").fill(smokeUserPassword);
      await loginPage.locator("[data-testid='login-submit']").click();
      await loginPage.waitForURL((url) => !url.pathname.startsWith("/auth"), { timeout: 25_000 });
      await loginPage.close();
    }

    // Optional: login + admin
    if (loginEmail && loginPassword) {
      const adminPage = await ctx.newPage();
      await adminPage.goto(`${baseUrl}/auth`, { waitUntil: "domcontentloaded", timeout: 60_000 });
      await adminPage.locator("input[name='username']").fill(loginEmail);
      await adminPage.locator("input[name='password']").fill(loginPassword);
      await adminPage.locator("[data-testid='login-submit']").click();
      await adminPage.waitForURL((url) => !url.pathname.startsWith("/auth"), { timeout: 25_000 });

      await adminPage.goto(`${baseUrl}/admin/usuarios`, { waitUntil: "domcontentloaded", timeout: 60_000 });
      await adminPage.getByRole("heading", { name: "Usuarios" }).first().waitFor({ state: "visible", timeout: 25_000 });
      await adminPage.close();
    }

    await ctx.close();
    await browser.close();

    // eslint-disable-next-line no-console
    console.log("Smoke e2e OK.");
  } finally {
    safeKill(child);
  }
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exitCode = 1;
});
