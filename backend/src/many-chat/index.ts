import axios, { AxiosError } from 'axios';
import { log } from '../server';
import { Users } from '@prisma/client';
import { ManyChatTags, manyChatTags, manyChatTagNames } from './tags';
import { prisma } from '../db';

/** Obtiene first_name y last_name para ManyChat; usa username si están vacíos */
function getFirstLastName(user: Users): { first_name: string; last_name: string } {
  if (user.first_name && user.last_name) {
    return { first_name: user.first_name, last_name: user.last_name };
  }
  const base = (user.username || user.email?.split('@')[0] || 'Usuario').trim();
  const parts = base.split(/\s+/).filter(Boolean);
  return {
    first_name: parts[0] || 'Usuario',
    last_name: parts.slice(1).join(' ') || parts[0] || '',
  };
}

// ManyChat subscriber IDs are long numeric strings (often > 2^53). Never coerce to Number.
type ManyChatSubscriberId = string;
const MAX_PRISMA_INT = 2147483647;

function normalizeSubscriberId(raw: unknown): ManyChatSubscriberId | null {
  if (raw === null || raw === undefined) return null;
  const s = String(raw).trim();
  if (!s) return null;
  // Defensive: avoid sending "1e+21" / non-digit garbage to ManyChat API.
  if (!/^[0-9]+$/.test(s)) return null;
  return s;
}

function toPrismaInt(id: ManyChatSubscriberId): number | null {
  // Avoid Number precision issues by only parsing when we know it fits within Prisma Int.
  // (10 digits max is safely below 2^53.)
  if (id.length > 10) return null;
  const n = Number(id);
  if (!Number.isInteger(n)) return null;
  if (n <= 0 || n > MAX_PRISMA_INT) return null;
  return n;
}

const MC_API_KEY = (process.env.MC_API_KEY || '').trim();

const client = axios.create({
  baseURL: 'https://api.manychat.com',
  headers: MC_API_KEY ? { Authorization: `Bearer ${MC_API_KEY}` } : {},
});

const isManyChatConfigured = (): boolean => Boolean(MC_API_KEY);

let didWarnMissingConfig = false;
const warnMissingConfig = (method: string) => {
  if (didWarnMissingConfig) return;
  didWarnMissingConfig = true;
  log.warn(`[MANYCHAT] MC_API_KEY not configured; skipping ManyChat calls (first seen in ${method})`);
};

type ManyChatCustomField = {
  id?: number | string | null;
  name?: string | null;
};

const CUSTOM_FIELDS_CACHE_TTL_MS = 5 * 60 * 1000;
let customFieldsCache:
  | { fetchedAt: number; byName: Map<string, number> }
  | null = null;

async function fetchCustomFieldsByName(): Promise<Map<string, number>> {
  const res = await client.get('/fb/page/getCustomFields');
  const fields = res.data?.data ?? res.data?.fields ?? res.data;
  if (!Array.isArray(fields)) return new Map();

  const byName = new Map<string, number>();
  for (const item of fields as ManyChatCustomField[]) {
    const name = String(item?.name ?? '').trim();
    const id = Number(item?.id ?? 0);
    if (!name || !Number.isFinite(id) || id <= 0) continue;
    byName.set(name.toLowerCase(), id);
  }
  return byName;
}

async function getCustomFieldId(fieldKey: string): Promise<number | null> {
  const key = String(fieldKey ?? '').trim().toLowerCase();
  if (!key) return null;

  const now = Date.now();
  const isFresh =
    customFieldsCache && now - customFieldsCache.fetchedAt < CUSTOM_FIELDS_CACHE_TTL_MS;

  if (!isFresh) {
    try {
      const byName = await fetchCustomFieldsByName();
      customFieldsCache = { fetchedAt: now, byName };
    } catch (error: any) {
      log.error('[MANYCHAT] Error fetching custom fields', {
        message: error instanceof Error ? error.message : String(error ?? ''),
      });
      return null;
    }
  }

  let id = customFieldsCache?.byName.get(key) ?? null;
  if (id) return id;

  // If missing, refresh once (handles recently-added fields without waiting TTL).
  try {
    const byName = await fetchCustomFieldsByName();
    customFieldsCache = { fetchedAt: now, byName };
    id = customFieldsCache.byName.get(key) ?? null;
    return id;
  } catch {
    return null;
  }
}

