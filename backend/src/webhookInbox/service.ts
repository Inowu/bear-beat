import { Prisma } from '@prisma/client';
import type { Request } from 'express';
import type { Stripe } from 'stripe';
import { prisma } from '../db';
import { log } from '../server';
import { processStripeWebhookPayload } from '../routers/webhooks/stripe';
import { StripeEvents } from '../routers/webhooks/stripe/events';
import { processStripePaymentWebhookPayload } from '../routers/webhooks/stripe/paymentIntentsWh';
import { stripeProductsWebhook } from '../routers/webhooks/stripe/productsWh';
import { processPaypalWebhookPayload } from '../routers/webhooks/paypal';
import { processConektaWebhookPayload } from '../routers/webhooks/conekta';
import {
  computeBackoff,
  markFailed,
  markProcessed,
  markProcessing,
} from '../services/webhookInbox';
import type { WebhookInboxIdentity, WebhookInboxProvider } from './types';
import {
  hashWebhookPayload,
  serializeHeadersForStorage,
} from './intake';

const RETRYABLE_HTTP_STATUS = new Set([408, 425, 429, 500, 502, 503, 504]);
const NON_RETRYABLE_HTTP_STATUS = new Set([400, 401, 403, 404, 409, 410, 422]);
const RETRYABLE_ERROR_CODES = new Set([
  'ECONNABORTED',
  'ECONNRESET',
  'ENOTFOUND',
  'EAI_AGAIN',
  'ETIMEDOUT',
  'EPIPE',
  'ENETUNREACH',
]);
const STRIPE_SUBSCRIPTION_EVENTS = new Set<string>([
  StripeEvents.SUBSCRIPTION_CREATED,
  StripeEvents.SUBSCRIPTION_UPDATED,
  StripeEvents.SUBSCRIPTION_DELETED,
]);
const STRIPE_PAYMENT_EVENTS = new Set<string>([
  StripeEvents.PAYMENT_INTENT_SUCCEEDED,
  StripeEvents.PAYMENT_INTENT_FAILED,
  StripeEvents.INVOICE_PAYMENT_FAILED,
  StripeEvents.INVOICE_PAID,
  StripeEvents.CHECKOUT_SESSION_COMPLETED,
]);

interface PersistWebhookInboxEventInput {
  provider: WebhookInboxProvider;
  req: Request;
  identity: WebhookInboxIdentity;
  rawPayload: string;
}

export type PersistWebhookInboxEventResult =
  | { kind: 'created'; inboxId: number }
  | { kind: 'duplicate' };

type EnqueueInboxJobFn = (inboxId: number) => Promise<boolean>;

const toPositiveInt = (value: string | undefined, fallback: number): number => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.floor(parsed);
};

const maxAttempts = (): number => toPositiveInt(process.env.WEBHOOK_INBOX_MAX_ATTEMPTS, 12);
const sweeperBatchSize = (): number => toPositiveInt(process.env.WEBHOOK_INBOX_SWEEP_BATCH_SIZE, 100);
const sweeperStaleEnqueuedMs = (): number =>
  toPositiveInt(process.env.WEBHOOK_INBOX_STALE_ENQUEUED_MS, 5 * 60 * 1000);

const isUniqueProviderEventError = (error: unknown): boolean => {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) return false;
  // Prisma may expose either the unique fields or the unique index name in target.
  // We verify provider+event_id existence before treating it as duplicate.
  return error.code === 'P2002';
};

const toErrorMessage = (error: unknown): string => {
  const text =
    error instanceof Error
      ? `${error.name}: ${error.message}`
      : String(error ?? 'unknown_error');
  return text.slice(0, 4000);
};

const resolveHttpStatus = (error: unknown): number | null => {
  const status = (error as any)?.response?.status;
  return typeof status === 'number' ? status : null;
};

const isRetryableError = (error: unknown): boolean => {
  if (error instanceof SyntaxError) return false;

  const message = toErrorMessage(error).toLowerCase();
  if (message.includes('invalid json') || message.includes('empty webhook payload')) {
    return false;
  }

  const status = resolveHttpStatus(error);
  if (status !== null) {
    if (RETRYABLE_HTTP_STATUS.has(status)) return true;
    if (NON_RETRYABLE_HTTP_STATUS.has(status)) return false;
  }

  const errorCode = (error as any)?.code;
  if (typeof errorCode === 'string' && RETRYABLE_ERROR_CODES.has(errorCode)) {
    return true;
  }

  return true;
};

const dispatchInboxEvent = async (
  provider: WebhookInboxProvider,
  rawPayload: string,
): Promise<void> => {
  const req = { body: rawPayload } as Request;

  switch (provider) {
    case 'stripe':
    case 'stripe_pi':
      {
        const payload = JSON.parse(rawPayload) as Stripe.Event;
        if (STRIPE_SUBSCRIPTION_EVENTS.has(payload.type)) {
          await processStripeWebhookPayload(payload);
          return;
        }

        if (STRIPE_PAYMENT_EVENTS.has(payload.type)) {
          await processStripePaymentWebhookPayload(payload);
          return;
        }

        if (provider === 'stripe') {
          await processStripeWebhookPayload(payload);
          return;
        }

        await processStripePaymentWebhookPayload(payload);
      }
      return;
    case 'stripe_products':
      await stripeProductsWebhook(req);
      return;
    case 'paypal':
      await processPaypalWebhookPayload(JSON.parse(rawPayload));
      return;
    case 'conekta':
      await processConektaWebhookPayload(JSON.parse(rawPayload));
      return;
    default:
      throw new Error(`Unsupported webhook provider: ${provider}`);
  }
};

