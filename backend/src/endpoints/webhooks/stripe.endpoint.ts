import { Request, Response } from 'express';
import type { Stripe } from 'stripe';
import { log } from '../../server';
import stripeInstance from '../../stripe';
import { getStripeWebhookBody } from '../../routers/utils/verifyStripeSignature';
import { persistEvent } from '../../services/webhookInbox';
import { enqueueWebhookInboxJob } from '../../queues/webhookInbox.queue';
import { markWebhookInboxEventEnqueued } from '../../webhookInbox/service';

const getStripeSignatureHeader = (
  header: string | string[] | undefined,
): string => {
  if (Array.isArray(header)) return header[0] ?? '';
  return typeof header === 'string' ? header : '';
};

export const stripeEndpoint = async (req: Request, res: Response) => {
  const secret = String(process.env.STRIPE_WH_SECRET || '').trim();
  if (!secret) {
    log.error('[STRIPE_WH] STRIPE_WH_SECRET is not configured.');
    return res.status(500).send('Webhook secret not configured');
  }

  const signature = getStripeSignatureHeader(req.headers['stripe-signature']);
  if (!signature) {
    return res.status(400).send('Invalid signature');
  }

  let event: Stripe.Event;
  try {
    event = stripeInstance.webhooks.constructEvent(
      req.body as Buffer | string,
      signature,
      secret,
    );
  } catch (error) {
    log.warn('[STRIPE_WH] Error verifying signature', {
      error: error instanceof Error ? error.message : String(error ?? ''),
    });
    return res.status(400).send('Invalid signature');
  }

  const payloadRaw = getStripeWebhookBody(req);
  if (!payloadRaw) {
    return res.status(400).send('Invalid JSON payload');
  }

  try {
    const persisted = await persistEvent({
      provider: 'stripe',
      eventId: String(event.id || '').trim(),
      eventType: String(event.type || '').trim(),
      livemode:
        typeof event.livemode === 'boolean'
          ? event.livemode
          : null,
      headers: req.headers as Record<string, unknown>,
      payloadRaw,
    });

    if (!persisted.created) {
      return res.status(200).end();
    }

    const queued = await enqueueWebhookInboxJob({ inboxId: persisted.inboxId });
    if (queued) {
      await markWebhookInboxEventEnqueued(persisted.inboxId);
    } else {
      log.warn('[STRIPE_WH] Persisted webhook but enqueue failed', {
        inboxId: persisted.inboxId,
        eventId: event.id ?? null,
        eventType: event.type ?? null,
      });
    }
  } catch (error) {
    log.error('[STRIPE_WH] Failed to persist/enqueue webhook event', {
      eventId: event.id ?? null,
      eventType: event.type ?? null,
      error: error instanceof Error ? error.message : String(error ?? ''),
    });
    return res.status(500).send('Failed to persist webhook event');
  }

  return res.status(200).end();
};
