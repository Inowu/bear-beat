import { Request } from 'express';
import { PaypalEvent } from './events';
import { subscribe } from '../../subscriptions/services/subscribe';
import { prisma } from '../../../db';
import { log } from '../../../server';

export const paypalSubscriptionWebhook = async (req: Request) => {
  const payload = JSON.parse(req.body as any);

  switch (payload.event_type) {
    case PaypalEvent.BILLING_SUBSCRIPTION_ACTIVATED:
    // log.info(`[PAYPAL_WH] Activating subscription for user ${user.id}`);
    // await subscribe({
    //   prisma,
    //   user,
    //   plan,
    //   subId,
    //   service: SubscriptionService.PAYPAL,
    // });
    default:
      log.info(`[PAYPAL_WH] Event type ${payload.event_type} not handled`);
      break;
  }
  return;
};
