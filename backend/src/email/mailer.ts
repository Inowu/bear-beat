import { log } from '../server';
import { emailTemplates } from './templates';
import { isSesConfigured, sendSesEmail, type SendSesEmailParams } from './ses';
import { buildMarketingUnsubscribeUrl } from '../comms/unsubscribe';

export const isEmailConfigured = (): boolean => isSesConfigured();

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
  if (!isSesConfigured()) {
    log.warn('[EMAIL] SES not configured; skipping email send', {
      to: params.to,
      subject: params.subject,
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
      toEmail,
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
      toEmail,
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
      toEmail,
      error: e instanceof Error ? e.message : e,
    });
  }
}
