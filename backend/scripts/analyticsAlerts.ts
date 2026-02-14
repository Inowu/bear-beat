import path from 'path';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import { isEmailConfigured, sendEmail } from '../src/email';
import { emailTemplates } from '../src/email/templates';
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

    if (!isEmailConfigured()) {
      log.warn('[ANALYTICS_ALERTS] Alerts found but SES email is not configured.', {
        recipients,
      });
      return;
    }

    const textLines = actionable
      .map(
        (alert) =>
          `- [${formatSeverityEmoji(alert.severity)}] ${alert.title} | ${alert.metric}: ${alert.value} (umbral ${alert.threshold})\\n  ${alert.message}\\n  Reco: ${alert.recommendation}`,
      )
      .join('\\n\\n');

    const tpl = emailTemplates.analyticsAlerts({
      days,
      count: actionable.length,
      detailsText: textLines,
      generatedAt: snapshot.generatedAt,
    });

    await sendEmail({
      to: recipients,
      subject: tpl.subject,
      html: tpl.html,
      text: tpl.text,
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
