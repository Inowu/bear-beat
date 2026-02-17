import type { Request } from 'express';
import { createVerify } from 'crypto';

const normalizeDigestHeader = (value: string): string => {
  const trimmed = value.trim();
  if (!trimmed) return '';

  const lower = trimmed.toLowerCase();
  if (lower.startsWith('sha-256=')) {
    return trimmed.slice(8).trim();
  }

  return trimmed;
};

const resolveConektaPublicKey = (): string => {
  const preferLive = process.env.NODE_ENV === 'production';

  return (
    (preferLive
      ? process.env.CONEKTA_SIGNED_KEY
      : process.env.CONEKTA_SIGNED_TEST_KEY) ||
    process.env.CONEKTA_SIGNED_KEY ||
    process.env.CONEKTA_SIGNED_TEST_KEY ||
    ''
  ).trim();
};

const getRawBody = (body: unknown): Buffer => {
  if (Buffer.isBuffer(body)) return body;
  if (typeof body === 'string') return Buffer.from(body, 'utf8');
  if (body === null || body === undefined) return Buffer.alloc(0);
  return Buffer.from(String(body), 'utf8');
};

export const verifyConektaSignature = (req: Request): boolean => {
  const digestHeader = req.headers.digest;
  const digest = Array.isArray(digestHeader) ? digestHeader[0] : digestHeader;
  if (!digest || typeof digest !== 'string') return false;

  const normalizedDigest = normalizeDigestHeader(digest);
  if (!normalizedDigest) return false;

  const publicKey = resolveConektaPublicKey();
  if (!publicKey) return false;

  try {
    const signature = Buffer.from(normalizedDigest, 'base64');
    if (!signature.length) return false;

    const verifier = createVerify('RSA-SHA256');
    verifier.update(getRawBody(req.body));
    verifier.end();
    return verifier.verify(publicKey, signature);
  } catch (_err) {
    return false;
  }
};
