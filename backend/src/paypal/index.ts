import axios from 'axios';

const clientId = (): string =>
  process.env.NODE_ENV === 'production'
    ? (process.env.PAYPAL_CLIENT_ID as string)
    : (process.env.PAYPAL_TEST_CLIENT_ID as string);

const clientSecret = (): string =>
  process.env.NODE_ENV === 'production'
    ? (process.env.PAYPAL_CLIENT_SECRET as string)
    : (process.env.PAYPAL_TEST_CLIENT_SECRET as string);

const paypalUrl = (): string =>
  process.env.NODE_ENV === 'production'
    ? (process.env.PAYPAL_URL as string)
    : (process.env.PAYPAL_SANDBOX_URL as string);

export const paypal = {
  paypalUrl,
  clientSecret,
  clientId,
  getToken: async () => {
    const url = `${paypalUrl()}/v1/oauth2/token`;

    const {
      data: { access_token },
    } = await axios(url, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Accept-Language': 'en_US',
        'content-type': 'application/x-www-form-urlencoded',
      },
      auth: {
        username: clientId(),
        password: clientSecret(),
      },
      params: {
        grant_type: 'client_credentials',
      },
    });

    return access_token;
  },
};
