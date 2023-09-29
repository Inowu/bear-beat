import { Request } from 'express';
import { PaypalEvent } from './events';
import { subscribe } from '../../subscriptions/services/subscribe';
import { prisma } from '../../../db';
import { log } from '../../../server';

export const paypalSubscriptionWebhook = async (req: Request) => {
  const payload = JSON.parse(req.body as any);

  console.log(payload);

  // switch (payload.event_type) {
  //   case PaypalEvent.BILLING_SUBSCRIPTION_ACTIVATED:
  //     log.info(`[PAYPAL_WH] Activating subscription for user ${user.id}`);
  //     await subscribe({
  //       prisma,
  //       user,
  //       plan,
  //       subId,
  //       service: SubscriptionService.PAYPAL,
  //     });
  // }
  return;

  const authAlgo = req.headers['PAYPAL-AUTH-ALGO'];
  const certUrl = req.headers['PAYPAL-CERT-URL'];
  const transmissionId = req.headers['PAYPAL-TRANSMISSION-ID'];
  const transmissionSig = req.headers['PAYPAL-TRANSMISSION-SIG'];
  const transmissionTime = req.headers['PAYPAL-TRANSMISSION-TIME'];

  const url =
    process.env.NODE_ENV === 'production'
      ? process.env.PAYPAL_URL
      : process.env.PAYPAL_SANDBOX_URL;

  const authUrl = `${url}/v1/oauth2/token`;
  const clientIdAndSecret = 'CLIENT_ID:SECRET_CODE';
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
      // webhook_id: '1JE4291016473214C',
      webhook_event: payload,
    }),
  });
};
