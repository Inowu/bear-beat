import "./_loadEnv";
import bcrypt from "bcrypt";
import crypto from "crypto";
import { PrismaClient } from "@prisma/client";
import { chromium } from "playwright";
import { RolesIds } from "../src/routers/auth/interfaces/roles.interface";

/**
 * E2E: negative flows + auth gating (local/staging only).
 *
 * Covered:
 * - anon user is redirected away from /descargas
 * - invalid credentials show a login error
 * - non-admin user cannot load admin users list (expects 403)
 * - checkout handles provider failure (mocked via network interception)
 *
 * Guardrails:
 * - Refuses to run if DATABASE_URL does not look local (unless overridden).
 * - Refuses to run against non-local base URL (unless overridden).
 * - Never prints credentials/tokens.
 */

const prisma = new PrismaClient();

function looksLikeLocalDatabaseUrl(dbUrl: string): boolean {
  const raw = (dbUrl || "").trim();
  if (!raw) return false;
  try {
    const parsed = new URL(raw);
    const host = parsed.hostname;
    if (!host) return false;
    return (
      host === "localhost" ||
      host === "127.0.0.1" ||
      host === "0.0.0.0" ||
      host.endsWith(".local") ||
      host === "bearbeat-staging-db" ||
      host === "bearbeat-db"
    );
  } catch {
    return /localhost|127\\.0\\.0\\.1|0\\.0\\.0\\.0/.test(raw);
  }
}

function normalizeBaseUrl(value: string): string {
  const trimmed = (value || "").trim() || "http://localhost:3000";
  return trimmed.endsWith("/") ? trimmed.slice(0, -1) : trimmed;
}

