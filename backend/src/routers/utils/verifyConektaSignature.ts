import { createVerify } from 'crypto';

const normalizeDigestHeader = (digestHeader: string): string => {
  const trimmed = digestHeader.trim();
  if (!trimmed) return '';

  const normalizedWithAlgo = trimmed.match(/^sha-256\s*=\s*(.+)$/i);
  if (normalizedWithAlgo?.[1]) {
    return normalizedWithAlgo[1].trim();
  }

  return trimmed;
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
    verifier.update(rawBody.toString('utf8'), 'utf8');
    verifier.end();
    return verifier.verify(normalizedPublicKey, signature);
  } catch (_err) {
    return false;
  }
};
