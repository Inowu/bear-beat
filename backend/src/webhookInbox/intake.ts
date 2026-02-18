import { createHash } from 'crypto';
import type { Request } from 'express';
import type { Prisma } from '@prisma/client';
import type { WebhookInboxIdentity, WebhookInboxProvider } from './types';

const toTrimmedString = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
};

const toBooleanOrNull = (value: unknown): boolean | null => {
  if (typeof value === 'boolean') return value;
  return null;
};

const parseJsonObject = (rawPayload: string): Record<string, unknown> => {
  const trimmed = rawPayload.trim();
  if (!trimmed) {
    throw new SyntaxError('Empty webhook payload');
  }

  const parsed = JSON.parse(trimmed) as unknown;
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new SyntaxError('Webhook payload must be a JSON object');
  }
  return parsed as Record<string, unknown>;
};

export const getRawBodyAsString = (body: unknown): string => {
  if (Buffer.isBuffer(body)) return body.toString('utf8');
  if (typeof body === 'string') return body;
  if (body === null || body === undefined) return '';

  if (typeof body === 'object') {
    try {
      return JSON.stringify(body);
    } catch {
      return String(body);
    }
  }

  return String(body);
};

export const parseWebhookPayload = (body: unknown): {
  rawPayload: string;
  payload: Record<string, unknown>;
} => {
  const rawPayload = getRawBodyAsString(body);
  const payload = parseJsonObject(rawPayload);
  return { rawPayload, payload };
};

export const hashWebhookPayload = (rawPayload: string): string =>
  createHash('sha256').update(rawPayload, 'utf8').digest('hex');

const normalizeHeadersValue = (
  value: string | string[] | undefined,
): string | string[] | null => {
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

export const serializeHeadersForStorage = (
  req: Request,
): Record<string, Prisma.InputJsonValue> => {
  const result: Record<string, Prisma.InputJsonValue> = {};

  Object.entries(req.headers || {}).forEach(([key, value]) => {
    const normalized = normalizeHeadersValue(value);
    if (normalized !== null) {
      result[key] = normalized as Prisma.InputJsonValue;
    }
  });

  return result;
};

const extractStripeIdentity = (
  payload: Record<string, unknown>,
): WebhookInboxIdentity | null => {
  const eventId = toTrimmedString(payload.id);
  const eventType = toTrimmedString(payload.type);
  if (!eventId || !eventType) return null;

  return {
    eventId,
    eventType,
    livemode: toBooleanOrNull(payload.livemode),
  };
};

const extractPaypalIdentity = (
  payload: Record<string, unknown>,
): WebhookInboxIdentity | null => {
  const eventId = toTrimmedString(payload.id) || toTrimmedString(payload.event_id);
  const eventType =
    toTrimmedString(payload.event_type) || toTrimmedString(payload.eventType);
  if (!eventId || !eventType) return null;

  return {
    eventId,
    eventType,
    livemode: null,
  };
};

const extractConektaIdentity = (
  payload: Record<string, unknown>,
): WebhookInboxIdentity | null => {
  const eventId = toTrimmedString(payload.id);
  const eventType = toTrimmedString(payload.type);
  if (!eventId || !eventType) return null;

  let livemode: boolean | null = toBooleanOrNull(payload.livemode);
  if (livemode === null) {
    const data = payload.data as Record<string, unknown> | undefined;
    const object =
      data && typeof data.object === 'object' && data.object
        ? (data.object as Record<string, unknown>)
        : null;
    livemode = toBooleanOrNull(object?.livemode);
  }

  return {
    eventId,
    eventType,
    livemode,
  };
};

export const extractWebhookIdentity = (
  provider: WebhookInboxProvider,
  payload: Record<string, unknown>,
): WebhookInboxIdentity | null => {
  switch (provider) {
    case 'stripe':
    case 'stripe_pi':
    case 'stripe_products':
      return extractStripeIdentity(payload);
    case 'paypal':
      return extractPaypalIdentity(payload);
    case 'conekta':
      return extractConektaIdentity(payload);
    default:
      return null;
  }
};
