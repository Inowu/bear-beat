import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import axios, { AxiosError } from 'axios';
import { shieldedProcedure } from '../../procedures/shielded.procedure';
import { log } from '../../server';
import { PaymentService } from './services/types';
import { subscribe } from './services/subscribe';
import { paypal } from '../../paypal';
import { paypal as uhPaypal } from '../migration/uhPaypal';
import { facebook } from '../../facebook';
import { manyChat } from '../../many-chat';
import { checkIfUserIsSubscriber } from '../migration/checkUHSubscriber';
import { getClientIpFromRequest } from '../../analytics';
import { getPlanKey } from '../../utils/getPlanKey';
import {
  BILLING_CONSENT_TYPE_RECURRING,
  BILLING_CONSENT_VERSION,
  buildRecurringBillingConsentText,
} from '../../utils/billingConsent';
import { sanitizeTrackingUrl } from '../../utils/trackingUrl';

export const subscribeWithPaypal = shieldedProcedure
  .input(
    z.object({
      planId: z.number(),
      subscriptionId: z.string(),
      acceptRecurring: z.boolean().optional(),
      fbp: z.string().optional(),
      fbc: z.string().optional(),
      eventId: z.string().optional(),
      url: z.string(),
    }),
  )
  .mutation(
    async ({
      input: { planId, subscriptionId, acceptRecurring, fbp, fbc, eventId, url },
      ctx: { prisma, session, req },
    }) => {
      const user = session!.user!;
      let migrationUser = null;
      const recurringAccepted = acceptRecurring ?? true;

      if (process.env.UH_MIGRATION_ACTIVE === 'true') {
        migrationUser = await checkIfUserIsSubscriber({
          email: user.email!,
        });

        if (migrationUser?.service === 'paypal') {
          const subscription = (
            await axios(
              `${uhPaypal.paypalUrl()}/v1/billing/subscriptions/${
                migrationUser.subscriptionId
              }`,
              {
                headers: {
                  Authorization: `Bearer ${await uhPaypal.getToken()}`,
                },
              },
            )
          ).data;

          if (subscription.status === 'ACTIVE') {
            log.info('[MIGRATION] Cancelling active PayPal subscription');

            try {
              await axios.post(
                `${uhPaypal.paypalUrl()}/v1/billing/subscriptions/${
                  migrationUser.subscriptionId
                }/cancel`,
                {
                  reason: 'CANCEL_BY_USER',
                },
                {
                  headers: {
                    Authorization: `Bearer ${await uhPaypal.getToken()}`,
                  },
                },
              );

              log.info('[MIGRATION] Active PayPal subscription cancelled');
            } catch (e) {
              const axiosErr = e as AxiosError;
              log.error('[MIGRATION] Failed to cancel active PayPal subscription', {
                status: axiosErr.response?.status ?? null,
                errorType: axiosErr.name,
              });

              throw new TRPCError({
                code: 'INTERNAL_SERVER_ERROR',
                message: 'Ocurrió un error al migrar la suscripción',
              });
            }
          }
        }
      }

      const existingUser = await prisma.users.findFirst({
        where: {
          id: user.id,
        },
      });

      const plan = await prisma.plans.findFirst({
        where: {
          id: planId,
        },
      });

      if (!plan) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Ese plan no existe',
        });
      }

      if (!recurringAccepted) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Debes aceptar el cobro recurrente para continuar.',
        });
      }

      try {
        const paypalToken = await paypal.getToken();

        const subscription = (
          await axios(
            `${paypal.paypalUrl()}/v1/billing/subscriptions/${subscriptionId}`,
            {
              headers: {
                Authorization: `Bearer ${paypalToken}`,
              },
            },
          )
        ).data;

        if (subscription?.status !== 'ACTIVE') {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message:
              'La suscripción de PayPal aún no está activa. Intenta nuevamente en unos segundos.',
          });
        }

        const paypalPlanId =
          typeof subscription?.plan_id === 'string'
            ? subscription.plan_id
            : null;
        const paypalPlanKey = getPlanKey(PaymentService.PAYPAL);
        const planFromPaypal = paypalPlanId
          ? await prisma.plans.findFirst({
              where: {
                [paypalPlanKey]: paypalPlanId,
              },
            })
          : null;
        const resolvedPlan = planFromPaypal ?? plan;

        await subscribe({
          prisma,
          user,
          plan: resolvedPlan,
          subId: subscriptionId,
          service: PaymentService.PAYPAL,
          expirationDate: new Date(subscription.billing_info.next_billing_time),
        });

        try {
          const clientIp = getClientIpFromRequest(req);
          const userAgentRaw = req.headers['user-agent'];
          const userAgent =
            typeof userAgentRaw === 'string'
              ? userAgentRaw
              : Array.isArray(userAgentRaw)
                ? userAgentRaw[0] ?? null
                : null;

          const order = await prisma.orders.findFirst({
            where: {
              user_id: user.id,
              txn_id: subscriptionId,
              payment_method: PaymentService.PAYPAL,
              is_plan: 1,
            },
            orderBy: { date_order: 'desc' },
            select: { id: true },
          });

          const existingConsent = await prisma.billingConsent.findFirst({
            where: {
              provider: 'paypal',
              provider_ref: subscriptionId,
              consent_type: BILLING_CONSENT_TYPE_RECURRING,
            },
            select: { id: true },
          });

          if (!existingConsent) {
            await prisma.billingConsent.create({
              data: {
                user_id: user.id,
                order_id: order?.id ?? null,
                plan_id: resolvedPlan.id,
                provider: 'paypal',
                provider_ref: subscriptionId,
                consent_type: BILLING_CONSENT_TYPE_RECURRING,
                consent_version: BILLING_CONSENT_VERSION,
                consent_text: buildRecurringBillingConsentText({
                  amount: resolvedPlan.price,
                  currency: resolvedPlan.moneda,
                  trialDays: 0,
                }),
                accepted: true,
                ip_address: clientIp,
                user_agent: userAgent,
                page_url: url ? sanitizeTrackingUrl(url, 1000) : null,
              },
            });
          }
        } catch (consentError) {
          log.warn('[PAYPAL] Failed to store billing consent (non-blocking)', {
            errorType: consentError instanceof Error ? consentError.name : typeof consentError,
          });
        }

        if (existingUser) {
          const clientIp = getClientIpFromRequest(req);
          const userAgentRaw = req.headers['user-agent'];
          const userAgent =
            typeof userAgentRaw === 'string'
              ? userAgentRaw
              : Array.isArray(userAgentRaw)
                ? userAgentRaw[0] ?? null
                : null;

          try {
            log.info('[PAYPAL] Sending Purchase event to Facebook CAPI');
            const value = Number(resolvedPlan.price);
            const currency = (resolvedPlan.moneda || 'USD').toUpperCase();
            await facebook.setEvent(
              'Purchase',
              clientIp,
              userAgent,
              { fbp, fbc, eventId },
              url,
              existingUser,
              { value, currency },
            );
          } catch (error) {
            log.error('[PAYPAL] Error sending CAPI event', {
              error: error instanceof Error ? error.message : error,
            });
          }

          await manyChat.addTagToUser(existingUser, 'SUCCESSFUL_PAYMENT');
        }

        return {
          message: 'La suscripción se creó correctamente',
        };
      } catch (e) {
        if (e instanceof TRPCError) {
          throw e;
        }

        log.error('[PAYPAL] Failed to create subscription', {
          errorType: e instanceof Error ? e.name : typeof e,
        });

        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Ocurrió un error al crear la suscripción',
        });
      }
    },
  );
