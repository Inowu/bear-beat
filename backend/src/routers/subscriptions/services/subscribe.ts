import crypto from 'crypto';
import { Users, Plans, PrismaClient, Orders } from '@prisma/client';
import { TRPCError } from '@trpc/server';
import { gbToBytes } from '../../../utils/gbToBytes';
import { log } from '../../../server';
import { OrderStatus } from '../interfaces/order-status.interface';
import { Params, PaymentService } from './types';
import { SessionUser } from '../../auth/utils/serialize-user';
import { sendPlanActivatedEmail } from '../../../email';
import { ingestPaymentSuccessEvent } from '../../../analytics/paymentSuccess';

type PaymentSuccessProvider = 'stripe' | 'stripe_oxxo' | 'paypal' | 'conekta' | 'admin';

const resolvePaymentSuccessProvider = (service: PaymentService): PaymentSuccessProvider | null => {
  switch (service) {
    case PaymentService.STRIPE:
    case PaymentService.STRIPE_RENOVACION:
    case PaymentService.STRIPE_PLAN_CHANGE:
      return 'stripe';
    case PaymentService.STRIPE_OXXO:
      return 'stripe_oxxo';
    case PaymentService.PAYPAL:
    case PaymentService.PAYPAL_PLAN_CHANGE:
      return 'paypal';
    case PaymentService.CONEKTA:
      return 'conekta';
    case PaymentService.ADMIN:
      return 'admin';
    default:
      return null;
  }
};

const emitPaymentSuccessFromPaidOrder = async (params: {
  prisma: PrismaClient;
  user: Users | SessionUser;
  order: Orders | null;
  plan: Plans | null | undefined;
  service: PaymentService;
  subId: string;
}): Promise<void> => {
  const {
    prisma,
    user,
    order,
    plan,
    service,
    subId,
  } = params;
  if (!order || order.status !== OrderStatus.PAID) return;

  const provider = resolvePaymentSuccessProvider(service);
  if (!provider) return;

  try {
    const previousPaidOrder = await prisma.orders.findFirst({
      where: {
        user_id: user.id,
        id: { not: order.id },
        status: OrderStatus.PAID,
        is_plan: 1,
        ...(order.plan_id == null
          ? { plan_id: null }
          : { plan_id: order.plan_id }),
        AND: [
          {
            OR: [{ is_canceled: null }, { is_canceled: 0 }],
          },
          {
            OR: [
              { date_order: { lt: order.date_order } },
              {
                date_order: order.date_order,
                id: { lt: order.id },
              },
            ],
          },
        ],
      },
      select: { id: true },
    });

    await ingestPaymentSuccessEvent({
      prisma,
      provider,
      providerEventId: subId || order.txn_id || order.invoice_id || `order_${order.id}`,
      userId: user.id,
      orderId: order.id,
      planId: order.plan_id ?? null,
      amount: Number(order.total_price) || Number(plan?.price) || 0,
      currency: plan?.moneda?.toUpperCase?.() ?? null,
      isRenewal: Boolean(previousPaidOrder?.id),
      eventTs: order.date_order ?? new Date(),
      metadata: {
        source: 'subscribe_service',
        paymentMethod: order.payment_method ?? null,
        txnId: order.txn_id ?? null,
        invoiceId: order.invoice_id ?? null,
      },
    });
  } catch (error) {
    log.debug('[SUBSCRIPTION] analytics payment_success skipped (subscribe service)', {
      error: error instanceof Error ? error.message : error,
    });
  }
};

