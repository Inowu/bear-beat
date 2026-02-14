import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import { log } from '../server';
import { emailTemplates } from './templates';
import { isSesConfigured, sendSesEmail, type SendSesEmailParams } from './ses';
import { buildMarketingUnsubscribeUrl } from '../comms/unsubscribe';

type EmailDeliveryMode = 'ses' | 'sink';

const isProductionRuntime = (): boolean => {
  const nodeEnv = String(process.env.NODE_ENV || '').trim().toLowerCase();
  if (nodeEnv !== 'production') return false;
  const sentryEnv = String(process.env.SENTRY_ENVIRONMENT || '').trim().toLowerCase();
  return !sentryEnv || sentryEnv === 'production';
};

const resolveEmailDeliveryMode = (): EmailDeliveryMode => {
  const raw = String(process.env.EMAIL_DELIVERY_MODE || '').trim().toLowerCase();
  const requested: EmailDeliveryMode | null = raw === 'ses' ? 'ses' : raw === 'sink' ? 'sink' : null;

  // Safety: never allow real sends outside production runtimes.
  if (!isProductionRuntime()) return 'sink';

  return requested ?? 'ses';
};

export const isEmailConfigured = (): boolean => {
  const mode = resolveEmailDeliveryMode();
  if (mode === 'sink') return true;
  return isSesConfigured();
};

