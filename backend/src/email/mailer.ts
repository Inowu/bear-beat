import { log } from '../server';
import { emailTemplates } from './templates';
import { isSesConfigured, sendSesEmail, type SendSesEmailParams } from './ses';
import { buildMarketingUnsubscribeUrl } from '../comms/unsubscribe';

export const isEmailConfigured = (): boolean => isSesConfigured();

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
    const tpl = emailTemplates.welcome({ name: toName, email: toAccountEmail, unsubscribeUrl });
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
    const tpl = emailTemplates.planActivated({
      name: toName,
      planName,
      price,
      currency,
      orderId,
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
