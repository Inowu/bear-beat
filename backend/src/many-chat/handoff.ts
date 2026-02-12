import crypto from 'crypto';
import { PrismaClient } from '@prisma/client';

export type ManyChatHandoffSnapshot = {
  contactId: string | null;
  channel: string | null;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  email: string | null;
  ref: string | null;
  // Extra metadata we might want later (keep small, no secrets).
  meta?: Record<string, unknown>;
};

const MAX_CLIENT_URL_LEN = 500;

const toTrimmedString = (value: unknown): string | null => {
  if (value === null || value === undefined) return null;
  const s = String(value).trim();
  return s ? s : null;
};

const clampLen = (value: string | null, max: number): string | null => {
  if (!value) return null;
  return value.length > max ? value.slice(0, max) : value;
};

const pickFirst = (raw: Record<string, unknown>, keys: string[]): string | null => {
  for (const k of keys) {
    if (!(k in raw)) continue;
    const v = toTrimmedString((raw as any)[k]);
    if (v) return v;
  }
  return null;
};

export function sanitizeManyChatHandoffPayload(rawBody: unknown): ManyChatHandoffSnapshot {
  const raw: Record<string, unknown> =
    rawBody && typeof rawBody === 'object' && !Array.isArray(rawBody)
      ? (rawBody as Record<string, unknown>)
      : {};

  const contactId = pickFirst(raw, ['contactId', 'contact_id', 'subscriber_id', 'subscriberId', 'id']);
  const channel = pickFirst(raw, ['channel', 'channelId', 'channel_id', 'source_channel']);
  const firstName = pickFirst(raw, ['firstName', 'first_name', 'firstname']);
  const lastName = pickFirst(raw, ['lastName', 'last_name', 'lastname']);
  const phone = pickFirst(raw, ['phone', 'whatsapp_phone', 'wa_phone', 'phone_number']);
  const email = pickFirst(raw, ['email', 'e-mail']);
  const ref = pickFirst(raw, ['ref', 'reference', 'flow', 'campaign']);

  // Keep it conservative: store a minimal, useful snapshot (avoid huge bodies / nested objects).
  return {
    contactId: clampLen(contactId, 64),
    channel: clampLen(channel, 24),
    firstName: clampLen(firstName, 120),
    lastName: clampLen(lastName, 120),
    phone: clampLen(phone, 64),
    email: clampLen(email, 255),
    ref: clampLen(ref, 120),
  };
}

const generateToken = (): string => {
  // 32 bytes -> ~43 chars base64url (no padding). Fits comfortably in VARCHAR(80).
  return crypto.randomBytes(32).toString('base64url');
};

export const resolveClientUrl = (): string => {
  const clientUrlRaw = (process.env.CLIENT_URL || 'https://thebearbeat.com').trim();
  return clientUrlRaw.slice(0, MAX_CLIENT_URL_LEN);
};

export function buildManyChatHandoffUrl(params: {
  clientUrl: string;
  redirectPath?: string | null;
  token: string;
  extraParams?: Record<string, string | null | undefined>;
}): string {
  const { clientUrl, redirectPath, token, extraParams } = params;
  const base = clientUrl.trim() || 'https://thebearbeat.com';
  const target = redirectPath && redirectPath.trim() ? redirectPath.trim() : '/#demo';

  // redirectPath can include hash (/#demo) or a full path (/planes).
  const url = new URL(target, base);
  url.searchParams.set('mc_t', token);

  if (extraParams) {
    for (const [key, value] of Object.entries(extraParams)) {
      const v = toTrimmedString(value);
      if (!v) continue;
      // Keep query strings tidy.
      url.searchParams.set(key, v.slice(0, 200));
    }
  }

  return url.toString();
}

