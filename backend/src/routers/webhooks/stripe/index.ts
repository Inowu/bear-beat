import { Plans, Users } from '@prisma/client';
import { Stripe } from 'stripe';
import { Request } from 'express';
import { getStripeWebhookBody } from '../../utils/verifyStripeSignature';
import { cancelSubscription } from '../../subscriptions/services/cancelSubscription';
import { log } from '../../../server';
import { subscribe } from '../../subscriptions/services/subscribe';
import { getPlanKey } from '../../../utils/getPlanKey';
import { StripeEvents } from './events';
import stripeInstance from '../../../stripe';
import { prisma } from '../../../db';
import { PaymentService } from '../../subscriptions/services/types';
import { OrderStatus } from '../../subscriptions/interfaces/order-status.interface';
import { sendPlanActivatedEmail } from '../../../email';
import { manyChat } from '../../../many-chat';
import { TRPCError } from '@trpc/server';
import { checkIfUserIsFromUH, checkIfUserIsSubscriber, SubscriptionCheckResult } from '../../migration/checkUHSubscriber';
import uhStripeInstance from '../../migration/uhStripe';
import { uhConektaSubscriptions } from '../../migration/uhConekta';
import { paypal as uhPaypal } from '../../migration/uhPaypal';
import axios, { AxiosError } from 'axios';
import { ingestAnalyticsEvents } from '../../../analytics';
import { markUserOffersRedeemed } from '../../../offers';
import { facebook } from '../../../facebook';
import { ingestPaymentSuccessEvent } from '../../../analytics/paymentSuccess';

