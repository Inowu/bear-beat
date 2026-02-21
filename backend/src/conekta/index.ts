import {
  CustomersApi,
  SubscriptionsApi,
  PaymentMethodsApi,
  Configuration,
  OrdersApi,
  WebhookKeysApi,
  EventsApi,
} from 'conekta';
import { loadEnvOnce } from '../utils/loadEnv';

loadEnvOnce();

const hasLiveKey = Boolean(process.env.CONEKTA_KEY?.trim());
const hasTestKey = Boolean(process.env.CONEKTA_TEST_KEY?.trim());
const keyMode = String(process.env.CONEKTA_KEY_MODE || '').trim().toLowerCase();
const nodeEnv = String(process.env.NODE_ENV || '').trim().toLowerCase();
const isDevLike = nodeEnv === 'development' || nodeEnv === 'test';

// Production-safe selection:
// - `CONEKTA_KEY_MODE=test|live` overrides behavior.
// - Dev/test environments prefer test keys.
// - All other environments prefer live keys when available.
const preferLive =
  keyMode === 'live' || keyMode === 'production'
    ? true
    : keyMode === 'test'
      ? false
      : isDevLike
        ? !hasTestKey && hasLiveKey
        : hasLiveKey;

const apiKey = (preferLive ? process.env.CONEKTA_KEY : process.env.CONEKTA_TEST_KEY)
  ?? process.env.CONEKTA_KEY
  ?? process.env.CONEKTA_TEST_KEY
  ?? '';

if (!apiKey) {
  // eslint-disable-next-line no-console
  console.warn('[CONEKTA] Missing CONEKTA_KEY/CONEKTA_TEST_KEY. Conekta API calls will fail.');
} else if (!preferLive && !isDevLike && hasLiveKey && hasTestKey) {
  // eslint-disable-next-line no-console
  console.warn(
    '[CONEKTA] Using TEST key outside development/test. Set CONEKTA_KEY_MODE=live for production.',
  );
}

const conektaConfig = new Configuration({ apiKey, accessToken: apiKey });

export const conektaCustomers = new CustomersApi(conektaConfig);

export const conektaSubscriptions = new SubscriptionsApi(conektaConfig);

export const conektaPaymentMethods = new PaymentMethodsApi(conektaConfig);

export const conektaOrders = new OrdersApi(conektaConfig);

export const conektaWebhookKeys = new WebhookKeysApi(conektaConfig);

export const conektaEvents = new EventsApi(conektaConfig);
