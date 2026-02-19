import crypto from 'crypto';
import { Prisma, type PrismaClient } from '@prisma/client';
import type { Request, Response } from 'express';
import { prisma } from '../../db';
import { log } from '../../server';

type SnsEnvelope = {
  Type?: string;
  MessageId?: string;
  Message?: string;
  SubscribeURL?: string;
  Timestamp?: string;
};

type SesNotificationPayload = {
  eventType?: string;
  mail?: {
    messageId?: string;
    timestamp?: string;
    tags?: Record<string, string[] | string>;
  };
  delivery?: { timestamp?: string };
  open?: { timestamp?: string };
  click?: { timestamp?: string };
  bounce?: { timestamp?: string };
  complaint?: { timestamp?: string };
};

type DeliveryStatus =
  | 'sent'
  | 'delivered'
  | 'opened'
  | 'clicked'
  | 'bounced'
  | 'complained'
  | 'failed';

const DELIVERY_STATUS_RANK: Record<string, number> = {
  created: 0,
  sent: 1,
  delivered: 2,
  opened: 3,
  clicked: 4,
  bounced: 5,
  complained: 6,
  failed: 7,
};

const parseBodyAsJsonObject = (body: unknown): Record<string, unknown> | null => {
  if (!body) return null;

  if (typeof body === 'string') {
    try {
      const parsed = JSON.parse(body);
      return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : null;
    } catch {
      return null;
    }
  }

  if (Buffer.isBuffer(body)) {
    try {
      const parsed = JSON.parse(body.toString('utf8'));
      return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : null;
    } catch {
      return null;
    }
  }

  if (typeof body === 'object') {
    return body as Record<string, unknown>;
  }

  return null;
};

const isDirectSesNotificationPayload = (
  value: Record<string, unknown>,
): value is SesNotificationPayload => {
  const eventType = value.eventType;
  const mail = value.mail as Record<string, unknown> | undefined;
  const messageId = mail?.messageId;

  return typeof eventType === 'string'
    && eventType.trim().length > 0
    && typeof messageId === 'string'
    && messageId.trim().length > 0;
};

const buildRawProviderEventId = (payload: Record<string, unknown>): string => {
  const digest = crypto
    .createHash('sha256')
    .update(JSON.stringify(payload))
    .digest('hex');

  return `raw_${digest}`.slice(0, 120);
};

const normalizeText = (value: unknown, max = 120): string | null => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, max);
};

const firstTag = (
  tags: Record<string, string[] | string> | undefined,
  key: string,
): string | null => {
  const raw = tags?.[key] ?? null;
  if (Array.isArray(raw)) {
    const first = normalizeText(raw[0], 120);
    return first;
  }
  return normalizeText(raw, 120);
};

const toDeliveryStatus = (eventTypeRaw: string): DeliveryStatus | null => {
  const normalized = eventTypeRaw.trim().toLowerCase().replace(/[\s_-]+/g, '');
  switch (normalized) {
    case 'send':
      return 'sent';
    case 'delivery':
      return 'delivered';
    case 'open':
      return 'opened';
    case 'click':
      return 'clicked';
    case 'bounce':
      return 'bounced';
    case 'complaint':
      return 'complained';
    case 'reject':
    case 'renderingfailure':
      return 'failed';
    default:
      return null;
  }
};

