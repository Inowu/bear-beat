import { Request } from 'express';

export const verifyPaypalSignature = async (req: Request): Promise<boolean> => {
  const authAlgo = req.headers['PAYPAL-AUTH-ALGO'];
  const certUrl = req.headers['PAYPAL-CERT-URL'];
  const transmissionId = req.headers['PAYPAL-TRANSMISSION-ID'];
  const transmissionSig = req.headers['PAYPAL-TRANSMISSION-SIG'];
  const transmissionTime = req.headers['PAYPAL-TRANSMISSION-TIME'];

  const url =
    process.env.NODE_ENV === 'production'
      ? process.env.PAYPAL_URL
      : process.env.PAYPAL_SANDBOX_URL;

  const clientId = (process.env.NODE_ENV = 'production'
    ? process.env.PAYPAL_CLIENT_ID
    : process.env.PAYPAL_TEST_CLIENT_ID);
  const clientSecret = (process.env.NODE_ENV = 'production'
    ? process.env.PAYPAL_CLIENT_SECRET
    : process.env.PAYPAL_TEST_CLIENT_SECRET);

  const authUrl = `${url}/v1/oauth2/token`;
  const clientIdAndSecret = `${clientId}:${clientSecret}`;
  const base64 = Buffer.from(clientIdAndSecret).toString('base64');

  const tokenBody = await (
    await fetch(authUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'Accept-Language': 'en_US',
        Authorization: `Basic ${base64}`,
      },
      body: 'grant_type=client_credentials',
    })
  ).json();

  const res = await (
    await fetch(`${url}/v1/notifications/verify-webhook-signature`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenBody.access_token}`,
      },
      body: JSON.stringify({
        transmission_id: transmissionId,
        transmission_time: transmissionTime,
        cert_url: certUrl,
        auth_algo: authAlgo,
        transmission_sig: transmissionSig,
        webhook_id: process.env.PAYPAL_WH_ID,
        webhook_event: req.body,
      }),
    })
  ).json();

  console.log(res);

  return false;
};