export const stripeSubscriptionWebhook = async (req: Request) => {
  const payloadStr = getStripeWebhookBody(req);
  const payload: Stripe.Event = JSON.parse(payloadStr);

  if (!shouldHandleEvent(payload)) return;

  const user = await getUserFromPayload(payload);

  if (!user) {
    log.error('[STRIPE_WH] User not found in event', { eventType: payload.type, eventId: payload.id });
    return;
  }

  const plan = (await getPlanFromPayload(payload))!;

  if (!plan && payload.type?.startsWith('customer.subscription')) {
    log.error('[STRIPE_WH] Plan not found in event', { eventType: payload.type, eventId: payload.id });

    return;
  }

  const subscription = payload.data.object as any;
  const previousAttributes = (payload as any)?.data?.previous_attributes as any;

  // await addMetadataToSubscription({
  //   subId: subscription.id,
  //   prisma,
  //   payload,
  //   user,
  //   plan: plan!,
  // });

  switch (payload.type) {
    case StripeEvents.SUBSCRIPTION_CREATED: {
      if (subscription.status === 'trialing') {
        log.info('[STRIPE_WH] Trial subscription created', {
          eventId: payload.id,
          status: subscription.status,
        });
        const quotaGbRaw = subscription?.metadata?.bb_trial_gb;
        const quotaGb = quotaGbRaw != null && String(quotaGbRaw).trim()
          ? Number(String(quotaGbRaw).trim())
          : undefined;

        // One-time marketing trial guard: mark as used when a trial actually starts (not when checkout is created).
        try {
          await prisma.users.updateMany({
            where: { id: user.id, trial_used_at: null },
            data: { trial_used_at: new Date() },
          });
        } catch (e) {
          log.debug('[STRIPE_WH] trial_used_at update skipped', {
            error: e instanceof Error ? e.message : e,
          });
        }

        await subscribe({
          subId: subscription.id,
          prisma,
          user,
          plan: plan!,
          orderId: subscription.metadata.orderId,
          service: PaymentService.STRIPE,
          expirationDate: new Date(subscription.current_period_end * 1000),
          quotaGb,
          isTrial: true,
        });

        // Internal analytics (server-side): trial started.
        try {
          await ingestAnalyticsEvents({
            prisma,
            events: [
              {
                eventId: `stripe:${payload.id}:trial_started`.slice(0, 80),
                eventName: 'trial_started',
                eventCategory: 'purchase',
                eventTs: new Date().toISOString(),
                userId: user.id,
                currency: plan?.moneda?.toUpperCase?.() ?? null,
                amount: 0,
                metadata: {
                  planId: plan?.id ?? null,
                  stripeSubscriptionId: subscription.id,
                  trialType: subscription?.metadata?.bb_trial_type ?? null,
                  trialGb: quotaGb ?? null,
                },
              },
            ],
            sessionUserId: user.id,
          });
        } catch (e) {
          log.debug('[STRIPE_WH] analytics trial_started skipped', {
            error: e instanceof Error ? e.message : e,
          });
        }

        // ManyChat: don't mark as payment; mark as trial instead.
        try {
          await manyChat.addTagToUser(user, 'TRIAL_STARTED');
        } catch (e) {
          log.error('[STRIPE_WH] Error while adding TRIAL_STARTED tag', {
            error: e instanceof Error ? e.message : e,
          });
        }

        await cancelUhSubscription(user);
        return;
      }

      if (subscription.status !== 'active') {
        log.info('[STRIPE_WH] Subscription created (non-active)', {
          eventId: payload.id,
          status: subscription.status,
        });

        return;
      }

      break;
    }
    case StripeEvents.SUBSCRIPTION_UPDATED:
      switch (subscription.status) {
        case 'active': {
          const orderIdRaw = subscription?.metadata?.orderId;
          const orderId = Number(orderIdRaw);
          let orderWasPaidBefore = true;
          if (Number.isFinite(orderId) && orderId > 0) {
            try {
              const order = await prisma.orders.findFirst({
                where: { id: orderId },
                select: { status: true },
              });
              orderWasPaidBefore = order?.status === OrderStatus.PAID;
            } catch {
              // If we can't determine the order state, skip server-side Purchase to avoid duplicates.
              orderWasPaidBefore = true;
            }
          }

          const prevStatus = typeof previousAttributes?.status === 'string'
            ? String(previousAttributes.status).toLowerCase()
            : null;
          const currentPeriodStart = typeof subscription?.current_period_start === 'number'
            ? subscription.current_period_start
            : null;
          const prevPeriodStart = typeof previousAttributes?.current_period_start === 'number'
            ? previousAttributes.current_period_start
            : null;
          const isTrialConversion = prevStatus === 'trialing';
          const isRenewal = prevStatus === 'active'
            && currentPeriodStart != null
            && prevPeriodStart != null
            && currentPeriodStart !== prevPeriodStart;
          const isInitialPaidActivation = !isRenewal && !isTrialConversion;

          log.info('[STRIPE_WH] Creating subscription', {
            eventId: payload.id,
            isRenewal,
            isTrialConversion,
          });

          // Email + ManyChat: only on first paid activation / trial conversion (avoid spamming on renewals).
          if (isInitialPaidActivation || isTrialConversion) {
            try {
              await sendPlanActivatedEmail({
                userId: user.id,
                toEmail: user.email,
                toName: user.username,
                planName: plan.name,
                price: plan.price,
                currency: plan.moneda.toUpperCase(),
                orderId: subscription.metadata.orderId,
              });
            } catch (e) {
              log.error('[STRIPE_WH] Plan activated email failed (non-blocking)', {
                errorType: e instanceof Error ? e.name : typeof e,
              });
            }
          }

          try {
            if (isTrialConversion) {
              await manyChat.addTagToUser(user, 'TRIAL_CONVERTED');
              await manyChat.addTagToUser(user, 'SUCCESSFUL_PAYMENT');
            } else if (isRenewal) {
              await manyChat.addTagToUser(user, 'SUBSCRIPTION_RENEWED');
            } else {
              await manyChat.addTagToUser(user, 'SUCCESSFUL_PAYMENT');
            }
          } catch (e) {
            log.error('[STRIPE_WH] Error while adding ManyChat tag', {
              error: e instanceof Error ? e.message : e,
            });
          }

          await subscribe({
            subId: subscription.id,
            prisma,
            user,
            plan: plan!,
            orderId: subscription.metadata.orderId,
            service: PaymentService.STRIPE,
            expirationDate: new Date(subscription.current_period_end * 1000),
          });

          const subscriptionMetadata = (subscription?.metadata ?? {}) as Record<string, unknown>;
          const latestPaidOrder = await prisma.orders.findFirst({
            where: {
              user_id: user.id,
              txn_id: subscription.id,
              status: OrderStatus.PAID,
              is_plan: 1,
              OR: [{ is_canceled: null }, { is_canceled: 0 }],
            },
            orderBy: { date_order: 'desc' },
            select: {
              id: true,
              plan_id: true,
              total_price: true,
              date_order: true,
            },
          });

          const shouldEmitPaymentSuccess = !orderWasPaidBefore || isTrialConversion || isRenewal;
          if (shouldEmitPaymentSuccess) {
            const toMetaString = (key: string, maxLen = 255): string | null => {
              const raw = subscriptionMetadata[key];
              if (typeof raw !== 'string') return null;
              const trimmed = raw.trim();
              if (!trimmed) return null;
              return trimmed.slice(0, maxLen);
            };

            try {
              await ingestPaymentSuccessEvent({
                prisma,
                provider: 'stripe',
                providerEventId: payload.id,
                userId: user.id,
                orderId:
                  latestPaidOrder?.id
                  ?? (Number.isFinite(orderId) && orderId > 0 ? orderId : null),
                planId: latestPaidOrder?.plan_id ?? plan?.id ?? null,
                amount: Number(latestPaidOrder?.total_price ?? plan?.price) || 0,
                currency: plan?.moneda?.toUpperCase?.() ?? null,
                isRenewal,
                eventTs: latestPaidOrder?.date_order ?? new Date(),
                sessionId: toMetaString('bb_session_id', 80),
                visitorId: toMetaString('bb_visitor_id', 80),
                attribution: {
                  source: toMetaString('bb_utm_source', 120),
                  medium: toMetaString('bb_utm_medium', 120),
                  campaign: toMetaString('bb_utm_campaign', 180),
                  term: toMetaString('bb_utm_term', 180),
                  content: toMetaString('bb_utm_content', 180),
                  fbclid: toMetaString('bb_fbclid', 255),
                  gclid: toMetaString('bb_gclid', 255),
                },
                metadata: {
                  stripeSubscriptionId: subscription.id,
                },
              });
            } catch (e) {
              log.debug('[STRIPE_WH] analytics payment_success skipped', {
                error: e instanceof Error ? e.message : e,
              });
            }
          }

          // Facebook CAPI Purchase (server-side): send once per order (avoid double counting renewals/updates).
          if (!orderWasPaidBefore) {
            try {
              const purchaseEventId =
                typeof subscriptionMetadata.bb_purchase_event_id === 'string'
                  ? subscriptionMetadata.bb_purchase_event_id.trim().slice(0, 120)
                  : '';
              const fbp =
                typeof subscriptionMetadata.bb_fbp === 'string'
                  ? subscriptionMetadata.bb_fbp.trim().slice(0, 480)
                  : '';
              const fbc =
                typeof subscriptionMetadata.bb_fbc === 'string'
                  ? subscriptionMetadata.bb_fbc.trim().slice(0, 480)
                  : '';
              const sourceUrl =
                typeof subscriptionMetadata.bb_source_url === 'string'
                  ? subscriptionMetadata.bb_source_url.trim().slice(0, 1000)
                  : 'https://thebearbeat.com/planes';

              const value = Number(plan.price) || 0;
              const currency = (plan.moneda || 'USD').toUpperCase();

              await facebook.setEvent(
                'Purchase',
                null,
                null,
                { fbp: fbp || null, fbc: fbc || null, eventId: purchaseEventId || null },
                sourceUrl,
                user,
                { value, currency },
              );
            } catch (e) {
              log.debug('[STRIPE_WH] CAPI Purchase skipped (non-blocking)', {
                error: e instanceof Error ? e.message : e,
              });
            }
          }

          // Offers/coupons: mark user offers redeemed and persist coupon usage (Checkout Sessions path).
          try {
            await markUserOffersRedeemed({ prisma, userId: user.id, reason: 'stripe_active' });
          } catch {
            // noop
          }

          try {
            const orderIdRaw = subscription?.metadata?.orderId;
            const orderId = Number(orderIdRaw);
            if (Number.isFinite(orderId) && orderId > 0) {
              const order = await prisma.orders.findFirst({
                where: { id: orderId },
                select: { user_id: true, cupon_id: true },
              });
              if (order?.cupon_id) {
                const used = await prisma.cuponsUsed.findFirst({
                  where: { user_id: order.user_id, cupon_id: order.cupon_id },
                  select: { id: true },
                });
                if (!used) {
                  await prisma.cuponsUsed.create({
                    data: {
                      user_id: order.user_id,
                      cupon_id: order.cupon_id,
                      date_cupon: new Date(),
                    },
                  });
                }
              }
            }
          } catch (e) {
            log.debug('[STRIPE_WH] Coupon usage persist skipped', {
              error: e instanceof Error ? e.message : e,
            });
          }

          // Internal analytics (server-side) for renewal/trial conversion.
          try {
            if (isTrialConversion) {
              await ingestAnalyticsEvents({
                prisma,
                events: [
                  {
                    eventId: `stripe:${payload.id}:trial_converted`.slice(0, 80),
                    eventName: 'trial_converted',
                    eventCategory: 'purchase',
                    eventTs: new Date().toISOString(),
                    userId: user.id,
                    currency: plan?.moneda?.toUpperCase?.() ?? null,
                    amount: Number(plan?.price) || 0,
                    metadata: {
                      planId: plan?.id ?? null,
                      stripeSubscriptionId: subscription.id,
                    },
                  },
                ],
                sessionUserId: user.id,
              });
            } else if (isRenewal) {
              await ingestAnalyticsEvents({
                prisma,
                events: [
                  {
                    eventId: `stripe:${payload.id}:subscription_renewed`.slice(0, 80),
                    eventName: 'subscription_renewed',
                    eventCategory: 'purchase',
                    eventTs: new Date().toISOString(),
                    userId: user.id,
                    currency: plan?.moneda?.toUpperCase?.() ?? null,
                    amount: Number(plan?.price) || 0,
                    metadata: {
                      planId: plan?.id ?? null,
                      stripeSubscriptionId: subscription.id,
                    },
                  },
                ],
                sessionUserId: user.id,
              });
            }
          } catch (e) {
            log.debug('[STRIPE_WH] analytics renewal/trial conversion skipped', {
              error: e instanceof Error ? e.message : e,
            });
          }

          await cancelUhSubscription(user);
          break;
        }
        case 'incomplete_expired': {
          log.info('[STRIPE_WH] Incomplete subscription expired', {
            eventId: payload.id,
          });

          try {
            await manyChat.addTagToUser(user, 'FAILED_PAYMENT');
          } catch (e) {
            log.error('[STRIPE_WH] Error adding FAILED_PAYMENT tag', {
              error: e instanceof Error ? e.message : e,
            });
          }

          // Internal analytics: payment failed (pre-activation).
          try {
            await ingestAnalyticsEvents({
              prisma,
              events: [
                {
                  eventId: `stripe:${payload.id}:payment_failed`.slice(0, 80),
                  eventName: 'payment_failed',
                  eventCategory: 'purchase',
                  eventTs: new Date().toISOString(),
                  userId: user.id,
                  currency: plan?.moneda?.toUpperCase?.() ?? null,
                  amount: Number(plan?.price) || 0,
                  metadata: {
                    provider: 'stripe',
                    reason: 'incomplete_expired',
                    stripeSubscriptionId: subscription.id,
                    orderId: subscription?.metadata?.orderId ?? null,
                  },
                },
              ],
              sessionUserId: user.id,
            });
          } catch (e) {
            log.debug('[STRIPE_WH] analytics payment_failed skipped', {
              error: e instanceof Error ? e.message : e,
            });
          }

          const pendingOrder = await prisma.orders.findFirst({
            where: {
              AND: [
                {
                  status: OrderStatus.PENDING,
                },
                {
                  payment_method: PaymentService.STRIPE,
                },
              ],
            },
          });

          if (pendingOrder) {
            await prisma.orders.update({
              where: {
                id: pendingOrder.id,
              },
              data: {
                status: OrderStatus.EXPIRED,
              },
            });
          }

          break;
        }
        case 'past_due': {
          const dunningEnabled = (process.env.DUNNING_ENABLED || '0').trim() === '1';

          log.info('[STRIPE_WH] Subscription past_due', {
            eventId: payload.id,
            dunningEnabled,
          });

          try {
            await manyChat.addTagToUser(user, 'FAILED_PAYMENT');
          } catch (e) {
            log.error('[STRIPE_WH] Error adding FAILED_PAYMENT tag', {
              error: e instanceof Error ? e.message : e,
            });
          }

          // Internal analytics: payment failed (billing). When dunning is enabled,
          // do NOT mark this as an involuntary cancellation yet.
          try {
            await ingestAnalyticsEvents({
              prisma,
              events: [
                {
                  eventId: `stripe:${payload.id}:payment_failed`.slice(0, 80),
                  eventName: 'payment_failed',
                  eventCategory: 'purchase',
                  eventTs: new Date().toISOString(),
                  userId: user.id,
                  currency: plan?.moneda?.toUpperCase?.() ?? null,
                  amount: Number(plan?.price) || 0,
                  metadata: {
                    provider: 'stripe',
                    reason: 'past_due',
                    stripeSubscriptionId: subscription.id,
                    orderId: subscription?.metadata?.orderId ?? null,
                  },
                },
                ...(dunningEnabled
                  ? []
                  : [
                      {
                        eventId: `stripe:${payload.id}:subscription_cancel_involuntary`.slice(0, 80),
                        eventName: 'subscription_cancel_involuntary',
                        eventCategory: 'retention' as const,
                        eventTs: new Date().toISOString(),
                        userId: user.id,
                        metadata: {
                          provider: 'stripe',
                          reason: 'past_due',
                          stripeSubscriptionId: subscription.id,
                          orderId: subscription?.metadata?.orderId ?? null,
                        },
                      },
                    ]),
              ],
              sessionUserId: user.id,
            });
          } catch (e) {
            log.debug('[STRIPE_WH] analytics payment_failed/involuntary_cancel skipped', {
              error: e instanceof Error ? e.message : e,
            });
          }

          if (!dunningEnabled) {
            await cancelSubscription({
              prisma,
              user,
              plan: getStripeSubscriptionPriceId(subscription),
              service: PaymentService.STRIPE,
              reason: OrderStatus.EXPIRED,
            });
          }

          break;
        }
        default:
          await cancelSubscription({
            prisma,
            user,
            plan: getStripeSubscriptionPriceId(subscription),
            service: PaymentService.STRIPE,
          });

          break;
      }
      break;
    case StripeEvents.SUBSCRIPTION_DELETED:
      log.info('[STRIPE_WH] Canceling subscription (deleted event)', {
        eventId: payload.id,
      });

      await cancelSubscription({
        prisma,
        user,
        plan: getStripeSubscriptionPriceId(subscription),
        service: PaymentService.STRIPE,
      });
      break;
    default:
      log.info('[STRIPE_WH] Unhandled event', { eventType: payload.type, eventId: payload.id });
  }
};