const parseEventDate = (...candidates: Array<string | null | undefined>): Date => {
  for (const raw of candidates) {
    if (!raw) continue;
    const parsed = new Date(raw);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return new Date();
};

const shouldAdvanceStatus = (current: string | null, incoming: DeliveryStatus): boolean => {
  const currentRank = DELIVERY_STATUS_RANK[current || ''] ?? -1;
  const incomingRank = DELIVERY_STATUS_RANK[incoming] ?? -1;
  return incomingRank >= currentRank;
};

const maybeAutoConfirmSubscription = async (envelope: SnsEnvelope): Promise<void> => {
  const autoConfirmEnabled = (process.env.SES_SNS_AUTO_CONFIRM || '1').trim() !== '0';
  if (!autoConfirmEnabled) return;
  const subscribeUrl = normalizeText(envelope.SubscribeURL, 2000);
  if (!subscribeUrl) return;
  try {
    await fetch(subscribeUrl, { method: 'GET' });
    log.info('[SES_SNS] Subscription confirmation requested');
  } catch (error) {
    log.warn('[SES_SNS] Failed to auto-confirm subscription', {
      error: error instanceof Error ? error.message : String(error ?? ''),
    });
  }
};

const insertEmailDeliveryEvent = async (db: PrismaClient, params: {
  providerEventId: string;
  providerMessageId: string;
  status: DeliveryStatus;
  eventTs: Date;
  templateKey: string | null;
  actionKey: string | null;
  stage: number | null;
}): Promise<void> => {
  try {
    await db.emailDeliveryEvent.create({
      data: {
        provider: 'ses',
        provider_event_id: params.providerEventId,
        provider_message_id: params.providerMessageId,
        event_type: params.status,
        event_ts: params.eventTs,
        template_key: params.templateKey,
        action_key: params.actionKey,
        stage: params.stage,
      },
      select: { id: true },
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError
      && error.code === 'P2002'
    ) {
      return;
    }
    throw error;
  }
};

const updateAutomationLogsByMessageId = async (
  db: PrismaClient,
  providerMessageId: string,
  nextStatus: DeliveryStatus,
): Promise<void> => {
  const rows = await db.automationActionLog.findMany({
    where: {
      provider_message_id: providerMessageId,
      channel: 'email',
    },
    select: {
      id: true,
      delivery_status: true,
    },
  });

  if (rows.length === 0) return;

  await Promise.all(
    rows.map(async (row) => {
      if (!shouldAdvanceStatus(row.delivery_status, nextStatus)) return;
      await db.automationActionLog.update({
        where: { id: row.id },
        data: { delivery_status: nextStatus },
        select: { id: true },
      });
    }),
  );
};

export const sesSnsEndpoint = async (req: Request, res: Response) => {
  const payloadRaw = parseBodyAsJsonObject(req.body);
  if (!payloadRaw) {
    return res.status(400).send('Invalid SNS payload');
  }

  let payload: SesNotificationPayload;
  let providerEventId: string | null = null;
  let envelopeTimestamp: string | undefined;

  if (isDirectSesNotificationPayload(payloadRaw)) {
    payload = payloadRaw;
    providerEventId = buildRawProviderEventId(payloadRaw);
  } else {
    const envelope: SnsEnvelope = {
      Type: normalizeText(payloadRaw.Type, 80) ?? undefined,
      MessageId: normalizeText(payloadRaw.MessageId, 120) ?? undefined,
      Message: typeof payloadRaw.Message === 'string' ? payloadRaw.Message : undefined,
      SubscribeURL: normalizeText(payloadRaw.SubscribeURL, 2000) ?? undefined,
      Timestamp: normalizeText(payloadRaw.Timestamp, 80) ?? undefined,
    };

    if (envelope.Type === 'SubscriptionConfirmation') {
      await maybeAutoConfirmSubscription(envelope);
      return res.status(200).end();
    }

    if (envelope.Type !== 'Notification') {
      return res.status(200).end();
    }

    if (!envelope.MessageId || !envelope.Message) {
      return res.status(400).send('Invalid SNS notification envelope');
    }

    try {
      payload = JSON.parse(envelope.Message) as SesNotificationPayload;
    } catch {
      return res.status(400).send('Invalid SES notification payload');
    }

    providerEventId = envelope.MessageId;
    envelopeTimestamp = envelope.Timestamp;
  }

  const eventTypeRaw = normalizeText(payload.eventType, 80);
  const status = eventTypeRaw ? toDeliveryStatus(eventTypeRaw) : null;
  const providerMessageId = normalizeText(payload.mail?.messageId, 120);
  if (!status || !providerMessageId || !providerEventId) {
    return res.status(200).end();
  }

  const tags = payload.mail?.tags;
  const templateKey = firstTag(tags, 'template_key');
  const actionKey = firstTag(tags, 'action_key');
  const stageRaw = firstTag(tags, 'stage');
  const stage = stageRaw != null ? Number(stageRaw) : Number.NaN;
  const safeStage = Number.isFinite(stage) ? Math.floor(stage) : null;

  const eventTs = parseEventDate(
    payload.delivery?.timestamp,
    payload.open?.timestamp,
    payload.click?.timestamp,
    payload.bounce?.timestamp,
    payload.complaint?.timestamp,
    payload.mail?.timestamp,
    envelopeTimestamp,
  );

  try {
    await insertEmailDeliveryEvent(prisma, {
      providerEventId,
      providerMessageId,
      status,
      eventTs,
      templateKey,
      actionKey,
      stage: safeStage,
    });

    await updateAutomationLogsByMessageId(prisma, providerMessageId, status);
  } catch (error) {
    log.error('[SES_SNS] Failed processing notification', {
      eventId: providerEventId,
      status,
      error: error instanceof Error ? error.message : String(error ?? ''),
    });
    return res.status(500).send('Failed processing SES notification');
  }

  return res.status(200).end();
};
