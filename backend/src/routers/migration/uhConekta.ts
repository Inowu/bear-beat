import {
  CustomersApi,
  SubscriptionsApi,
  PaymentMethodsApi,
  Configuration,
  OrdersApi,
} from 'conekta';
import { config } from 'dotenv';

config();

const apiKey = process.env.CONEKTA_UH_KEY as string;

const conektaConfig = new Configuration({ apiKey, accessToken: apiKey });

export const uhConektaCustomers = new CustomersApi(conektaConfig);

export const uhConektaSubscriptions = new SubscriptionsApi(conektaConfig);

export const uhConektaPaymentMethods = new PaymentMethodsApi();

export const uhConektaOrders = new OrdersApi(conektaConfig);
