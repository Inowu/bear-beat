import { PrismaClient } from '@prisma/client';

export const BLOCKED_EMAIL_DOMAINS_CONFIG_NAME = 'blocked_email_domains';

export const RESERVED_EMAIL_DOMAINS = [
  'gmail.com',
  'yahoo.com',
  'outlook.com',
  'hotmail.com',
  'live.com',
  'icloud.com',
  'protonmail.com',
  'aol.com',
];

const DOMAIN_REGEX = /^(?!-)[a-z0-9-]+(\.[a-z0-9-]+)+$/;

const coerceDomainList = (value: unknown): string[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  const normalized = value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);

  return Array.from(new Set(normalized));
};

export const normalizeDomainInput = (domain: string): string =>
  domain.trim().toLowerCase();

export const normalizeEmailDomain = (email: string): string | null => {
  const trimmed = email.trim().toLowerCase();
  const atIndex = trimmed.lastIndexOf('@');

  if (atIndex === -1) {
    return null;
  }

  const domain = trimmed.slice(atIndex + 1).trim();
  return domain.length ? domain : null;
};

export const isValidDomain = (domain: string): boolean =>
  DOMAIN_REGEX.test(domain);

export const getBlockedEmailDomains = async (
  prisma: PrismaClient,
): Promise<string[]> => {
  const config = await prisma.config.findFirst({
    where: {
      name: BLOCKED_EMAIL_DOMAINS_CONFIG_NAME,
    },
  });

  if (!config?.value) {
    return [];
  }

  try {
    const parsed = JSON.parse(config.value);
    return coerceDomainList(parsed);
  } catch {
    return [];
  }
};

export const setBlockedEmailDomains = async (
  prisma: PrismaClient,
  domains: string[],
): Promise<string[]> => {
  const normalized = coerceDomainList(domains).sort();
  const payload = JSON.stringify(normalized);
  const existing = await prisma.config.findFirst({
    where: {
      name: BLOCKED_EMAIL_DOMAINS_CONFIG_NAME,
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
        name: BLOCKED_EMAIL_DOMAINS_CONFIG_NAME,
        value: payload,
      },
    });
  }

  return normalized;
};