const getStripeSubscriptionPriceId = (subscription: any): string => {
  const priceId =
    subscription?.plan?.id
    || subscription?.items?.data?.[0]?.price?.id
    || subscription?.items?.data?.[0]?.price;

  if (typeof priceId === 'string' && priceId.trim()) return priceId;

  log.warn('[STRIPE_WH] Subscription event without resolvable plan/price id');
  return '';
};

export const getUserFromPayload = async (
  payload: Stripe.Event,
): Promise<Users | null> => {
  let user: Users | null | undefined = null;

  const customerId = (payload.data.object as any).customer;

  switch (payload.type) {
    case StripeEvents.SUBSCRIPTION_CREATED:
    case StripeEvents.SUBSCRIPTION_UPDATED:
    case StripeEvents.SUBSCRIPTION_DELETED:
      user = await prisma.users.findFirst({
        where: {
          stripe_cusid: customerId,
        },
      });
      break;
    default:
      break;
  }

  if (!user) {
    try {
      const existingUser = await stripeInstance.customers.retrieve(customerId);

      log.info(
        '[STRIPE_WH] No user matched Stripe customer id; attempting email-based recovery',
      );

      const dbUser = await prisma.users.findFirst({
        where: {
          email: (existingUser as any).email,
        },
      });

      if (!dbUser) {
        log.error(
          '[STRIPE_WH] No user matched Stripe customer email during recovery',
        );

        return null;
      }

      await prisma.users.update({
        where: {
          id: dbUser.id,
        },
        data: {
          stripe_cusid: customerId,
        },
      });

      log.info(
        '[STRIPE_WH] Updated user with Stripe customer id during recovery',
      );

      return dbUser;
    } catch (e: any) {
      const stripeCode = e?.raw?.code ?? null;
      const errorType = typeof e?.type === 'string' ? e.type : null;
      log.error('[STRIPE_WH] Stripe customer recovery failed', {
        eventId: payload.id,
        stripeCode,
        errorType,
      });

      return null;
    }
  }

  return user;
};

