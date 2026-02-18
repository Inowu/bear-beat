import { Request, Response } from 'express';
import { verifyPaypalSignature } from '../../routers/utils/verifyPaypalSignature';
import { log } from '../../server';
import { parseWebhookPayload, extractWebhookIdentity } from '../../webhookInbox/intake';
import { persistEvent } from '../../services/webhookInbox';
import { enqueueWebhookInboxJob } from '../../queues/webhookInbox.queue';
import { markWebhookInboxEventEnqueued } from '../../webhookInbox/service';

export const paypalEndpoint = async (req: Request, res: Response) => {
  const isValid = await verifyPaypalSignature(req);
  if (!isValid) {
    return res.status(400).send('Invalid signature');
  }

  let parsedPayload: ReturnType<typeof parseWebhookPayload>;
  try {
    parsedPayload = parseWebhookPayload(req.body);
  } catch (error) {
    log.warn('[PAYPAL_WH] Invalid JSON payload', {
      error: error instanceof Error ? error.message : String(error ?? ''),
    });
    return res.status(400).send('Invalid JSON payload');
  }

  const identity = extractWebhookIdentity('paypal', parsedPayload.payload);
  if (!identity) {
    return res.status(400).send('Invalid webhook payload');
  }

  try {
    const persisted = await persistEvent({
      provider: 'paypal',
      eventId: identity.eventId,
      eventType: identity.eventType,
      livemode: identity.livemode,
      headers: req.headers as Record<string, unknown>,
      payloadRaw: parsedPayload.rawPayload,
    });

    log.info('[PAYPAL_WH] Inbox transition', {
      provider: 'paypal',
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
      log.info('[PAYPAL_WH] Inbox transition', {
        provider: 'paypal',
        eventId: identity.eventId,
        eventType: identity.eventType,
        inboxId: persisted.inboxId,
        status: 'ENQUEUED',
      });
    } else {
      log.warn('[PAYPAL_WH] Persisted webhook but enqueue failed', {
        provider: 'paypal',
        eventId: identity.eventId,
        eventType: identity.eventType,
        inboxId: persisted.inboxId,
      });
    }
  } catch (error) {
    log.error('[PAYPAL_WH] Failed to persist/enqueue webhook event', {
      provider: 'paypal',
      eventId: identity.eventId,
      eventType: identity.eventType,
      error: error instanceof Error ? error.message : String(error ?? ''),
    });
    return res.status(500).send('Failed to persist webhook event');
  }

  return res.status(200).end();
};