const writeSinkEmail = async (params: SendSesEmailParams): Promise<string | null> => {
  const dir = String(process.env.EMAIL_SINK_DIR || '').trim();
  if (!dir) return null;

  try {
    await fs.mkdir(dir, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const id = crypto.randomBytes(6).toString('hex');
    const file = path.join(dir, `email-${stamp}-${id}.json`);
    const payload = {
      createdAt: new Date().toISOString(),
      // Intentionally omit recipient addresses (PII). Keep only counts.
      toCount: Array.isArray(params.to) ? params.to.length : 0,
      replyToCount: Array.isArray(params.replyTo) ? params.replyTo.length : 0,
      subject: params.subject,
      html: params.html ?? null,
      text: params.text ?? null,
    };
    await fs.writeFile(file, JSON.stringify(payload, null, 2), 'utf8');
    return file;
  } catch {
    return null;
  }
};

const resolveClientUrl = (): string => {
  const raw = (process.env.CLIENT_URL || 'https://thebearbeat.com').trim();
  return raw.replace(/\/+$/, '');
};

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

export async function sendEmail(params: SendSesEmailParams): Promise<{ messageId: string | null }> {
  const mode = resolveEmailDeliveryMode();

  if (mode === 'sink') {
    const sinkFile = await writeSinkEmail(params);
    log.info('[EMAIL] Sink delivery (no real send)', {
      mode,
      recipientCount: Array.isArray(params.to) ? params.to.length : 0,
      sinkFile,
    });
    return { messageId: null };
  }

  if (!isSesConfigured()) {
    log.warn('[EMAIL] SES not configured; skipping email send', {
      mode,
      recipientCount: Array.isArray(params.to) ? params.to.length : 0,
    });
    return { messageId: null };
  }

  return sendSesEmail(params);
}

export async function sendWelcomeEmail(params: { userId: number; toEmail: string; toName: string; toAccountEmail: string }): Promise<void> {
  const { userId, toEmail, toName, toAccountEmail } = params;
  try {
    const unsubscribeUrl = buildMarketingUnsubscribeUrl(userId) ?? undefined;
    const base = resolveClientUrl();
    const plansUrl = appendQueryParams(`${base}/planes`, {
      utm_source: 'email',
      utm_medium: 'transactional',
      utm_campaign: 'welcome',
      utm_content: 'cta_plans',
    });
    const accountUrl = appendQueryParams(`${base}/micuenta`, {
      utm_source: 'email',
      utm_medium: 'transactional',
      utm_campaign: 'welcome',
      utm_content: 'link_account',
    });
    const tpl = emailTemplates.welcome({
      name: toName,
      email: toAccountEmail,
      plansUrl,
      accountUrl,
      unsubscribeUrl,
    });
    await sendEmail({ to: [toEmail], subject: tpl.subject, html: tpl.html, text: tpl.text });
  } catch (e) {
    log.warn('[EMAIL] Welcome email failed (non-blocking)', {
      userId,
      error: e instanceof Error ? e.message : e,
    });
  }
}

export async function sendPasswordResetEmail(params: { userId: number; toEmail: string; toName: string; toAccountEmail: string; link: string }): Promise<void> {
  const { userId, toEmail, toName, toAccountEmail, link } = params;
  try {
    const unsubscribeUrl = buildMarketingUnsubscribeUrl(userId) ?? undefined;
    const tpl = emailTemplates.passwordReset({ name: toName, email: toAccountEmail, link, unsubscribeUrl });
    await sendEmail({ to: [toEmail], subject: tpl.subject, html: tpl.html, text: tpl.text });
  } catch (e) {
    log.warn('[EMAIL] Password reset email failed (non-blocking)', {
      userId,
      error: e instanceof Error ? e.message : e,
    });
  }
}

export async function sendPlanActivatedEmail(params: { userId: number; toEmail: string; toName: string; planName: string; price: unknown; currency: string; orderId: unknown }): Promise<void> {
  const { userId, toEmail, toName, planName, price, currency, orderId } = params;
  try {
    const unsubscribeUrl = buildMarketingUnsubscribeUrl(userId) ?? undefined;
    const base = resolveClientUrl();
    const catalogUrl = appendQueryParams(`${base}/descargas`, {
      utm_source: 'email',
      utm_medium: 'transactional',
      utm_campaign: 'plan_activated',
      utm_content: 'cta_catalog',
    });
    const accountUrl = appendQueryParams(`${base}/micuenta`, {
      utm_source: 'email',
      utm_medium: 'transactional',
      utm_campaign: 'plan_activated',
      utm_content: 'link_account',
    });
    const tpl = emailTemplates.planActivated({
      name: toName,
      planName,
      price,
      currency,
      orderId,
      catalogUrl,
      accountUrl,
      unsubscribeUrl,
    });
    await sendEmail({ to: [toEmail], subject: tpl.subject, html: tpl.html, text: tpl.text });
  } catch (e) {
    log.warn('[EMAIL] Plan activated email failed (non-blocking)', {
      userId,
      error: e instanceof Error ? e.message : e,
    });
  }
}

export async function sendCancellationConfirmedEmail(params: {
  userId: number;
  toEmail: string;
  toName: string;
  planName: string;
  accessUntil: string;
}): Promise<void> {
  const { userId, toEmail, toName, planName, accessUntil } = params;
  try {
    const base = resolveClientUrl();
    const reactivateUrl = appendQueryParams(`${base}/planes`, {
      utm_source: 'email',
      utm_medium: 'transactional',
      utm_campaign: 'cancel_confirmed',
      utm_content: 'cta_reactivate',
    });
    const accountUrl = appendQueryParams(`${base}/micuenta`, {
      utm_source: 'email',
      utm_medium: 'transactional',
      utm_campaign: 'cancel_confirmed',
      utm_content: 'link_account',
    });
    const tpl = emailTemplates.cancellationConfirmed({
      name: toName,
      planName,
      accessUntil,
      accountUrl,
      reactivateUrl,
    });
    await sendEmail({ to: [toEmail], subject: tpl.subject, html: tpl.html, text: tpl.text });
  } catch (e) {
    log.warn('[EMAIL] Cancellation confirmed email failed (non-blocking)', {
      userId,
      error: e instanceof Error ? e.message : e,
    });
  }
}

export async function sendCancellationEndingSoonEmail(params: {
  userId: number;
  toEmail: string;
  toName: string;
  accessUntil: string;
}): Promise<void> {
  const { userId, toEmail, toName, accessUntil } = params;
  try {
    const base = resolveClientUrl();
    const reactivateUrl = appendQueryParams(`${base}/planes`, {
      utm_source: 'email',
      utm_medium: 'transactional',
      utm_campaign: 'cancel_ending_soon',
      utm_content: 'cta_reactivate',
    });
    const accountUrl = appendQueryParams(`${base}/micuenta`, {
      utm_source: 'email',
      utm_medium: 'transactional',
      utm_campaign: 'cancel_ending_soon',
      utm_content: 'link_account',
    });
    const tpl = emailTemplates.cancellationEndingSoon({
      name: toName,
      accessUntil,
      accountUrl,
      reactivateUrl,
    });
    await sendEmail({ to: [toEmail], subject: tpl.subject, html: tpl.html, text: tpl.text });
  } catch (e) {
    log.warn('[EMAIL] Cancellation ending soon email failed (non-blocking)', {
      userId,
      error: e instanceof Error ? e.message : e,
    });
  }
}
