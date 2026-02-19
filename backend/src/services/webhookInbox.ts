import { Prisma } from '@prisma/client';
import { createHash } from 'crypto';
import { prisma } from '../db';

export interface PersistWebhookInboxEventInput {
  provider: string;
  eventId: string;
  eventType: string;
  livemode: boolean | null;
  headers: Record<string, unknown>;
  payloadRaw: string;
}

export interface PersistWebhookInboxEventResult {
  created: boolean;
  inboxId: number;
}

const toPositiveInt = (value: string | undefined, fallback: number): number => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.floor(parsed);
};

const baseBackoffMs = (): number =>
  toPositiveInt(process.env.WEBHOOK_INBOX_RETRY_BASE_MS, 30_000);

const backoffCapMs = (): number =>
  toPositiveInt(process.env.WEBHOOK_INBOX_RETRY_CAP_MS, 6 * 60 * 60 * 1000);

const toErrorMessage = (error: unknown): string => {
  const text =
    error instanceof Error
      ? `${error.name}: ${error.message}`
      : String(error ?? 'unknown_error');
  return text.slice(0, 4000);
};

const normalizeHeaderValue = (value: unknown): Prisma.InputJsonValue | null => {
  if (Array.isArray(value)) {
    const normalized = value
      .map((entry) => String(entry ?? '').trim())
      .filter(Boolean);
    return normalized.length > 0 ? normalized : null;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed || null;
  }

  return null;
};

const serializeHeaders = (
  headers: Record<string, unknown>,
): Record<string, Prisma.InputJsonValue> => {
  const result: Record<string, Prisma.InputJsonValue> = {};

  Object.entries(headers || {}).forEach(([key, value]) => {
    const normalized = normalizeHeaderValue(value);
    if (normalized !== null) {
      result[key] = normalized;
    }
  });

  return result;
};

const isUniqueProviderEventError = (error: unknown): boolean => {
  const knownError = error as {
    code?: string;
    meta?: { target?: string[] | string };
  };
  // Prisma may return the unique target as ["provider","event_id"] or
  // as the index name string (e.g. "uniq_webhook_inbox_provider_event").
  // We resolve ambiguity by verifying existence with provider+event_id below.
  return knownError?.code === 'P2002';
};

export const computeBackoff = (attempts: number): number => {
  const safeAttempts = Number.isFinite(attempts)
    ? Math.max(1, Math.floor(attempts))
    : 1;
  const exponent = Math.max(0, safeAttempts - 1);
  const rawDelay = baseBackoffMs() * (2 ** exponent);
  return Math.min(backoffCapMs(), rawDelay);
};

export const persistEvent = async ({
  provider,
  eventId,
  eventType,
  livemode,
  headers,
  payloadRaw,
}: PersistWebhookInboxEventInput): Promise<PersistWebhookInboxEventResult> => {
  const normalizedProvider = String(provider || '').trim();
  const normalizedEventId = String(eventId || '').trim();
  const normalizedEventType = String(eventType || '').trim();
  const normalizedPayloadRaw = String(payloadRaw || '');
  const payloadHash = createHash('sha256')
    .update(normalizedPayloadRaw, 'utf8')
    .digest('hex');

  if (!normalizedProvider || !normalizedEventId || !normalizedEventType) {
    throw new Error('Missing webhook inbox identity fields');
  }

  return prisma.$transaction(async (tx) => {
    try {
      const created = await tx.webhookInboxEvent.create({
        data: {
          provider: normalizedProvider,
          event_id: normalizedEventId,
          event_type: normalizedEventType,
          livemode,
          status: 'RECEIVED',
          attempts: 0,
          next_retry_at: null,
          processed_at: null,
          last_error: null,
          headers_json: serializeHeaders(headers),
          payload_raw: normalizedPayloadRaw,
          payload_hash: payloadHash,
          processing_started_at: null,
        },
        select: { id: true },
      });

      return { created: true, inboxId: created.id };
    } catch (error) {
      if (!isUniqueProviderEventError(error)) throw error;

      const existing = await tx.webhookInboxEvent.findFirst({
        where: {
          provider: normalizedProvider,
          event_id: normalizedEventId,
        },
        select: { id: true },
      });

      if (!existing) throw error;
      return { created: false, inboxId: existing.id };
    }
  });
};

export const markProcessing = async (inboxId: number): Promise<boolean> => {
  const updated = await prisma.webhookInboxEvent.updateMany({
    where: {
      id: inboxId,
      status: {
        in: ['RECEIVED', 'FAILED', 'ENQUEUED'],
      },
    },
    data: {
      status: 'PROCESSING',
      processing_started_at: new Date(),
      next_retry_at: null,
    },
  });

  return updated.count > 0;
};

export const markProcessed = async (inboxId: number): Promise<void> => {
  await prisma.webhookInboxEvent.update({
    where: { id: inboxId },
    data: {
      status: 'PROCESSED',
      processed_at: new Date(),
      last_error: null,
      next_retry_at: null,
      processing_started_at: null,
    },
  });
};

export const markFailed = async (
  inboxId: number,
  error: unknown,
  nextRetryAt: Date | null,
): Promise<void> => {
  const status = nextRetryAt ? 'FAILED' : 'IGNORED';

  await prisma.webhookInboxEvent.update({
    where: { id: inboxId },
    data: {
      status,
      attempts: { increment: 1 },
      next_retry_at: nextRetryAt,
      last_error: toErrorMessage(error),
      processing_started_at: null,
      processed_at: status === 'IGNORED' ? new Date() : null,
    },
  });
};
