export const paypal = {
  paypalUrl:
    process.env.NODE_ENV === 'production'
      ? process.env.PAYPAL_URL
      : process.env.PAYPAL_SANDBOX_URL,
  clientId:
    process.env.NODE_ENV === 'production'
      ? process.env.PAYPAL_CLIENT_ID
      : process.env.PAYPAL_TEST_CLIENT_ID,
  clientSecret:
    process.env.NODE_ENV === 'production'
      ? process.env.PAYPAL_CLIENT_SECRET
      : process.env.PAYPAL_TEST_CLIENT_SECRET,
};
