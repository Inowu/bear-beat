import { EventResponse } from 'conekta';
import { Orders, Plans, Users, product_orders, products } from '@prisma/client';
import { Request } from 'express';
import { addDays } from 'date-fns';
import { subscribe } from '../../subscriptions/services/subscribe';
import { prisma } from '../../../db';
import { log } from '../../../server';
import { cancelSubscription } from '../../subscriptions/services/cancelSubscription';
import { getPlanKey } from '../../../utils/getPlanKey';
import { cancelOrder } from '../../subscriptions/services/cancelOrder';
import { ConektaEvents } from './events';
import { PaymentService } from '../../subscriptions/services/types';
import { brevo } from '../../../email';
import { OrderStatus } from '../../subscriptions/interfaces/order-status.interface';
import { addGBToAccount } from '../../products/services/addGBToAccount';

export const conektaSubscriptionWebhook = async (req: Request) => {
  const payload: EventResponse = JSON.parse(req.body as any);
  const payloadStr = req.body;

  if (!shouldHandleEvent(payload)) return;

  const user = await getCustomerIdFromPayload(payload);

  if (!user) {
    log.error(
      `[CONEKTA_WH] User not found in event: ${payload.type}, payload: ${payloadStr}`,
    );
    return;
  }

  const plan = await getPlanFromPayload(payload);

  if (!plan && payload.type?.startsWith('subscription')) {
    log.error(
      `[CONEKTA_WH] Plan not found in event: ${payload.type}, payload: ${payloadStr}`,
    );

    return;
  }

  const subscription = payload.data?.object;

  const isProduct = Boolean(payload.data?.object.metadata.isProduct);

  switch (payload.type) {
    case ConektaEvents.SUB_PAID:
      log.info(
        `[CONEKTA_WH] Creating subscription for user ${user.id}, subscription id: ${subscription.id}, payload: ${payloadStr}`,
      );
      await subscribe({
        subId: subscription.id,
        prisma,
        user,
        plan: plan!,
        service: PaymentService.CONEKTA,
        expirationDate: plan
          ? addDays(new Date(), Number(plan.duration))
          : addDays(new Date(), 30),
      });
      break;
    case ConektaEvents.SUB_UPDATED:
      log.info(
        `[CONEKTA_WH] Updating subscription for user ${user.id}, subscription status: ${subscription.status}, subscription id: ${subscription.id}, payload: ${payloadStr}`,
      );
      if (payload.data?.object.status !== 'active') {
        await cancelSubscription({
          prisma,
          user,
          plan: subscription.plan.id,
          service: PaymentService.CONEKTA,
        });
      }
      break;
    case ConektaEvents.SUB_CANCELED:
      log.info(
        `[CONEKTA_WH] Canceling subscription for user ${user.id}, subscription id: ${subscription.id}, payload: ${payloadStr}`,
      );
      await cancelSubscription({
        prisma,
        user,
        plan: subscription.plan.id,
        service: PaymentService.CONEKTA,
      });
      break;
    case ConektaEvents.ORDER_VOIDED:
    case ConektaEvents.ORDER_DECLINED: {
      const orderId = payload.data?.object.metadata.orderId;

      log.info(`[CONEKTA_WH] Canceling order ${orderId}`);
      await cancelOrder({
        prisma,
        orderId,
        isProduct,
        reason: OrderStatus.FAILED,
      });

      break;
    }
    case ConektaEvents.ORDER_EXPIRED: {
      const orderId = payload.data?.object.metadata.orderId;

      log.info(`[CONEKTA_WH] Canceling order ${orderId}`);
      await cancelOrder({
        prisma,
        orderId,
        isProduct,
        reason: OrderStatus.EXPIRED,
      });

      break;
    }
    case ConektaEvents.ORDER_CHARGED_BACK:
    case ConektaEvents.ORDER_CANCELED: {
      const orderId = payload.data?.object.metadata.orderId;

      log.info(`[CONEKTA_WH] Canceling order ${orderId}`);
      await cancelOrder({
        prisma,
        orderId,
        isProduct,
      });

      break;
    }
    case ConektaEvents.ORDER_PAID: {
      // Ignore with card for now
      if (
        payload.data?.object.charges.data[0].payment_method.object.startsWith(
          'card',
        )
      ) {
        log.info(
          `[CONEKTA_WH] Ignoring card payment for user ${user.id}, payload: ${payloadStr}`,
        );
        return;
      }

      log.info(
        `[CONEKTA_WH] Paid order event received for user ${user.id}, payload: ${payloadStr} `,
      );

      const orderId = payload.data?.object.metadata.orderId;

      if (!orderId) {
        log.error(
          `[CONEKTA_WH] Order id not found in payload: ${payloadStr}, returning from conekta webhook`,
        );
        return;
      }

      let productOrPlan: Plans | products | null = null;
      let order: Orders | product_orders | null = null;

      if (isProduct) {
        log.info(
          `[CONEKTA_WH] Updating product order ${orderId} to paid, payload: ${payloadStr}`,
        );

        order = await prisma.product_orders.update({
          where: {
            id: orderId,
          },
          data: {
            status: OrderStatus.PAID,
          },
        });
      } else {
        order = (await prisma.orders.update({
          where: {
            id: payload.data?.object.metadata.orderId,
          },
          data: {
            status: OrderStatus.PAID,
          },
        })) as Orders;

        productOrPlan = (await prisma.plans.findFirst({
          where: {
            id: order.plan_id!,
          },
        })) as Plans;
      }

      if (!order || !productOrPlan) {
        log.error(
          `[CONEKTA_WH] Order or product not found in payload: ${payloadStr}, returning from conekta webhook`,
        );
        return;
      }

      if (isProduct) {
        await addGBToAccount({
          prisma,
          user,
          orderId: Number(orderId),
        });
      } else {
        await subscribe({
          subId: subscription.id,
          prisma,
          user,
          orderId: Number(orderId),
          service: PaymentService.CONEKTA,
          expirationDate: addDays(
            new Date(),
            Number(productOrPlan.duration) || 30,
          ),
        });
      }

      try {
        await brevo.smtp.sendTransacEmail({
          templateId: 2,
          to: [{ email: user.email, name: user.username }],
          params: {
            NAME: user.username,
            plan_name: productOrPlan.name,
            price: productOrPlan.price,
            currency: productOrPlan.moneda.toUpperCase(),
            ORDER: order.id,
          },
        });
      } catch (e) {
        log.error(`[CONEKTA] Error while sending email ${e}`);
      }

      break;
    }
    default:
      log.info(
        `[CONEKTA_WH] Unhandled event ${payload.type}, payload: ${payloadStr}`,
      );
  }
};

