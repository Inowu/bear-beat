import './_loadEnv';
import fs from 'fs';
import path from 'path';
import axios from 'axios';

/**
 * Ensures PayPal webhook IDs are present in backend/.env.
 * - Reuses existing webhook by URL when possible
 * - Creates webhook when missing
 * - Stores id in PAYPAL_WH_ID / PAYPAL_TEST_WH_ID
 */

const ENV_PATH = path.resolve(__dirname, '..', '.env');
const DEFAULT_WEBHOOK_BASE_URL = 'https://thebearbeatapi.lat';

const REQUIRED_EVENT_NAMES = [
  'BILLING.SUBSCRIPTION.ACTIVATED',
  'BILLING.SUBSCRIPTION.RE-ACTIVATED',
  'BILLING.SUBSCRIPTION.UPDATED',
  'BILLING.SUBSCRIPTION.CANCELLED',
  'BILLING.SUBSCRIPTION.EXPIRED',
  'BILLING.SUBSCRIPTION.SUSPENDED',
  'BILLING.SUBSCRIPTION.PAYMENT.FAILED',
  'PAYMENT.SALE.COMPLETED',
  'PAYMENT.SALE.DENIED',
] as const;

type PaypalWebhook = {
  id: string;
  url?: string;
  event_types?: Array<{ name?: string }>;
};

function getEnvValue(key: string): string {
  return (process.env[key] || '').trim();
}

function normalizeUrl(value: string): string {
  return value.trim().replace(/\/+$/, '');
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function upsertEnv(key: string, value: string) {
  const current = fs.existsSync(ENV_PATH) ? fs.readFileSync(ENV_PATH, 'utf8') : '';
  const line = `${key}=${value}`;
  const re = new RegExp(`^${escapeRegExp(key)}=.*$`, 'm');
  let next = current;

  if (re.test(current)) {
    next = current.replace(re, line);
  } else {
    next = `${current}${current.endsWith('\n') || !current ? '' : '\n'}${line}\n`;
  }

  fs.writeFileSync(ENV_PATH, next);
  process.env[key] = value;
}

function hasAllRequiredEvents(webhook: PaypalWebhook): boolean {
  const names = new Set(
    (webhook.event_types || [])
      .map((eventType) => String(eventType?.name || '').trim())
      .filter(Boolean),
  );
  return REQUIRED_EVENT_NAMES.every((requiredName) => names.has(requiredName));
}

async function getAccessToken(
  apiBase: string,
  clientId: string,
  clientSecret: string,
): Promise<string> {
  const { data } = await axios.post(
    `${apiBase}/v1/oauth2/token`,
    new URLSearchParams({ grant_type: 'client_credentials' }).toString(),
    {
      headers: {
        Accept: 'application/json',
        'Accept-Language': 'en_US',
        'content-type': 'application/x-www-form-urlencoded',
      },
      auth: {
        username: clientId,
        password: clientSecret,
      },
      timeout: 20_000,
    },
  );

  const token = String(data?.access_token || '').trim();
  if (!token) throw new Error('PayPal access token is empty');
  return token;
}

async function listWebhooks(
  apiBase: string,
  token: string,
): Promise<PaypalWebhook[]> {
  const { data } = await axios.get(`${apiBase}/v1/notifications/webhooks`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
    timeout: 20_000,
  });

  return Array.isArray(data?.webhooks) ? (data.webhooks as PaypalWebhook[]) : [];
}

async function createWebhook(
  apiBase: string,
  token: string,
  webhookUrl: string,
): Promise<PaypalWebhook> {
  const payload = {
    url: webhookUrl,
    event_types: REQUIRED_EVENT_NAMES.map((name) => ({ name })),
  };

  const { data } = await axios.post(
    `${apiBase}/v1/notifications/webhooks`,
    payload,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      timeout: 20_000,
    },
  );

  if (!data?.id) throw new Error('PayPal webhook create response missing id');
  return data as PaypalWebhook;
}

function resolveWebhookUrl(
  explicitUrl: string,
  mode: 'live' | 'test',
): string {
  if (explicitUrl) return normalizeUrl(explicitUrl);

  const modeSpecificUrl =
    mode === 'live'
      ? getEnvValue('PAYPAL_WEBHOOK_URL')
      : getEnvValue('PAYPAL_TEST_WEBHOOK_URL');
  if (modeSpecificUrl) return normalizeUrl(modeSpecificUrl);

  const base =
    getEnvValue('PAYPAL_WEBHOOK_BASE_URL') ||
    getEnvValue('BACKEND_PUBLIC_URL') ||
    DEFAULT_WEBHOOK_BASE_URL;

  return `${normalizeUrl(base)}/webhooks.paypal`;
}

