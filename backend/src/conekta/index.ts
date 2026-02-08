import {
  CustomersApi,
  SubscriptionsApi,
  PaymentMethodsApi,
  Configuration,
  OrdersApi,
} from 'conekta';
import { config } from 'dotenv';

config();

const hasLiveKey = Boolean(process.env.CONEKTA_KEY?.trim());
const hasTestKey = Boolean(process.env.CONEKTA_TEST_KEY?.trim());

// Production servers may not set NODE_ENV. Prefer live keys if available and test keys are missing.
const preferLive = process.env.NODE_ENV === 'production' || (hasLiveKey && !hasTestKey);

const apiKey = (preferLive ? process.env.CONEKTA_KEY : process.env.CONEKTA_TEST_KEY)
  ?? process.env.CONEKTA_KEY
  ?? process.env.CONEKTA_TEST_KEY
  ?? '';

if (!apiKey) {
  // eslint-disable-next-line no-console
  console.warn('[CONEKTA] Missing CONEKTA_KEY/CONEKTA_TEST_KEY. Conekta API calls will fail.');
}

const conektaConfig = new Configuration({ apiKey, accessToken: apiKey });

export const conektaCustomers = new CustomersApi(conektaConfig);

export const conektaSubscriptions = new SubscriptionsApi(conektaConfig);

export const conektaPaymentMethods = new PaymentMethodsApi(conektaConfig);

export const conektaOrders = new OrdersApi(conektaConfig);
