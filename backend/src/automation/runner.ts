import { Prisma, PrismaClient, Users } from '@prisma/client';
import { log } from '../server';
import { isEmailConfigured, sendEmail } from '../email';
import { emailTemplates } from '../email/templates';
import { resolveEmailTemplateContent } from '../email/templateOverrides';
import { manyChat } from '../many-chat';
import { ANALYTICS_PUBLIC_TRAFFIC_FILTER_AE_SQL, ensureAnalyticsEventsTableExists } from '../analytics';
import { OFFER_KEYS, markUserOffersRedeemed, upsertUserOfferAndCoupon } from '../offers';
import { twilio } from '../twilio';
import { buildMarketingUnsubscribeUrl } from '../comms/unsubscribe';
import { buildStripeBillingPortalUrl } from '../billing/stripeBillingPortalLink';
import { computeDunningStageDays } from '../billing/dunning';

type AutomationChannel = 'manychat' | 'email' | 'twilio' | 'admin' | 'system';
type AutomationDeliveryStatus =
  | 'created'
  | 'sent'
  | 'delivered'
  | 'opened'
  | 'clicked'
  | 'bounced'
  | 'complained'
  | 'failed';

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

async function safeAddManyChatTag(user: Users, tag: any): Promise<boolean> {
  try {
    await manyChat.addTagToUser(user, tag);
    return true;
  } catch (e) {
    // Shouldn't throw, but never break automations.
    log.debug('[AUTOMATION] ManyChat tag skipped', {
      userId: user.id,
      tag,
      error: e instanceof Error ? e.message : e,
    });
    return false;
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
  prisma: PrismaClient;
  userId: number;
  actionKey: string;
  contextKey?: string | null;
  stage: number;
  toEmail: string;
  subject: string;
  html: string;
  text: string;
  templateKey?: string;
  templateVariables?: Record<string, unknown>;
  metadata?: Prisma.JsonObject;
}): Promise<boolean> {
  if (!isEmailConfigured()) return false;
  const {
    prisma,
    userId,
    actionKey,
    contextKey,
    stage,
    toEmail,
    subject,
    html,
    text,
    templateKey,
    templateVariables,
    metadata,
  } = params;
  const normalizedContextKey = normalizeContextKey(contextKey);
  const resolvedActionKey = actionKey.endsWith('_email') ? actionKey : `${actionKey}_email`;
  const resolvedTemplateKey = (templateKey || `${resolvedActionKey}_s${stage}`).trim().slice(0, 120);

  const { created } = await createActionLog({
    prisma,
    userId,
    actionKey: resolvedActionKey,
    contextKey: normalizedContextKey,
    stage,
    channel: 'email',
    deliveryStatus: 'created',
    metadata: {
      ...(metadata ?? {}),
      templateKey: resolvedTemplateKey,
      baseActionKey: actionKey,
    },
  });
  if (!created) {
    const existing = await prisma.automationActionLog.findUnique({
      where: {
        user_id_action_key_stage_context_key: {
          user_id: userId,
          action_key: resolvedActionKey,
          stage,
          context_key: normalizedContextKey,
        },
      },
      select: { delivery_status: true },
    });
    // Retry only failed sends for the same journey.
    if (existing?.delivery_status !== 'failed') return false;
  }

  const updateEmailLog = async (status: AutomationDeliveryStatus, providerMessageId: string | null) => {
    await prisma.automationActionLog.update({
      where: {
        user_id_action_key_stage_context_key: {
          user_id: userId,
          action_key: resolvedActionKey,
          stage,
          context_key: normalizedContextKey,
        },
      },
      data: {
        delivery_status: status,
        provider_message_id: providerMessageId,
      },
      select: { id: true },
    });
  };
  try {
    const resolvedContent = await resolveEmailTemplateContent({
      prisma,
      templateKey: resolvedTemplateKey,
      fallback: {
        subject,
        html,
        text,
      },
      variables: templateVariables,
    });

    const result = await sendEmail({
      to: [toEmail],
      subject: resolvedContent.subject,
      html: resolvedContent.html,
      text: resolvedContent.text,
      tags: {
        action_key: resolvedActionKey,
        template_key: resolvedTemplateKey,
        stage: String(stage),
      },
    });
    await updateEmailLog(result.messageId ? 'sent' : 'failed', result.messageId ?? null);
    if (!result.messageId) {
      log.warn('[AUTOMATION] Email send returned no provider message id', {
        userId,
        actionKey: resolvedActionKey,
        stage,
      });
    }
    return Boolean(result.messageId);
  } catch (e) {
    try {
      await updateEmailLog('failed', null);
    } catch {
      // noop: preserve main error handling
    }
    log.warn('[AUTOMATION] Email send failed', {
      userId,
      actionKey: resolvedActionKey,
      stage,
      error: e instanceof Error ? e.message : e,
    });
    return false;
  }
}

async function safeSendTwilioLink(user: Users, url: string): Promise<boolean> {
  if (!isTwilioConfigured()) return false;
  const phone = String(user.phone || '').trim();
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 10 || digits.length > 15) return false;
  if (!user.whatsapp_marketing_opt_in) return false;
  try {
    await twilio.sendMessage(phone, url);
    return true;
  } catch (e) {
    log.warn('[AUTOMATION] Twilio send failed', {
      userId: user.id,
      error: e instanceof Error ? e.message : e,
    });
    return false;
  }
}

