import bcrypt from 'bcrypt';
import { PrismaClient, Users } from '@prisma/client';
import { generateJwt } from '../../utils/generateJwt';

const MAX_REFRESH_TOKEN_HASHES = 3;
const LEGACY_REFRESH_TOKEN_MAX_LENGTH = 250;

const isLikelyBcryptHash = (value: string): boolean =>
  value.startsWith('$2') && value.length >= 59;

export const getStoredRefreshTokenHashes = (
  rawValue: string | null | undefined,
): string[] => {
  if (!rawValue) return [];
  const raw = rawValue.trim();
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed)) {
      const validHashes = parsed
        .map((entry) => (typeof entry === 'string' ? entry.trim() : ''))
        .filter((entry) => isLikelyBcryptHash(entry));
      return validHashes.slice(-MAX_REFRESH_TOKEN_HASHES);
    }
  } catch {
    // legacy format fallback (single hash string)
  }

  if (isLikelyBcryptHash(raw)) {
    return [raw];
  }

  return [];
};

const encodeStoredRefreshTokenHashes = (hashes: string[]): string | null => {
  const deduped = Array.from(new Set(hashes.filter(Boolean))).slice(
    -MAX_REFRESH_TOKEN_HASHES,
  );
  if (deduped.length === 0) return null;

  let result = JSON.stringify(deduped);
  while (
    result.length > LEGACY_REFRESH_TOKEN_MAX_LENGTH &&
    deduped.length > 1
  ) {
    deduped.shift();
    result = JSON.stringify(deduped);
  }

  if (result.length <= LEGACY_REFRESH_TOKEN_MAX_LENGTH) {
    return result;
  }

  // Final fallback for schema compatibility.
  return deduped.length > 0 ? deduped[deduped.length - 1] : null;
};

export const generateTokens = async (prisma: PrismaClient, user: Users) => {
  const refreshToken = generateJwt(user, { expiresIn: '365d' });
  const refreshHash = bcrypt.hashSync(refreshToken, 10);
  const existingHashes = getStoredRefreshTokenHashes(user.refresh_token);
  const nextHashes = [...existingHashes, refreshHash];
  const encodedRefreshTokenHashes = encodeStoredRefreshTokenHashes(nextHashes);

  await prisma.users.update({
    where: {
      id: user.id,
    },
    data: {
      refresh_token: encodedRefreshTokenHashes,
    },
  });

  return {
    token: generateJwt(user),
    refreshToken,
  };
};
