import axios from 'axios';

/* eslint-disable no-confusing-arrow */

const hasLiveCreds = Boolean(
  process.env.PAYPAL_CLIENT_ID?.trim() && process.env.PAYPAL_CLIENT_SECRET?.trim(),
);
const hasTestCreds = Boolean(
  process.env.PAYPAL_TEST_CLIENT_ID?.trim() &&
    process.env.PAYPAL_TEST_CLIENT_SECRET?.trim(),
);

// Production servers may not set NODE_ENV. Prefer live creds if available and test creds are missing.
const preferLive = process.env.NODE_ENV === 'production' || (hasLiveCreds && !hasTestCreds);

const clientId = (): string =>
  (preferLive ? process.env.PAYPAL_CLIENT_ID : process.env.PAYPAL_TEST_CLIENT_ID) ??
  process.env.PAYPAL_CLIENT_ID ??
  process.env.PAYPAL_TEST_CLIENT_ID ??
  '';

const clientSecret = (): string =>
  (preferLive ? process.env.PAYPAL_CLIENT_SECRET : process.env.PAYPAL_TEST_CLIENT_SECRET) ??
  process.env.PAYPAL_CLIENT_SECRET ??
  process.env.PAYPAL_TEST_CLIENT_SECRET ??
  '';

const paypalUrl = (): string =>
  (preferLive ? process.env.PAYPAL_URL : process.env.PAYPAL_SANDBOX_URL) ??
  process.env.PAYPAL_URL ??
  process.env.PAYPAL_SANDBOX_URL ??
  '';

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