export const subscribe = async ({
  prisma,
  user,
  plan,
  orderId: metaOrderId,
  subId,
  service,
  expirationDate,
  quotaGb: quotaGbInput,
  isTrial = false,
}: Params) => {
  const ftpUser = await prisma.ftpUser.findFirst({
    where: {
      user_id: user.id,
    },
  });

  let dbPlan: Plans | null | undefined = plan;

  const orderIdRaw =
    typeof metaOrderId === 'string' || typeof metaOrderId === 'number'
      ? Number(metaOrderId)
      : 0;
  const orderId = Number.isFinite(orderIdRaw) && orderIdRaw > 0 ? orderIdRaw : 0;

  if (!plan) {
    log.info('[SUBSCRIPTION] Fetching order');
    const order = await prisma.orders.findFirstOrThrow({
      where: {
        id: orderId,
      },
    });

    // if (order.status === OrderStatus.PAID) {
    //   log.error(`[SUBSCRIPTION] This order was already paid, ${orderId}`);
    //   return;
    // }

    if (!order.plan_id) {
      log.error('[SUBSCRIPTION] Order missing plan_id');

      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'The given order did not have a plan id',
      });
    }

    log.info(`[SUBSCRIPTION] Fetching plan with id ${order.plan_id}`);
    dbPlan = await prisma.plans.findFirst({
      where: {
        id: order.plan_id,
      },
    });
  }

  if (!dbPlan) {
    log.warn(
      `[SUBSCRIPTION] Could not find plan with id ${plan?.id ?? 'unknown'}. No action was taken`,
    );

    return;
  }

  const planGigas = Number(dbPlan.gigas) || 0;
  const quotaGb =
    typeof quotaGbInput === 'number' && Number.isFinite(quotaGbInput) && quotaGbInput > 0
      ? quotaGbInput
      : planGigas > 0
        ? planGigas
        : 500;

  // Hasn't subscribed before
  if (!ftpUser) {
    log.info('[SUBSCRIPTION] Creating new subscription');

    try {
      let settledPaidOrder: Orders | null = null;
      const formattedUsername = user.username.toLowerCase().replace(/ /g, '.');
      const responses = await prisma.$transaction([
        ...insertFtpQuotas({ prisma, user, plan: dbPlan, quotaGb }),
        prisma.ftpUser.create({
          data: {
            userid: formattedUsername,
            user_id: user.id,
            homedir: dbPlan.homedir,
            uid: 2001,
            gid: 2001,
            passwd: crypto.randomBytes(15).toString('base64'),
            expiration: expirationDate,
          },
        }),
        prisma.descargasUser.create({
          data: {
            available: quotaGb,
            date_end: expirationDate,
            user_id: user.id,
            ...(orderId ? { order_id: orderId } : {}),
          },
        }),
      ]);

      if (
        service === PaymentService.ADMIN ||
        service === PaymentService.PAYPAL
      ) {
        let selectedOrderId: number;

        const createdOrder = await insertOrderOrUpdate(
          prisma,
          orderId,
          subId,
          user.id,
          dbPlan,
          service,
        );
        selectedOrderId = createdOrder.id;
        settledPaidOrder = createdOrder;

        await prisma.descargasUser.update({
          where: {
            id: responses[responses.length - 1].id,
          },
          data: {
            order_id: selectedOrderId,
          },
        });

        try {
          await sendPlanActivatedEmail({
            userId: user.id,
            toEmail: user.email,
            toName: user.username,
            planName: dbPlan.name,
            price: dbPlan.price,
            currency: dbPlan.moneda.toUpperCase(),
            orderId: selectedOrderId,
          });
        } catch (e) {
          log.error(`[SUBSCRIPTION] Error while sending email ${e}`);
        }
      }

      if (orderId) {
        if (!isTrial) {
          settledPaidOrder = await prisma.orders.update({
            where: {
              id: orderId,
            },
            data: {
              status: OrderStatus.PAID,
            },
          });
        }
      }

      if (!isTrial) {
        await emitPaymentSuccessFromPaidOrder({
          prisma,
          user,
          order: settledPaidOrder,
          plan: dbPlan,
          service,
          subId,
        });
      }
    } catch (e) {
      log.error(`Error while creating ftp user: ${e}`);
    }
  } else {
    log.info('[SUBSCRIPTION] Renovating subscription');

    try {
      const [existingTallies, existingLimits] = await Promise.all([
        prisma.ftpquotatallies.findFirst({
          where: {
            name: ftpUser.userid,
          },
        }),
        prisma.ftpQuotaLimits.findFirst({
          where: {
            name: ftpUser.userid,
          },
        }),
      ]);

      let talliesId = existingTallies?.id;
      let limitsId = existingLimits?.id;

      if (!existingTallies) {
        const tallies = await prisma.ftpquotatallies.create({
          data: {
            name: ftpUser.userid,
          },
        });

        talliesId = tallies.id;
      }

      if (!existingLimits) {
        const limits = await prisma.ftpQuotaLimits.create({
          data: {
            bytes_out_avail: gbToBytes(quotaGb),
            bytes_xfer_avail: 0,
            // A limit of 0 means unlimited
            files_out_avail: 0,
            bytes_in_avail: 1,
            files_in_avail: 1,
            name: ftpUser.userid,
          },
        });

        limitsId = limits.id;
      }

      // Renovation
      await prisma.$transaction([
        prisma.ftpquotatallies.update({
          where: {
            id: talliesId,
          },
          data: {
            bytes_out_used: 0,
          },
        }),
        prisma.ftpQuotaLimits.update({
          where: {
            id: limitsId,
          },
          data: {
            bytes_out_avail: gbToBytes(quotaGb),
            bytes_xfer_avail: 0,
            files_xfer_avail: 0,
            files_out_avail: 0,
            // A limit of 0 means unlimited
            bytes_in_avail: 1,
            files_in_avail: 1,
            name: ftpUser.userid,
          },
        }),
        prisma.ftpUser.update({
          where: {
            id: ftpUser.id,
          },
          data: {
            expiration: expirationDate,
          },
        }),
      ]);

      log.info('[SUBSCRIPTION] Creating renewal order');

      const createdOrder = await insertOrderOrUpdate(
        prisma,
        orderId,
        subId,
        user.id,
        dbPlan,
        service,
      );
      // Webhooks can be delivered multiple times. Avoid granting duplicate quota rows
      // when we process the same billing period more than once (idempotency).
      const existingDescargasForPeriod = await prisma.descargasUser.findFirst({
        where: {
          user_id: user.id,
          date_end: expirationDate,
        },
        select: { id: true },
      });
      if (existingDescargasForPeriod) {
        log.info(
          `[SUBSCRIPTION] Descargas already exists for period ending ${expirationDate.toISOString()}, skipping insert`,
        );
      } else {
        await insertInDescargas({
          expirationDate,
          availableGb: quotaGb,
          user,
          order: createdOrder,
          prisma,
        });
      }

      await emitPaymentSuccessFromPaidOrder({
        prisma,
        user,
        order: createdOrder,
        plan: dbPlan,
        service,
        subId,
      });
    } catch (e) {
      log.error(`Error while renovating subscription: ${e}`);
    }
  }
};

