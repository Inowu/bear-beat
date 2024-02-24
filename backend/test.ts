import Stripe from 'stripe';
import { paypal } from './src/paypal';
import archiver from 'archiver';
import fs from 'fs';
import { config } from 'dotenv';
import {
  CustomersApi,
  SubscriptionsApi,
  PaymentMethodsApi,
  Configuration,
  OrdersApi,
} from 'conekta';
import axios from 'axios';

config();

async function main() {
  // try {
  //   const conektaConfig = new Configuration({
  //     apiKey: process.env.CONEKTA_TEST_KEY,
  //     accessToken: process.env.CONEKTA_TEST_KEY,
  //   });
  //
  //   const customersApi = new CustomersApi(conektaConfig);
  //
  //   try {
  //     const res = await customersApi.createCustomer({
  //       name: 'JDEZ94'.replace(/[^a-zA-Z0-9]/g, ''),
  //       email: 'john_bdc@hotmail.com',
  //       phone: '+52 4776820132',
  //       metadata: {
  //         id: 11356,
  //       },
  //     });
  //
  //     console.log(res);
  //   } catch (e) {
  //     console.log(e?.response?.data?.details);
  //   }
  // } catch (e) {
  //   console.log(e.type);
  //   console.log(e.raw.code);
  // }

  // STRIPE
  // const stripeInstance = new Stripe(process.env.STRIPE_TEST_KEY as string, {
  //   apiVersion: '2023-08-16',
  // });
  //
  // console.log(
  //   await stripeInstance.products.create({
  //     name: 'test product bearbeat',
  //     active: true,
  //     default_price_data: {
  //       currency: 'usd',
  //       unit_amount: 1000,
  //       recurring: {
  //         interval: 'month',
  //         interval_count: 1,
  //       },
  //     },
  //   }),
  // );

  // console.log({
  //   paypalUrl: paypal.paypalUrl(),
  //   clientId: paypal.clientId(),
  //   clientSecret: paypal.clientSecret(),
  // });
  // PAYPAL
  // const token = await paypal.getToken();

  // const res = await axios.get(
  //   `${paypal.paypalUrl()}/v1/catalogs/products`,
  //   // {
  //   //   name: 'test product bearbeat',
  //   //   type: 'DIGITAL',
  //   //   category: 'ECOMMERCE_SERVICES',
  //   //   home_url: 'https://thebearbeat.com',
  //   // },
  //   {
  //     headers: {
  //       Authorization: `Bearer ${token}`,
  //     },
  //   },
  // );
  //
  // console.log({
  //   paypalUrl: paypal.paypalUrl(),
  //   clientId: paypal.clientId(),
  //   clientSecret: paypal.clientSecret(),
  // });
  // const res = (
  //   await axios.post(
  //     `${paypal.paypalUrl()}/v1/billing/plans`,
  //     {
  //       product_id: 'PROD-6XD39077UM964502Y',
  //       name: 'test plan bearbeat',
  //       description: undefined,
  //       status: 'ACTIVE',
  //       billing_cycles: [
  //         {
  //           tenure_type: 'REGULAR',
  //           sequence: 1,
  //           total_cycles: 0,
  //           pricing_scheme: {
  //             fixed_price: {
  //               value: '18',
  //               currency_code: 'USD',
  //             },
  //           },
  //           frequency: {
  //             interval_unit: 'MONTH',
  //             interval_count: 1,
  //           },
  //         },
  //       ],
  //       payment_preferences: {
  //         auto_bill_outstanding: true,
  //         setup_fee: {
  //           value: '0',
  //           currency_code: 'USD',
  //         },
  //       },
  //     },
  //     {
  //       headers: {
  //         Authorization: `Bearer ${token}`,
  //       },
  //     },
  //   )
  // ).data;

  // const res = (
  //   await axios(
  //     `${paypal.paypalUrl()}/v1/billing/subscriptions/I-M9U0UXA9XLU0`,
  //     { headers: { Authorization: `Bearer ${token}` } },
  //   )
  // ).data;

  // console.log(res);

  const archive = archiver('zip', {
    zlib: { level: 9 },
  });

  const output = fs.createWriteStream('./compressed-dirs/test.zip');

  archive.on('progress', (progress) => console.log(progress));

  archive.directory('./node_modules', false);

  archive.pipe(output);

  await archive.finalize();
}

main();
