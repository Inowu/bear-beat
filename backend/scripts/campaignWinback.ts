import fs from 'fs';
import path from 'path';
import { Prisma } from '@prisma/client';
import './_loadEnv';
import { prisma } from '../src/db';
import { isEmailConfigured, sendEmail } from '../src/email';
import { emailTemplates } from '../src/email/templates';
import { buildMarketingUnsubscribeUrl } from '../src/comms/unsubscribe';
import { OFFER_KEYS, upsertUserOfferAndCoupon } from '../src/offers';

type Segment = 'lapsed' | 'never_paid';

type LapsedRow = { userId: number; email: string; username: string; lastEndedAt: Date };
type NeverPaidRow = { userId: number; email: string; username: string; registeredOn: Date };

const resolveClientUrl = (): string => (process.env.CLIENT_URL || 'https://thebearbeat.com').trim().replace(/\/+$/, '');

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

const parseNumber = (raw: string | null, fallback: number): number => {
  const n = Number(raw);
  if (!Number.isFinite(n)) return fallback;
  return n;
};

const parseBool = (raw: string | null, fallback: boolean): boolean => {
  if (raw == null) return fallback;
  const normalized = `${raw}`.trim().toLowerCase();
  if (['1', 'true', 'yes', 'y', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'n', 'off'].includes(normalized)) return false;
  return fallback;
};

const takeArgValue = (args: string[], flag: string): string | null => {
  const prefix = `${flag}=`;
  for (let i = 0; i < args.length; i += 1) {
    const arg = String(args[i] ?? '').trim();
    if (!arg) continue;
    if (arg.startsWith(prefix)) return arg.slice(prefix.length).trim();
    if (arg === flag) return String(args[i + 1] ?? '').trim();
  }
  return null;
};

async function createActionLog(params: {
  userId: number;
  actionKey: string;
  stage: number;
  channel: string;
  metadata?: Prisma.JsonObject;
}): Promise<{ created: boolean; id: number | null }> {
  const { userId, actionKey, stage, channel, metadata } = params;
  try {
    const created = await prisma.automationActionLog.create({
      data: {
        user_id: userId,
        action_key: actionKey,
        stage,
        channel,
        provider_message_id: null,
        metadata_json: metadata,
      },
      select: { id: true },
    });
    return { created: true, id: created.id };
  } catch (e: any) {
    if (e?.code === 'P2002') {
      return { created: false, id: null };
    }
    throw e;
  }
}

