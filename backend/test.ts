import {
  CustomersApi,
  SubscriptionsApi,
  PaymentMethodsApi,
  Configuration,
  OrdersApi,
} from 'conekta';

async function main() {
  try {
    const conektaConfig = new Configuration({
      apiKey: process.env.CONEKTA_TEST_KEY,
      accessToken: process.env.CONEKTA_TEST_KEY,
    });

    const customersApi = new CustomersApi(conektaConfig);

    try {
      const res = await customersApi.createCustomer({
        name: 'JDEZ94'.replace(/[^a-zA-Z0-9]/g, ''),
        email: 'john_bdc@hotmail.com',
        phone: '+52 4776820132',
        metadata: {
          id: 11356,
        },
      });

      console.log(res);
    } catch (e) {
      console.log(e?.response?.data?.details);
    }
  } catch (e) {
    console.log(e.type);
    console.log(e.raw.code);
  }
}

main();
