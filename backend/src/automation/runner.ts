import { Prisma, PrismaClient, Users } from '@prisma/client';
import { log } from '../server';
import { isEmailConfigured, sendEmail } from '../email';
import { emailTemplates } from '../email/templates';
import { manyChat } from '../many-chat';
import { ensureAnalyticsEventsTableExists } from '../analytics';
import { OFFER_KEYS, markUserOffersRedeemed, upsertUserOfferAndCoupon } from '../offers';
import { twilio } from '../twilio';
import { buildMarketingUnsubscribeUrl } from '../comms/unsubscribe';

type AutomationChannel = 'manychat' | 'email' | 'twilio' | 'admin' | 'system';

const DEFAULT_LIMIT = 200;

const FIVE_MINUTES_MS = 5 * 60 * 1000;

const parseNumber = (raw: string | undefined, fallback: number): number => {
  const n = Number(raw);
  if (!Number.isFinite(n)) return fallback;
  return n;
};

const isConfigured = (key: string): boolean => Boolean(process.env[key]?.trim());

const isTwilioConfigured = (): boolean =>
  isConfigured('TWILIO_ACCOUNT_SID') &&
  isConfigured('TWILIO_AUTH_TOKEN') &&
  isConfigured('TWILIO_CONTENT_SID') &&
  isConfigured('TWILIO_MESSAGING_SID');

const resolveClientUrl = (): string => (process.env.CLIENT_URL || 'https://thebearbeat.com').trim();

const appendQueryParams = (baseUrl: string, params: Record<string, string>): string => {
  try {
    const url = new URL(baseUrl);
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }
    return url.toString();
  } catch {
    return baseUrl;
  }
};

async function safeAddManyChatTag(user: Users, tag: any): Promise<void> {
  try {
    await manyChat.addTagToUser(user, tag);
  } catch (e) {
    // Shouldn't throw, but never break automations.
    log.debug('[AUTOMATION] ManyChat tag skipped', {
      userId: user.id,
      tag,
      error: e instanceof Error ? e.message : e,
    });
  }
}

async function safeSetManyChatCustomFields(
  user: Users,
  fields: Array<{ key: string; value: string }>,
): Promise<void> {
  try {
    const mcId = await manyChat.getManyChatId(user);
    if (!mcId) return;
    for (const field of fields) {
      manyChat.setCustomField(mcId, field.key, field.value).catch(() => {});
    }
  } catch (e) {
    log.debug('[AUTOMATION] ManyChat custom fields skipped', {
      userId: user.id,
      error: e instanceof Error ? e.message : e,
    });
  }
}

async function safeSendAutomationEmail(params: {
  toEmail: string;
  toName: string;
  subject: string;
  html: string;
  text: string;
}): Promise<void> {
  if (!isEmailConfigured()) return;
  const { toEmail, subject, html, text } = params;
  try {
    await sendEmail({
      to: [toEmail],
      subject,
      html,
      text,
    });
  } catch (e) {
    log.warn('[AUTOMATION] Email send failed', {
      toEmail,
      subject,
      error: e instanceof Error ? e.message : e,
    });
  }
}

async function safeSendTwilioLink(user: Users, url: string): Promise<void> {
  if (!isTwilioConfigured()) return;
  if (!user.phone) return;
  if (!user.whatsapp_marketing_opt_in) return;
  try {
    await twilio.sendMessage(user.phone, url);
  } catch (e) {
    log.warn('[AUTOMATION] Twilio send failed', {
      userId: user.id,
      error: e instanceof Error ? e.message : e,
    });
  }
}

async function createActionLog(params: {
  prisma: PrismaClient;
  userId: number;
  actionKey: string;
  stage: number;
  channel: AutomationChannel;
  providerMessageId?: string | null;
  metadata?: Prisma.JsonObject;
}): Promise<{ created: boolean }> {
  const { prisma, userId, actionKey, stage, channel, providerMessageId, metadata } = params;
  try {
    await prisma.automationActionLog.create({
      data: {
        user_id: userId,
        action_key: actionKey,
        stage,
        channel,
        provider_message_id: providerMessageId ?? null,
        metadata_json: metadata,
      },
      select: { id: true },
    });
    return { created: true };
  } catch (e: any) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      return { created: false };
    }
    throw e;
  }
}

async function shouldSkipRun(prisma: PrismaClient): Promise<boolean> {
  // Guard against overlapping runs if a deploy starts two processes briefly.
  const now = Date.now();
  const recent = new Date(now - 30 * 60 * 1000);
  const running = await prisma.automationRunLog.findFirst({
    where: {
      status: 'running',
      started_at: { gte: recent },
    },
    select: { id: true },
  });
  return Boolean(running);
}