const normalizeContextKey = (value?: string | null): string => {
  if (typeof value !== 'string') return '';
  const normalized = value.trim();
  if (!normalized) return '';
  return normalized.slice(0, 160);
};

async function createActionLog(params: {
  prisma: PrismaClient;
  userId: number;
  actionKey: string;
  contextKey?: string | null;
  stage: number;
  channel: AutomationChannel;
  deliveryStatus?: AutomationDeliveryStatus;
  providerMessageId?: string | null;
  metadata?: Prisma.JsonObject;
}): Promise<{ created: boolean }> {
  const {
    prisma,
    userId,
    actionKey,
    contextKey,
    stage,
    channel,
    deliveryStatus,
    providerMessageId,
    metadata,
  } = params;
  try {
    await prisma.automationActionLog.create({
      data: {
        user_id: userId,
        action_key: actionKey,
        context_key: normalizeContextKey(contextKey),
        stage,
        channel,
        delivery_status: deliveryStatus ?? null,
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

  const emailAutomationsEnabledFlag = (process.env.EMAIL_AUTOMATIONS_ENABLED || '1').trim();
  const emailAutomationsEnabled = emailAutomationsEnabledFlag !== '0';
  if (!emailAutomationsEnabled) {
    log.info('[AUTOMATION] Email automations disabled via EMAIL_AUTOMATIONS_ENABLED=0. Emails will be skipped.');
  }

  const registeredNoPurchase7dEnabledFlag = (process.env.AUTOMATION_REGISTERED_NO_PURCHASE_7D_ENABLED || '1').trim();
  const registeredNoPurchase7dEnabled = registeredNoPurchase7dEnabledFlag !== '0';
  if (!registeredNoPurchase7dEnabled) {
    log.info('[AUTOMATION] registered_no_purchase_7d disabled via AUTOMATION_REGISTERED_NO_PURCHASE_7D_ENABLED=0.');
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
            ae.user_id,
            MAX(ae.event_ts) AS trial_started_at
          FROM analytics_events ae
          WHERE ae.event_name = 'trial_started'
            AND ae.user_id IS NOT NULL
            AND ae.event_ts >= DATE_SUB(NOW(), INTERVAL 30 DAY)
            AND ae.event_ts < DATE_SUB(NOW(), INTERVAL 24 HOUR)
            ${ANALYTICS_PUBLIC_TRAFFIC_FILTER_AE_SQL}
          GROUP BY ae.user_id
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
	        if (
	          emailAutomationsEnabled
	          && templateId > 0
	          && user.email_marketing_opt_in
	          && user.email_marketing_news_opt_in
	          && canSendEmail()
	        ) {
	          const url = appendQueryParams(`${resolveClientUrl()}/`, {
	            utm_source: 'email',
	            utm_medium: 'automation',
	            utm_campaign: 'trial_no_download_24h',
	            utm_content: 'cta',
	          });
	          const unsubscribeUrl = buildMarketingUnsubscribeUrl(user.id) ?? undefined;
	          const tpl = emailTemplates.automationTrialNoDownload24h({ name: user.username, url, unsubscribeUrl });
	          if (await safeSendAutomationEmail({
            prisma,
	            userId: user.id,
	            actionKey: 'trial_no_download',
	            stage: 24,
	            toEmail: user.email,
	            subject: tpl.subject,
	            html: tpl.html,
	            text: tpl.text,
	            templateKey: 'automation_trial_no_download_24h',
              templateVariables: {
                NAME: user.username,
                URL: url,
                UNSUBSCRIBE_URL: unsubscribeUrl,
              },
	          })) {
	            noteEmailSent();
	          }
	        }
        bump('trial_no_download');
      }
    }

    // Rule 2a: first paid order, no download in 2h (quick activation push)
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
            AND date_order < DATE_SUB(NOW(), INTERVAL 2 HOUR)
          GROUP BY user_id
        ) fp
        LEFT JOIN download_history dh
          ON dh.userId = fp.user_id
          AND dh.date >= fp.first_paid_at
          AND dh.date < DATE_ADD(fp.first_paid_at, INTERVAL 2 HOUR)
        LEFT JOIN automation_action_logs aal
          ON aal.user_id = fp.user_id
          AND aal.action_key = 'paid_no_download'
          AND aal.stage = 2
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
          stage: 2,
          channel: 'system',
          metadata: { paidAt: row.paidAt.toISOString() },
        });
        if (!created) continue;

        safeAddManyChatTag(user, 'AUTOMATION_PAID_NO_DOWNLOAD_2H').catch(() => {});

        const instructionsUrl = appendQueryParams(`${resolveClientUrl()}/instrucciones`, {
          utm_source: 'email',
          utm_medium: 'automation',
          utm_campaign: 'paid_no_download_2h',
          utm_content: 'cta_instructions',
        });
        const catalogUrl = appendQueryParams(`${resolveClientUrl()}/`, {
          utm_source: 'email',
          utm_medium: 'automation',
          utm_campaign: 'paid_no_download_2h',
          utm_content: 'link_catalog',
        });
        const recommendedFolder = (process.env.AUTOMATION_RECOMMENDED_FOLDER || 'Semana').trim() || 'Semana';

        await safeSendTwilioLink(user, instructionsUrl);

        const templateId = parseNumber(
          process.env.AUTOMATION_EMAIL_PAID_NO_DOWNLOAD_2H_TEMPLATE_ID
            || process.env.AUTOMATION_EMAIL_PAID_NO_DOWNLOAD_TEMPLATE_ID,
          0,
        );
        if (
          emailAutomationsEnabled
          && templateId > 0
          && user.email_marketing_opt_in
          && user.email_marketing_news_opt_in
          && canSendEmail()
        ) {
          const unsubscribeUrl = buildMarketingUnsubscribeUrl(user.id) ?? undefined;
          const tpl = emailTemplates.automationPaidNoDownload2h({
            name: user.username,
            instructionsUrl,
            catalogUrl,
            recommendedFolder,
            unsubscribeUrl,
          });
          if (await safeSendAutomationEmail({
            prisma,
            userId: user.id,
            actionKey: 'paid_no_download',
            stage: 2,
            toEmail: user.email,
            subject: tpl.subject,
            html: tpl.html,
            text: tpl.text,
            templateKey: 'automation_paid_no_download_2h',
            templateVariables: {
              NAME: user.username,
              INSTRUCTIONS_URL: instructionsUrl,
              CATALOG_URL: catalogUrl,
              RECOMMENDED_FOLDER: recommendedFolder,
              UNSUBSCRIBE_URL: unsubscribeUrl,
            },
          })) {
            noteEmailSent();
          }
        }
        bump('paid_no_download_2h');
      }
    }

    // Rule 2b: paid but no download in 24h (first paid order)
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
	        if (
	          emailAutomationsEnabled
	          && templateId > 0
	          && user.email_marketing_opt_in
	          && user.email_marketing_news_opt_in
	          && canSendEmail()
	        ) {
	          const url = appendQueryParams(`${resolveClientUrl()}/`, {
	            utm_source: 'email',
	            utm_medium: 'automation',
	            utm_campaign: 'paid_no_download_24h',
	            utm_content: 'cta',
	          });
	          const unsubscribeUrl = buildMarketingUnsubscribeUrl(user.id) ?? undefined;
	          const tpl = emailTemplates.automationPaidNoDownload24h({ name: user.username, url, unsubscribeUrl });
	          if (await safeSendAutomationEmail({
            prisma,
	            userId: user.id,
	            actionKey: 'paid_no_download',
	            stage: 24,
	            toEmail: user.email,
	            subject: tpl.subject,
	            html: tpl.html,
	            text: tpl.text,
	            templateKey: 'automation_paid_no_download_24h',
              templateVariables: {
                NAME: user.username,
                URL: url,
                UNSUBSCRIBE_URL: unsubscribeUrl,
              },
	          })) {
	            noteEmailSent();
	          }
	        }
        bump('paid_no_download');
      }
    }

    // Rule 3: registered 7d ago and no paid plan orders
    if (registeredNoPurchase7dEnabled) {
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
	          AND (
	            (aal.action_key = 'registered_no_purchase' AND aal.stage = 7)
	            OR (aal.action_key = 'registered_no_purchase_offer')
	          )
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

	        if (
	          emailAutomationsEnabled
	          && templateId > 0
	          && user.email_marketing_opt_in
	          && user.email_marketing_offers_opt_in
	          && offer.couponCode
	          && canSendEmail()
	        ) {
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
	          if (await safeSendAutomationEmail({
            prisma,
	            userId: user.id,
	            actionKey: 'registered_no_purchase',
	            stage: 7,
	            toEmail: user.email,
	            subject: tpl.subject,
	            html: tpl.html,
	            text: tpl.text,
	            templateKey: 'automation_registered_no_purchase_7d',
              templateVariables: {
                NAME: user.username,
                URL: url,
                COUPON_CODE: offer.couponCode,
                PERCENT_OFF: offer.percentOff,
                EXPIRES_AT: expiresAtText,
                UNSUBSCRIBE_URL: unsubscribeUrl,
              },
	          })) {
	            noteEmailSent();
	          }
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
	        if (emailAutomationsEnabled && templateId > 0 && canSendEmail()) {
	          const url = appendQueryParams(`${resolveClientUrl()}/micuenta`, {
	            utm_source: 'email',
	            utm_medium: 'automation',
	            utm_campaign: 'verify_whatsapp_24h',
	            utm_content: 'cta',
	          });
	          const tpl = emailTemplates.automationVerifyWhatsApp24h({ name: user.username, url });
	          if (await safeSendAutomationEmail({
            prisma,
	            userId: user.id,
	            actionKey: 'verify_whatsapp',
	            stage: 24,
	            toEmail: user.email,
	            subject: tpl.subject,
	            html: tpl.html,
	            text: tpl.text,
	            templateKey: 'automation_verify_whatsapp_24h',
              templateVariables: {
                NAME: user.username,
                URL: url,
              },
	          })) {
	            noteEmailSent();
	          }
	        }

        bump('verify_whatsapp_24h');
      }
    }

    // Rule 3c/3d/3e: checkout abandoned (canonical source: checkout_logs) after 15m/1h/24h.
    {
      type CheckoutAbandonedCandidate = {
        userId: number;
        checkoutAt: Date;
        contextKey: string;
        planId: number | null;
        planName: string | null;
        planPrice: Prisma.Decimal | number | string | null;
        planCurrency: string | null;
      };

      const checkoutAbandonedStages = [
        {
          stage: 15,
          waitMinutes: 15,
          lookbackDays: 14,
          manyChatTag: 'AUTOMATION_CHECKOUT_ABANDONED_15M',
          templateId: parseNumber(
            process.env.AUTOMATION_EMAIL_CHECKOUT_ABANDONED_15M_TEMPLATE_ID
              || process.env.AUTOMATION_EMAIL_CHECKOUT_ABANDONED_1H_TEMPLATE_ID,
            0,
          ),
          campaign: 'checkout_abandoned_15m',
          bumpKey: 'checkout_abandoned_15m',
        },
        {
          stage: 1,
          waitMinutes: 60,
          lookbackDays: 14,
          manyChatTag: 'AUTOMATION_CHECKOUT_ABANDONED_1H',
          templateId: parseNumber(process.env.AUTOMATION_EMAIL_CHECKOUT_ABANDONED_1H_TEMPLATE_ID, 0),
          campaign: 'checkout_abandoned_1h',
          bumpKey: 'checkout_abandoned_1h',
        },
        {
          stage: 24,
          waitMinutes: 24 * 60,
          lookbackDays: 30,
          manyChatTag: 'AUTOMATION_CHECKOUT_ABANDONED_24H',
          templateId: parseNumber(process.env.AUTOMATION_EMAIL_CHECKOUT_ABANDONED_24H_TEMPLATE_ID, 0),
          campaign: 'checkout_abandoned_24h',
          bumpKey: 'checkout_abandoned_24h',
        },
      ] as const;

      for (const stageConfig of checkoutAbandonedStages) {
        const rows = await prisma.$queryRaw<Array<CheckoutAbandonedCandidate>>(Prisma.sql`
          SELECT
            ca.userId AS userId,
            ca.checkoutAt AS checkoutAt,
            ca.contextKey AS contextKey,
            ca.planId AS planId,
            p.name AS planName,
            p.price AS planPrice,
            p.moneda AS planCurrency
          FROM (
            SELECT
              cl.user_id AS userId,
              cl.last_checkout_date AS checkoutAt,
              CONCAT('checkout:', DATE_FORMAT(cl.last_checkout_date, '%Y%m%d%H%i%s')) AS contextKey,
              (
                SELECT CAST(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(ae.metadata_json, '$.planId')), '') AS UNSIGNED)
                FROM analytics_events ae
                WHERE ae.user_id = cl.user_id
                  AND ae.event_name IN ('checkout_started', 'checkout_start', 'checkout_method_selected', 'checkout_abandoned')
                  AND ae.event_ts >= DATE_SUB(cl.last_checkout_date, INTERVAL 24 HOUR)
                  AND ae.event_ts <= DATE_ADD(cl.last_checkout_date, INTERVAL 10 MINUTE)
                  ${ANALYTICS_PUBLIC_TRAFFIC_FILTER_AE_SQL}
                ORDER BY ae.event_ts DESC
                LIMIT 1
              ) AS planId
            FROM checkout_logs cl
            INNER JOIN users u
              ON u.id = cl.user_id
              AND u.blocked = 0
            LEFT JOIN orders o
              ON o.user_id = cl.user_id
              AND o.status = 1
              AND o.is_plan = 1
              AND (o.is_canceled IS NULL OR o.is_canceled = 0)
              AND o.date_order > cl.last_checkout_date
            LEFT JOIN descargas_user du
              ON du.user_id = cl.user_id
              AND du.date_end > NOW()
            LEFT JOIN automation_action_logs aal
              ON aal.user_id = cl.user_id
              AND aal.action_key = 'checkout_abandoned'
              AND aal.stage = ${stageConfig.stage}
              AND aal.context_key = CONCAT('checkout:', DATE_FORMAT(cl.last_checkout_date, '%Y%m%d%H%i%s'))
            WHERE cl.last_checkout_date >= DATE_SUB(NOW(), INTERVAL ${stageConfig.lookbackDays} DAY)
              AND cl.last_checkout_date < DATE_SUB(NOW(), INTERVAL ${stageConfig.waitMinutes} MINUTE)
              AND o.id IS NULL
              AND du.id IS NULL
              AND aal.id IS NULL
            ORDER BY cl.last_checkout_date DESC
            LIMIT ${limit}
          ) ca
          LEFT JOIN plans p
            ON p.id = ca.planId
          ORDER BY ca.checkoutAt DESC
        `);

        for (const row of rows) {
          const userId = Number(row.userId);
          if (!userId) continue;

          const contextKey = normalizeContextKey(row.contextKey);
          if (!contextKey) continue;

          const { created } = await createActionLog({
            prisma,
            userId,
            actionKey: 'checkout_abandoned',
            contextKey,
            stage: stageConfig.stage,
            channel: 'system',
            metadata: {
              checkoutAt: row.checkoutAt.toISOString(),
              planId: row.planId ?? null,
              stageMinutes: stageConfig.waitMinutes,
            },
          });
          if (!created) continue;

          const user = await prisma.users.findFirst({ where: { id: userId } });
          if (!user || user.blocked) continue;

          const manyChatTagged = await safeAddManyChatTag(user, stageConfig.manyChatTag);
          if (manyChatTagged) {
            await createActionLog({
              prisma,
              userId,
              actionKey: 'checkout_abandoned_manychat',
              contextKey,
              stage: stageConfig.stage,
              channel: 'manychat',
              metadata: { tag: stageConfig.manyChatTag },
            });
          }

          const base = resolveClientUrl();
          const rawUrl = row.planId ? `${base}/comprar?priceId=${row.planId}` : `${base}/planes`;
          const whatsappUrl = appendQueryParams(rawUrl, {
            utm_source: 'whatsapp',
            utm_medium: 'automation',
            utm_campaign: stageConfig.campaign,
            utm_content: 'cta',
          });
          const whatsappSent = await safeSendTwilioLink(user, whatsappUrl);
          if (whatsappSent) {
            await createActionLog({
              prisma,
              userId,
              actionKey: 'checkout_abandoned_whatsapp',
              contextKey,
              stage: stageConfig.stage,
              channel: 'twilio',
              metadata: { campaign: stageConfig.campaign },
            });
          }

          if (
            emailAutomationsEnabled
            && stageConfig.templateId > 0
            && user.email_marketing_opt_in
            && user.email_marketing_news_opt_in
            && canSendEmail()
          ) {
            const emailUrl = appendQueryParams(rawUrl, {
              utm_source: 'email',
              utm_medium: 'automation',
              utm_campaign: stageConfig.campaign,
              utm_content: 'cta',
            });
            const unsubscribeUrl = buildMarketingUnsubscribeUrl(userId) ?? undefined;
            const tpl = emailTemplates.automationCheckoutAbandoned({
              name: user.username,
              url: emailUrl,
              planName: row.planName ?? null,
              price: row.planPrice == null ? null : String(row.planPrice),
              currency: row.planCurrency ?? null,
              unsubscribeUrl,
            });
            const emailSent = await safeSendAutomationEmail({
            prisma,
              userId,
              actionKey: 'checkout_abandoned_email',
              contextKey,
              stage: stageConfig.stage,
              toEmail: user.email,
              subject: tpl.subject,
              html: tpl.html,
              text: tpl.text,
              templateKey: `automation_checkout_abandoned_${stageConfig.stage}`,
              templateVariables: {
                NAME: user.username,
                URL: emailUrl,
                PLAN_NAME: row.planName ?? null,
                PRICE: row.planPrice == null ? null : String(row.planPrice),
                CURRENCY: row.planCurrency ?? null,
                UNSUBSCRIBE_URL: unsubscribeUrl,
              },
              metadata: { campaign: stageConfig.campaign },
            });
            if (emailSent) {
              noteEmailSent();
            }
          }

          bump(stageConfig.bumpKey);
        }
      }
    }

    // Rule 3f: trial ending in ~24h and no purchase
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
            ae.user_id,
            MAX(ae.event_ts) AS trial_started_at
          FROM analytics_events ae
          WHERE ae.event_name = 'trial_started'
            AND ae.user_id IS NOT NULL
            AND ae.event_ts >= DATE_SUB(NOW(), INTERVAL 60 DAY)
            ${ANALYTICS_PUBLIC_TRAFFIC_FILTER_AE_SQL}
          GROUP BY ae.user_id
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
        if (!user || user.blocked) continue;
        safeAddManyChatTag(user, 'AUTOMATION_TRIAL_EXPIRING_24H').catch(() => {});

	        const templateId = parseNumber(process.env.AUTOMATION_EMAIL_TRIAL_EXPIRING_24H_TEMPLATE_ID, 0);
	        if (
	          emailAutomationsEnabled
	          && templateId > 0
	          && user.email_marketing_opt_in
	          && user.email_marketing_news_opt_in
	          && canSendEmail()
	        ) {
	          const url = appendQueryParams(`${resolveClientUrl()}/planes`, {
	            utm_source: 'email',
	            utm_medium: 'automation',
	            utm_campaign: 'trial_expiring_24h',
	            utm_content: 'cta',
	          });
	          const unsubscribeUrl = buildMarketingUnsubscribeUrl(userId) ?? undefined;
	          const tpl = emailTemplates.automationTrialExpiring24h({
	            name: user.username,
	            url,
	            unsubscribeUrl,
	          });
	          if (await safeSendAutomationEmail({
            prisma,
	            userId,
	            actionKey: 'trial_expiring',
	            stage: 24,
	            toEmail: user.email,
	            subject: tpl.subject,
	            html: tpl.html,
	            text: tpl.text,
	            templateKey: 'automation_trial_expiring_24h',
              templateVariables: {
                NAME: user.username,
                URL: url,
                UNSUBSCRIBE_URL: unsubscribeUrl,
              },
	          })) {
	            noteEmailSent();
	          }
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
	        if (
	          emailAutomationsEnabled
	          && templateId > 0
	          && user.email_marketing_opt_in
	          && user.email_marketing_news_opt_in
	          && canSendEmail()
	        ) {
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
	          if (await safeSendAutomationEmail({
            prisma,
	            userId: user.id,
	            actionKey: 'active_no_download',
	            stage: days,
	            toEmail: user.email,
	            subject: tpl.subject,
	            html: tpl.html,
	            text: tpl.text,
	            templateKey: `automation_active_no_download_${days}d`,
              templateVariables: {
                NAME: user.username,
                URL: url,
                DAYS: days,
                UNSUBSCRIBE_URL: unsubscribeUrl,
              },
	          })) {
	            noteEmailSent();
	          }
	        }

        bump(`active_no_download_${days}d`);
      }
    }

    // Rule 4b: cancelled subscription -> reminder 3 days before access ends (transactional).
    // (Only for users who cancelled: orders.is_canceled = 1)
    {
      const rows = await prisma.$queryRaw<
        Array<{ userId: number; email: string; username: string; accessUntil: Date }>
      >(Prisma.sql`
        SELECT
          du.user_id AS userId,
          u.email AS email,
          u.username AS username,
          du.date_end AS accessUntil
        FROM descargas_user du
        INNER JOIN orders o
          ON o.id = du.order_id
          AND o.is_canceled = 1
        INNER JOIN users u
          ON u.id = du.user_id
          AND u.blocked = 0
        LEFT JOIN descargas_user du_next
          ON du_next.user_id = du.user_id
          AND du_next.date_end > du.date_end
        LEFT JOIN automation_action_logs aal
          ON aal.user_id = du.user_id
          AND aal.action_key = 'cancel_access_end_reminder'
          AND aal.stage = 3
        WHERE du.date_end = DATE_ADD(CURDATE(), INTERVAL 3 DAY)
          AND du_next.id IS NULL
          AND aal.id IS NULL
        ORDER BY du.user_id DESC
        LIMIT ${limit}
      `);

      for (const row of rows) {
        if (!emailAutomationsEnabled || !canSendEmail()) break;

        const { created } = await createActionLog({
          prisma,
          userId: Number(row.userId),
          actionKey: 'cancel_access_end_reminder',
          stage: 3,
          channel: 'system',
          metadata: { accessUntil: row.accessUntil.toISOString().slice(0, 10) },
        });
        if (!created) continue;

        const accessUntilText = row.accessUntil instanceof Date ? row.accessUntil.toISOString().slice(0, 10) : '';
        const accountUrl = appendQueryParams(`${resolveClientUrl()}/micuenta`, {
          utm_source: 'email',
          utm_medium: 'transactional',
          utm_campaign: 'cancel_ending_soon',
          utm_content: 'link_account',
        });
        const reactivateUrl = appendQueryParams(`${resolveClientUrl()}/planes`, {
          utm_source: 'email',
          utm_medium: 'transactional',
          utm_campaign: 'cancel_ending_soon',
          utm_content: 'cta_reactivate',
        });
        const tpl = emailTemplates.cancellationEndingSoon({
          name: row.username,
          accessUntil: accessUntilText,
          accountUrl,
          reactivateUrl,
        });
        if (await safeSendAutomationEmail({
            prisma,
          userId: Number(row.userId),
          actionKey: 'cancel_access_end_reminder',
          stage: 3,
          toEmail: row.email,
          subject: tpl.subject,
          html: tpl.html,
          text: tpl.text,
          templateKey: 'automation_cancel_access_end_reminder_3d',
          templateVariables: {
            NAME: row.username,
            ACCESS_UNTIL: accessUntilText,
            ACCOUNT_URL: accountUrl,
            REACTIVATE_URL: reactivateUrl,
          },
        })) {
          noteEmailSent();
        }
        bump('cancel_access_end_reminder_3d');
      }
    }

    // Rule 4c: winback cadence 7/30/60 days after access ended (marketing only).
    for (const stageDays of [7, 30, 60]) {
      const lookbackDays = Math.max(
        60,
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
          AND aal.stage = ${stageDays}
        ${stageDays === 7 ? Prisma.sql`
        LEFT JOIN automation_action_logs aal_legacy
          ON aal_legacy.user_id = u.id
          AND aal_legacy.action_key = 'winback_lapsed'
          AND aal_legacy.stage = 1
        ` : Prisma.sql``}
        WHERE du_active.id IS NULL
          AND u.email_marketing_opt_in = 1
          AND u.email_marketing_offers_opt_in = 1
          AND aal.id IS NULL
          ${stageDays === 7 ? Prisma.sql`AND aal_legacy.id IS NULL` : Prisma.sql``}
          AND EXISTS (
            SELECT 1
            FROM orders o
            WHERE o.user_id = u.id
              AND o.status = 1
              AND o.is_plan = 1
          )
        GROUP BY u.id, u.email, u.username
        HAVING lastEndedAt = DATE_SUB(CURDATE(), INTERVAL ${stageDays} DAY)
          AND lastEndedAt >= DATE_SUB(CURDATE(), INTERVAL ${lookbackDays} DAY)
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
          stage: stageDays,
          channel: 'system',
          metadata: { lastEndedAt: row.lastEndedAt.toISOString(), percentOff, expiresDays },
        });
        if (!created) continue;

        const expiresAt = new Date(Date.now() + expiresDays * 24 * 60 * 60 * 1000);
        const offer = await upsertUserOfferAndCoupon({
          prisma,
          userId,
          offerKey: OFFER_KEYS.WINBACK_LAPSED,
          stage: stageDays,
          percentOff,
          expiresAt,
        });

        await safeSetManyChatCustomFields(user, [
          { key: 'bb_offer_code', value: offer.couponCode ?? '' },
          { key: 'bb_offer_pct', value: String(offer.percentOff) },
          { key: 'bb_offer_expires_at', value: expiresAt.toISOString() },
        ]);
        safeAddManyChatTag(user, `AUTOMATION_WINBACK_LAPSED_${stageDays}D_OFFER_${offer.percentOff}`).catch(() => {});

        const templateId = parseNumber(process.env.AUTOMATION_EMAIL_WINBACK_LAPSED_TEMPLATE_ID, 0);
        if (
          emailAutomationsEnabled
          && templateId > 0
          && user.email_marketing_opt_in
          && user.email_marketing_offers_opt_in
          && offer.couponCode
          && canSendEmail()
        ) {
          const url = appendQueryParams(`${resolveClientUrl()}/planes`, {
            utm_source: 'email',
            utm_medium: 'automation',
            utm_campaign: `winback_lapsed_${stageDays}d_${offer.percentOff}`,
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
          if (await safeSendAutomationEmail({
            prisma,
            userId: user.id,
            actionKey: 'winback_lapsed',
            stage: stageDays,
            toEmail: user.email,
            subject: tpl.subject,
            html: tpl.html,
            text: tpl.text,
            templateKey: `automation_winback_lapsed_${stageDays}d`,
            templateVariables: {
              NAME: user.username,
              URL: url,
              COUPON_CODE: offer.couponCode,
              PERCENT_OFF: offer.percentOff,
              EXPIRES_AT: expiresAtText,
              UNSUBSCRIBE_URL: unsubscribeUrl,
            },
          })) {
            noteEmailSent();
          }
        }

        await safeSendTwilioLink(user, `${resolveClientUrl()}/planes`);
        bump(`winback_lapsed_${stageDays}d`);
      }
    }

    // Rule 5: plans viewed, no checkout started after 12h -> offer 10%
    {
      const rows = await prisma.$queryRaw<
        Array<{ userId: number; lastPlansViewAt: Date }>
      >(Prisma.sql`
        SELECT
          pv.user_id AS userId,
          pv.last_plans_view_at AS lastPlansViewAt
        FROM (
          SELECT ae.user_id, MAX(ae.event_ts) AS last_plans_view_at
          FROM analytics_events ae
          WHERE ae.user_id IS NOT NULL
            AND ae.event_name = 'page_view'
            AND (ae.page_path LIKE '/planes%' OR ae.page_path = '/planes')
            AND ae.event_ts >= DATE_SUB(NOW(), INTERVAL 14 DAY)
            ${ANALYTICS_PUBLIC_TRAFFIC_FILTER_AE_SQL}
          GROUP BY ae.user_id
        ) pv
        LEFT JOIN analytics_events ae
          ON ae.user_id = pv.user_id
          AND ae.event_name = 'checkout_started'
          AND ae.event_ts > pv.last_plans_view_at
          ${ANALYTICS_PUBLIC_TRAFFIC_FILTER_AE_SQL}
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
          AND ae.id IS NULL
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
	        if (
	          emailAutomationsEnabled
	          && offerEmailTemplateId > 0
	          && user.email_marketing_opt_in
	          && user.email_marketing_offers_opt_in
	          && offer.couponCode
	          && canSendEmail()
	        ) {
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
	          if (await safeSendAutomationEmail({
            prisma,
	            userId: user.id,
	            actionKey: 'plans_view_no_checkout',
	            stage: 1,
	            toEmail: user.email,
	            subject: tpl.subject,
	            html: tpl.html,
	            text: tpl.text,
	            templateKey: 'automation_plans_offer_stage_1',
              templateVariables: {
                NAME: user.username,
                URL: url,
                COUPON_CODE: offer.couponCode,
                PERCENT_OFF: offer.percentOff,
                EXPIRES_AT: expiresAtText,
                UNSUBSCRIBE_URL: unsubscribeUrl,
              },
	          })) {
	            noteEmailSent();
	          }
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
	        if (
	          emailAutomationsEnabled
	          && offerEmailTemplateId > 0
	          && user.email_marketing_opt_in
	          && user.email_marketing_offers_opt_in
	          && offer.couponCode
	          && canSendEmail()
	        ) {
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
	          if (await safeSendAutomationEmail({
            prisma,
	            userId: user.id,
	            actionKey: 'plans_view_no_checkout',
	            stage: 2,
	            toEmail: user.email,
	            subject: tpl.subject,
	            html: tpl.html,
	            text: tpl.text,
	            templateKey: 'automation_plans_offer_stage_2',
              templateVariables: {
                NAME: user.username,
                URL: url,
                COUPON_CODE: offer.couponCode,
                PERCENT_OFF: offer.percentOff,
                EXPIRES_AT: expiresAtText,
                UNSUBSCRIBE_URL: unsubscribeUrl,
              },
	          })) {
	            noteEmailSent();
	          }
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
	        if (
	          emailAutomationsEnabled
	          && offerEmailTemplateId > 0
	          && user.email_marketing_opt_in
	          && user.email_marketing_offers_opt_in
	          && offer.couponCode
	          && canSendEmail()
	        ) {
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
	          if (await safeSendAutomationEmail({
            prisma,
	            userId: user.id,
	            actionKey: 'plans_view_no_checkout',
	            stage: 3,
	            toEmail: user.email,
	            subject: tpl.subject,
	            html: tpl.html,
	            text: tpl.text,
	            templateKey: 'automation_plans_offer_stage_3',
              templateVariables: {
                NAME: user.username,
                URL: url,
                COUPON_CODE: offer.couponCode,
                PERCENT_OFF: offer.percentOff,
                EXPIRES_AT: expiresAtText,
                UNSUBSCRIBE_URL: unsubscribeUrl,
              },
	          })) {
	            noteEmailSent();
	          }
	        }

        bump('plans_offer_50');
      }
    }

    // Dunning: subscription payment failed (D0/D1/D3/D7/D14).
    // Transactional: does NOT require marketing opt-in.
    {
      const dunningEnabled = (process.env.DUNNING_ENABLED || '0').trim() === '1';
      if (emailAutomationsEnabled && dunningEnabled && canSendEmail()) {
        const lookbackDays = Math.max(
          7,
          Math.min(120, Math.floor(parseNumber(process.env.DUNNING_LOOKBACK_DAYS, 30))),
        );

        const rows = await prisma.$queryRaw<
          Array<{ userId: number; failedAt: Date; provider: string | null; reason: string | null }>
        >(Prisma.sql`
          SELECT
            ae.user_id AS userId,
            ae.event_ts AS failedAt,
            JSON_UNQUOTE(JSON_EXTRACT(ae.metadata_json, '$.provider')) AS provider,
            JSON_UNQUOTE(JSON_EXTRACT(ae.metadata_json, '$.reason')) AS reason
          FROM analytics_events ae
          INNER JOIN (
            SELECT ae.user_id, MAX(ae.event_ts) AS max_ts
            FROM analytics_events ae
            WHERE ae.event_name = 'payment_failed'
              AND ae.user_id IS NOT NULL
              AND ae.event_ts >= DATE_SUB(NOW(), INTERVAL ${lookbackDays} DAY)
              AND JSON_UNQUOTE(JSON_EXTRACT(ae.metadata_json, '$.provider')) IN ('stripe', 'paypal')
              AND JSON_UNQUOTE(JSON_EXTRACT(ae.metadata_json, '$.reason')) IN (
                'past_due',
                'billing_subscription_payment_failed',
                'payment_sale_denied'
              )
              ${ANALYTICS_PUBLIC_TRAFFIC_FILTER_AE_SQL}
            GROUP BY ae.user_id
          ) last
            ON last.user_id = ae.user_id
            AND last.max_ts = ae.event_ts
          LEFT JOIN users u
            ON u.id = ae.user_id
          LEFT JOIN orders o_paid
            ON o_paid.user_id = ae.user_id
            AND o_paid.is_plan = 1
            AND o_paid.status = 1
            AND o_paid.date_order > ae.event_ts
          WHERE u.blocked = 0
            ${ANALYTICS_PUBLIC_TRAFFIC_FILTER_AE_SQL}
            AND o_paid.id IS NULL
          ORDER BY ae.event_ts DESC
          LIMIT ${limit}
        `);

        const now = new Date();

        for (const row of rows) {
          if (!canSendEmail()) break;
          const user = await prisma.users.findFirst({
            where: { id: row.userId },
            select: { id: true, email: true, username: true, blocked: true },
          });
          if (!user || user.blocked) continue;

          const stageDays = computeDunningStageDays(row.failedAt, now);
          if (stageDays == null) continue;

          // Idempotency: do not send the same stage more than once.
          const { created } = await createActionLog({
            prisma,
            userId: user.id,
            actionKey: 'dunning_payment_failed',
            stage: stageDays,
            channel: 'system',
            metadata: {
              provider: row.provider ?? null,
              reason: row.reason ?? null,
              failedAt: row.failedAt.toISOString(),
            },
          });
          if (!created) continue;

          // Include the latest known access end date (if any) for urgency.
          let accessUntilText: string | null = null;
          try {
            const lastAccess = await prisma.descargasUser.findFirst({
              where: { user_id: user.id },
              orderBy: [{ date_end: 'desc' }, { id: 'desc' }],
              select: { date_end: true },
            });
            if (lastAccess?.date_end instanceof Date) {
              accessUntilText = lastAccess.date_end.toISOString().slice(0, 10);
            }
          } catch {
            // ignore
          }

          const accountUrl = appendQueryParams(`${resolveClientUrl()}/micuenta`, {
            utm_source: 'email',
            utm_medium: 'transactional',
            utm_campaign: `dunning_d${stageDays}`,
            utm_content: 'cta_account',
          });

          // Prefer a direct portal link for Stripe, else fall back to account page.
          const ctaUrl =
            row.provider === 'stripe'
              ? buildStripeBillingPortalUrl({ userId: user.id }) || accountUrl
              : accountUrl;

          const tpl = emailTemplates.dunningPaymentFailed({
            name: user.username,
            ctaUrl,
            stageDays,
            accessUntil: accessUntilText,
            supportUrl: accountUrl,
          });

          if (await safeSendAutomationEmail({
            prisma,
            userId: user.id,
            actionKey: 'dunning_payment_failed',
            stage: stageDays,
            toEmail: user.email,
            subject: tpl.subject,
            html: tpl.html,
            text: tpl.text,
            templateKey: `automation_dunning_payment_failed_d${stageDays}`,
            templateVariables: {
              NAME: user.username,
              CTA_URL: ctaUrl,
              STAGE_DAYS: stageDays,
              ACCESS_UNTIL: accessUntilText,
              SUPPORT_URL: accountUrl,
            },
          })) {
            noteEmailSent();
          }
          bump(`dunning_d${stageDays}`);
        }
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