function toCsv(value: unknown): string {
  const str = String(value ?? '');
  const escaped = str.replace(/"/g, '""');
  return `"${escaped}"`;
}

async function queryLapsed(params: {
  limit: number;
  lookbackDays: number;
  minLapsedDays: number;
  stage: number;
}): Promise<LapsedRow[]> {
  const { limit, lookbackDays, minLapsedDays, stage } = params;
  return prisma.$queryRaw<LapsedRow[]>(Prisma.sql`
    SELECT
      u.id AS userId,
      u.email AS email,
      u.username AS username,
      MAX(du.date_end) AS lastEndedAt
    FROM descargas_user du
    INNER JOIN users u
      ON u.id = du.user_id
    LEFT JOIN automation_action_logs aal
      ON aal.user_id = u.id
      AND aal.action_key = 'winback_lapsed'
      AND aal.stage = ${stage}
    WHERE u.blocked = 0
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
    HAVING lastEndedAt < DATE_SUB(NOW(), INTERVAL ${minLapsedDays} DAY)
      AND lastEndedAt >= DATE_SUB(NOW(), INTERVAL ${lookbackDays} DAY)
    ORDER BY lastEndedAt DESC
    LIMIT ${limit}
  `);
}

async function queryNeverPaid(params: {
  limit: number;
  lookbackDays: number;
  minRegisteredDays: number;
  stage: number;
}): Promise<NeverPaidRow[]> {
  const { limit, lookbackDays, minRegisteredDays, stage } = params;
  return prisma.$queryRaw<NeverPaidRow[]>(Prisma.sql`
    SELECT
      u.id AS userId,
      u.email AS email,
      u.username AS username,
      u.registered_on AS registeredOn
    FROM users u
    LEFT JOIN orders o
      ON o.user_id = u.id
      AND o.status = 1
      AND o.is_plan = 1
    LEFT JOIN descargas_user du
      ON du.user_id = u.id
      AND du.date_end > NOW()
    LEFT JOIN automation_action_logs aal_offer
      ON aal_offer.user_id = u.id
      AND aal_offer.action_key = 'registered_no_purchase_offer'
      AND aal_offer.stage = ${stage}
    LEFT JOIN automation_action_logs aal_auto
      ON aal_auto.user_id = u.id
      AND aal_auto.action_key = 'registered_no_purchase'
      AND aal_auto.stage = 7
    WHERE u.blocked = 0
      AND u.email_marketing_opt_in = 1
      AND aal_offer.id IS NULL
      AND (${stage} > 1 OR aal_auto.id IS NULL)
      AND u.verified = 1
      AND u.registered_on < DATE_SUB(NOW(), INTERVAL ${minRegisteredDays} DAY)
      AND u.registered_on >= DATE_SUB(NOW(), INTERVAL ${lookbackDays} DAY)
      AND o.id IS NULL
      AND du.id IS NULL
    ORDER BY u.registered_on DESC
    LIMIT ${limit}
  `);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const segmentRaw = (takeArgValue(args, '--segment') || 'lapsed').trim() as Segment;
  const segment: Segment = segmentRaw === 'never_paid' ? 'never_paid' : 'lapsed';

  const limit = Math.max(1, Math.min(10_000, Math.floor(parseNumber(takeArgValue(args, '--limit'), 500))));
  const lookbackDays = Math.max(1, Math.min(3650, Math.floor(parseNumber(takeArgValue(args, '--lookbackDays'), 365))));
  const minDays = Math.max(0, Math.min(3650, Math.floor(parseNumber(takeArgValue(args, '--minDays'), segment === 'lapsed' ? 3 : 7))));
  const percentOffDefault = segment === 'lapsed' ? 50 : 30;
  const percentOff = Math.max(1, Math.min(99, Math.floor(parseNumber(takeArgValue(args, '--percentOff'), percentOffDefault))));
  const expiresDays = Math.max(1, Math.min(30, Math.floor(parseNumber(takeArgValue(args, '--expiresDays'), 3))));
  const stage = Math.max(1, Math.min(99, Math.floor(parseNumber(takeArgValue(args, '--stage'), 1))));
  const shouldSend = parseBool(takeArgValue(args, '--send'), false) || args.includes('--send');

  const base = resolveClientUrl();
  const now = new Date();
  const expiresAt = new Date(Date.now() + expiresDays * 24 * 60 * 60 * 1000);
  const expiresAtText = `${expiresAt.toISOString().replace('T', ' ').slice(0, 16)} UTC`;

  const outDir = path.resolve(__dirname, '..', '..', 'output');
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, `campaign-${segment}-${now.toISOString().slice(0, 10)}.csv`);

  let rows: Array<LapsedRow | NeverPaidRow> = [];
  if (segment === 'lapsed') {
    rows = await queryLapsed({ limit, lookbackDays, minLapsedDays: minDays, stage });
  } else {
    rows = await queryNeverPaid({ limit, lookbackDays, minRegisteredDays: minDays, stage });
  }

  const csvHeader =
    segment === 'lapsed'
      ? ['userId', 'email', 'username', 'lastEndedAt'].map(toCsv).join(',')
      : ['userId', 'email', 'username', 'registeredOn'].map(toCsv).join(',');
  const csvLines = [csvHeader];
  for (const row of rows as any[]) {
    const line =
      segment === 'lapsed'
        ? [row.userId, row.email, row.username, row.lastEndedAt?.toISOString?.() ?? ''].map(toCsv).join(',')
        : [row.userId, row.email, row.username, row.registeredOn?.toISOString?.() ?? ''].map(toCsv).join(',');
    csvLines.push(line);
  }
  fs.writeFileSync(outPath, `${csvLines.join('\n')}\n`, 'utf8');

  // eslint-disable-next-line no-console
  console.log(`[CAMPAIGN] Segment=${segment} found=${rows.length} csv=${outPath}`);

  if (!shouldSend) return;
  if ((process.env.EMAIL_AUTOMATIONS_ENABLED || '1').trim() === '0') {
    // eslint-disable-next-line no-console
    console.log('[CAMPAIGN] EMAIL_AUTOMATIONS_ENABLED=0; refusing to send campaign emails.');
    return;
  }
  if (!isEmailConfigured()) {
    throw new Error('Email (SES) is not configured. Missing AWS_REGION/SES_FROM_EMAIL (or credentials).');
  }

  let sent = 0;
  let skipped = 0;
  let failed = 0;

  for (const row of rows as any[]) {
    const userId = Number(row.userId);
    if (!userId) continue;

    const actionKey = segment === 'lapsed' ? 'winback_lapsed' : 'registered_no_purchase_offer';
    const { created, id: actionLogId } = await createActionLog({
      userId,
      actionKey,
      stage,
      channel: 'system',
      metadata:
        segment === 'lapsed'
          ? { segment, percentOff, expiresDays, lastEndedAt: row.lastEndedAt?.toISOString?.() ?? null }
          : { segment, percentOff, expiresDays, registeredOn: row.registeredOn?.toISOString?.() ?? null },
    });

    if (!created || !actionLogId) {
      skipped += 1;
      continue;
    }

    try {
      const offer = await upsertUserOfferAndCoupon({
        prisma,
        userId,
        offerKey: segment === 'lapsed' ? OFFER_KEYS.WINBACK_LAPSED : OFFER_KEYS.REGISTERED_NO_PURCHASE,
        stage,
        percentOff,
        expiresAt,
      });

      const unsubscribeUrl = buildMarketingUnsubscribeUrl(userId) ?? undefined;
      const url = appendQueryParams(`${base}/planes`, {
        utm_source: 'email',
        utm_medium: 'campaign',
        utm_campaign: segment === 'lapsed' ? `winback_lapsed_${offer.percentOff}` : `registered_no_purchase_${offer.percentOff}`,
        utm_content: 'cta',
      });

      const tpl =
        segment === 'lapsed'
          ? emailTemplates.winbackLapsedOffer({
              name: row.username,
              url,
              couponCode: offer.couponCode ?? '',
              percentOff: offer.percentOff,
              expiresAt: expiresAtText,
              unsubscribeUrl,
            })
          : emailTemplates.registeredNoPurchaseOffer({
              name: row.username,
              url,
              couponCode: offer.couponCode ?? '',
              percentOff: offer.percentOff,
              expiresAt: expiresAtText,
              unsubscribeUrl,
            });

      const result = await sendEmail({
        to: [row.email],
        subject: tpl.subject,
        html: tpl.html,
        text: tpl.text,
      });

      prisma.automationActionLog
        .update({
          where: { id: actionLogId },
          data: {
            channel: 'email',
            provider_message_id: result.messageId ?? null,
          },
          select: { id: true },
        })
        .catch(() => {});

      sent += 1;
      // eslint-disable-next-line no-console
      console.log(`[CAMPAIGN] Sent userId=${userId} segment=${segment} messageId=${result.messageId ?? 'n/a'}`);
    } catch (e) {
      failed += 1;
      // Allow retry on next run by removing the dedupe log.
      prisma.automationActionLog.delete({ where: { id: actionLogId } }).catch(() => {});
      // eslint-disable-next-line no-console
      console.warn(`[CAMPAIGN] Failed userId=${userId} segment=${segment}`, e instanceof Error ? e.message : e);
    }
  }

  // eslint-disable-next-line no-console
  console.log(`[CAMPAIGN] Done segment=${segment} sent=${sent} skipped=${skipped} failed=${failed}`);
}

main()
  .catch((error) => {
    // eslint-disable-next-line no-console
    console.error('[CAMPAIGN] Fatal', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect().catch(() => {});
  });