async function ensureMode(opts: {
  mode: 'live' | 'test';
  apiBase: string;
  clientId: string;
  clientSecret: string;
  webhookIdKey: string;
  explicitWebhookUrl: string;
  strict: boolean;
}) {
  const {
    mode,
    apiBase,
    clientId,
    clientSecret,
    webhookIdKey,
    explicitWebhookUrl,
    strict,
  } = opts;

  const hasAnyConfig = Boolean(apiBase || clientId || clientSecret);
  const hasFullConfig = Boolean(apiBase && clientId && clientSecret);

  if (!hasAnyConfig) {
    // eslint-disable-next-line no-console
    console.log(`[PAYPAL:${mode}] skip (no credentials configured)`);
    return;
  }

  if (!hasFullConfig) {
    const msg = `[PAYPAL:${mode}] incomplete credentials. Please set ${mode === 'live'
      ? 'PAYPAL_URL/PAYPAL_CLIENT_ID/PAYPAL_CLIENT_SECRET'
      : 'PAYPAL_SANDBOX_URL/PAYPAL_TEST_CLIENT_ID/PAYPAL_TEST_CLIENT_SECRET'}`;
    if (strict) throw new Error(msg);
    // eslint-disable-next-line no-console
    console.warn(msg);
    return;
  }

  const webhookUrl = resolveWebhookUrl(explicitWebhookUrl, mode);
  if (!webhookUrl) {
    const msg = `[PAYPAL:${mode}] could not resolve webhook url`;
    if (strict) throw new Error(msg);
    // eslint-disable-next-line no-console
    console.warn(msg);
    return;
  }

  const token = await getAccessToken(apiBase, clientId, clientSecret);
  const webhooks = await listWebhooks(apiBase, token);
  const envWebhookId = getEnvValue(webhookIdKey);

  const byId = envWebhookId
    ? webhooks.find((webhook) => webhook.id === envWebhookId)
    : null;
  const byUrl = webhooks.find(
    (webhook) => normalizeUrl(String(webhook.url || '')) === webhookUrl,
  );

  const reusable = [byId, byUrl].find(
    (webhook): webhook is PaypalWebhook =>
      Boolean(
        webhook &&
          webhook.id &&
          normalizeUrl(String(webhook.url || '')) === webhookUrl &&
          hasAllRequiredEvents(webhook),
      ),
  );

  if (reusable?.id) {
    upsertEnv(webhookIdKey, reusable.id);
    // eslint-disable-next-line no-console
    console.log(`[PAYPAL:${mode}] using existing webhook ${reusable.id}`);
    return;
  }

  try {
    const created = await createWebhook(apiBase, token, webhookUrl);
    upsertEnv(webhookIdKey, created.id);
    // eslint-disable-next-line no-console
    console.log(`[PAYPAL:${mode}] created webhook ${created.id}`);
    return;
  } catch (error) {
    // If PayPal refuses duplicate URL creation but there is a webhook by URL,
    // keep using it even if event list is stale.
    if (byUrl?.id) {
      upsertEnv(webhookIdKey, byUrl.id);
      // eslint-disable-next-line no-console
      console.warn(
        `[PAYPAL:${mode}] fallback to existing webhook ${byUrl.id}; please verify events include ${REQUIRED_EVENT_NAMES.join(', ')}`,
      );
      return;
    }

    throw error;
  }
}

async function main() {
  if (!fs.existsSync(ENV_PATH)) {
    throw new Error(`Env file not found: ${ENV_PATH}`);
  }

  const liveApiBase = normalizeUrl(getEnvValue('PAYPAL_URL'));
  const liveClientId = getEnvValue('PAYPAL_CLIENT_ID');
  const liveClientSecret = getEnvValue('PAYPAL_CLIENT_SECRET');

  const testApiBase = normalizeUrl(getEnvValue('PAYPAL_SANDBOX_URL'));
  const testClientId = getEnvValue('PAYPAL_TEST_CLIENT_ID');
  const testClientSecret = getEnvValue('PAYPAL_TEST_CLIENT_SECRET');

  await ensureMode({
    mode: 'live',
    apiBase: liveApiBase,
    clientId: liveClientId,
    clientSecret: liveClientSecret,
    webhookIdKey: 'PAYPAL_WH_ID',
    explicitWebhookUrl: getEnvValue('PAYPAL_WEBHOOK_URL'),
    strict: true,
  });

  await ensureMode({
    mode: 'test',
    apiBase: testApiBase,
    clientId: testClientId,
    clientSecret: testClientSecret,
    webhookIdKey: 'PAYPAL_TEST_WH_ID',
    explicitWebhookUrl: getEnvValue('PAYPAL_TEST_WEBHOOK_URL'),
    strict: false,
  });
}

main().catch((error) => {
  // eslint-disable-next-line no-console
  console.error(
    `[PAYPAL] ensurePaypalWebhooks failed: ${error instanceof Error ? error.message : String(error)}`,
  );
  process.exitCode = 1;
});
