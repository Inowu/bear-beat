import {
  CustomersApi,
  SubscriptionsApi,
  PaymentMethodsApi,
  Configuration,
  OrdersApi,
} from 'conekta';
import { config } from 'dotenv';

config();

const apiKey = process.env.NODE_ENV === 'production' ? process.env.CONEKTA_UH_KEY : process.env.CONEKTA_UH_TEST_KEY;

const conektaConfig = new Configuration({ apiKey, accessToken: apiKey });

export const uhConektaCustomers = new CustomersApi(conektaConfig);

export const uhConektaSubscriptions = new SubscriptionsApi(conektaConfig);

export const uhConektaPaymentMethods = new PaymentMethodsApi();

export const uhConektaOrders = new OrdersApi(conektaConfig);