function isPrivateHostname(hostname: string): boolean {
  const host = (hostname || "").trim().toLowerCase();
  if (!host) return false;
  if (host === "localhost" || host === "127.0.0.1" || host === "::1") return true;
  if (host.endsWith(".local")) return true;

  const parts = host.split(".");
  if (parts.length === 4 && parts.every((p) => /^\d+$/.test(p))) {
    const nums = parts.map((p) => Number(p));
    if (nums.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return false;
    const [a, b] = nums;
    if (a === 10) return true;
    if (a === 192 && b === 168) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
  }

  return false;
}

async function ensureAtLeastOneActivePlan(): Promise<void> {
  const existing = await prisma.plans.findFirst({
    where: { activated: 1 },
    select: { id: true, gigas: true, price: true },
    orderBy: { id: "asc" },
  });

  const hasValid =
    Boolean(existing?.id) &&
    Number(existing?.price ?? 0) > 0 &&
    Number(existing?.gigas ?? 0) > 0 &&
    existing?.id !== 41;

  if (hasValid) return;

  // Create a minimal, valid plan for UI testing (activated, price>0, gigas>0).
  const created = await prisma.plans.create({
    data: {
      name: `E2E Plan ${Date.now()}`,
      description: "Plan creado automaticamente para E2E local (audit).",
      homedir: "/tmp/bearbeat-e2e",
      gigas: BigInt(100),
      price: "9.99",
      duration: "mensual",
      activated: 1,
      moneda: "usd",
    },
    select: { id: true },
  });

  // Frontend filters out plan id 41; if we happen to hit it, create one more.
  if (created.id === 41) {
    await prisma.plans.create({
      data: {
        name: `E2E Plan ${Date.now()} (alt)`,
        description: "Plan alterno para evitar filtro de UI (id=41).",
        homedir: "/tmp/bearbeat-e2e-alt",
        gigas: BigInt(120),
        price: "12.99",
        duration: "mensual",
        activated: 1,
        moneda: "usd",
      },
      select: { id: true },
    });
  }
}

async function main(): Promise<void> {
  const dbUrl = process.env.DATABASE_URL || "";
  if (!looksLikeLocalDatabaseUrl(dbUrl) && process.env.AUDIT_SEED_ALLOW_NONLOCAL !== "1") {
    throw new Error(
      "Refusing to run e2eNegativeFlows on a non-local DATABASE_URL. " +
        "Set AUDIT_SEED_ALLOW_NONLOCAL=1 to override (not recommended).",
    );
  }

  const baseUrl = normalizeBaseUrl(process.env.SMOKE_BASE_URL || process.env.CANARY_BASE_URL || "");
  const allowNonLocalBase = process.env.E2E_ALLOW_NONLOCAL_BASE_URL === "1";
  const baseHostname = new URL(baseUrl).hostname;
  if (!allowNonLocalBase && !isPrivateHostname(baseHostname)) {
    throw new Error(
      `Refusing to run e2eNegativeFlows against non-local base URL (${baseUrl}). ` +
        "Run against local STAGING (localhost/LAN IP) or set E2E_ALLOW_NONLOCAL_BASE_URL=1 to override (not recommended).",
    );
  }

  await ensureAtLeastOneActivePlan();

  const email = `e2e-neg-${Date.now()}@gmail.com`;
  const password = `E2E-${crypto.randomBytes(6).toString("hex")}-pass!`;
  const passwordHash = await bcrypt.hash(password, 10);

  await prisma.users.create({
    data: {
      username: `e2e-neg-${Date.now()}`,
      email,
      password: passwordHash,
      active: 1,
      verified: true,
      blocked: false,
      role_id: RolesIds.normal,
    },
    select: { id: true },
  });

  const headless = (process.env.E2E_HEADLESS || "1").trim() !== "0";
  const browser = await chromium.launch({ headless });
  try {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await ctx.newPage();
    page.setDefaultTimeout(45_000);

    // Guardrail: avoid accidental e2e runs against production APIs when the base URL is localhost.
    const isLocalBase =
      baseHostname === "localhost" || baseHostname === "127.0.0.1";
    if (isLocalBase) {
      await page.goto(`${baseUrl}/`, { waitUntil: "domcontentloaded" });
      const feConfig = await page.evaluate(() => ({
        environment: (process.env.REACT_APP_ENVIRONMENT || "").trim(),
        apiBaseUrl: (process.env.REACT_APP_API_BASE_URL || "").trim(),
        trpcUrl: (process.env.REACT_APP_TRPC_URL || "").trim(),
      }));

      const pointsToProd =
        feConfig.environment === "production" ||
        feConfig.apiBaseUrl.includes("thebearbeatapi.lat") ||
        feConfig.trpcUrl.includes("thebearbeatapi.lat");

      if (pointsToProd) {
        throw new Error(
          `Refusing to run negative e2e on localhost when the frontend is configured for production APIs (REACT_APP_ENVIRONMENT=${feConfig.environment || "unset"}). ` +
            `Start the frontend with REACT_APP_ENVIRONMENT=development and REACT_APP_API_BASE_URL=http://localhost:5001 (see docs/STAGING_LOCAL.md).`,
        );
      }
    }

    // 1) Auth gating: anon must be redirected away from /descargas.
    await page.goto(`${baseUrl}/descargas`, { waitUntil: "domcontentloaded" });
    await page.waitForURL((url) => url.pathname.startsWith("/auth"), { timeout: 20_000 });
    await page.locator("[data-testid='login-submit']").waitFor({ state: "visible", timeout: 15_000 });

    // 2) Invalid credentials (negative login): must show an inline error.
    const badLoginResponsePromise = page
      .waitForResponse((res) => res.url().includes("/trpc/auth.login"), { timeout: 25_000 })
      .catch(() => null);

    await page.locator("input[name='username']").fill(email);
    await page.locator("input[name='password']").fill(`${password}-wrong`);
    await page.locator("[data-testid='login-submit']").click();

    const badLoginRes = await badLoginResponsePromise;
    if (!badLoginRes) {
      throw new Error("Expected auth.login request during negative login, but no response was observed");
    }

    await page.waitForFunction(() => {
      const el = document.querySelector(".auth-login-inline-error");
      const text = el?.textContent?.trim() || "";
      return text.length > 0;
    }, null, { timeout: 15_000 });

    const inlineError = page.locator(".auth-login-inline-error");
    const inlineText = (await inlineError.innerText().catch(() => "")).trim().toLowerCase();
    if (!inlineText || !inlineText.includes("credenciales")) {
      throw new Error(`Expected inline login error mentioning credentials, got: ${inlineText || "(empty)"}`);
    }

    // 3) Valid login should redirect back to the gated route (/descargas).
    await page.locator("input[name='username']").fill(email);
    await page.locator("input[name='password']").fill(password);
    await page.locator("[data-testid='login-submit']").click();
    await page.waitForURL((url) => url.pathname === "/descargas", { timeout: 30_000 });

    // 4) Non-admin user must be redirected away from /admin.
    await page.goto(`${baseUrl}/admin/usuarios`, { waitUntil: "domcontentloaded" });
    await page.waitForURL((url) => url.pathname === "/", { timeout: 25_000 });

    // 5) Checkout provider failure should be handled (error modal visible).
    await page.goto(`${baseUrl}/planes`, { waitUntil: "domcontentloaded" });
    const planCta = page.locator("[data-testid^='plan-primary-cta-']").first();
    await planCta.waitFor({ state: "visible", timeout: 25_000 });
    await planCta.click();
    await page.waitForURL((url) => url.pathname === "/comprar" && url.search.includes("priceId="), {
      timeout: 25_000,
    });

    // Intercept checkout session creation and force an error.
    await page.route("**/trpc/subscriptions.createStripeCheckoutSession**", async (route) => {
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ error: { message: "Mock checkout provider failure" } }),
      });
    });

    await page.getByRole("heading", { level: 1, name: /(activar|activa).*acceso/i }).waitFor({
      state: "visible",
      timeout: 25_000,
    });
    await page.locator("[data-testid='checkout-method-card']").click();
    await page.locator("[data-testid='checkout-continue']").click();

    const modalContent = page.locator(".container-error-modal .content");
    await modalContent.waitFor({ state: "visible", timeout: 25_000 });

    // Cleanup
    await ctx.close();

    // eslint-disable-next-line no-console
    console.log("E2E negative flows OK.");
  } finally {
    await browser.close().catch(() => null);
  }
}

main()
  .catch((err) => {
    // eslint-disable-next-line no-console
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect().catch(() => null);
  });
