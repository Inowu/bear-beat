import { TRPCError } from '@trpc/server';
import { log } from '../../../server';
import { DescargasUser, Orders, Plans, Users } from '@prisma/client';
import stripeInstance from '../../../stripe';
import { prisma } from '../../../db';
import { gbToBytes } from '../../../utils/gbToBytes';
import { SessionUser } from '../../auth/utils/serialize-user';
import { getFtpUserInfo } from '../../utils/getFtpUserInfo';
import { paypal } from '../../../paypal';
import axios from 'axios';

interface Params {
  subscriptionOrder: Orders;
  newPlan: Plans;
  subscription: DescargasUser;
  user: SessionUser;
}

/**
 * Updates the stripe subscription item to the new plan
 * Caller is responsibe for checking if the subscription has a valid order_id
 */
export const updateStripeSubscription = async ({
  subscriptionOrder,
  newPlan,
  subscription,
  user,
}: Params) => {
  const subscriptionId = subscriptionOrder.txn_id;

  if (!subscriptionId || !subscriptionId.startsWith('sub_')) {
    log.error(
      `[CHANGE_PLAN] This subscription's order has no subscription id or the id is invalid, order id: ${subscriptionOrder.id}`,
    );

    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message:
        'Hay un problema con esta suscripción, por favor contacta a soporte',
    });
  }

  const stripeSub = (
    await stripeInstance.subscriptionItems.list({
      subscription: subscriptionId,
    })
  ).data[0];

  if (!stripeSub) {
    log.error(
      `[CHANGE_PLAN] Stripe subscription not found, sub id ${subscriptionId}`,
    );

    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message:
        'Hay un problema con esta suscripción, por favor contacta a soporte',
    });
  }

  try {
    await stripeInstance.subscriptionItems.update(stripeSub.id, {
      // Checked outside method
      price: newPlan.stripe_prod_id!,
      proration_behavior: 'always_invoice',
    });

    await updateFtpUserInfo({
      subscription,
      user,
      subscriptionOrder,
      newPlan,
    });

    return {
      message: 'El plan de tu suscripción ha sido actualizado',
    };
  } catch (e) {
    log.error(`[CHANGE_PLAN] Error updating stripe subscription item, ${e}`);
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message:
        'Hubo un error al actualizar tu plan, por favor contacta a soporte',
    });
  }
};

export const updatePaypalSubscription = async ({
  subscriptionOrder,
  newPlan,
  subscription,
  user,
}: Params) => {
  if (!subscriptionOrder.txn_id || !subscriptionOrder.txn_id.startsWith('I-')) {
    log.error(
      `[CHANGE_PLAN] This subscription's order has no subscription id or the id is invalid, order id: ${subscriptionOrder.id}`,
    );

    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message:
        'Hay un problema con esta suscripción, por favor contacta a soporte',
    });
  }

  // This is done after user accepted the change on the client
  // await updateFtpUserInfo({
  //   subscription,
  //   user,
  //   subscriptionOrder,
  //   newPlan,
  // });

  const token = await paypal.getToken();

  try {
    // Update the paypal subscription
    const response = await axios.post(
      `${paypal.paypalUrl()}/v1/billing/subscriptions/${
        subscriptionOrder.txn_id
      }/revise`,
      {
        plan_id: newPlan.paypal_plan_id,
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    );

    return {
      message: 'El plan de tu suscripción ha sido actualizado',
      data: response.data,
    };
  } catch (e) {
    log.error(`[CHANGE_PLAN] Error updating paypal subscription, ${e}`);

    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message:
        'Hubo un error al actualizar tu plan, por favor contacta a soporte',
    });
  }
};

export const updateFtpUserInfo = async ({
  subscription,
  user,
  subscriptionOrder,
  newPlan,
}: {
  subscription: DescargasUser;
  user: SessionUser | Users;
  subscriptionOrder: Orders;
  newPlan: Plans;
}) => {
  const previousPlanOrder = await prisma.orders.findFirst({
    where: {
      // Checked outside method
      id: subscription.order_id!,
    },
  });

  if (!previousPlanOrder || !previousPlanOrder.plan_id) {
    log.error(
      `[CHANGE_PLAN] No plan found for order id ${subscription.order_id}`,
    );

    throw new TRPCError({
      code: 'NOT_FOUND',
      message: 'No se encontró la orden de la suscripción',
    });
  }

  const previousPlan = await prisma.plans.findFirst({
    where: {
      id: previousPlanOrder.plan_id,
    },
  });

  if (!previousPlan) {
    log.error(
      `[CHANGE_PLAN] No plan found for plan id ${previousPlanOrder.plan_id}`,
    );

    throw new TRPCError({
      code: 'NOT_FOUND',
      message: 'No se encontró el plan de la suscripción',
    });
  }

  const ftpInfo = await getFtpUserInfo(user);

  if (!ftpInfo.ftpUser || !ftpInfo.limits || !ftpInfo.tallies) {
    log.error(`[CHANGE_PLAN] No se encontró la información de FTP del usuario`);

    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'Hubo un error al obtener tu información de FTP',
    });
  }

  const newLimit = gbToBytes(Number(newPlan.gigas));

  log.info(
    `[CHANGE_PLAN] Updating plan for user ${user.id} to new plan ${newPlan.id} with new limit ${newLimit} bytes`,
  );

  try {
    delete (subscriptionOrder as Partial<Orders>).id;

    const results = await prisma.$transaction([
      prisma.ftpQuotaLimits.update({
        where: {
          id: ftpInfo.limits.id,
        },
        data: {
          bytes_out_avail: newLimit,
        },
      }),
      prisma.change_plan_transactions.create({
        data: {
          userId: user.id,
          newPlanId: newPlan.id,
          oldPlanId: previousPlan.id,
          createdAt: new Date(),
        },
      }),
      prisma.orders.create({
        data: {
          ...subscriptionOrder,
          plan_id: newPlan.id,
        },
      }),
    ]);

    await prisma.descargasUser.update({
      where: {
        id: subscription.id,
      },
      data: {
        order_id: results[2].id,
      },
    });
  } catch (e) {
    log.error(
      `[CHANGE_PLAN] Error updating ftp info when changing plan for user ${user.id}, ${e}`,
    );

    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message:
        'Hubo un error al actualizar tu plan, por favor contacta a soporte',
    });
  }
};