export async function createManyChatHandoffToken(params: {
  prisma: PrismaClient;
  snapshot: ManyChatHandoffSnapshot;
  ttlDays: number;
}): Promise<{ token: string; expiresAt: Date; recordId: number }> {
  const { prisma, snapshot, ttlDays } = params;
  const now = new Date();
  const ttlMs = Math.max(1, ttlDays) * 24 * 60 * 60 * 1000;
  const expiresAt = new Date(now.getTime() + ttlMs);

  // Retry on rare token collisions.
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const token = generateToken();
    try {
      const created = await prisma.manyChatHandoffToken.create({
        data: {
          token,
          contact_id: snapshot.contactId,
          channel: snapshot.channel,
          payload_json: snapshot as any,
          created_at: now,
          expires_at: expiresAt,
        },
        select: { id: true },
      });
      return { token, expiresAt, recordId: created.id };
    } catch (e: any) {
      // Prisma unique constraint failure: retry.
      const msg = e instanceof Error ? e.message : String(e ?? '');
      if (msg.toLowerCase().includes('uniq_mch_token')) continue;
      throw e;
    }
  }

  throw new Error('Failed to generate unique ManyChat handoff token');
}

export async function resolveManyChatHandoffToken(params: {
  prisma: PrismaClient;
  token: string;
}): Promise<{
  ok: true;
  token: string;
  contactId: string | null;
  channel: string | null;
  snapshot: ManyChatHandoffSnapshot | null;
  createdAt: Date;
  expiresAt: Date;
  claimedUserId: number | null;
} | {
  ok: false;
  reason: 'not_found' | 'expired' | 'invalid';
}> {
  const { prisma, token } = params;
  const normalized = token.trim();
  if (!normalized || normalized.length < 16 || normalized.length > 200) {
    return { ok: false, reason: 'invalid' };
  }

  const record = await prisma.manyChatHandoffToken.findFirst({
    where: { token: normalized },
  });

  if (!record) return { ok: false, reason: 'not_found' };

  if (record.expires_at && new Date(record.expires_at).getTime() < Date.now()) {
    return { ok: false, reason: 'expired' };
  }

  // Best-effort mark resolve time (non-blocking).
  if (!record.resolved_at) {
    prisma.manyChatHandoffToken
      .update({
        where: { id: record.id },
        data: { resolved_at: new Date() },
        select: { id: true },
      })
      .catch(() => {});
  }

  const snapshot = (record.payload_json as any) as ManyChatHandoffSnapshot | null;
  return {
    ok: true,
    token: record.token,
    contactId: record.contact_id ?? null,
    channel: record.channel ?? null,
    snapshot: snapshot ?? null,
    createdAt: record.created_at,
    expiresAt: record.expires_at,
    claimedUserId: record.claimed_user_id ?? null,
  };
}

export async function claimManyChatHandoffToken(params: {
  prisma: PrismaClient;
  token: string;
  userId: number;
}): Promise<{
  ok: true;
  alreadyClaimed: boolean;
  contactId: string | null;
  channel: string | null;
  snapshot: ManyChatHandoffSnapshot | null;
} | {
  ok: false;
  reason: 'not_found' | 'expired' | 'invalid' | 'claimed_by_other_user';
}> {
  const { prisma, token, userId } = params;
  const normalized = token.trim();
  if (!normalized || normalized.length < 16 || normalized.length > 200) {
    return { ok: false, reason: 'invalid' };
  }

  const record = await prisma.manyChatHandoffToken.findFirst({
    where: { token: normalized },
  });

  if (!record) return { ok: false, reason: 'not_found' };
  if (record.expires_at && new Date(record.expires_at).getTime() < Date.now()) {
    return { ok: false, reason: 'expired' };
  }

  const claimedUserId = record.claimed_user_id;
  if (claimedUserId && claimedUserId !== userId) {
    return { ok: false, reason: 'claimed_by_other_user' };
  }

  const snapshot = (record.payload_json as any) as ManyChatHandoffSnapshot | null;

  if (claimedUserId === userId) {
    return {
      ok: true,
      alreadyClaimed: true,
      contactId: record.contact_id ?? null,
      channel: record.channel ?? null,
      snapshot: snapshot ?? null,
    };
  }

  await prisma.manyChatHandoffToken.update({
    where: { id: record.id },
    data: {
      claimed_user_id: userId,
      claimed_at: new Date(),
    },
  });

  return {
    ok: true,
    alreadyClaimed: false,
    contactId: record.contact_id ?? null,
    channel: record.channel ?? null,
    snapshot: snapshot ?? null,
  };
}
