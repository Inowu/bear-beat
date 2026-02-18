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

type CanaryGateway = 'stripe' | 'paypal' | 'either';
type CanaryPaymentMethod = 'card' | 'paypal' | null;

const parseExpectedGateway = (value: string | undefined): CanaryGateway => {
  const normalized = (value || '').trim().toLowerCase();
  if (normalized === 'paypal') return 'paypal';
  if (normalized === 'either' || normalized === 'any') return 'either';
  return 'stripe';
};

const parsePaymentMethod = (
  value: string | undefined,
  expectedGateway: CanaryGateway,
): CanaryPaymentMethod => {
  const normalized = (value || '').trim().toLowerCase();
  if (normalized === 'card' || normalized === 'tarjeta') return 'card';
  if (normalized === 'paypal') return 'paypal';

  if (expectedGateway === 'stripe') return 'card';
  if (expectedGateway === 'paypal') return 'paypal';
  return null;
};

const matchesGatewayUrl = (url: URL, expected: CanaryGateway): boolean => {
  const host = url.hostname.toLowerCase();
  const isStripe = host.includes('stripe.com');
  const isPaypal = host.includes('paypal.com');

  if (expected === 'stripe') return isStripe;
  if (expected === 'paypal') return isPaypal;
  return isStripe || isPaypal;
};

const clickPaymentMethodIfNeeded = async (
  page: import('playwright').Page,
  method: CanaryPaymentMethod,
  timeoutMs: number,
): Promise<void> => {
  if (!method) return;
  const name = method === 'card' ? /tarjeta/i : /paypal/i;
  const button = page.getByRole('button', { name }).first();
  await button.waitFor({ state: 'visible', timeout: timeoutMs });
  await button.click();
};

async function run(): Promise<void> {
  const baseUrlRaw =
    process.env.CANARY_BASE_URL ||
    process.env.FRONTEND_BASE_URL ||
    'http://localhost:3000';
  const baseUrl = normalizeBaseUrl(baseUrlRaw);

  const username = (process.env.CANARY_USERNAME || '').trim();
  const password = (process.env.CANARY_PASSWORD || '').trim();
  const expectedGateway = parseExpectedGateway(
    process.env.CANARY_EXPECT_GATEWAY,
  );
  const paymentMethod = parsePaymentMethod(
    process.env.CANARY_PAYMENT_METHOD,
    expectedGateway,
  );
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
    const firstPlanCta = page
      .locator("button[data-testid^='plan-primary-cta-']")
      .first();
    await firstPlanCta.waitFor({ state: 'visible', timeout: timeoutMs });

    await Promise.all([
      page.waitForURL('**/comprar?priceId=*', { timeout: timeoutMs }),
      firstPlanCta.click(),
    ]);

    await clickPaymentMethodIfNeeded(page, paymentMethod, timeoutMs);

    await page.locator('.checkout-cta-btn--primary').click();

    await page.waitForURL((url) => matchesGatewayUrl(url, expectedGateway), {
      timeout: timeoutMs,
    });

    const finalUrl = page.url();
    const parsedFinalUrl = new URL(finalUrl);
    if (!matchesGatewayUrl(parsedFinalUrl, expectedGateway)) {
      throw new Error(
        `Expected ${expectedGateway} redirect, got: ${finalUrl}`,
      );
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
