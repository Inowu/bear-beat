import path from 'path';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import { brevo } from '../src/email';
import { getAnalyticsHealthAlerts } from '../src/analytics';
import { log } from '../src/server';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const parseNumber = (value: string | undefined, fallback: number): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const resolveRecipientList = (raw: string | undefined): string[] =>
  (raw || '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);

const formatSeverityEmoji = (severity: string): string => {
  if (severity === 'critical') return 'CRITICAL';
  if (severity === 'warning') return 'WARNING';
  return 'INFO';
};

async function main(): Promise<void> {
  if (!process.env.DATABASE_URL) {
    log.info('[ANALYTICS_ALERTS] DATABASE_URL not configured. Skipping.');
    return;
  }

  const days = Math.max(7, Math.min(365, Math.floor(parseNumber(process.env.ANALYTICS_ALERTS_DAYS, 14))));
  const recipients = resolveRecipientList(process.env.ANALYTICS_ALERTS_EMAIL_TO);
  const templateIdRaw = (process.env.ANALYTICS_ALERTS_BREVO_TEMPLATE_ID || '').trim();
  const templateId = templateIdRaw ? Number(templateIdRaw) : null;

  const prisma = new PrismaClient();
  try {
    const snapshot = await getAnalyticsHealthAlerts(prisma, days);
    const actionable = snapshot.alerts.filter(
      (alert) => alert.severity === 'critical' || alert.severity === 'warning',
    );

    if (actionable.length === 0) {
      log.info('[ANALYTICS_ALERTS] No actionable alerts.');
      return;
    }

    if (recipients.length === 0) {
      log.warn('[ANALYTICS_ALERTS] Alerts found but ANALYTICS_ALERTS_EMAIL_TO is empty.', {
        alerts: actionable.map((alert) => alert.id),
      });
      return;
    }

    if (!process.env.BREVO_API_KEY) {
      log.warn('[ANALYTICS_ALERTS] Alerts found but BREVO_API_KEY is not configured.', {
        recipients,
      });
      return;
    }

    const subject = `[Bear Beat] Alerts de analytics (${actionable.length}) · ${days}d`;
    const textLines = actionable
      .map(
        (alert) =>
          `- [${formatSeverityEmoji(alert.severity)}] ${alert.title} | ${alert.metric}: ${alert.value} (umbral ${alert.threshold})\\n  ${alert.message}\\n  Reco: ${alert.recommendation}`,
      )
      .join('\\n\\n');

    const htmlContent = `
      <div style="font-family: Arial, sans-serif; line-height: 1.5;">
        <h2>Alerts de analytics (${actionable.length})</h2>
        <p>Ventana: últimos <strong>${days}</strong> días.</p>
        <pre style="white-space: pre-wrap; background: #f6f8fa; padding: 12px; border-radius: 10px;">${textLines}</pre>
        <p style="color:#666; font-size: 12px;">Generado: ${snapshot.generatedAt}</p>
      </div>
    `.trim();

    if (templateId && Number.isFinite(templateId) && templateId > 0) {
      await brevo.smtp.sendTransacEmail({
        templateId: Math.floor(templateId),
        to: recipients.map((email) => ({ email })),
        params: {
          DAYS: days,
          ALERTS_COUNT: actionable.length,
          GENERATED_AT: snapshot.generatedAt,
          ALERTS_TEXT: textLines,
        },
      });
      log.info('[ANALYTICS_ALERTS] Email sent via template.', {
        templateId: Math.floor(templateId),
        recipients,
        alerts: actionable.map((alert) => alert.id),
      });
      return;
    }

    const senderEmail =
      (process.env.ANALYTICS_ALERTS_EMAIL_FROM || process.env.BREVO_SENDER_EMAIL || '').trim();
    const senderName =
      (process.env.ANALYTICS_ALERTS_EMAIL_FROM_NAME || process.env.BREVO_SENDER_NAME || 'Bear Beat').trim();

    if (!senderEmail) {
      log.warn('[ANALYTICS_ALERTS] Missing sender email. Set ANALYTICS_ALERTS_EMAIL_FROM.', {
        recipients,
      });
      return;
    }

    await brevo.smtp.sendTransacEmail({
      sender: { email: senderEmail, name: senderName },
      to: recipients.map((email) => ({ email })),
      subject,
      htmlContent,
    });

    log.info('[ANALYTICS_ALERTS] Email sent.', {
      recipients,
      alerts: actionable.map((alert) => alert.id),
    });
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  log.error('[ANALYTICS_ALERTS] Script failed.', {
    error: error instanceof Error ? error.message : error,
  });
  process.exitCode = 1;
});