export const persistWebhookInboxEvent = async ({
  provider,
  req,
  identity,
  rawPayload,
}: PersistWebhookInboxEventInput): Promise<PersistWebhookInboxEventResult> => {
  const payloadHash = hashWebhookPayload(rawPayload);

  try {
    const event = await prisma.webhookInboxEvent.create({
      data: {
        provider,
        event_id: identity.eventId,
        event_type: identity.eventType,
        livemode: identity.livemode,
        status: 'RECEIVED',
        attempts: 0,
        headers_json: serializeHeadersForStorage(req),
        payload_raw: rawPayload,
        payload_hash: payloadHash,
      },
      select: { id: true },
    });

    return { kind: 'created', inboxId: event.id };
  } catch (error) {
    if (isUniqueProviderEventError(error)) {
      const existing = await prisma.webhookInboxEvent.findFirst({
        where: {
          provider,
          event_id: identity.eventId,
        },
        select: { id: true },
      });

      if (existing) return { kind: 'duplicate' };
    }
    throw error;
  }
};

export const markWebhookInboxEventEnqueued = async (
  inboxId: number,
): Promise<void> => {
  await prisma.webhookInboxEvent.updateMany({
    where: {
      id: inboxId,
      status: {
        in: ['RECEIVED', 'FAILED', 'ENQUEUED'],
      },
    },
    data: {
      status: 'ENQUEUED',
      next_retry_at: null,
    },
  });
};

export const processWebhookInboxEvent = async (
  inboxId: number,
): Promise<void> => {
  const event = await prisma.webhookInboxEvent.findUnique({
    where: { id: inboxId },
    select: {
      id: true,
      provider: true,
      status: true,
      attempts: true,
      payload_raw: true,
      event_id: true,
      event_type: true,
    },
  });

  if (!event) {
    log.warn('[WEBHOOK_INBOX] Event not found for processing', {
      inboxId,
    });
    return;
  }

  if (event.status === 'PROCESSED' || event.status === 'IGNORED') {
    return;
  }

  const claimed = await markProcessing(event.id);
  if (!claimed) {
    return;
  }

  log.info('[WEBHOOK_INBOX] Event processing transition', {
    provider: event.provider,
    eventId: event.event_id,
    eventType: event.event_type,
    inboxId: event.id,
    status: 'PROCESSING',
  });

  try {
    await dispatchInboxEvent(
      event.provider as WebhookInboxProvider,
      event.payload_raw,
    );

    await markProcessed(event.id);
    log.info('[WEBHOOK_INBOX] Event processing transition', {
      provider: event.provider,
      eventId: event.event_id,
      eventType: event.event_type,
      inboxId: event.id,
      status: 'PROCESSED',
    });
  } catch (error) {
    const attempt = event.attempts + 1;
    const retryable = isRetryableError(error);
    const canRetry = retryable && attempt < maxAttempts();
    const nextRetryAt = canRetry
      ? new Date(Date.now() + computeBackoff(attempt))
      : null;
    const status = canRetry ? 'FAILED' : 'IGNORED';
    await markFailed(event.id, error, nextRetryAt);

    log.warn('[WEBHOOK_INBOX] Event processing transition', {
      provider: event.provider,
      eventId: event.event_id,
      eventType: event.event_type,
      inboxId: event.id,
      attempts: attempt,
      status,
      retryable: canRetry,
    });
  }
};

export const sweepWebhookInboxEvents = async (
  enqueueJob: EnqueueInboxJobFn,
): Promise<{ scanned: number; enqueued: number }> => {
  const now = new Date();
  const staleCutoff = new Date(Date.now() - sweeperStaleEnqueuedMs());
  const dueEvents = await prisma.webhookInboxEvent.findMany({
    where: {
      OR: [
        { status: 'RECEIVED' },
        { status: 'FAILED', next_retry_at: { lte: now } },
        { status: 'ENQUEUED', updated_at: { lte: staleCutoff } },
      ],
    },
    orderBy: [{ received_at: 'asc' }, { id: 'asc' }],
    take: sweeperBatchSize(),
    select: { id: true },
  });

  let enqueued = 0;

  for (const event of dueEvents) {
    const queued = await enqueueJob(event.id);
    if (!queued) continue;
    enqueued += 1;
    await markWebhookInboxEventEnqueued(event.id);
  }

  if (enqueued > 0) {
    log.info('[WEBHOOK_INBOX] Sweeper re-enqueued events', {
      scanned: dueEvents.length,
      enqueued,
    });
  }

  return {
    scanned: dueEvents.length,
    enqueued,
  };
};
