import path from 'path';
import dotenv from 'dotenv';
import * as Sentry from '@sentry/node';
import { chromium } from 'playwright';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

// Initializes Sentry when DSN is configured.
// Use require() so dotenv runs first even in module mode.
// eslint-disable-next-line @typescript-eslint/no-var-requires
require('../src/instrument');

const parseNumber = (value: string | undefined, fallback: number): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const normalizeBaseUrl = (value: string): string => value.replace(/\/+$/, '');

async function run(): Promise<void> {
  const baseUrlRaw =
    process.env.CANARY_BASE_URL ||
    process.env.FRONTEND_BASE_URL ||
    'http://localhost:3000';
  const baseUrl = normalizeBaseUrl(baseUrlRaw);

  const username = (process.env.CANARY_USERNAME || '').trim();
  const password = (process.env.CANARY_PASSWORD || '').trim();
  const headless = (process.env.CANARY_HEADLESS || '1').trim() !== '0';
  const timeoutMs = Math.max(
    5000,
    Math.min(120000, Math.floor(parseNumber(process.env.CANARY_TIMEOUT_MS, 45000))),
  );

  if (!username || !password) {
    throw new Error(
      'Missing CANARY_USERNAME/CANARY_PASSWORD. Set a test user without an active subscription.',
    );
  }

  const browser = await chromium.launch({ headless });
  const context = await browser.newContext();
  const page = await context.newPage();
  page.setDefaultTimeout(timeoutMs);

  try {
    await page.goto(
      `${baseUrl}/?utm_source=canary&utm_medium=synthetic&utm_campaign=checkout_canary`,
      { waitUntil: 'domcontentloaded' },
    );

    await page.goto(`${baseUrl}/auth`, { waitUntil: 'domcontentloaded' });
    await page.fill('#username', username);
    await page.fill('#password', password);

    await Promise.all([
      page.waitForURL(
        (url) => !url.pathname.startsWith('/auth'),
        { timeout: timeoutMs },
      ),
      page.click('button[type="submit"]'),
    ]);

    await page.goto(`${baseUrl}/planes`, { waitUntil: 'domcontentloaded' });
    const firstPlanCta = page.locator('.plan-card-btn-hero').first();
    await firstPlanCta.waitFor({ state: 'visible', timeout: timeoutMs });

    await Promise.all([
      page.waitForURL('**/comprar?priceId=*', { timeout: timeoutMs }),
      firstPlanCta.click(),
    ]);

    // Force card method (MXN defaults to SPEI).
    await page.getByRole('button', { name: /tarjeta/i }).click();

    await page.locator('.checkout-cta-btn--primary').click();

    await page.waitForURL((url) => url.hostname.includes('stripe.com'), {
      timeout: timeoutMs,
    });

    const finalUrl = page.url();
    if (!finalUrl.includes('stripe.com')) {
      throw new Error(`Expected Stripe redirect, got: ${finalUrl}`);
    }
  } finally {
    await context.close().catch(() => {});
    await browser.close().catch(() => {});
  }
}

run().catch(async (error) => {
  const message =
    error instanceof Error ? error.message : 'Unknown error running checkout canary';

  try {
    Sentry.withScope((scope) => {
      scope.setTag('canary', 'checkout');
      scope.setLevel('error');
      scope.setContext('canary', {
        baseUrl: process.env.CANARY_BASE_URL || process.env.FRONTEND_BASE_URL || null,
      });
      Sentry.captureMessage(`Checkout canary failed: ${message}`);
    });
    await Sentry.flush(4000);
  } catch {
    // noop
  }

  // eslint-disable-next-line no-console
  console.error(`[CANARY] Checkout canary failed: ${message}`);
  process.exitCode = 1;
});