const insertOrderOrUpdate = async (
  prisma: PrismaClient,
  orderId: number,
  subId: string,
  userId: number,
  plan: Plans,
  service: PaymentService,
) => {
  const now = new Date();

  if (orderId) {
    const byId = await prisma.orders.findFirst({
      where: { id: orderId },
    });

    // If this is the initial checkout-created order (PENDING), mark it as paid now.
    // This is especially important for trials converting to paid (first invoice happens later).
    if (byId && byId.status !== OrderStatus.PAID) {
      const updated = await prisma.orders.update({
        where: { id: byId.id },
        data: {
          txn_id: subId,
          user_id: userId,
          status: OrderStatus.PAID,
          is_plan: 1,
          plan_id: plan.id,
          payment_method: service,
          date_order: now,
          total_price: Number(plan.price),
        },
      });
      return updated;
    }
  }

  // Dedupe renewals: use the most recent paid order for this subscription id.
  const latestForSubscription = await prisma.orders.findFirst({
    where: {
      txn_id: subId,
      user_id: userId,
      payment_method: service,
      is_plan: 1,
      plan_id: plan.id,
      status: OrderStatus.PAID,
      OR: [{ is_canceled: null }, { is_canceled: 0 }],
    },
    orderBy: { date_order: 'desc' },
  });

  if (latestForSubscription) {
    const minutesDifference = Math.floor(
      Math.abs(now.getTime() - latestForSubscription.date_order.getTime()) /
        1000 /
        60,
    );
    if (minutesDifference <= 1) {
      return latestForSubscription;
    }
  }

  return prisma.orders.create({
    data: {
      txn_id: subId,
      user_id: userId,
      status: OrderStatus.PAID,
      is_plan: 1,
      plan_id: plan.id,
      payment_method: service,
      date_order: now,
      total_price: Number(plan.price),
    },
  });
};

const insertFtpQuotas = ({
  prisma,
  user,
  plan,
  quotaGb,
}: {
  prisma: PrismaClient;
  user: Users | SessionUser;
  plan: Plans;
  quotaGb: number;
}) => {
  const gbBytes = gbToBytes(quotaGb);

  log.info(
    `[SUBSCRIPTION] Inserting ftp quotas, bytes_out_avail: ${gbBytes}`,
  );

  const formattedUsername = user.username.toLowerCase().replace(/ /g, '.');

  return [
    prisma.ftpQuotaLimits.create({
      data: {
        bytes_out_avail: gbBytes,
        bytes_xfer_avail: 0,
        // A limit of 0 means unlimited
        files_out_avail: 0,
        bytes_in_avail: 1,
        files_in_avail: 1,
        name: formattedUsername,
      },
    }),
    prisma.ftpquotatallies.create({
      data: {
        name: formattedUsername,
      },
    }),
  ];
};

const insertInDescargas = async ({
  expirationDate,
  availableGb,
  user,
  order,
  prisma,
}: {
  prisma: PrismaClient;
  expirationDate: Date;
  availableGb: number;
  user: Users | SessionUser;
  order: Orders;
}) =>
  prisma.descargasUser.create({
    data: {
      available: availableGb,
      date_end: expirationDate,
      user_id: user.id,
      order_id: order.id,
    },
  });
