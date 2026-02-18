import { Request, Response } from 'express';
import { verifyConektaSignature } from '../../routers/utils/verifyConektaSignature';
import { receiveWebhookIntoInbox } from './webhookInboxReception';
import { log } from '../../server';

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

  try {
    const result = await receiveWebhookIntoInbox({
      provider: 'conekta',
      req,
      logPrefix: 'CONEKTA_WH',
    });
    if (!result.ok) {
      log.error('[CONEKTA_WH] Failed to process webhook event.', {
        status: result.status,
        error: result.message,
      });
      return res.status(500).send('Webhook processing failed');
    }
  } catch (error) {
    log.error('[CONEKTA_WH] Unexpected webhook processing error.', {
      error: error instanceof Error ? error.message : String(error ?? ''),
    });
    return res.status(500).send('Webhook processing failed');
  }

  return res.status(200).end();
};