export const manyChat = {
  getInfo: async function (mcId: ManyChatSubscriberId): Promise<Record<any, any> | null> {
    if (!isManyChatConfigured()) {
      warnMissingConfig('getInfo');
      return null;
    }
    try {
      const response = await client(
        `/fb/subscriber/getInfo?subscriber_id=${encodeURIComponent(mcId)}`,
      );

      return response.data.data;
    } catch (error: any) {
      const axiosErr = error as AxiosError;
      log.error('[MANYCHAT] getInfo failed', {
        status: axiosErr.response?.status ?? null,
        error: axiosErr.message,
      });

      return null;
    }
  },
  findByCustomField: async function (
    customFieldKey: string,
    customFieldValue: string,
  ) {
    if (!isManyChatConfigured()) {
      warnMissingConfig('findByCustomField');
      return null;
    }
    try {
      const response = await client(
        `/fb/subscriber/findByCustomField?key=${customFieldKey}&value=${customFieldValue}`,
      );

      return response.data.data;
    } catch (error: any) {
      const axiosErr = error as AxiosError;
      log.error('[MANYCHAT] findByCustomField failed', {
        fieldKey: customFieldKey,
        status: axiosErr.response?.status ?? null,
        error: axiosErr.message,
      });

      return null;
    }
  },
  createSubscriber: async function (
    user: Users,
    consentPhrase: string,
  ): Promise<Record<any, any> | null> {
    if (!isManyChatConfigured()) {
      warnMissingConfig('createSubscriber');
      return null;
    }
    const { first_name, last_name } = getFirstLastName(user);
    try {
      const response = await client.post('/fb/subscriber/createSubscriber', {
        first_name,
        last_name,
        phone: user.phone?.replace(/\s/g, ''),
        whatsapp_phone: user.phone?.replace(/\s/g, ''),
        optin_whatsapp: true,
        email: user.email,
        has_opt_in_sms: true,
        has_opt_in_email: true,
        consent_phrase: consentPhrase,
      });

      return response.data.data;
    } catch (error: any) {
      const axiosErr = error as AxiosError;
      log.error('[MANYCHAT] createSubscriber failed', {
        status: axiosErr.response?.status ?? null,
        error: axiosErr.message,
      });

      return null;
    }
  },
  setCustomField: async function (
    mcId: ManyChatSubscriberId,
    fieldKey: string,
    fieldValue: string,
  ) {
    if (!isManyChatConfigured()) {
      warnMissingConfig('setCustomField');
      return null;
    }

    const fieldId = await getCustomFieldId(fieldKey);
    if (!fieldId) {
      log.warn('[MANYCHAT] Custom field not found; skipping setCustomField', {
        fieldKey,
      });
      return null;
    }
    try {
      const response = await client.post('/fb/subscriber/setCustomField', {
        subscriber_id: mcId,
        field_id: fieldId,
        field_value: fieldValue,
      });

      return response.data.data;
    } catch (error: any) {
      const axiosErr = error as AxiosError;
      log.error('[MANYCHAT] setCustomField failed', {
        fieldKey,
        status: axiosErr.response?.status ?? null,
        error: axiosErr.message,
      });

      return null;
    }
  },
  updateSubscriber: async function (
    user: Partial<Users>,
    mcId: ManyChatSubscriberId,
    consentPhrase: string,
  ) {
    if (!isManyChatConfigured()) {
      warnMissingConfig('updateSubscriber');
      return null;
    }
    try {
      const response = await client.post('/fb/subscriber/updateSubscriber', {
        ...user,
        subscriber_id: mcId,
        phone: user.phone?.replace(/\s/g, ''),
        email: user.email,
        has_opt_in_sms: true,
        has_opt_in_email: true,
        consent_phrase: consentPhrase,
        optin_whatsapp: true,
        whatsapp_phone: user.phone?.replace(/\s/g, ''),
      });

      return response.data.data;
    } catch (error: any) {
      const axiosErr = error as AxiosError;
      log.error('[MANYCHAT] updateSubscriber failed', {
        status: axiosErr.response?.status ?? null,
        error: axiosErr.message,
      });
      return null;
    }
  },
  findBySystemField: async function (
    systemField: 'email' | 'phone',
    systemFieldValue: string,
  ): Promise<Array<Record<any, any>> | null> {
    if (!isManyChatConfigured()) {
      warnMissingConfig('findBySystemField');
      return null;
    }
    try {
      const encoded = encodeURIComponent(systemFieldValue);
      const response = await client(
        `/fb/subscriber/findBySystemField?${systemField}=${encoded}`,
      );

      return response.data.data;
    } catch (error: any) {
      const axiosErr = error as AxiosError;
      log.error('[MANYCHAT] findBySystemField failed', {
        systemField,
        status: axiosErr.response?.status ?? null,
        error: axiosErr.message,
      });

      return null;
    }
  },
  addTagToUser: async function (
    user: Users,
    tag: ManyChatTags | string,
  ): Promise<Array<Record<any, any>> | null> {
    if (!isManyChatConfigured()) {
      warnMissingConfig('addTagToUser');
      return null;
    }
    const mcId = await this.getManyChatId(user);

    if (!mcId) {
      log.warn(`[MANYCHAT] No mc_id available, cannot add tag ${tag}`);
      return null;
    }

    const subscriberId = mcId;
    const tagRaw = String(tag || '').trim();
    if (!tagRaw) return null;

    const hasKey = Object.prototype.hasOwnProperty.call(manyChatTags, tagRaw);
    const tagKey = hasKey ? (tagRaw as keyof typeof manyChatTags) : null;
    const tagId = tagKey ? manyChatTags[tagKey] : null;
    const tagName = tagKey ? manyChatTagNames[tagKey] : tagRaw;

    const tryAddByName = async () => {
      try {
        const response = await client.post('/fb/subscriber/addTagByName', {
          subscriber_id: subscriberId,
          tag_name: tagName,
        });
        log.info(`[MANYCHAT] Tag "${tagName}" added via addTagByName`);
        return response.data;
      } catch (fallbackError: any) {
        const axiosErr = fallbackError as AxiosError;
        log.error('[MANYCHAT] addTagByName failed', {
          tagName,
          status: axiosErr.response?.status ?? null,
          error: axiosErr.message,
        });
        return null;
      }
    };

    // 1. Intentar por ID
    if (typeof tagId === 'number' && Number.isFinite(tagId) && tagId > 0) {
      try {
        const response = await client.post('/fb/subscriber/addTag', {
          subscriber_id: subscriberId,
          tag_id: tagId,
        });
        log.info(`[MANYCHAT] Tag ${tagRaw} (id ${tagId}) added`);
        return response.data;
      } catch (error: any) {
        const axiosErr = error as AxiosError;
        log.warn('[MANYCHAT] addTag by ID failed; retrying by name', {
          tag: tagRaw,
          tagId,
          status: axiosErr.response?.status ?? null,
          error: axiosErr.message,
        });
        return tryAddByName();
      }
    }

    // If tagId is missing/0 (IDs differ across ManyChat workspaces), go straight to addTagByName.
    return tryAddByName();
  },
  getManyChatId: async function (user: Users) {
    const mcIdFromDb = normalizeSubscriberId(user.mc_id);
    if (mcIdFromDb) return mcIdFromDb;

    if (!isManyChatConfigured()) {
      warnMissingConfig('getManyChatId');
      return null;
    }

    const existingSubscriberByEmail = await this.findBySystemField(
      'email',
      user.email,
    );

    if (existingSubscriberByEmail?.length) {
      log.info('[MANYCHAT:RETRIEVE_OR_CREATE] Subscriber found in ManyChat by email');

      return normalizeSubscriberId(existingSubscriberByEmail?.[0]?.id);
    }

    const existingSubscriberByPhone = user.phone
      ? await this.findBySystemField('phone', user.phone)
      : null;

    if (existingSubscriberByPhone?.length) {
      log.info('[MANYCHAT:RETRIEVE_OR_CREATE] Subscriber found in ManyChat by phone');

      return normalizeSubscriberId(existingSubscriberByPhone?.[0]?.id);
    }

    log.info(
      "[MANYCHAT:RETRIEVE_OR_CREATE] Subscriber wasn't found in ManyChat, creating a new subscriber...",
    );

    const subscriber = await this.createSubscriber(user, 'Consent');

    if (!subscriber) return null;

    const createdId = normalizeSubscriberId((subscriber as any).id);
    if (!createdId) return null;

    log.info('[MANYCHAT:RETRIEVE_OR_CREATE] Created new subscriber');

    await this.updateSubscriber(user, createdId, 'Consent');

    try {
      const mcIdInt = toPrismaInt(createdId);
      // Persist only when it fits in Prisma Int. ManyChat IDs are usually bigger; that's OK.
      if (mcIdInt) {
        await prisma.users.update({
          where: {
            id: user.id,
          },
          data: {
            mc_id: mcIdInt,
          },
        });
      }
    } catch (e: any) {
      log.error(
        `[MANYCHAT:GET_ID] Error updating user with mc_id: ${e.message}`,
      );
    }

    return createdId;
  },
};
