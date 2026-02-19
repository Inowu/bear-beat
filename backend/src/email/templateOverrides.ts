import { PrismaClient } from '@prisma/client';
import { prisma as defaultPrisma } from '../db';
import { log } from '../server';
import {
  type EmailTemplateContent,
  type EmailTemplateKey,
  normalizeEmailTemplateLookupKey,
} from './templateCatalog';

export type EmailTemplateVariables = Record<string, unknown>;

type OverrideRecord = {
  template_key: string;
  enabled: boolean;
  subject: string | null;
  html: string | null;
  text: string | null;
  updated_at: Date;
  updated_by_user_id: number | null;
};

type CachedOverrideEntry = {
  expiresAt: number;
  value: OverrideRecord | null;
};

const CACHE_TTL_MS = 15 * 1000;
const TOKEN_PATTERN = /{{\s*([A-Za-z][A-Za-z0-9_]*)\s*}}/g;
const MAX_SUBJECT_LENGTH = 191;

const overrideCache = new Map<EmailTemplateKey, CachedOverrideEntry>();

const resolvePrisma = (prisma?: PrismaClient): PrismaClient => prisma ?? defaultPrisma;

const sanitizeSubject = (value: string): string =>
  String(value || '')
    .replace(/[\r\n]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_SUBJECT_LENGTH);

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const buildTemplateVariableMap = (
  variables: EmailTemplateVariables | undefined,
): Map<string, string> => {
  const out = new Map<string, string>();
  if (!variables) return out;

  Object.entries(variables).forEach(([rawKey, rawValue]) => {
    if (rawValue == null) return;
    const key = String(rawKey || '').trim();
    if (!key) return;
    const normalizedValue = String(rawValue);
    out.set(key.toUpperCase(), normalizedValue);
  });

  return out;
};

const renderTemplateString = (
  value: string,
  variables: EmailTemplateVariables | undefined,
  mode: 'subject' | 'html' | 'text',
): string => {
  if (!value) return '';
  const dictionary = buildTemplateVariableMap(variables);

  return value.replace(TOKEN_PATTERN, (fullMatch, tokenName: string) => {
    const normalizedToken = String(tokenName || '').trim().toUpperCase();
    if (!normalizedToken) return fullMatch;

    const resolved = dictionary.get(normalizedToken);
    if (resolved == null) return fullMatch;

    if (mode === 'html') {
      return escapeHtml(resolved);
    }

    return resolved;
  });
};

const normalizeNullableString = (
  value: string | null | undefined,
): string | null => {
  if (value == null) return null;
  const normalized = String(value).replace(/\r\n/g, '\n');
  if (!normalized.trim()) return null;
  return normalized;
};

const findOverrideRecord = async (
  params: {
    prisma?: PrismaClient;
    templateKey: EmailTemplateKey;
    bypassCache?: boolean;
  },
): Promise<OverrideRecord | null> => {
  const { templateKey, bypassCache = false } = params;
  const now = Date.now();

  if (!bypassCache) {
    const cached = overrideCache.get(templateKey);
    if (cached && cached.expiresAt > now) {
      return cached.value;
    }
  }

  const prisma = resolvePrisma(params.prisma);
  const record = await prisma.emailTemplateOverride.findUnique({
    where: { template_key: templateKey },
    select: {
      template_key: true,
      enabled: true,
      subject: true,
      html: true,
      text: true,
      updated_at: true,
      updated_by_user_id: true,
    },
  });

  overrideCache.set(templateKey, {
    expiresAt: now + CACHE_TTL_MS,
    value: record,
  });

  return record;
};

export const invalidateEmailTemplateOverrideCache = (
  templateKey?: string,
): void => {
  const raw = String(templateKey || '').trim();
  if (!raw) {
    overrideCache.clear();
    return;
  }

  const normalized = normalizeEmailTemplateLookupKey(raw);
  if (!normalized) return;
  overrideCache.delete(normalized);
};

export const renderEmailTemplateContent = (params: {
  content: EmailTemplateContent;
  variables?: EmailTemplateVariables;
}): EmailTemplateContent => {
  const { content, variables } = params;

  const renderedSubject = sanitizeSubject(
    renderTemplateString(String(content.subject || ''), variables, 'subject'),
  );
  const renderedHtml = renderTemplateString(String(content.html || ''), variables, 'html');
  const renderedText = renderTemplateString(String(content.text || ''), variables, 'text');

  return {
    subject: renderedSubject,
    html: renderedHtml,
    text: renderedText,
  };
};

export const resolveEmailTemplateContent = async (params: {
  templateKey: string;
  fallback: EmailTemplateContent;
  variables?: EmailTemplateVariables;
  prisma?: PrismaClient;
}): Promise<EmailTemplateContent> => {
  const { templateKey, fallback, variables } = params;
  const normalizedTemplateKey = normalizeEmailTemplateLookupKey(templateKey);
  if (!normalizedTemplateKey) {
    return fallback;
  }

  try {
    const record = await findOverrideRecord({
      prisma: params.prisma,
      templateKey: normalizedTemplateKey,
    });

    if (!record || !record.enabled) {
      return fallback;
    }

    const fallbackSubject = sanitizeSubject(String(fallback.subject || ''));
    const fallbackHtml = String(fallback.html || '');
    const fallbackText = String(fallback.text || '');

    const overrideSubject = normalizeNullableString(record.subject);
    const overrideHtml = normalizeNullableString(record.html);
    const overrideText = normalizeNullableString(record.text);

    const rendered = renderEmailTemplateContent({
      content: {
        subject: overrideSubject ?? fallbackSubject,
        html: overrideHtml ?? fallbackHtml,
        text: overrideText ?? fallbackText,
      },
      variables,
    });

    return {
      subject: rendered.subject || fallbackSubject,
      html: rendered.html || fallbackHtml,
      text: rendered.text || fallbackText,
    };
  } catch (error) {
    log.warn('[EMAIL] Failed to resolve template override; using default template', {
      templateKey: normalizedTemplateKey,
      error: error instanceof Error ? error.message : error,
    });
    return fallback;
  }
};

export const getEmailTemplateOverride = async (params: {
  templateKey: string;
  prisma?: PrismaClient;
  bypassCache?: boolean;
}): Promise<OverrideRecord | null> => {
  const normalizedTemplateKey = normalizeEmailTemplateLookupKey(params.templateKey);
  if (!normalizedTemplateKey) return null;

  return findOverrideRecord({
    prisma: params.prisma,
    templateKey: normalizedTemplateKey,
    bypassCache: params.bypassCache,
  });
};
