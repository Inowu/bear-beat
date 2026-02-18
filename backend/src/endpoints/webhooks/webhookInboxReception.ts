import type { Request } from 'express';
import { log } from '../../server';
import { enqueueWebhookInboxJob } from '../../queue/webhookInbox';
import {
  extractWebhookIdentity,
  parseWebhookPayload,
} from '../../webhookInbox/intake';
import {
  markWebhookInboxEventEnqueued,
  persistWebhookInboxEvent,
} from '../../webhookInbox/service';
import type { WebhookInboxProvider } from '../../webhookInbox/types';

type ReceptionResult =
  | { ok: true; duplicate: boolean }
  | { ok: false; status: number; message: string };

interface ReceiveWebhookIntoInboxInput {
  provider: WebhookInboxProvider;
  req: Request;
  logPrefix: string;
}

export const receiveWebhookIntoInbox = async ({
  provider,
  req,
  logPrefix,
}: ReceiveWebhookIntoInboxInput): Promise<ReceptionResult> => {
  let parsedPayload: ReturnType<typeof parseWebhookPayload>;

  try {
    parsedPayload = parseWebhookPayload(req.body);
  } catch (error) {
    log.warn(`[${logPrefix}] Invalid JSON payload`, {
      provider,
      error: error instanceof Error ? error.message : String(error ?? ''),
    });
    return {
      ok: false,
      status: 400,
      message: 'Invalid JSON payload',
    };
  }

  const identity = extractWebhookIdentity(provider, parsedPayload.payload);
  if (!identity) {
    log.warn(`[${logPrefix}] Missing event metadata in payload`, {
      provider,
    });
    return {
      ok: false,
      status: 400,
      message: 'Invalid webhook payload',
    };
  }

  try {
    const persisted = await persistWebhookInboxEvent({
      provider,
      req,
      identity,
      rawPayload: parsedPayload.rawPayload,
    });

    if (persisted.kind === 'duplicate') {
      log.info(`[${logPrefix}] Duplicate webhook event ignored`, {
        provider,
        eventType: identity.eventType,
        eventId: identity.eventId,
      });
      return { ok: true, duplicate: true };
    }

    const queued = await enqueueWebhookInboxJob({ inboxId: persisted.inboxId });
    if (queued) {
      await markWebhookInboxEventEnqueued(persisted.inboxId);
    } else {
      log.warn(`[${logPrefix}] Persisted webhook but enqueue failed`, {
        provider,
        inboxId: persisted.inboxId,
        eventType: identity.eventType,
        eventId: identity.eventId,
      });
    }

    return { ok: true, duplicate: false };
  } catch (error) {
    log.error(`[${logPrefix}] Failed to persist webhook event`, {
      provider,
      eventType: identity.eventType,
      eventId: identity.eventId,
      error: error instanceof Error ? error.message : String(error ?? ''),
    });
    return {
      ok: false,
      status: 500,
      message: 'Failed to persist webhook event',
    };
  }
};

