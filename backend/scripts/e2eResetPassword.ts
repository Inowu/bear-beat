import "./_loadEnv";
import bcrypt from "bcrypt";
import crypto from "crypto";
import { addHours } from "date-fns";
import { PrismaClient } from "@prisma/client";
import { chromium } from "playwright";

/**
 * E2E: password reset flow (local/staging only).
 *
 * We do NOT rely on email providers in local STAGING.
 * Instead we create a user + activation token directly in the local DB,
 * then exercise the public reset UI and verify login with the new password.
 *
 * Guardrails:
 * - Refuses to run if DATABASE_URL does not look local (unless overridden).
 * - Never prints the reset token or any credentials.
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

  // Allow RFC1918 ranges (common when testing from a phone on LAN).
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

function sanitizeUrlForLogs(raw: string): string {
  try {
    const u = new URL(raw);
    // Reset links include a one-time token; never log it.
    u.searchParams.delete("token");
    return u.toString();
  } catch {
    return raw;
  }
}

async function main(): Promise<void> {
  const dbUrl = process.env.DATABASE_URL || "";
  if (!looksLikeLocalDatabaseUrl(dbUrl) && process.env.AUDIT_SEED_ALLOW_NONLOCAL !== "1") {
    throw new Error(
      "Refusing to run e2eResetPassword on a non-local DATABASE_URL. " +
        "Set AUDIT_SEED_ALLOW_NONLOCAL=1 to override (not recommended).",
    );
  }

  const baseUrl = normalizeBaseUrl(process.env.SMOKE_BASE_URL || process.env.CANARY_BASE_URL || "");
  const allowNonLocalBase = process.env.E2E_ALLOW_NONLOCAL_BASE_URL === "1";
  const baseHostname = new URL(baseUrl).hostname;
  if (!allowNonLocalBase && !isPrivateHostname(baseHostname)) {
    throw new Error(
      `Refusing to run e2eResetPassword against non-local base URL (${baseUrl}). ` +
        "Run against local STAGING (localhost/LAN IP) or set E2E_ALLOW_NONLOCAL_BASE_URL=1 to override (not recommended).",
    );
  }

  const email = `e2e-reset-${Date.now()}@local.test`;
  const initialPassword = `Init-${crypto.randomBytes(6).toString("hex")}-pass!`;
  const newPassword = `New-${crypto.randomBytes(6).toString("hex")}-pass!`;

  const initialHash = await bcrypt.hash(initialPassword, 10);

  const user = await prisma.users.create({
    data: {
      username: `e2e-reset-${Date.now()}`,
      email,
      password: initialHash,
      active: 1,
      verified: true,
      blocked: false,
      role_id: 4, // normal
    },
    select: { id: true },
  });

  const resetToken = crypto.randomBytes(32).toString("hex");
  const hashedToken = bcrypt.hashSync(resetToken, 10);

  await prisma.users.update({
    where: { id: user.id },
    data: {
      activationcode: hashedToken,
      token_expiration: addHours(new Date(), 1),
    },
  });

  const browser = await chromium.launch({ headless: true });
  try {
    // Step 1: reset password UI
    const resetCtx = await browser.newContext({
      viewport: { width: 1280, height: 800 },
    });
    const page = await resetCtx.newPage();

    await page.goto(`${baseUrl}/auth/reset-password?token=${resetToken}&userId=${user.id}`, {
      waitUntil: "domcontentloaded",
      timeout: 60_000,
    });

    const changePasswordResponsePromise = page
      .waitForResponse((res) => res.url().includes("/trpc/auth.changePassword"), {
        timeout: 25_000,
      })
      .catch(() => null);

    await page.locator("#password").fill(newPassword);
    await page.locator("#passwordConfirmation").fill(newPassword);
    await page.locator("[data-testid='reset-submit']").click();

    const changePasswordResponse = await changePasswordResponsePromise;
    if (!changePasswordResponse) {
      throw new Error("Password reset did not trigger auth.changePassword request");
    }

    const errorContent = page.locator(".container-error-modal .content");

    // UX note: some route guards can redirect away from /auth after we set session tokens.
    // Therefore the most reliable assertion is: HTTP 2xx and no visible error modal.
    if (changePasswordResponse.status() >= 400) {
      const msg = (await errorContent.innerText().catch(() => "")) || "";
      throw new Error(
        `Password reset failed (HTTP ${changePasswordResponse.status()}): ${msg.trim() || "unknown error"}`,
      );
    }
    const errorVisible = await errorContent.isVisible().catch(() => false);
    if (errorVisible) {
      const msg = (await errorContent.innerText().catch(() => "")) || "";
      throw new Error(
        `Password reset showed an error modal despite HTTP ${changePasswordResponse.status()}: ${msg.trim() || "unknown error"}`,
      );
    }
    await resetCtx.close();

    // Step 2: login with the new password (isolated context to avoid any session bleed)
    const loginCtx = await browser.newContext({
      viewport: { width: 1280, height: 800 },
    });
    const loginPage = await loginCtx.newPage();
    await loginPage.goto(`${baseUrl}/auth`, { waitUntil: "domcontentloaded", timeout: 60_000 });
    await loginPage.locator("input[name='username']").fill(email);
    await loginPage.locator("input[name='password']").fill(newPassword);
    await loginPage.locator("[data-testid='login-submit']").click();
    await loginPage.waitForURL((url) => !url.pathname.startsWith("/auth"), { timeout: 25_000 });
    await loginCtx.close();
  } finally {
    await browser.close().catch(() => null);
  }

  // eslint-disable-next-line no-console
  console.log("E2E reset password OK.");
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
