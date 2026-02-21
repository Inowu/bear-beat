import { Request, Response } from 'express';
import { conektaWebhookKeys } from '../../conekta';
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

const normalizePemValue = (value: string): string => {
  let normalized = value.trim();

  if (
    (normalized.startsWith('"') && normalized.endsWith('"')) ||
    (normalized.startsWith('\'') && normalized.endsWith('\''))
  ) {
    normalized = normalized.slice(1, -1);
  }

  return normalized.replace(/\\n/g, '\n').trim();
};

const EXTRA_PUBLIC_KEYS_SPLIT_REGEX = /[\n,]/;
const WEBHOOK_KEYS_CACHE_TTL_MS = 5 * 60 * 1000;
let cachedWebhookPublicKeys: { keys: string[]; expiresAt: number } = {
  keys: [],
  expiresAt: 0,
};

const dedupeKeys = (keys: string[]): string[] =>
  Array.from(new Set(keys.filter((item) => item.length > 0)));

const resolveExtraConfiguredPublicKeys = (): string[] => {
  const configured = String(process.env.CONEKTA_WEBHOOK_PUBLIC_KEYS || '').trim();
  if (!configured) return [];

  return dedupeKeys(
    configured
      .split(EXTRA_PUBLIC_KEYS_SPLIT_REGEX)
      .map((item) => normalizePemValue(item))
      .filter(Boolean),
  );
};

const getActiveWebhookPublicKeysFromConekta = async (): Promise<string[]> => {
  const now = Date.now();
  if (cachedWebhookPublicKeys.expiresAt > now && cachedWebhookPublicKeys.keys.length > 0) {
    return cachedWebhookPublicKeys.keys;
  }

  try {
    const response = await conektaWebhookKeys.getWebhookKeys('en', undefined, 100);
    const rows = (response.data as { data?: Array<{ active?: boolean; public_key?: string }> } | null)?.data;
    const fetchedKeys = Array.isArray(rows)
      ? rows
          .map((row) => normalizePemValue(String(row?.public_key || '')))
          .filter(Boolean)
      : [];

    cachedWebhookPublicKeys = {
      keys: dedupeKeys(fetchedKeys),
      expiresAt: now + WEBHOOK_KEYS_CACHE_TTL_MS,
    };
  } catch (error) {
    cachedWebhookPublicKeys = {
      keys: [],
      expiresAt: now + 30 * 1000,
    };
    log.warn('[CONEKTA_WH] Failed to refresh webhook public keys from Conekta API', {
      error: error instanceof Error ? error.message : String(error ?? ''),
    });
  }

  return cachedWebhookPublicKeys.keys;
};

const resolveConektaWebhookPublicKey = (): string => {
  const configuredPublicKey = normalizePemValue(String(
    process.env.CONEKTA_WEBHOOK_PUBLIC_KEY || '',
  ));
  if (configuredPublicKey) return configuredPublicKey;

  const preferLive = process.env.NODE_ENV === 'production';
  const candidates = preferLive
    ? [process.env.CONEKTA_SIGNED_KEY, process.env.CONEKTA_SIGNED_TEST_KEY]
    : [process.env.CONEKTA_SIGNED_TEST_KEY, process.env.CONEKTA_SIGNED_KEY];

  for (const candidate of candidates) {
    const normalized = normalizePemValue(String(candidate || ''));
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

  const headers = req.headers as Record<string, string | string[] | undefined>;
  const digestHeader =
    getHeaderValue(headers.digest) ||
    getHeaderValue(headers['x-conekta-signature']) ||
    getHeaderValue(headers['x-signature']);
  const primaryPublicKeyPem = resolveConektaWebhookPublicKey();
  const isPrimarySignatureValid = verifyConektaSignature(
    req.body,
    digestHeader,
    primaryPublicKeyPem,
  );
  let isValidSignature = isPrimarySignatureValid;

  if (!isValidSignature) {
    const configuredFallbackKeys = resolveExtraConfiguredPublicKeys();
    const apiFallbackKeys = await getActiveWebhookPublicKeysFromConekta();
    const fallbackKeys = dedupeKeys([
      ...configuredFallbackKeys,
      ...apiFallbackKeys,
    ]).filter((key) => key !== primaryPublicKeyPem);

    for (const publicKeyPem of fallbackKeys) {
      if (verifyConektaSignature(req.body, digestHeader, publicKeyPem)) {
        isValidSignature = true;
        break;
      }
    }
  }

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
