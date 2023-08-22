import {
  CustomersApi,
  SubscriptionsApi,
  PaymentMethodsApi,
  Configuration,
  OrdersApi,
} from 'conekta';
import { config } from 'dotenv';

config();

const apiKey =
  process.env.NODE_ENV === 'production'
    ? (process.env.CONEKTA_KEY as string)
    : (process.env.CONEKTA_TEST_KEY as string);

const conektaConfig = new Configuration({ apiKey, accessToken: apiKey });

export const conektaClient = new CustomersApi(conektaConfig);

export const conektaSubscriptions = new SubscriptionsApi(conektaConfig);

export const conektaPaymentMethods = new PaymentMethodsApi();

export const conektaOrders = new OrdersApi(conektaConfig);
