import { Request, Response } from 'express';
import { verifyConektaSignature } from '../../routers/utils/verifyConektaSignature';
import { log } from '../../server';
import { parseWebhookPayload, extractWebhookIdentity } from '../../webhookInbox/intake';
import { persistEvent } from '../../services/webhookInbox';
import { enqueueWebhookInboxJob } from '../../queues/webhookInbox.queue';
import { markWebhookInboxEventEnqueued } from '../../webhookInbox/service';

const getHeaderValue = (value: string | string[] | undefined): string => {
  if (Array.isArray(value)) {
    return typeof value[0] === 'string' ? value[0] : '';
  }

  return typeof value === 'string' ? value : '';
};

const resolveConektaWebhookPublicKey = (): string => {
  const configuredPublicKey = String(
    process.env.CONEKTA_WEBHOOK_PUBLIC_KEY || '',
  ).trim();
  if (configuredPublicKey) return configuredPublicKey;

  const preferLive = process.env.NODE_ENV === 'production';
  const candidates = preferLive
    ? [process.env.CONEKTA_SIGNED_KEY, process.env.CONEKTA_SIGNED_TEST_KEY]
    : [process.env.CONEKTA_SIGNED_TEST_KEY, process.env.CONEKTA_SIGNED_KEY];

  for (const candidate of candidates) {
    const normalized = String(candidate || '').trim();
    if (normalized) return normalized;
  }

  return '';
};

export const conektaEndpoint = async (req: Request, res: Response) => {
  const isProduction = process.env.NODE_ENV === 'production';

  if (!Buffer.isBuffer(req.body)) {
    log.warn('[CONEKTA_WH] Expected raw Buffer body but received non-buffer payload.');
    return res.status(400).send('Invalid webhook payload');
  }

  const digestHeader = getHeaderValue(req.headers.digest);
  const publicKeyPem = resolveConektaWebhookPublicKey();
  const isValidSignature = verifyConektaSignature(
    req.body,
    digestHeader,
    publicKeyPem,
  );

  if (!isValidSignature) {
    return res.status(isProduction ? 401 : 400).send('Invalid signature');
  }

  let parsedPayload: ReturnType<typeof parseWebhookPayload>;
  try {
    parsedPayload = parseWebhookPayload(req.body);
  } catch (error) {
    log.warn('[CONEKTA_WH] Invalid JSON payload', {
      error: error instanceof Error ? error.message : String(error ?? ''),
    });
    return res.status(400).send('Invalid JSON payload');
  }

  const identity = extractWebhookIdentity('conekta', parsedPayload.payload);
  if (!identity) {
    return res.status(400).send('Invalid webhook payload');
  }

  try {
    const persisted = await persistEvent({
      provider: 'conekta',
      eventId: identity.eventId,
      eventType: identity.eventType,
      livemode: identity.livemode,
      headers: req.headers as Record<string, unknown>,
      payloadRaw: parsedPayload.rawPayload,
    });

    log.info('[CONEKTA_WH] Inbox transition', {
      provider: 'conekta',
      eventId: identity.eventId,
      eventType: identity.eventType,
      inboxId: persisted.inboxId,
      status: persisted.created ? 'RECEIVED' : 'DUPLICATE',
    });

    if (!persisted.created) {
      return res.status(200).end();
    }

    const queued = await enqueueWebhookInboxJob({ inboxId: persisted.inboxId });
    if (queued) {
      await markWebhookInboxEventEnqueued(persisted.inboxId);
      log.info('[CONEKTA_WH] Inbox transition', {
        provider: 'conekta',
        eventId: identity.eventId,
        eventType: identity.eventType,
        inboxId: persisted.inboxId,
        status: 'ENQUEUED',
      });
    } else {
      log.warn('[CONEKTA_WH] Persisted webhook but enqueue failed', {
        provider: 'conekta',
        eventId: identity.eventId,
        eventType: identity.eventType,
        inboxId: persisted.inboxId,
      });
    }
  } catch (error) {
    log.error('[CONEKTA_WH] Failed to persist/enqueue webhook event', {
      provider: 'conekta',
      eventId: identity.eventId,
      eventType: identity.eventType,
      error: error instanceof Error ? error.message : String(error ?? ''),
    });
    return res.status(500).send('Failed to persist webhook event');
  }

  return res.status(200).end();
};
