import { Request } from 'express';
import axios from 'axios';
import { log } from '../../server';
import { paypal } from '../../paypal';

const getHeaderValue = (req: Request, headerName: string): string => {
  const value = req.headers[headerName];
  if (Array.isArray(value)) return value[0] ?? '';
  return typeof value === 'string' ? value : '';
};

const parseWebhookEvent = (body: unknown): Record<string, any> => {
  if (Buffer.isBuffer(body)) {
    const raw = body.toString('utf8').trim();
    if (!raw) return {};
    return JSON.parse(raw) as Record<string, any>;
  }

  if (typeof body === 'string') {
    const raw = body.trim();
    if (!raw) return {};
    return JSON.parse(raw) as Record<string, any>;
  }

  if (typeof body === 'object' && body) {
    return body as Record<string, any>;
  }

  return {};
};

const resolvePaypalWebhookId = (): string => {
  const hasLiveCreds = Boolean(
    process.env.PAYPAL_CLIENT_ID?.trim() &&
      process.env.PAYPAL_CLIENT_SECRET?.trim(),
  );
  const hasTestCreds = Boolean(
    process.env.PAYPAL_TEST_CLIENT_ID?.trim() &&
      process.env.PAYPAL_TEST_CLIENT_SECRET?.trim(),
  );

  const preferLive =
    process.env.NODE_ENV === 'production' || (hasLiveCreds && !hasTestCreds);

  return (
    (preferLive
      ? process.env.PAYPAL_WH_ID?.trim()
      : process.env.PAYPAL_TEST_WH_ID?.trim()) ||
    process.env.PAYPAL_WH_ID?.trim() ||
    process.env.PAYPAL_TEST_WH_ID?.trim() ||
    ''
  );
};

export const verifyPaypalSignature = async (req: Request): Promise<boolean> => {
  const authAlgo = getHeaderValue(req, 'paypal-auth-algo');
  const certUrl = getHeaderValue(req, 'paypal-cert-url');
  const transmissionId = getHeaderValue(req, 'paypal-transmission-id');
  const transmissionSig = getHeaderValue(req, 'paypal-transmission-sig');
  const transmissionTime = getHeaderValue(req, 'paypal-transmission-time');
  const webhookId = resolvePaypalWebhookId();

  if (
    !authAlgo ||
    !certUrl ||
    !transmissionId ||
    !transmissionSig ||
    !transmissionTime
  ) {
    log.warn(
      '[PAYPAL_WH] Missing signature headers. Rejecting webhook request.',
    );
    return false;
  }

  if (!webhookId) {
    log.error(
      '[PAYPAL_WH] Missing PAYPAL_WH_ID/PAYPAL_TEST_WH_ID env var. Rejecting webhook request.',
    );
    return false;
  }

  try {
    const webhookEvent = parseWebhookEvent(req.body);
    const accessToken = await paypal.getToken();

    const verifyPayload = {
      transmission_id: transmissionId,
      transmission_time: transmissionTime,
      cert_url: certUrl,
      auth_algo: authAlgo,
      transmission_sig: transmissionSig,
      webhook_id: webhookId,
      webhook_event: webhookEvent,
    };

    const response = await axios.post(
      `${paypal.paypalUrl()}/v1/notifications/verify-webhook-signature`,
      verifyPayload,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        timeout: 15_000,
      },
    );

    const verificationStatus = String(
      response.data?.verification_status || '',
    ).toUpperCase();
    const isValid = verificationStatus === 'SUCCESS';

    if (!isValid) {
      log.warn(
        `[PAYPAL_WH] Signature verification failed. status=${verificationStatus}`,
      );
    }

    return isValid;
  } catch (e) {
    log.error(
      `[PAYPAL_WH] Error while verifying webhook signature: ${String(e)}`,
    );
    return false;
  }
};
