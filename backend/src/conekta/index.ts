import {
  CustomersApi,
  SubscriptionsApi,
  PaymentMethodsApi,
  Configuration,
  OrdersApi,
} from 'conekta';

const apikey =
  process.env.NODE_ENV === 'production'
    ? process.env.CONEKTA_KEY
    : process.env.CONEKTA_TEST_KEY;
const config = new Configuration({ accessToken: apikey });

export const conektaClient = new CustomersApi(config);

export const conektaSubscriptions = new SubscriptionsApi(config);

export const conektaPaymentMethods = new PaymentMethodsApi(config);

export const conektaOrders = new OrdersApi(config);