const getPlanFromPayload = async (
  payload: Stripe.Event,
): Promise<Plans | null> => {
  let plan: Plans | null | undefined = null;

  switch (payload.type) {
    case StripeEvents.SUBSCRIPTION_CREATED:
    case StripeEvents.SUBSCRIPTION_UPDATED:
    case StripeEvents.SUBSCRIPTION_DELETED: {
      const subscription = payload.data.object as any;
      const stripePlanKey = getPlanKey(PaymentService.STRIPE);
      const identifiers = [
        subscription.items?.data?.[0]?.price?.id,
        subscription.items?.data?.[0]?.price,
        subscription.plan?.id,
      ]
        .filter((value): value is string => typeof value === 'string' && value.trim().length > 0);

      if (identifiers.length > 0) {
        plan = await prisma.plans.findFirst({
          where: {
            [stripePlanKey]: { in: identifiers } as any,
          } as any,
        });
      }

      if (!plan && identifiers.length > 0) {
        const candidateId = identifiers[0];
        if (candidateId.startsWith('price_') || candidateId.startsWith('plan_')) {
          try {
            const stripePrice = await stripeInstance.prices.retrieve(candidateId);
            const productId =
              typeof stripePrice.product === 'string'
                ? stripePrice.product
                : stripePrice.product?.id;
            if (productId) {
              plan = await prisma.plans.findFirst({
                where: {
                  [stripePlanKey]: productId,
                },
              });
            }
          } catch {
            // ignore and fallback to order metadata below
          }
        }
      }

      if (!plan) {
        const orderIdRaw = Number(subscription?.metadata?.orderId);
        if (Number.isFinite(orderIdRaw) && orderIdRaw > 0) {
          const order = await prisma.orders.findFirst({
            where: { id: orderIdRaw },
            select: { plan_id: true },
          });
          if (order?.plan_id) {
            plan = await prisma.plans.findFirst({
              where: { id: order.plan_id },
            });
          }
        }
      }
      break;
    }
    default:
      break;
  }

  return plan;
};

