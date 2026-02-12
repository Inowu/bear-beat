import { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../db';
import { log } from '../server';
import {
  buildManyChatHandoffUrl,
  createManyChatHandoffToken,
  resolveClientUrl,
  resolveManyChatHandoffToken,
  sanitizeManyChatHandoffPayload,
} from '../many-chat/handoff';

const MAX_SECRET_LEN = 200;

function safeEqual(a: string, b: string): boolean {
  // Avoid throwing on length mismatch.
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i += 1) {
    out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return out === 0;
}

const createSchema = z
  .object({
    secret: z.string().min(1).max(MAX_SECRET_LEN),
    redirectPath: z.string().optional(),
  })
  .passthrough();

export const manyChatHandoffCreateEndpoint = async (req: Request, res: Response) => {
  // Prefer a dedicated secret for the handoff endpoint.
  // Fallback to MC_API_KEY so existing installations don't require additional env wiring.
  const secretConfigured = (process.env.MC_HANDOFF_SECRET || process.env.MC_API_KEY || '').trim();
  if (!secretConfigured) {
    res.status(503).json({ ok: false, message: 'ManyChat handoff not configured' });
    return;
  }

  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ ok: false, message: 'Payload inválido' });
    return;
  }

  const providedSecret = parsed.data.secret.trim();
  if (!safeEqual(providedSecret, secretConfigured)) {
    res.status(401).json({ ok: false, message: 'Unauthorized' });
    return;
  }

  const ttlDaysRaw = (process.env.MC_HANDOFF_TTL_DAYS || '').trim();
  const ttlDays = Math.max(1, Number(ttlDaysRaw) || 14);

  const snapshot = sanitizeManyChatHandoffPayload(req.body);

  // Even if contactId is missing, we still generate a token (useful for attribution). But log it.
  if (!snapshot.contactId) {
    log.warn('[MANYCHAT_HANDOFF] Missing contactId in create payload', {
      channel: snapshot.channel,
    });
  }

  try {
    const created = await createManyChatHandoffToken({
      prisma,
      snapshot,
      ttlDays,
    });

    // Pass through common attribution params if ManyChat sends them.
    const bodyAny = req.body as Record<string, unknown>;
    const extraParams: Record<string, string | null | undefined> = {
      utm_source: typeof bodyAny.utm_source === 'string' ? bodyAny.utm_source : undefined,
      utm_medium: typeof bodyAny.utm_medium === 'string' ? bodyAny.utm_medium : undefined,
      utm_campaign: typeof bodyAny.utm_campaign === 'string' ? bodyAny.utm_campaign : undefined,
      utm_content: typeof bodyAny.utm_content === 'string' ? bodyAny.utm_content : undefined,
      utm_term: typeof bodyAny.utm_term === 'string' ? bodyAny.utm_term : undefined,
      fbclid: typeof bodyAny.fbclid === 'string' ? bodyAny.fbclid : undefined,
      gclid: typeof bodyAny.gclid === 'string' ? bodyAny.gclid : undefined,
      mc_ref: snapshot.ref ?? undefined,
    };

    const clientUrl = resolveClientUrl();
    const url = buildManyChatHandoffUrl({
      clientUrl,
      redirectPath: parsed.data.redirectPath,
      token: created.token,
      extraParams,
    });

    res.status(200).json({
      ok: true,
      url,
      token: created.token,
      expiresAt: created.expiresAt.toISOString(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create handoff token';
    log.error('[MANYCHAT_HANDOFF] Create failed', { message });
    res.status(500).json({ ok: false, message });
  }
};

export const manyChatHandoffResolveEndpoint = async (req: Request, res: Response) => {
  const tokenRaw =
    typeof req.query.token === 'string'
      ? req.query.token
      : typeof req.query.mc_t === 'string'
        ? req.query.mc_t
        : '';

  try {
    const result = await resolveManyChatHandoffToken({
      prisma,
      token: tokenRaw,
    });

    if (!result.ok) {
      const status = result.reason === 'invalid' ? 400 : result.reason === 'expired' ? 410 : 404;
      res.status(status).json({ ok: false, reason: result.reason });
      return;
    }

    res.status(200).json({
      ok: true,
      contactId: result.contactId,
      channel: result.channel,
      snapshot: result.snapshot,
      createdAt: result.createdAt.toISOString(),
      expiresAt: result.expiresAt.toISOString(),
      claimedUserId: result.claimedUserId,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to resolve handoff token';
    res.status(500).json({ ok: false, message });
  }
};
