import { log } from '../server';
import { emailTemplates } from './templates';
import { isSesConfigured, sendSesEmail, type SendSesEmailParams } from './ses';

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

export async function sendWelcomeEmail(params: { toEmail: string; toName: string; toAccountEmail: string }): Promise<void> {
  const { toEmail, toName, toAccountEmail } = params;
  try {
    const tpl = emailTemplates.welcome({ name: toName, email: toAccountEmail });
    await sendEmail({ to: [toEmail], subject: tpl.subject, html: tpl.html, text: tpl.text });
  } catch (e) {
    log.warn('[EMAIL] Welcome email failed (non-blocking)', {
      toEmail,
      error: e instanceof Error ? e.message : e,
    });
  }
}

export async function sendPasswordResetEmail(params: { toEmail: string; toName: string; toAccountEmail: string; link: string }): Promise<void> {
  const { toEmail, toName, toAccountEmail, link } = params;
  try {
    const tpl = emailTemplates.passwordReset({ name: toName, email: toAccountEmail, link });
    await sendEmail({ to: [toEmail], subject: tpl.subject, html: tpl.html, text: tpl.text });
  } catch (e) {
    log.warn('[EMAIL] Password reset email failed (non-blocking)', {
      toEmail,
      error: e instanceof Error ? e.message : e,
    });
  }
}

export async function sendPlanActivatedEmail(params: { toEmail: string; toName: string; planName: string; price: unknown; currency: string; orderId: unknown }): Promise<void> {
  const { toEmail, toName, planName, price, currency, orderId } = params;
  try {
    const tpl = emailTemplates.planActivated({
      name: toName,
      planName,
      price,
      currency,
      orderId,
    });
    await sendEmail({ to: [toEmail], subject: tpl.subject, html: tpl.html, text: tpl.text });
  } catch (e) {
    log.warn('[EMAIL] Plan activated email failed (non-blocking)', {
      toEmail,
      error: e instanceof Error ? e.message : e,
    });
  }
}
