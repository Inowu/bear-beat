import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { shieldedProcedure } from '../../procedures/shielded.procedure';
import { getStripeCustomer } from './utils/getStripeCustomer';
import { getPlanKey } from '../../utils/getPlanKey';
import stripeInstance, { isStripeConfigured } from '../../stripe';
import { log } from '../../server';
import { OrderStatus } from './interfaces/order-status.interface';
import { hasActiveSubscription } from './utils/hasActiveSub';
import { PaymentService } from './services/types';
import { checkIfUserIsFromUH, checkIfUserIsSubscriber, SubscriptionCheckResult } from '../migration/checkUHSubscriber';
import { addDays } from 'date-fns';
import { facebook } from '../../facebook';
import { getClientIpFromRequest } from '../../analytics';
import { resolveCheckoutCoupon } from '../../offers';
import {
  BILLING_CONSENT_TYPE_RECURRING,
  BILLING_CONSENT_VERSION,
  buildRecurringBillingConsentText,
} from '../../utils/billingConsent';
import { getMarketingTrialConfigFromEnv } from '../../utils/trialConfig';
import { ensureStripePriceId, StripePriceKey } from './utils/ensureStripePriceId';
import { sanitizeTrackingUrl } from '../../utils/trackingUrl';

/**
 * Crea una Stripe Checkout Session (redirect a la página de pago de Stripe).
 * El usuario paga en checkout.stripe.com y Stripe redirige a success_url o cancel_url.
 * La suscripción se activa vía webhook customer.subscription.updated (status active).
 * Deploy: este procedure debe estar en el backend en producción para que /comprar funcione.
 */