export const getCustomerIdFromPayload = async (
  payload: EventResponse,
): Promise<Users | null> => {
  let user: Users | null | undefined = null;

  switch (payload.type) {
    case ConektaEvents.SUB_PAID:
    case ConektaEvents.SUB_UPDATED:
    case ConektaEvents.SUB_CANCELED:
      user = await prisma.users.findFirst({
        where: {
          conekta_cusid: payload.data?.object.customer_id,
        },
      });
      break;
    case ConektaEvents.ORDER_PAID:
      user = await prisma.users.findFirst({
        where: {
          OR: [
            {
              id: payload.data?.object.metadata.userId,
            },
          ],
        },
      });

      if (!user) {
        log.error('[CONEKTA_WH] Trying to find user by email in database');

        user = await prisma.users.findFirst({
          where: {
            email: payload.data?.object?.customer_info?.email,
          },
        });

        if (user) {
          await prisma.users.update({
            where: {
              id: user.id,
            },
            data: {
              conekta_cusid: payload.data?.object?.customer_info?.customer_id,
            },
          });
        }
      }
      break;
    default:
      break;
  }

  return user;
};

const getPlanFromPayload = async (
  payload: EventResponse,
): Promise<Plans | null> => {
  let plan: Plans | null | undefined = null;

  switch (payload.type) {
    case ConektaEvents.SUB_PAID:
    case ConektaEvents.SUB_UPDATED:
    case ConektaEvents.SUB_CANCELED:
      plan = await prisma.plans.findFirst({
        where: {
          [getPlanKey()]: payload.data?.object.plan_id,
        },
      });
      break;
    default:
      break;
  }

  return plan;
};

const shouldHandleEvent = (payload: EventResponse): boolean => {
  switch (payload.type) {
    case ConektaEvents.SUB_PAID:
    case ConektaEvents.SUB_UPDATED:
    case ConektaEvents.SUB_CANCELED:
    case ConektaEvents.ORDER_VOIDED:
    case ConektaEvents.ORDER_DECLINED:
    case ConektaEvents.ORDER_CANCELED:
    case ConektaEvents.ORDER_PAID:
      return true;
    default:
      log.info(
        `[CONEKTA_WH] Uhandled event ${payload.type}, payload: ${JSON.stringify(
          payload,
        )}`,
      );
      return false;
  }
};
