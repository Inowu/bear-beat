import { Request } from 'express';
import axios from 'axios';

export const verifyPaypalSignature = async (req: Request): Promise<boolean> => {
  const authAlgo = req.headers['paypal-auth-algo'];
  const certUrl = req.headers['paypal-cert-url'];
  const transmissionId = req.headers['paypal-transmission-id'];
  const transmissionSig = req.headers['paypal-transmission-sig'];
  const transmissionTime = req.headers['paypal-transmission-time'];

  const url =
    process.env.NODE_ENV === 'production'
      ? process.env.PAYPAL_URL
      : process.env.PAYPAL_SANDBOX_URL;

  const clientId =
    process.env.NODE_ENV === 'production'
      ? process.env.PAYPAL_CLIENT_ID
      : process.env.PAYPAL_TEST_CLIENT_ID;
  const clientSecret =
    process.env.NODE_ENV === 'production'
      ? process.env.PAYPAL_CLIENT_SECRET
      : process.env.PAYPAL_TEST_CLIENT_SECRET;

  const authUrl = `${url}/v1/oauth2/token`;

  try {
    const {
      data: { access_token },
    } = await axios(authUrl, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Accept-Language': 'en_US',
        'content-type': 'application/x-www-form-urlencoded',
      },
      auth: {
        username: clientId as string,
        password: clientSecret as string,
      },
      params: {
        grant_type: 'client_credentials',
      },
    });

    const verifyPayload = {
      transmission_id: transmissionId,
      transmission_time: transmissionTime,
      cert_url: certUrl,
      auth_algo: authAlgo,
      transmission_sig: transmissionSig,
      webhook_id: process.env.PAYPAL_WH_ID,
      webhook_event: req.body,
    };

    const res = await axios.post(
      `${url}/v1/notifications/verify-webhook-signature`,
      verifyPayload,
      {
        headers: {
          Authorization: `Bearer ${access_token}`,
        },
      },
    );

    console.log({
      result: res.data.verification_status,
      body: req.body.toString(),
    });
  } catch (e: any) {
    console.error(e);
  }

  return false;
};