export const createStripeCheckoutSession = shieldedProcedure
  .input(
    z.object({
      planId: z.number(),
      acceptRecurring: z.boolean().optional(),
      successUrl: z.string().url(),
      cancelUrl: z.string().url(),
      coupon: z.string().optional(),
      fbp: z.string().optional(),
      fbc: z.string().optional(),
      url: z.string().optional(),
      eventId: z.string().optional(),
      purchaseEventId: z.string().optional(),
    }),
  )
  .mutation(async ({ input: { planId, acceptRecurring, successUrl, cancelUrl, coupon, fbp, fbc, url, eventId, purchaseEventId }, ctx: { prisma, session, req } }) => {
    const user = session!.user!;
    const recurringAccepted = acceptRecurring ?? true;

    const plan = await prisma.plans.findFirst({
      where: { id: planId },
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

    const existingUser = await prisma.users.findFirst({
      where: { id: user.id },
    });

    if (!existingUser) {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'No se pudo resolver el usuario para iniciar checkout.',
      });
    }

    const isLocalSuccessUrl = (() => {
      try {
        const parsed = new URL(successUrl);
        const host = parsed.hostname;
        return host === 'localhost' || host === '127.0.0.1' || host === '0.0.0.0' || host === '::1';
      } catch {
        return false;
      }
    })();

    // Local dev safety net: allow UI/funnel testing even when Stripe keys are not configured.
    // This NEVER runs in production and only returns a localhost success_url (no real payment).
    if (process.env.NODE_ENV !== 'production' && isLocalSuccessUrl && !isStripeConfigured()) {
      const mockSessionId = `cs_test_mock_${Date.now()}_${user.id}_${plan.id}`;
      let redirectUrl = successUrl;
      if (redirectUrl.includes('{CHECKOUT_SESSION_ID}')) {
        redirectUrl = redirectUrl.replace('{CHECKOUT_SESSION_ID}', mockSessionId);
      } else {
        try {
          const parsed = new URL(redirectUrl);
          parsed.searchParams.set('session_id', mockSessionId);
          redirectUrl = parsed.toString();
        } catch {
          // keep best-effort
        }
      }

      log.warn('[STRIPE_CHECKOUT_SESSION] Stripe not configured, returning mock checkout URL (local dev only).', {
        planId: plan.id,
      });

      return {
        url: redirectUrl,
        sessionId: mockSessionId,
        mocked: true,
        serverSidePurchaseTracking: false,
      };
    }

    const stripeCustomer = await getStripeCustomer(prisma, user);

    log.info('[STRIPE_CHECKOUT_SESSION] Creating checkout session', { planId });

    await hasActiveSubscription({
      user,
      customerId: stripeCustomer,
      prisma,
      service: PaymentService.STRIPE,
    });

    // CAPI: InitiateCheckout con dedupe (eventId) si existe.
    // No bloquear checkout si falla.
    try {
      if (url) {
        const clientIp = getClientIpFromRequest(req);
        const userAgentRaw = req.headers['user-agent'];
        const userAgent =
          typeof userAgentRaw === 'string'
            ? userAgentRaw
            : Array.isArray(userAgentRaw)
              ? userAgentRaw[0] ?? null
              : null;

        const value = Number(plan.price) || 0;
        const currency = (plan.moneda || 'USD').toUpperCase();
        await facebook.setEvent(
          'InitiateCheckout',
          clientIp,
          userAgent,
          { fbp, fbc, eventId },
          url,
          existingUser,
          { value, currency },
        );
      }
    } catch (error) {
      log.debug('[STRIPE_CHECKOUT_SESSION] CAPI InitiateCheckout skipped', {
        error: error instanceof Error ? error.message : error,
      });
    }

    const priceKey = getPlanKey(PaymentService.STRIPE) as StripePriceKey;
    let priceId = plan[priceKey];
    if (!priceId || typeof priceId !== 'string' || !priceId.startsWith('price_')) {
      // Auto-setup to avoid losing conversions when a plan is missing Stripe price configuration.
      try {
        priceId = await ensureStripePriceId({
          prisma,
          plan,
          priceKey,
        });
      } catch (error) {
        log.error('[STRIPE_CHECKOUT_SESSION] Missing Stripe price and auto-setup failed', {
          planId: plan.id,
          priceKey,
          error: error instanceof Error ? error.message : error,
        });
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Este plan no tiene un precio de Stripe configurado. Contacta soporte.',
        });
      }
    }

    if (!priceId || typeof priceId !== 'string') {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'No se pudo resolver el precio de Stripe para este plan.',
      });
    }
    const stripePriceId = priceId;

    const resolvedCoupon = await resolveCheckoutCoupon({
      prisma,
      userId: user.id,
      requestedCoupon: coupon ?? null,
    });

    const dbCoupon = resolvedCoupon.couponCode
      ? await prisma.cupons.findFirst({
          where: { code: resolvedCoupon.couponCode, active: 1 },
          select: { id: true, discount: true, code: true },
        })
      : null;

    const order = await prisma.orders.create({
      data: {
        user_id: user.id,
        status: OrderStatus.PENDING,
        is_plan: 1,
        plan_id: plan.id,
        payment_method: PaymentService.STRIPE,
        date_order: new Date(),
        total_price: Number(plan.price),
        ...(dbCoupon ? { discount: dbCoupon.discount, cupon_id: dbCoupon.id } : {}),
      },
    });

    let uhUser: SubscriptionCheckResult | null = null;
    // Migration check is best-effort: never block Stripe checkout if the legacy provider (Firebase/UH)
    // is temporarily unavailable or rate-limited.
    try {
      const isUhUser = await checkIfUserIsFromUH(user.email);
      if (isUhUser) {
        uhUser = await checkIfUserIsSubscriber(isUhUser);
      }
    } catch (migrationError) {
      log.warn('[STRIPE_CHECKOUT_SESSION] UH migration check skipped', {
        errorType: migrationError instanceof Error ? migrationError.name : typeof migrationError,
      });
      uhUser = null;
    }
    const trialEnd = uhUser?.remainingDays
      ? Math.floor(addDays(new Date(), uhUser.remainingDays).getTime() / 1000)
      : undefined;

    if (uhUser) {
      log.info('[STRIPE_CHECKOUT_SESSION] Migration trial applied', {
        remainingDays: uhUser.remainingDays,
      });
    }

    // Marketing trial (7 days, 100GB, etc): only for users with no previous paid plan orders.
    const trialConfig = getMarketingTrialConfigFromEnv();
    const bbTrialDays = trialConfig.days;
    const bbTrialGb = trialConfig.gb;

    let marketingTrialEnd: number | undefined;
    let isMarketingTrial = false;

    if (!trialEnd && bbTrialDays > 0 && !existingUser.trial_used_at) {
      const previousPaidPlanOrder = await prisma.orders.findFirst({
        where: {
          user_id: user.id,
          status: OrderStatus.PAID,
          is_plan: 1,
        },
        select: { id: true },
      });

      if (!previousPaidPlanOrder) {
        // Anti-abuse guard: if another account with the same phone already used a trial
        // or has a paid plan, this user is not eligible for the "first time" marketing trial.
        const phone = (existingUser.phone ?? '').trim();
        let samePhoneUsedTrialOrPaid = false;
        if (phone) {
          try {
            const samePhoneUsers = await prisma.users.findMany({
              where: { id: { not: user.id }, phone },
              select: { id: true, trial_used_at: true },
              take: 5,
            });

            const samePhoneHasTrial = samePhoneUsers.some((row) => Boolean(row.trial_used_at));
            let samePhoneHasPaid = false;
            if (!samePhoneHasTrial && samePhoneUsers.length > 0) {
              const paid = await prisma.orders.findFirst({
                where: {
                  user_id: { in: samePhoneUsers.map((row) => row.id) },
                  status: OrderStatus.PAID,
                  is_plan: 1,
                },
                select: { id: true },
              });
              samePhoneHasPaid = Boolean(paid);
            }
            samePhoneUsedTrialOrPaid = samePhoneHasTrial || samePhoneHasPaid;
          } catch {
            // Best-effort only; never break checkout.
          }
        }

        if (samePhoneUsedTrialOrPaid) {
          log.info('[STRIPE_CHECKOUT_SESSION] Marketing trial blocked (same phone already used)');
        } else {
          isMarketingTrial = true;
          marketingTrialEnd = Math.floor(addDays(new Date(), bbTrialDays).getTime() / 1000);
          log.info(
            `[STRIPE_CHECKOUT_SESSION] Marketing trial enabled (days: ${bbTrialDays}, gb: ${bbTrialGb})`,
          );
        }
      }
    }

    const effectiveTrialEnd = trialEnd ?? marketingTrialEnd;
    const trialMetadata: Record<string, string> = {};
    if (effectiveTrialEnd) {
      trialMetadata.bb_trial_type = uhUser ? 'migration' : isMarketingTrial ? 'marketing' : 'trial';
      if (isMarketingTrial && bbTrialGb > 0) {
        // Subscription metadata must be string values.
        trialMetadata.bb_trial_gb = String(bbTrialGb);
      }
    }

    const consentTrialDays = effectiveTrialEnd
      ? Math.max(
          0,
          Math.ceil((effectiveTrialEnd * 1000 - Date.now()) / (1000 * 60 * 60 * 24)),
        )
      : 0;
    const consentText = buildRecurringBillingConsentText({
      amount: plan.price,
      currency: plan.moneda,
      trialDays: consentTrialDays,
    });

    const safeMetaValue = (value: unknown, maxLen = 480): string | undefined => {
      const raw = typeof value === 'string' ? value : value != null ? String(value) : '';
      const trimmed = raw.trim();
      return trimmed ? trimmed.slice(0, maxLen) : undefined;
    };

    const subscriptionMarketingMetadata: Record<string, string> = {};
    const metaFbp = safeMetaValue(fbp);
    const metaFbc = safeMetaValue(fbc);
    const metaPurchaseEventId = safeMetaValue(purchaseEventId, 120);
    const metaSourceUrl = safeMetaValue(url ? sanitizeTrackingUrl(url, 480) : '', 480);
    if (metaFbp) subscriptionMarketingMetadata.bb_fbp = metaFbp;
    if (metaFbc) subscriptionMarketingMetadata.bb_fbc = metaFbc;
    if (metaPurchaseEventId) subscriptionMarketingMetadata.bb_purchase_event_id = metaPurchaseEventId;
    if (metaSourceUrl) subscriptionMarketingMetadata.bb_source_url = metaSourceUrl;

    const createSession = async (withDiscount: boolean) =>
      stripeInstance.checkout.sessions.create(
        {
          mode: 'subscription',
          customer: stripeCustomer,
          line_items: [
            {
              price: stripePriceId,
              quantity: 1,
            },
          ],
          success_url: successUrl,
          cancel_url: cancelUrl,
          metadata: {
            orderId: String(order.id),
            userId: String(user.id),
            bb_consent_version: BILLING_CONSENT_VERSION,
          },
          subscription_data: {
            metadata: {
              orderId: String(order.id),
              ...trialMetadata,
              ...subscriptionMarketingMetadata,
              bb_consent_version: BILLING_CONSENT_VERSION,
            },
            ...(effectiveTrialEnd ? { trial_end: effectiveTrialEnd } : {}),
          },
          // Stripe Checkout enforces: allow_promotion_codes XOR discounts.
          // If we auto-apply a coupon (offers / requested), we must not also enable promo-code entry.
          ...(withDiscount && resolvedCoupon.couponCode
            ? { discounts: [{ coupon: resolvedCoupon.couponCode }] }
            : { allow_promotion_codes: true }),
        },
        { idempotencyKey: `stripe-checkout-order-${order.id}` },
      );

    const isStripeCouponError = (err: unknown): boolean => {
      const message =
        typeof (err as any)?.message === 'string' ? String((err as any).message) : '';
      const lower = message.toLowerCase();
      return lower.includes('coupon') && (lower.includes('no such') || lower.includes('invalid'));
    };

    try {
      const stripeSession = await createSession(true);
      if (!stripeSession.url) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Stripe no devolvió una URL de checkout',
        });
      }

      log.info('[STRIPE_CHECKOUT_SESSION] Created checkout session');

      try {
        const clientIp = getClientIpFromRequest(req);
        const userAgentRaw = req.headers['user-agent'];
        const userAgent =
          typeof userAgentRaw === 'string'
            ? userAgentRaw
            : Array.isArray(userAgentRaw)
              ? userAgentRaw[0] ?? null
              : null;

        await prisma.billingConsent.create({
          data: {
            user_id: user.id,
            order_id: order.id,
            plan_id: plan.id,
            provider: 'stripe',
            provider_ref: stripeSession.id,
            consent_type: BILLING_CONSENT_TYPE_RECURRING,
            consent_version: BILLING_CONSENT_VERSION,
            consent_text: consentText,
            accepted: true,
            ip_address: clientIp,
            user_agent: userAgent,
            page_url: url ? sanitizeTrackingUrl(url, 1000) : null,
          },
        });
      } catch (consentError) {
        log.warn('[STRIPE_CHECKOUT_SESSION] Failed to store billing consent (non-blocking)', {
          errorType: consentError instanceof Error ? consentError.name : typeof consentError,
        });
      }

      return {
        url: stripeSession.url,
        sessionId: stripeSession.id,
        serverSidePurchaseTracking: true,
      };
    } catch (e: unknown) {
      // Never break checkout due to an auto-offer coupon mismatch in Stripe. Retry without the discount.
      if (resolvedCoupon.source === 'offer' && resolvedCoupon.couponCode && isStripeCouponError(e)) {
        log.warn('[STRIPE_CHECKOUT_SESSION] Offer coupon rejected by Stripe, retrying without discount', {
          errorType: e instanceof Error ? e.name : typeof e,
        });
        try {
          const stripeSession = await createSession(false);
          if (stripeSession.url) {
            // Keep DB consistent with what Stripe actually applied.
            try {
              await prisma.orders.update({
                where: { id: order.id },
                data: { discount: 0, cupon_id: null },
              });
            } catch {
              // noop
            }
            return { url: stripeSession.url, sessionId: stripeSession.id, serverSidePurchaseTracking: true };
          }
        } catch (retryError) {
          log.error('[STRIPE_CHECKOUT_SESSION] Retry without coupon failed', {
            errorType: retryError instanceof Error ? retryError.name : typeof retryError,
          });
        }
      }
      log.error('[STRIPE_CHECKOUT_SESSION] Error creating checkout session', {
        errorType: e instanceof Error ? e.name : typeof e,
      });
      const msg = e instanceof Error ? e.message : 'Error al crear la sesión de pago';
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: msg,
      });
    }
  });