const shouldHandleEvent = (payload: Stripe.Event): boolean => {
  switch (payload.type) {
    case StripeEvents.SUBSCRIPTION_CREATED:
    case StripeEvents.SUBSCRIPTION_UPDATED:
    case StripeEvents.SUBSCRIPTION_DELETED:
      return true;
    default:
      log.info('[STRIPE_WH] Ignoring unsupported Stripe subscription event', { eventType: payload.type, eventId: payload.id });
      return false;
  }
};


const cancelUhSubscription = async (user: Users) => {
  try {
    if (process.env.UH_MIGRATION_ACTIVE === 'true') {
      const uhUser = await checkIfUserIsFromUH(user.email);

      if (uhUser) {
        const migrationUser = await checkIfUserIsSubscriber(uhUser);

        if (migrationUser) {
          log.info('[STRIPE_WH:MIGRATION] Starting cancellation for migrated subscription', {
            service: migrationUser.service,
          });

          switch (migrationUser.service) {
            case 'stripe':
              await handleStripeMigration(migrationUser, { userEmail: user.email });
              break;
            case 'conekta':
              await handleConektaMigration(migrationUser);
              break;
            case 'paypal':
              await handlePaypalMigration(migrationUser);
              break;
            default:
              throw new Error(`Unknown service: ${migrationUser.service}`);
          }
        }
      }
    }
  } catch (e) {
    log.error('[STRIPE_WH:MIGRATION] Failed to process migration', {
      errorType: e instanceof Error ? e.name : typeof e,
    });

    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Error al procesar la migración de suscripción',
    });
  }
};

