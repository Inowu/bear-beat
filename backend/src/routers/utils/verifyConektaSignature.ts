import { createVerify } from 'crypto';

const stripWrappingQuotes = (value: string): string => {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"'))
    || (trimmed.startsWith('\'') && trimmed.endsWith('\''))
  ) {
    return trimmed.slice(1, -1).trim();
  }
  return trimmed;
};

const normalizeBase64Like = (value: string): string => {
  const token = stripWrappingQuotes(value)
    .replace(/\s+/g, '')
    .replace(/-/g, '+')
    .replace(/_/g, '/');
  if (!token) return '';

  const remainder = token.length % 4;
  if (remainder === 0) return token;
  return `${token}${'='.repeat(4 - remainder)}`;
};

const normalizeDigestHeader = (digestHeader: string): string => {
  const trimmed = digestHeader.trim();
  if (!trimmed) return '';

  const parts = trimmed
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);

  for (const part of parts) {
    const normalizedWithAlgo = part.match(/^sha-256\s*=\s*(.+)$/i);
    if (normalizedWithAlgo?.[1]) {
      return normalizeBase64Like(normalizedWithAlgo[1]);
    }
  }

  return normalizeBase64Like(parts[0] || trimmed);
};

export const verifyConektaSignature = (
  rawBody: Buffer,
  digestHeader: string,
  publicKeyPem: string,
): boolean => {
  if (!Buffer.isBuffer(rawBody)) return false;

  const normalizedDigest = normalizeDigestHeader(digestHeader);
  if (!normalizedDigest) return false;

  const normalizedPublicKey = publicKeyPem.trim();
  if (!normalizedPublicKey) return false;

  try {
    const signature = Buffer.from(normalizedDigest, 'base64');
    if (!signature.length) return false;

    const verifier = createVerify('RSA-SHA256');
    verifier.update(rawBody);
    verifier.end();
    return verifier.verify(normalizedPublicKey, signature);
  } catch (_err) {
    return false;
  }
};
