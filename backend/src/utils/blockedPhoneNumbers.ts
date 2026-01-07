import { PrismaClient } from '@prisma/client';

export const BLOCKED_PHONE_NUMBERS_CONFIG_NAME = 'blocked_phone_numbers';

const PHONE_REGEX = /^\+\d{1,4}\s\d{4,14}$/;

const coercePhoneList = (value: unknown): string[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  const normalized = value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => normalizePhoneInput(item))
    .filter((item): item is string => Boolean(item));

  return Array.from(new Set(normalized));
};

export const normalizePhoneInput = (phone: string): string =>
  phone.trim().replace(/\s+/g, ' ');

export const normalizePhoneNumber = (phone: string): string | null => {
  const normalized = normalizePhoneInput(phone);
  if (!normalized) {
    return null;
  }

  if (!PHONE_REGEX.test(normalized)) {
    return null;
  }

  return normalized;
};

export const isValidPhoneNumber = (phone: string): boolean =>
  PHONE_REGEX.test(phone);

export const getBlockedPhoneNumbers = async (
  prisma: PrismaClient,
): Promise<string[]> => {
  const config = await prisma.config.findFirst({
    where: {
      name: BLOCKED_PHONE_NUMBERS_CONFIG_NAME,
    },
  });

  if (!config?.value) {
    return [];
  }

  try {
    const parsed = JSON.parse(config.value);
    return coercePhoneList(parsed);
  } catch {
    return [];
  }
};

export const setBlockedPhoneNumbers = async (
  prisma: PrismaClient,
  numbers: string[],
): Promise<string[]> => {
  const normalized = coercePhoneList(numbers).sort();
  const payload = JSON.stringify(normalized);
  const existing = await prisma.config.findFirst({
    where: {
      name: BLOCKED_PHONE_NUMBERS_CONFIG_NAME,
    },
  });

  if (existing) {
    await prisma.config.update({
      where: {
        id: existing.id,
      },
      data: {
        value: payload,
      },
    });
  } else {
    await prisma.config.create({
      data: {
        name: BLOCKED_PHONE_NUMBERS_CONFIG_NAME,
        value: payload,
      },
    });
  }

  return normalized;
};