async function handleStripeMigration(
  migrationUser: SubscriptionCheckResult,
  params: { userEmail: string },
) {
  const { userEmail } = params;
  const customer = await uhStripeInstance.customers.list({
    email: userEmail,
    limit: 1,
  });

  if (customer.data.length === 0) {
    log.error('[STRIPE_WH:MIGRATION] No Stripe customer found for migrated email');
    throw new TRPCError({
      code: 'NOT_FOUND',
      message: 'No se encontró el cliente',
    });
  }

  const activeStripeSubscriptions = await uhStripeInstance.subscriptions.list({
    customer: customer.data[0].id,
    status: 'active',
  });

  for (const subscription of activeStripeSubscriptions.data) {
    try {
      log.info('[STRIPE_WH:MIGRATION] Cancelling active Stripe subscription');
      await uhStripeInstance.subscriptions.cancel(subscription.id);
      log.info('[STRIPE_WH:MIGRATION] Successfully cancelled Stripe subscription');
    } catch (e) {
      log.error('[STRIPE_WH:MIGRATION] Failed to cancel Stripe subscription', {
        errorType: e instanceof Error ? e.name : null,
      });
      throw e;
    }
  }
}

async function handleConektaMigration(
  migrationUser: SubscriptionCheckResult,
) {
  const activeConektaSubscriptions = await uhConektaSubscriptions.getSubscription(migrationUser.subscriptionId);

  if (activeConektaSubscriptions.data.status === 'active') {
    try {
      log.info('[STRIPE_WH:MIGRATION] Cancelling active Conekta subscription');
      await uhConektaSubscriptions.cancelSubscription(migrationUser.subscriptionId);
      log.info('[STRIPE_WH:MIGRATION] Successfully cancelled Conekta subscription');
    } catch (e) {
      log.error('[STRIPE_WH:MIGRATION] Failed to cancel Conekta subscription', {
        errorType: e instanceof Error ? e.name : null,
      });
      throw e;
    }
  }
}

async function handlePaypalMigration(
  migrationUser: SubscriptionCheckResult,
) {
  const subscription = (await axios(`${uhPaypal.paypalUrl()}/v1/billing/subscriptions/${migrationUser.subscriptionId}`, {
    headers: {
      Authorization: `Bearer ${await uhPaypal.getToken()}`,
    },
  })).data;

  if (subscription.status === 'ACTIVE') {
    log.info('[STRIPE_WH:MIGRATION] Cancelling active PayPal subscription');

    try {
      await axios.post(`${uhPaypal.paypalUrl()}/v1/billing/subscriptions/${migrationUser.subscriptionId}/cancel`, {
        reason: 'CANCEL_BY_USER',
      }, {
        headers: {
          Authorization: `Bearer ${await uhPaypal.getToken()}`,
        }
      });

      log.info('[STRIPE_WH:MIGRATION] Active PayPal subscription cancelled');
    } catch (e) {
      const axiosErr = e as AxiosError;
      log.error('[STRIPE_WH:MIGRATION] Failed to cancel PayPal subscription', {
        status: axiosErr.response?.status ?? null,
      });

      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Ocurrió un error al migrar la suscripción',
      });
    }
  }
}
