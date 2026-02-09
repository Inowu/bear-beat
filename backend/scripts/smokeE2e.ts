import path from "path";
import { spawn } from "child_process";
import { chromium } from "playwright";

/**
 * Dev-only smoke checks using Playwright (no @playwright/test runner).
 *
 * It validates critical CRO flows without completing real payments:
 * - Home renders + CTA goes to Registro
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
  const child = spawn(cmd, {
    cwd: REPO_ROOT,
    shell: true,
    env: {
      ...process.env,
      BROWSER: "none",
    },
    stdio: "ignore",
  });
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

function resolveBaseUrl(): string {
  const base = (process.env.SMOKE_BASE_URL || "http://localhost:3000").trim();
  return base.endsWith("/") ? base.slice(0, -1) : base;
}

async function main() {
  const baseUrl = resolveBaseUrl();
  const loginEmail = process.env.SMOKE_LOGIN_EMAIL?.trim();
  const loginPassword = process.env.SMOKE_LOGIN_PASSWORD?.trim();

  const { child } = spawnDevServersIfNeeded();
  try {
    await waitForHttpOk(baseUrl, 120_000);
    const apiBaseRaw =
      process.env.REACT_APP_API_BASE_URL?.trim() ||
      process.env.SMOKE_API_BASE_URL?.trim() ||
      "";
    if (apiBaseRaw) {
      const apiBase = apiBaseRaw.endsWith("/") ? apiBaseRaw.slice(0, -1) : apiBaseRaw;
      await waitForHttpOk(`${apiBase}/api/analytics/health`, 90_000);
    }

    const browser = await chromium.launch({ headless: true });
    const ctx = await browser.newContext({
      viewport: { width: 1280, height: 800 },
    });
    const page = await ctx.newPage();

    // HOME (logged out)
    await page.goto(`${baseUrl}/`, { waitUntil: "domcontentloaded", timeout: 60_000 });
    await page.getByRole("heading", { level: 1 }).waitFor({ state: "visible", timeout: 15_000 });

    const primaryCta = page.locator(".home-hero .home-cta--primary").first();
    await primaryCta.waitFor({ state: "visible", timeout: 10_000 });
    await primaryCta.click();
    await page.waitForURL(/\/auth\/registro/, { timeout: 20_000 });

    // PLANES (logged out, requires at least 1 activated plan)
    await page.goto(`${baseUrl}/planes`, { waitUntil: "domcontentloaded", timeout: 60_000 });
    const planCard = page.locator(".plan-card-wrapper, .plan-card-main-card").first();
    await planCard.waitFor({ state: "visible", timeout: 20_000 });

    // Optional: login + admin
    if (loginEmail && loginPassword) {
      await page.goto(`${baseUrl}/auth`, { waitUntil: "domcontentloaded", timeout: 60_000 });
      await page.locator("input[name='username']").fill(loginEmail);
      await page.locator("input[name='password']").fill(loginPassword);
      await page.getByRole("button", { name: /ingresar/i }).click();
      await page.waitForURL((url) => !url.pathname.startsWith("/auth"), { timeout: 25_000 });

      await page.goto(`${baseUrl}/admin/usuarios`, { waitUntil: "domcontentloaded", timeout: 60_000 });
      await page.getByRole("heading", { name: "Usuarios" }).first().waitFor({ state: "visible", timeout: 25_000 });
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
