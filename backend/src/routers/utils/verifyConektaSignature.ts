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
    .replace(/^:+/, '')
    .replace(/:+$/, '')
    .replace(/-/g, '+')
    .replace(/_/g, '/');
  if (!token) return '';

  const remainder = token.length % 4;
  if (remainder === 0) return token;
  return `${token}${'='.repeat(4 - remainder)}`;
};

type DigestCandidate = {
  algorithm: 'RSA-SHA256' | 'RSA-SHA512' | 'RSA-SHA1';
  signatureBase64: string;
};

const algoFromDigestLabel = (
  value: string,
): DigestCandidate['algorithm'] | null => {
  const normalized = value.trim().toLowerCase();
  if (normalized === 'sha-256') return 'RSA-SHA256';
  if (normalized === 'sha256') return 'RSA-SHA256';
  if (normalized === 'rsa-sha256') return 'RSA-SHA256';
  if (normalized === 'sha-512') return 'RSA-SHA512';
  if (normalized === 'sha512') return 'RSA-SHA512';
  if (normalized === 'rsa-sha512') return 'RSA-SHA512';
  if (normalized === 'sha-1') return 'RSA-SHA1';
  if (normalized === 'sha1') return 'RSA-SHA1';
  if (normalized === 'rsa-sha1') return 'RSA-SHA1';
  return null;
};

const parseDigestCandidates = (digestHeader: string): DigestCandidate[] => {
  const trimmed = digestHeader.trim();
  if (!trimmed) return [];

  const parts = trimmed
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);

  const candidates: DigestCandidate[] = [];
  let fallbackSignatureBase64 = '';

  for (const part of parts) {
    const normalizedWithAlgo = part.match(/^([a-z0-9-]+)\s*=\s*(.+)$/i);
    if (normalizedWithAlgo?.[1] && normalizedWithAlgo?.[2]) {
      const label = normalizedWithAlgo[1].trim();
      const signatureBase64 = normalizeBase64Like(normalizedWithAlgo[2]);
      if (!signatureBase64) continue;

      const algorithm = algoFromDigestLabel(label);
      if (algorithm) {
        candidates.push({ algorithm, signatureBase64 });
        continue;
      }

      const normalizedLabel = label.toLowerCase();
      if (normalizedLabel === 'signature' || normalizedLabel === 'sig') {
        candidates.push({ algorithm: 'RSA-SHA256', signatureBase64 });
        continue;
      }

      if (!fallbackSignatureBase64) {
        fallbackSignatureBase64 = signatureBase64;
      }
    }
  }

  if (candidates.length > 0) return candidates;
  if (fallbackSignatureBase64) {
    return [{ algorithm: 'RSA-SHA256', signatureBase64: fallbackSignatureBase64 }];
  }

  const firstPartValue = (() => {
    const firstPart = parts[0] || trimmed;
    const matched = firstPart.match(/^[a-z0-9-]+\s*=\s*(.+)$/i);
    return matched?.[1] || firstPart;
  })();
  const fallback = normalizeBase64Like(firstPartValue);
  return fallback
    ? [{ algorithm: 'RSA-SHA256', signatureBase64: fallback }]
    : [];
};

export const verifyConektaSignature = (
  rawBody: Buffer,
  digestHeader: string,
  publicKeyPem: string,
): boolean => {
  if (!Buffer.isBuffer(rawBody)) return false;

  const digestCandidates = parseDigestCandidates(digestHeader);
  if (digestCandidates.length === 0) return false;

  const normalizedPublicKey = publicKeyPem.trim();
  if (!normalizedPublicKey) return false;

  for (const candidate of digestCandidates) {
    try {
      const signature = Buffer.from(candidate.signatureBase64, 'base64');
      if (!signature.length) continue;

      const verifier = createVerify(candidate.algorithm);
      verifier.update(rawBody);
      verifier.end();
      if (verifier.verify(normalizedPublicKey, signature)) {
        return true;
      }
    } catch (_err) {
      // Ignore malformed candidates and try the next one.
    }
  }

  return false;
};
