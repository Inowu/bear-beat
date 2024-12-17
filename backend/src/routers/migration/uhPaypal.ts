import axios from 'axios';

/* eslint-disable no-confusing-arrow */

const clientId = (): string => process.env.PAYPAL_UH_CLIENT_ID as string;

const clientSecret = (): string => process.env.PAYPAL_UH_CLIENT_SECRET as string;

const paypalUrl = (): string => process.env.PAYPAL_URL as string;

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