export async function runAutomationOnce(prisma: PrismaClient): Promise<void> {
  if (!process.env.DATABASE_URL) {
    log.info('[AUTOMATION] DATABASE_URL not configured. Skipping.');
    return;
  }

  const enabledFlag = (process.env.AUTOMATION_RUNNER_ENABLED || '1').trim();
  if (enabledFlag === '0') {
    log.info('[AUTOMATION] Disabled via AUTOMATION_RUNNER_ENABLED=0. Skipping.');
    return;
  }

  if (await shouldSkipRun(prisma)) {
    log.warn('[AUTOMATION] Previous run still marked running. Skipping this tick.');
    return;
  }

  await ensureAnalyticsEventsTableExists(prisma);

  const run = await prisma.automationRunLog.create({
    data: {
      started_at: new Date(),
      status: 'running',
    },
    select: { id: true },
  });

  const finishRun = async (status: 'success' | 'failed', error?: string) => {
    try {
      await prisma.automationRunLog.update({
        where: { id: run.id },
        data: {
          finished_at: new Date(),
          status,
          ...(error ? { error } : {}),
        },
      });
    } catch (e) {
      log.warn('[AUTOMATION] Failed to update run log', {
        runId: run.id,
        error: e instanceof Error ? e.message : e,
      });
    }
  };

  const limit = Math.max(20, Math.min(500, Math.floor(parseNumber(process.env.AUTOMATION_RUNNER_LIMIT, DEFAULT_LIMIT))));
  const maxEmailsPerRun = Math.max(
    0,
    Math.min(2000, Math.floor(parseNumber(process.env.AUTOMATION_EMAIL_MAX_PER_RUN, 120))),
  );
  let emailsSent = 0;
  const canSendEmail = (): boolean => emailsSent < maxEmailsPerRun;
  const noteEmailSent = () => {
    emailsSent += 1;
  };

  try {
    const stats: Record<string, number> = {};
    const bump = (key: string) => {
      stats[key] = (stats[key] || 0) + 1;
    };

    // Rule 1: trial started but no download in 24h
    {
      const rows = await prisma.$queryRaw<
        Array<{ userId: number; trialStartedAt: Date }>
      >(Prisma.sql`
        SELECT
          t.user_id AS userId,
          t.trial_started_at AS trialStartedAt
        FROM (
          SELECT
            user_id,
            MAX(event_ts) AS trial_started_at
          FROM analytics_events
          WHERE event_name = 'trial_started'
            AND user_id IS NOT NULL
            AND event_ts >= DATE_SUB(NOW(), INTERVAL 30 DAY)
            AND event_ts < DATE_SUB(NOW(), INTERVAL 24 HOUR)
          GROUP BY user_id
        ) t
        LEFT JOIN download_history dh
          ON dh.userId = t.user_id
          AND dh.date >= t.trial_started_at
          AND dh.date < DATE_ADD(t.trial_started_at, INTERVAL 24 HOUR)
        LEFT JOIN automation_action_logs aal
          ON aal.user_id = t.user_id
          AND aal.action_key = 'trial_no_download'
          AND aal.stage = 24
        LEFT JOIN orders o
          ON o.user_id = t.user_id
          AND o.status = 1
          AND o.is_plan = 1
          AND (o.is_canceled IS NULL OR o.is_canceled = 0)
          AND o.date_order > t.trial_started_at
        WHERE dh.id IS NULL
          AND aal.id IS NULL
          AND o.id IS NULL
        ORDER BY t.trial_started_at DESC
        LIMIT ${limit}
      `);

      for (const row of rows) {
        const user = await prisma.users.findFirst({ where: { id: row.userId } });
        if (!user || user.blocked) continue;

        const { created } = await createActionLog({
          prisma,
          userId: user.id,
          actionKey: 'trial_no_download',
          stage: 24,
          channel: 'system',
          metadata: { trialStartedAt: row.trialStartedAt.toISOString() },
        });
        if (!created) continue;

        safeAddManyChatTag(user, 'AUTOMATION_TRIAL_NO_DOWNLOAD_24H').catch(() => {});
        const templateId = parseNumber(process.env.AUTOMATION_EMAIL_TRIAL_NO_DOWNLOAD_TEMPLATE_ID, 0);
        if (templateId > 0 && user.email_marketing_opt_in && canSendEmail()) {
          const url = appendQueryParams(`${resolveClientUrl()}/`, {
            utm_source: 'email',
            utm_medium: 'automation',
            utm_campaign: 'trial_no_download_24h',
            utm_content: 'cta',
          });
          const unsubscribeUrl = buildMarketingUnsubscribeUrl(user.id) ?? undefined;
          const tpl = emailTemplates.automationTrialNoDownload24h({ name: user.username, url, unsubscribeUrl });
          await safeSendAutomationEmail({
            toEmail: user.email,
            toName: user.username,
            subject: tpl.subject,
            html: tpl.html,
            text: tpl.text,
          });
          noteEmailSent();
        }
        bump('trial_no_download');
      }
    }

    // Rule 2: paid but no download in 24h (first paid order)
    {
      const rows = await prisma.$queryRaw<
        Array<{ userId: number; paidAt: Date }>
      >(Prisma.sql`
        SELECT
          fp.user_id AS userId,
          fp.first_paid_at AS paidAt
        FROM (
          SELECT user_id, MIN(date_order) AS first_paid_at
          FROM orders
          WHERE status = 1
            AND is_plan = 1
            AND (is_canceled IS NULL OR is_canceled = 0)
            AND date_order >= DATE_SUB(NOW(), INTERVAL 30 DAY)
            AND date_order < DATE_SUB(NOW(), INTERVAL 24 HOUR)
          GROUP BY user_id
        ) fp
        LEFT JOIN download_history dh
          ON dh.userId = fp.user_id
          AND dh.date >= fp.first_paid_at
          AND dh.date < DATE_ADD(fp.first_paid_at, INTERVAL 24 HOUR)
        LEFT JOIN automation_action_logs aal
          ON aal.user_id = fp.user_id
          AND aal.action_key = 'paid_no_download'
          AND aal.stage = 24
        WHERE dh.id IS NULL
          AND aal.id IS NULL
        ORDER BY fp.first_paid_at DESC
        LIMIT ${limit}
      `);

      for (const row of rows) {
        const user = await prisma.users.findFirst({ where: { id: row.userId } });
        if (!user || user.blocked) continue;

        const { created } = await createActionLog({
          prisma,
          userId: user.id,
          actionKey: 'paid_no_download',
          stage: 24,
          channel: 'system',
          metadata: { paidAt: row.paidAt.toISOString() },
        });
        if (!created) continue;

        safeAddManyChatTag(user, 'AUTOMATION_PAID_NO_DOWNLOAD_24H').catch(() => {});
        const templateId = parseNumber(process.env.AUTOMATION_EMAIL_PAID_NO_DOWNLOAD_TEMPLATE_ID, 0);
        if (templateId > 0 && user.email_marketing_opt_in && canSendEmail()) {
          const url = appendQueryParams(`${resolveClientUrl()}/`, {
            utm_source: 'email',
            utm_medium: 'automation',
            utm_campaign: 'paid_no_download_24h',
            utm_content: 'cta',
          });
          const unsubscribeUrl = buildMarketingUnsubscribeUrl(user.id) ?? undefined;
          const tpl = emailTemplates.automationPaidNoDownload24h({ name: user.username, url, unsubscribeUrl });
          await safeSendAutomationEmail({
            toEmail: user.email,
            toName: user.username,
            subject: tpl.subject,
            html: tpl.html,
            text: tpl.text,
          });
          noteEmailSent();
        }
        bump('paid_no_download');
      }
    }

    // Rule 3: registered 7d ago and no paid plan orders
    {
      const rows = await prisma.$queryRaw<
        Array<{ userId: number; registeredOn: Date }>
      >(Prisma.sql`
        SELECT
          u.id AS userId,
          u.registered_on AS registeredOn
        FROM users u
        LEFT JOIN orders o
          ON o.user_id = u.id
          AND o.status = 1
          AND o.is_plan = 1
          AND (o.is_canceled IS NULL OR o.is_canceled = 0)
        LEFT JOIN automation_action_logs aal
          ON aal.user_id = u.id
          AND aal.action_key = 'registered_no_purchase'
          AND aal.stage = 7
        WHERE u.registered_on <= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
          AND u.registered_on >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
          AND u.blocked = 0
          AND u.verified = 1
          AND o.id IS NULL
          AND aal.id IS NULL
        ORDER BY u.registered_on DESC
        LIMIT ${limit}
      `);

      for (const row of rows) {
        const user = await prisma.users.findFirst({ where: { id: row.userId } });
        if (!user || user.blocked) continue;

        const { created } = await createActionLog({
          prisma,
          userId: user.id,
          actionKey: 'registered_no_purchase',
          stage: 7,
          channel: 'system',
          metadata: { registeredOn: row.registeredOn.toISOString() },
        });
        if (!created) continue;

        safeAddManyChatTag(user, 'AUTOMATION_REGISTERED_NO_PURCHASE_7D').catch(() => {});
        const templateId = parseNumber(process.env.AUTOMATION_EMAIL_REGISTERED_NO_PURCHASE_TEMPLATE_ID, 0);
        const percentOff = Math.max(
          1,
          Math.min(99, Math.floor(parseNumber(process.env.AUTOMATION_REGISTERED_NO_PURCHASE_PERCENT_OFF, 30))),
        );
        const expiresDays = Math.max(
          1,
          Math.min(30, Math.floor(parseNumber(process.env.AUTOMATION_REGISTERED_NO_PURCHASE_EXPIRES_DAYS, 3))),
        );
        const expiresAt = new Date(Date.now() + expiresDays * 24 * 60 * 60 * 1000);
        const offer = await upsertUserOfferAndCoupon({
          prisma,
          userId: user.id,
          offerKey: OFFER_KEYS.REGISTERED_NO_PURCHASE,
          stage: 1,
          percentOff,
          expiresAt,
        });

        await safeSetManyChatCustomFields(user, [
          { key: 'bb_offer_code', value: offer.couponCode ?? '' },
          { key: 'bb_offer_pct', value: String(offer.percentOff) },
          { key: 'bb_offer_expires_at', value: expiresAt.toISOString() },
        ]);
        safeAddManyChatTag(user, `AUTOMATION_REGISTERED_NO_PURCHASE_OFFER_${offer.percentOff}`).catch(() => {});

        if (templateId > 0 && user.email_marketing_opt_in && offer.couponCode && canSendEmail()) {
          const url = appendQueryParams(`${resolveClientUrl()}/planes`, {
            utm_source: 'email',
            utm_medium: 'automation',
            utm_campaign: 'registered_no_purchase_7d',
            utm_content: 'cta',
          });
          const unsubscribeUrl = buildMarketingUnsubscribeUrl(user.id) ?? undefined;
          const expiresAtText = `${expiresAt.toISOString().replace('T', ' ').slice(0, 16)} UTC`;
          const tpl = emailTemplates.registeredNoPurchaseOffer({
            name: user.username,
            url,
            couponCode: offer.couponCode,
            percentOff: offer.percentOff,
            expiresAt: expiresAtText,
            unsubscribeUrl,
          });
          await safeSendAutomationEmail({
            toEmail: user.email,
            toName: user.username,
            subject: tpl.subject,
            html: tpl.html,
            text: tpl.text,
          });
          noteEmailSent();
        }
        bump('registered_no_purchase');
      }
    }

    // Rule 3b: registered 24h+ ago but WhatsApp not verified (required to download)
    {
      const rows = await prisma.$queryRaw<
        Array<{ userId: number; email: string; username: string; registeredOn: Date }>
      >(Prisma.sql`
        SELECT
          u.id AS userId,
          u.email AS email,
          u.username AS username,
          u.registered_on AS registeredOn
        FROM users u
        LEFT JOIN automation_action_logs aal
          ON aal.user_id = u.id
          AND aal.action_key = 'verify_whatsapp'
          AND aal.stage = 24
        WHERE u.registered_on <= DATE_SUB(CURDATE(), INTERVAL 1 DAY)
          AND u.registered_on >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
          AND u.blocked = 0
          AND u.verified = 0
          AND aal.id IS NULL
        ORDER BY u.registered_on DESC
        LIMIT ${limit}
      `);

      for (const row of rows) {
        const userId = Number(row.userId);
        if (!userId) continue;

        const { created } = await createActionLog({
          prisma,
          userId,
          actionKey: 'verify_whatsapp',
          stage: 24,
          channel: 'system',
          metadata: { registeredOn: row.registeredOn.toISOString() },
        });
        if (!created) continue;

        const user = await prisma.users.findFirst({ where: { id: userId } });
        if (!user || user.blocked) continue;

        safeAddManyChatTag(user, 'AUTOMATION_VERIFY_WHATSAPP_24H').catch(() => {});

        const templateId = parseNumber(process.env.AUTOMATION_EMAIL_VERIFY_WHATSAPP_24H_TEMPLATE_ID, 0);
        if (templateId > 0 && canSendEmail()) {
          const url = appendQueryParams(`${resolveClientUrl()}/micuenta`, {
            utm_source: 'email',
            utm_medium: 'automation',
            utm_campaign: 'verify_whatsapp_24h',
            utm_content: 'cta',
          });
          const tpl = emailTemplates.automationVerifyWhatsApp24h({ name: user.username, url });
          await safeSendAutomationEmail({
            toEmail: user.email,
            toName: user.username,
            subject: tpl.subject,
            html: tpl.html,
            text: tpl.text,
          });
          noteEmailSent();
        }

        bump('verify_whatsapp_24h');
      }
    }

    // Rule 3c: checkout started, no purchase after 1h
    {
      const rows = await prisma.$queryRaw<
        Array<{
          userId: number;
          email: string;
          username: string;
          emailMarketingOptIn: number;
          checkoutStartedAt: Date;
          planId: number | null;
          planName: string | null;
          planPrice: any | null;
          planCurrency: string | null;
        }>
      >(Prisma.sql`
        SELECT
          cs.user_id AS userId,
          u.email AS email,
          u.username AS username,
          u.email_marketing_opt_in AS emailMarketingOptIn,
          cs.checkout_started_at AS checkoutStartedAt,
          cs.plan_id AS planId,
          p.name AS planName,
          p.price AS planPrice,
          p.moneda AS planCurrency
        FROM (
          SELECT
            ae.user_id,
            MAX(ae.event_ts) AS checkout_started_at,
            MAX(CAST(JSON_UNQUOTE(JSON_EXTRACT(ae.metadata_json, '$.planId')) AS UNSIGNED)) AS plan_id
          FROM analytics_events ae
          WHERE ae.event_name = 'checkout_started'
            AND ae.user_id IS NOT NULL
            AND ae.event_ts >= DATE_SUB(NOW(), INTERVAL 14 DAY)
            AND ae.event_ts < DATE_SUB(NOW(), INTERVAL 1 HOUR)
          GROUP BY ae.user_id
        ) cs
        INNER JOIN users u
          ON u.id = cs.user_id
          AND u.blocked = 0
        LEFT JOIN plans p
          ON p.id = cs.plan_id
        LEFT JOIN orders o
          ON o.user_id = cs.user_id
          AND o.status = 1
          AND o.is_plan = 1
          AND (o.is_canceled IS NULL OR o.is_canceled = 0)
          AND o.date_order > cs.checkout_started_at
        LEFT JOIN descargas_user du
          ON du.user_id = cs.user_id
          AND du.date_end > NOW()
        LEFT JOIN automation_action_logs aal
          ON aal.user_id = cs.user_id
          AND aal.action_key = 'checkout_abandoned'
          AND aal.stage = 1
        WHERE o.id IS NULL
          AND du.id IS NULL
          AND aal.id IS NULL
        ORDER BY cs.checkout_started_at DESC
        LIMIT ${limit}
      `);

      for (const row of rows) {
        const userId = Number(row.userId);
        if (!userId) continue;

        const { created } = await createActionLog({
          prisma,
          userId,
          actionKey: 'checkout_abandoned',
          stage: 1,
          channel: 'system',
          metadata: {
            checkoutStartedAt: row.checkoutStartedAt.toISOString(),
            planId: row.planId ?? null,
          },
        });
        if (!created) continue;

        const user = await prisma.users.findFirst({ where: { id: userId } });
        if (user) {
          safeAddManyChatTag(user, 'AUTOMATION_CHECKOUT_ABANDONED_1H').catch(() => {});
        }

        const templateId = parseNumber(process.env.AUTOMATION_EMAIL_CHECKOUT_ABANDONED_1H_TEMPLATE_ID, 0);
        const emailOptIn = Boolean(row.emailMarketingOptIn);
        if (templateId > 0 && emailOptIn && canSendEmail()) {
          const base = resolveClientUrl();
          const rawUrl = row.planId ? `${base}/comprar?priceId=${row.planId}` : `${base}/planes`;
          const url = appendQueryParams(rawUrl, {
            utm_source: 'email',
            utm_medium: 'automation',
            utm_campaign: 'checkout_abandoned_1h',
            utm_content: 'cta',
          });
          const unsubscribeUrl = buildMarketingUnsubscribeUrl(userId) ?? undefined;
          const tpl = emailTemplates.automationCheckoutAbandoned({
            name: row.username,
            url,
            planName: row.planName ?? null,
            price: row.planPrice ? String(row.planPrice) : null,
            currency: row.planCurrency ?? null,
            unsubscribeUrl,
          });
          await safeSendAutomationEmail({
            toEmail: row.email,
            toName: row.username,
            subject: tpl.subject,
            html: tpl.html,
            text: tpl.text,
          });
          noteEmailSent();
        }

        bump('checkout_abandoned_1h');
      }
    }

    // Rule 3d: checkout started, no purchase after 24h
    {
      const rows = await prisma.$queryRaw<
        Array<{
          userId: number;
          email: string;
          username: string;
          emailMarketingOptIn: number;
          checkoutStartedAt: Date;
          planId: number | null;
          planName: string | null;
          planPrice: any | null;
          planCurrency: string | null;
        }>
      >(Prisma.sql`
        SELECT
          cs.user_id AS userId,
          u.email AS email,
          u.username AS username,
          u.email_marketing_opt_in AS emailMarketingOptIn,
          cs.checkout_started_at AS checkoutStartedAt,
          cs.plan_id AS planId,
          p.name AS planName,
          p.price AS planPrice,
          p.moneda AS planCurrency
        FROM (
          SELECT
            ae.user_id,
            MAX(ae.event_ts) AS checkout_started_at,
            MAX(CAST(JSON_UNQUOTE(JSON_EXTRACT(ae.metadata_json, '$.planId')) AS UNSIGNED)) AS plan_id
          FROM analytics_events ae
          WHERE ae.event_name = 'checkout_started'
            AND ae.user_id IS NOT NULL
            AND ae.event_ts >= DATE_SUB(NOW(), INTERVAL 30 DAY)
            AND ae.event_ts < DATE_SUB(NOW(), INTERVAL 24 HOUR)
          GROUP BY ae.user_id
        ) cs
        INNER JOIN users u
          ON u.id = cs.user_id
          AND u.blocked = 0
        LEFT JOIN plans p
          ON p.id = cs.plan_id
        LEFT JOIN orders o
          ON o.user_id = cs.user_id
          AND o.status = 1
          AND o.is_plan = 1
          AND (o.is_canceled IS NULL OR o.is_canceled = 0)
          AND o.date_order > cs.checkout_started_at
        LEFT JOIN descargas_user du
          ON du.user_id = cs.user_id
          AND du.date_end > NOW()
        LEFT JOIN automation_action_logs aal
          ON aal.user_id = cs.user_id
          AND aal.action_key = 'checkout_abandoned'
          AND aal.stage = 24
        WHERE o.id IS NULL
          AND du.id IS NULL
          AND aal.id IS NULL
        ORDER BY cs.checkout_started_at DESC
        LIMIT ${limit}
      `);

      for (const row of rows) {
        const userId = Number(row.userId);
        if (!userId) continue;

        const { created } = await createActionLog({
          prisma,
          userId,
          actionKey: 'checkout_abandoned',
          stage: 24,
          channel: 'system',
          metadata: {
            checkoutStartedAt: row.checkoutStartedAt.toISOString(),
            planId: row.planId ?? null,
          },
        });
        if (!created) continue;

        const user = await prisma.users.findFirst({ where: { id: userId } });
        if (user) {
          safeAddManyChatTag(user, 'AUTOMATION_CHECKOUT_ABANDONED_24H').catch(() => {});
        }

        const templateId = parseNumber(process.env.AUTOMATION_EMAIL_CHECKOUT_ABANDONED_24H_TEMPLATE_ID, 0);
        const emailOptIn = Boolean(row.emailMarketingOptIn);
        if (templateId > 0 && emailOptIn && canSendEmail()) {
          const base = resolveClientUrl();
          const rawUrl = row.planId ? `${base}/comprar?priceId=${row.planId}` : `${base}/planes`;
          const url = appendQueryParams(rawUrl, {
            utm_source: 'email',
            utm_medium: 'automation',
            utm_campaign: 'checkout_abandoned_24h',
            utm_content: 'cta',
          });
          const unsubscribeUrl = buildMarketingUnsubscribeUrl(userId) ?? undefined;
          const tpl = emailTemplates.automationCheckoutAbandoned({
            name: row.username,
            url,
            planName: row.planName ?? null,
            price: row.planPrice ? String(row.planPrice) : null,
            currency: row.planCurrency ?? null,
            unsubscribeUrl,
          });
          await safeSendAutomationEmail({
            toEmail: row.email,
            toName: row.username,
            subject: tpl.subject,
            html: tpl.html,
            text: tpl.text,
          });
          noteEmailSent();
        }

        bump('checkout_abandoned_24h');
      }
    }

    // Rule 3e: trial ending in ~24h and no purchase
    {
      const trialDays = Math.max(1, Math.min(30, Math.floor(parseNumber(process.env.BB_TRIAL_DAYS, 7))));
      const startMin = new Date(Date.now() - trialDays * 24 * 60 * 60 * 1000);
      const startMax = new Date(Date.now() - (trialDays - 1) * 24 * 60 * 60 * 1000);

      const rows = await prisma.$queryRaw<
        Array<{ userId: number; email: string; username: string; emailMarketingOptIn: number; trialStartedAt: Date }>
      >(Prisma.sql`
        SELECT
          t.user_id AS userId,
          u.email AS email,
          u.username AS username,
          u.email_marketing_opt_in AS emailMarketingOptIn,
          t.trial_started_at AS trialStartedAt
        FROM (
          SELECT
            user_id,
            MAX(event_ts) AS trial_started_at
          FROM analytics_events
          WHERE event_name = 'trial_started'
            AND user_id IS NOT NULL
            AND event_ts >= DATE_SUB(NOW(), INTERVAL 60 DAY)
          GROUP BY user_id
        ) t
        INNER JOIN users u
          ON u.id = t.user_id
          AND u.blocked = 0
        LEFT JOIN orders o
          ON o.user_id = t.user_id
          AND o.status = 1
          AND o.is_plan = 1
          AND (o.is_canceled IS NULL OR o.is_canceled = 0)
          AND o.date_order > t.trial_started_at
        LEFT JOIN descargas_user du
          ON du.user_id = t.user_id
          AND du.date_end > NOW()
        LEFT JOIN automation_action_logs aal
          ON aal.user_id = t.user_id
          AND aal.action_key = 'trial_expiring'
          AND aal.stage = 24
        WHERE t.trial_started_at >= ${startMin}
          AND t.trial_started_at < ${startMax}
          AND o.id IS NULL
          AND du.id IS NULL
          AND aal.id IS NULL
        ORDER BY t.trial_started_at DESC
        LIMIT ${limit}
      `);

      for (const row of rows) {
        const userId = Number(row.userId);
        if (!userId) continue;

        const { created } = await createActionLog({
          prisma,
          userId,
          actionKey: 'trial_expiring',
          stage: 24,
          channel: 'system',
          metadata: { trialStartedAt: row.trialStartedAt.toISOString(), trialDays },
        });
        if (!created) continue;

        const user = await prisma.users.findFirst({ where: { id: userId } });
        if (user) {
          safeAddManyChatTag(user, 'AUTOMATION_TRIAL_EXPIRING_24H').catch(() => {});
        }

        const templateId = parseNumber(process.env.AUTOMATION_EMAIL_TRIAL_EXPIRING_24H_TEMPLATE_ID, 0);
        const emailOptIn = Boolean(row.emailMarketingOptIn);
        if (templateId > 0 && emailOptIn && canSendEmail()) {
          const url = appendQueryParams(`${resolveClientUrl()}/planes`, {
            utm_source: 'email',
            utm_medium: 'automation',
            utm_campaign: 'trial_expiring_24h',
            utm_content: 'cta',
          });
          const unsubscribeUrl = buildMarketingUnsubscribeUrl(userId) ?? undefined;
          const tpl = emailTemplates.automationTrialExpiring24h({
            name: row.username,
            url,
            unsubscribeUrl,
          });
          await safeSendAutomationEmail({
            toEmail: row.email,
            toName: row.username,
            subject: tpl.subject,
            html: tpl.html,
            text: tpl.text,
          });
          noteEmailSent();
        }

        bump('trial_expiring_24h');
      }
    }

    // Rule 4: active subscription, no downloads in 7/14/21 days (requires at least one download)
    for (const days of [7, 14, 21]) {
      const rows = await prisma.$queryRaw<
        Array<{ userId: number; lastDownloadAt: Date }>
      >(Prisma.sql`
        SELECT
          u.id AS userId,
          MAX(dh.date) AS lastDownloadAt
        FROM descargas_user du
        INNER JOIN users u
          ON u.id = du.user_id
        INNER JOIN download_history dh
          ON dh.userId = du.user_id
        LEFT JOIN automation_action_logs aal
          ON aal.user_id = du.user_id
          AND aal.action_key = 'active_no_download'
          AND aal.stage = ${days}
        WHERE du.date_end > NOW()
          AND u.blocked = 0
        GROUP BY u.id
        HAVING lastDownloadAt < DATE_SUB(NOW(), INTERVAL ${days} DAY)
          AND MAX(aal.id) IS NULL
        ORDER BY lastDownloadAt ASC
        LIMIT ${limit}
      `);

      for (const row of rows) {
        const user = await prisma.users.findFirst({ where: { id: row.userId } });
        if (!user || user.blocked) continue;

        const { created } = await createActionLog({
          prisma,
          userId: user.id,
          actionKey: 'active_no_download',
          stage: days,
          channel: 'system',
          metadata: { lastDownloadAt: row.lastDownloadAt.toISOString() },
        });
        if (!created) continue;

        const tag =
          days === 7
            ? 'AUTOMATION_ACTIVE_NO_DOWNLOAD_7D'
            : days === 14
              ? 'AUTOMATION_ACTIVE_NO_DOWNLOAD_14D'
              : 'AUTOMATION_ACTIVE_NO_DOWNLOAD_21D';
        safeAddManyChatTag(user, tag).catch(() => {});

        const templateId = parseNumber(process.env.AUTOMATION_EMAIL_ACTIVE_NO_DOWNLOAD_TEMPLATE_ID, 0);
        if (templateId > 0 && user.email_marketing_opt_in && canSendEmail()) {
          const url = appendQueryParams(`${resolveClientUrl()}/`, {
            utm_source: 'email',
            utm_medium: 'automation',
            utm_campaign: `active_no_download_${days}d`,
            utm_content: 'cta',
          });
          const unsubscribeUrl = buildMarketingUnsubscribeUrl(user.id) ?? undefined;
          const tpl = emailTemplates.automationActiveNoDownload({
            name: user.username,
            url,
            days,
            unsubscribeUrl,
          });
          await safeSendAutomationEmail({
            toEmail: user.email,
            toName: user.username,
            subject: tpl.subject,
            html: tpl.html,
            text: tpl.text,
          });
          noteEmailSent();
        }

        bump(`active_no_download_${days}d`);
      }
    }

    // Rule 4b: lapsed subscription (ended recently) -> winback offer
    {
      const stage = 1;
      const minDays = Math.max(
        1,
        Math.min(3650, Math.floor(parseNumber(process.env.AUTOMATION_WINBACK_LAPSED_MIN_DAYS, 7))),
      );
      const lookbackDays = Math.max(
        7,
        Math.min(3650, Math.floor(parseNumber(process.env.AUTOMATION_WINBACK_LAPSED_LOOKBACK_DAYS, 365))),
      );
      const percentOff = Math.max(
        1,
        Math.min(99, Math.floor(parseNumber(process.env.AUTOMATION_WINBACK_LAPSED_PERCENT_OFF, 50))),
      );
      const expiresDays = Math.max(
        1,
        Math.min(30, Math.floor(parseNumber(process.env.AUTOMATION_WINBACK_LAPSED_EXPIRES_DAYS, 3))),
      );

      const rows = await prisma.$queryRaw<
        Array<{ userId: number; email: string; username: string; lastEndedAt: Date }>
      >(Prisma.sql`
        SELECT
          u.id AS userId,
          u.email AS email,
          u.username AS username,
          MAX(du.date_end) AS lastEndedAt
        FROM descargas_user du
        INNER JOIN users u
          ON u.id = du.user_id
          AND u.blocked = 0
        LEFT JOIN descargas_user du_active
          ON du_active.user_id = u.id
          AND du_active.date_end > NOW()
        LEFT JOIN automation_action_logs aal
          ON aal.user_id = u.id
          AND aal.action_key = 'winback_lapsed'
          AND aal.stage = ${stage}
        WHERE du_active.id IS NULL
          AND u.email_marketing_opt_in = 1
          AND aal.id IS NULL
          AND EXISTS (
            SELECT 1
            FROM orders o
            WHERE o.user_id = u.id
              AND o.status = 1
              AND o.is_plan = 1
          )
        GROUP BY u.id, u.email, u.username
        HAVING lastEndedAt < DATE_SUB(NOW(), INTERVAL ${minDays} DAY)
          AND lastEndedAt >= DATE_SUB(NOW(), INTERVAL ${lookbackDays} DAY)
        ORDER BY lastEndedAt DESC
        LIMIT ${limit}
      `);

      for (const row of rows) {
        const userId = Number(row.userId);
        if (!userId) continue;
        const user = await prisma.users.findFirst({ where: { id: userId } });
        if (!user || user.blocked) continue;

        const { created } = await createActionLog({
          prisma,
          userId,
          actionKey: 'winback_lapsed',
          stage,
          channel: 'system',
          metadata: { lastEndedAt: row.lastEndedAt.toISOString(), percentOff, expiresDays },
        });
        if (!created) continue;

        const expiresAt = new Date(Date.now() + expiresDays * 24 * 60 * 60 * 1000);
        const offer = await upsertUserOfferAndCoupon({
          prisma,
          userId,
          offerKey: OFFER_KEYS.WINBACK_LAPSED,
          stage,
          percentOff,
          expiresAt,
        });

        await safeSetManyChatCustomFields(user, [
          { key: 'bb_offer_code', value: offer.couponCode ?? '' },
          { key: 'bb_offer_pct', value: String(offer.percentOff) },
          { key: 'bb_offer_expires_at', value: expiresAt.toISOString() },
        ]);
        safeAddManyChatTag(user, `AUTOMATION_WINBACK_LAPSED_OFFER_${offer.percentOff}`).catch(() => {});

        const templateId = parseNumber(process.env.AUTOMATION_EMAIL_WINBACK_LAPSED_TEMPLATE_ID, 0);
        if (templateId > 0 && user.email_marketing_opt_in && offer.couponCode && canSendEmail()) {
          const url = appendQueryParams(`${resolveClientUrl()}/planes`, {
            utm_source: 'email',
            utm_medium: 'automation',
            utm_campaign: `winback_lapsed_${offer.percentOff}`,
            utm_content: 'cta',
          });
          const unsubscribeUrl = buildMarketingUnsubscribeUrl(user.id) ?? undefined;
          const expiresAtText = `${expiresAt.toISOString().replace('T', ' ').slice(0, 16)} UTC`;
          const tpl = emailTemplates.winbackLapsedOffer({
            name: user.username,
            url,
            couponCode: offer.couponCode,
            percentOff: offer.percentOff,
            expiresAt: expiresAtText,
            unsubscribeUrl,
          });
          await safeSendAutomationEmail({
            toEmail: user.email,
            toName: user.username,
            subject: tpl.subject,
            html: tpl.html,
            text: tpl.text,
          });
          noteEmailSent();
        }

        // Optional WhatsApp: send a link to plans (login required).
        await safeSendTwilioLink(user, `${resolveClientUrl()}/planes`);

        bump('winback_lapsed');
      }
    }

    // Rule 5: plans viewed, no checkout after 12h -> offer 10%
    {
      const rows = await prisma.$queryRaw<
        Array<{ userId: number; lastPlansViewAt: Date }>
      >(Prisma.sql`
        SELECT
          pv.user_id AS userId,
          pv.last_plans_view_at AS lastPlansViewAt
        FROM (
          SELECT user_id, MAX(event_ts) AS last_plans_view_at
          FROM analytics_events
          WHERE user_id IS NOT NULL
            AND event_name = 'page_view'
            AND (page_path LIKE '/planes%' OR page_path = '/planes')
            AND event_ts >= DATE_SUB(NOW(), INTERVAL 14 DAY)
          GROUP BY user_id
        ) pv
        LEFT JOIN analytics_events co
          ON co.user_id = pv.user_id
          AND co.event_name = 'checkout_started'
          AND co.event_ts > pv.last_plans_view_at
        LEFT JOIN orders o
          ON o.user_id = pv.user_id
          AND o.status = 1
          AND o.is_plan = 1
          AND (o.is_canceled IS NULL OR o.is_canceled = 0)
          AND o.date_order > pv.last_plans_view_at
        LEFT JOIN descargas_user du
          ON du.user_id = pv.user_id
          AND du.date_end > NOW()
        LEFT JOIN automation_action_logs aal
          ON aal.user_id = pv.user_id
          AND aal.action_key = 'plans_view_no_checkout'
          AND aal.stage = 1
        WHERE pv.last_plans_view_at < DATE_SUB(NOW(), INTERVAL 12 HOUR)
          AND co.id IS NULL
          AND o.id IS NULL
          AND du.id IS NULL
          AND aal.id IS NULL
        ORDER BY pv.last_plans_view_at DESC
        LIMIT ${limit}
      `);

      for (const row of rows) {
        const user = await prisma.users.findFirst({ where: { id: row.userId } });
        if (!user || user.blocked) continue;

        const { created } = await createActionLog({
          prisma,
          userId: user.id,
          actionKey: 'plans_view_no_checkout',
          stage: 1,
          channel: 'system',
          metadata: { lastPlansViewAt: row.lastPlansViewAt.toISOString() },
        });
        if (!created) continue;

        const expiresAt = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
        const offer = await upsertUserOfferAndCoupon({
          prisma,
          userId: user.id,
          offerKey: OFFER_KEYS.PLANS_NO_CHECKOUT,
          stage: 1,
          percentOff: 10,
          expiresAt,
        });

        await safeSetManyChatCustomFields(user, [
          { key: 'bb_offer_code', value: offer.couponCode ?? '' },
          { key: 'bb_offer_pct', value: String(offer.percentOff) },
          { key: 'bb_offer_expires_at', value: expiresAt.toISOString() },
        ]);
        safeAddManyChatTag(user, 'AUTOMATION_PLANS_OFFER_10').catch(() => {});

        const offerEmailTemplateId = parseNumber(process.env.AUTOMATION_EMAIL_PLANS_OFFER_TEMPLATE_ID, 0);
        if (offerEmailTemplateId > 0 && user.email_marketing_opt_in && offer.couponCode && canSendEmail()) {
          const url = appendQueryParams(`${resolveClientUrl()}/planes`, {
            utm_source: 'email',
            utm_medium: 'automation',
            utm_campaign: `plans_offer_${offer.percentOff}`,
            utm_content: 'cta',
          });
          const unsubscribeUrl = buildMarketingUnsubscribeUrl(user.id) ?? undefined;
          const expiresAtText = `${expiresAt.toISOString().replace('T', ' ').slice(0, 16)} UTC`;
          const tpl = emailTemplates.automationPlansOffer({
            name: user.username,
            url,
            couponCode: offer.couponCode,
            percentOff: offer.percentOff,
            expiresAt: expiresAtText,
            unsubscribeUrl,
          });
          await safeSendAutomationEmail({
            toEmail: user.email,
            toName: user.username,
            subject: tpl.subject,
            html: tpl.html,
            text: tpl.text,
          });
          noteEmailSent();
        }

        // Optional WhatsApp: send a link to plans (login required).
        await safeSendTwilioLink(user, `${resolveClientUrl()}/planes`);

        bump('plans_offer_10');
      }
    }

    // Offer escalation: stage 2 (30%) after 2 days
    {
      const rows = await prisma.$queryRaw<
        Array<{ userId: number; firstOfferAt: Date }>
      >(Prisma.sql`
        SELECT
          o1.user_id AS userId,
          o1.created_at AS firstOfferAt
        FROM user_offers o1
        INNER JOIN users u
          ON u.id = o1.user_id
        LEFT JOIN user_offers o2
          ON o2.user_id = o1.user_id
          AND o2.offer_key = o1.offer_key
          AND o2.stage = 2
        LEFT JOIN orders ord
          ON ord.user_id = o1.user_id
          AND ord.status = 1
          AND ord.is_plan = 1
          AND (ord.is_canceled IS NULL OR ord.is_canceled = 0)
          AND ord.date_order > o1.created_at
        LEFT JOIN descargas_user du
          ON du.user_id = o1.user_id
          AND du.date_end > NOW()
        LEFT JOIN automation_action_logs aal
          ON aal.user_id = o1.user_id
          AND aal.action_key = 'plans_view_no_checkout'
          AND aal.stage = 2
        WHERE o1.offer_key = ${OFFER_KEYS.PLANS_NO_CHECKOUT}
          AND o1.stage = 1
          AND o1.redeemed_at IS NULL
          AND o1.created_at < DATE_SUB(NOW(), INTERVAL 2 DAY)
          AND o2.id IS NULL
          AND ord.id IS NULL
          AND du.id IS NULL
          AND u.blocked = 0
          AND aal.id IS NULL
        ORDER BY o1.created_at ASC
        LIMIT ${limit}
      `);

      for (const row of rows) {
        const user = await prisma.users.findFirst({ where: { id: row.userId } });
        if (!user || user.blocked) continue;

        const { created } = await createActionLog({
          prisma,
          userId: user.id,
          actionKey: 'plans_view_no_checkout',
          stage: 2,
          channel: 'system',
          metadata: { firstOfferAt: row.firstOfferAt.toISOString() },
        });
        if (!created) continue;

        const expiresAt = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
        const offer = await upsertUserOfferAndCoupon({
          prisma,
          userId: user.id,
          offerKey: OFFER_KEYS.PLANS_NO_CHECKOUT,
          stage: 2,
          percentOff: 30,
          expiresAt,
        });

        await safeSetManyChatCustomFields(user, [
          { key: 'bb_offer_code', value: offer.couponCode ?? '' },
          { key: 'bb_offer_pct', value: String(offer.percentOff) },
          { key: 'bb_offer_expires_at', value: expiresAt.toISOString() },
        ]);
        safeAddManyChatTag(user, 'AUTOMATION_PLANS_OFFER_30').catch(() => {});

        const offerEmailTemplateId = parseNumber(process.env.AUTOMATION_EMAIL_PLANS_OFFER_TEMPLATE_ID, 0);
        if (offerEmailTemplateId > 0 && user.email_marketing_opt_in && offer.couponCode && canSendEmail()) {
          const url = appendQueryParams(`${resolveClientUrl()}/planes`, {
            utm_source: 'email',
            utm_medium: 'automation',
            utm_campaign: `plans_offer_${offer.percentOff}`,
            utm_content: 'cta',
          });
          const unsubscribeUrl = buildMarketingUnsubscribeUrl(user.id) ?? undefined;
          const expiresAtText = `${expiresAt.toISOString().replace('T', ' ').slice(0, 16)} UTC`;
          const tpl = emailTemplates.automationPlansOffer({
            name: user.username,
            url,
            couponCode: offer.couponCode,
            percentOff: offer.percentOff,
            expiresAt: expiresAtText,
            unsubscribeUrl,
          });
          await safeSendAutomationEmail({
            toEmail: user.email,
            toName: user.username,
            subject: tpl.subject,
            html: tpl.html,
            text: tpl.text,
          });
          noteEmailSent();
        }

        bump('plans_offer_30');
      }
    }

    // Offer escalation: stage 3 (50%) after 15 days from first offer
    {
      const rows = await prisma.$queryRaw<
        Array<{ userId: number; firstOfferAt: Date }>
      >(Prisma.sql`
        SELECT
          o1.user_id AS userId,
          o1.created_at AS firstOfferAt
        FROM user_offers o1
        INNER JOIN users u
          ON u.id = o1.user_id
        LEFT JOIN user_offers o3
          ON o3.user_id = o1.user_id
          AND o3.offer_key = o1.offer_key
          AND o3.stage = 3
        LEFT JOIN orders ord
          ON ord.user_id = o1.user_id
          AND ord.status = 1
          AND ord.is_plan = 1
          AND (ord.is_canceled IS NULL OR ord.is_canceled = 0)
          AND ord.date_order > o1.created_at
        LEFT JOIN descargas_user du
          ON du.user_id = o1.user_id
          AND du.date_end > NOW()
        LEFT JOIN automation_action_logs aal
          ON aal.user_id = o1.user_id
          AND aal.action_key = 'plans_view_no_checkout'
          AND aal.stage = 3
        WHERE o1.offer_key = ${OFFER_KEYS.PLANS_NO_CHECKOUT}
          AND o1.stage = 1
          AND o1.redeemed_at IS NULL
          AND o1.created_at < DATE_SUB(NOW(), INTERVAL 15 DAY)
          AND o3.id IS NULL
          AND ord.id IS NULL
          AND du.id IS NULL
          AND u.blocked = 0
          AND aal.id IS NULL
        ORDER BY o1.created_at ASC
        LIMIT ${limit}
      `);

      for (const row of rows) {
        const user = await prisma.users.findFirst({ where: { id: row.userId } });
        if (!user || user.blocked) continue;

        const { created } = await createActionLog({
          prisma,
          userId: user.id,
          actionKey: 'plans_view_no_checkout',
          stage: 3,
          channel: 'system',
          metadata: { firstOfferAt: row.firstOfferAt.toISOString() },
        });
        if (!created) continue;

        const expiresAt = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
        const offer = await upsertUserOfferAndCoupon({
          prisma,
          userId: user.id,
          offerKey: OFFER_KEYS.PLANS_NO_CHECKOUT,
          stage: 3,
          percentOff: 50,
          expiresAt,
        });

        await safeSetManyChatCustomFields(user, [
          { key: 'bb_offer_code', value: offer.couponCode ?? '' },
          { key: 'bb_offer_pct', value: String(offer.percentOff) },
          { key: 'bb_offer_expires_at', value: expiresAt.toISOString() },
        ]);
        safeAddManyChatTag(user, 'AUTOMATION_PLANS_OFFER_50').catch(() => {});

        const offerEmailTemplateId = parseNumber(process.env.AUTOMATION_EMAIL_PLANS_OFFER_TEMPLATE_ID, 0);
        if (offerEmailTemplateId > 0 && user.email_marketing_opt_in && offer.couponCode && canSendEmail()) {
          const url = appendQueryParams(`${resolveClientUrl()}/planes`, {
            utm_source: 'email',
            utm_medium: 'automation',
            utm_campaign: `plans_offer_${offer.percentOff}`,
            utm_content: 'cta',
          });
          const unsubscribeUrl = buildMarketingUnsubscribeUrl(user.id) ?? undefined;
          const expiresAtText = `${expiresAt.toISOString().replace('T', ' ').slice(0, 16)} UTC`;
          const tpl = emailTemplates.automationPlansOffer({
            name: user.username,
            url,
            couponCode: offer.couponCode,
            percentOff: offer.percentOff,
            expiresAt: expiresAtText,
            unsubscribeUrl,
          });
          await safeSendAutomationEmail({
            toEmail: user.email,
            toName: user.username,
            subject: tpl.subject,
            html: tpl.html,
            text: tpl.text,
          });
          noteEmailSent();
        }

        bump('plans_offer_50');
      }
    }

    // Mark offers redeemed for users who purchased recently (stops escalation).
    {
      const rows = await prisma.$queryRaw<Array<{ userId: number }>>(Prisma.sql`
        SELECT DISTINCT o.user_id AS userId
        FROM orders o
        WHERE o.status = 1
          AND o.is_plan = 1
          AND (o.is_canceled IS NULL OR o.is_canceled = 0)
          AND o.date_order >= DATE_SUB(NOW(), INTERVAL 1 DAY)
      `);
      for (const row of rows) {
        await markUserOffersRedeemed({ prisma, userId: Number(row.userId) });
      }
    }

    log.info('[AUTOMATION] Run complete', { runId: run.id, stats });
    await finishRun('success');
  } catch (e: any) {
    log.error('[AUTOMATION] Run failed', {
      runId: run.id,
      error: e instanceof Error ? e.message : e,
    });
    await finishRun('failed', e instanceof Error ? e.message : String(e));
  }
}

export async function runAutomationForever(prisma: PrismaClient): Promise<void> {
  const intervalMs = Math.max(
    60_000,
    Math.min(60 * 60 * 1000, parseNumber(process.env.AUTOMATION_RUNNER_INTERVAL_MS, FIVE_MINUTES_MS)),
  );

  let shouldStop = false;
  const stop = () => {
    shouldStop = true;
  };

  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);

  while (!shouldStop) {
    await runAutomationOnce(prisma);
    if (shouldStop) break;
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
}
