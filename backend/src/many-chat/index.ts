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

export const manyChat = {
  getInfo: async function (mcId: number): Promise<Record<any, any> | null> {
    if (!isManyChatConfigured()) {
      warnMissingConfig('getInfo');
      return null;
    }
    try {
      const response = await client(
        `/fb/subscriber/getInfo?subscriber_id=${mcId}`,
      );

      return response.data.data;
    } catch (error: any) {
      log.error(
        `[MANYCHAT] Error getting many chat subscriber information: ${
          JSON.stringify((error as AxiosError).response?.data) || error.message
        }`,
      );

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
      log.error(
        `[MANYCHAT] Error finding subcriber by custom field: ${JSON.stringify(
          (error as AxiosError).response?.data,
        )}`,
      );

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
      log.error(
        `[MANYCHAT] Error while creating many chat subscriber for user ${
          user.id
        }, data: ${JSON.stringify(
          (error as AxiosError).response?.config.data,
        )}, error: ${JSON.stringify((error as AxiosError).response?.data)}`,
      );

      return null;
    }
  },
  setCustomField: async function (
    mcId: number,
    fieldKey: string,
    fieldValue: string,
  ) {
    if (!isManyChatConfigured()) {
      warnMissingConfig('setCustomField');
      return null;
    }
    try {
      const response = await client.post('/fb/subscriber/setCustomField', {
        subscriber_id: mcId,
        field_name: fieldKey,
        field_value: fieldValue,
      });

      return response.data.data;
    } catch (error: any) {
      log.error(
        `[MANYCHAT] Error setting custom field for subscriber ${mcId}: ${
          JSON.stringify((error as AxiosError).response?.data) || error.message
        }`,
      );

      return null;
    }
  },
  updateSubscriber: async function (
    user: Partial<Users>,
    mcId: number,
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
      log.error(
        `[MANYCHAT] Error updating subscriber ${user.id}: ${
          JSON.stringify((error as AxiosError).response?.data) || error.message
        }`,
      );
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
      log.error(
        `[MANYCHAT] Error finding subcriber by system field: ${
          JSON.stringify((error as AxiosError).response?.data) || error.message
        }`,
      );

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
      log.warn(`[MANYCHAT] No mc_id for user ${user.id}, cannot add tag ${tag}`);
      return null;
    }

    const subscriberId = Number(mcId);
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
        log.info(`[MANYCHAT] Tag "${tagName}" added via addTagByName to subscriber ${subscriberId}`);
        return response.data;
      } catch (fallbackError: any) {
        const fbData = (fallbackError as AxiosError).response?.data;
        log.error(
          `[MANYCHAT] addTagByName failed for user ${user.id}, subscriber ${subscriberId}, tag "${tagName}": ${JSON.stringify(fbData) || fallbackError.message}`,
        );
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
        log.info(`[MANYCHAT] Tag ${tagRaw} (id ${tagId}) added to subscriber ${subscriberId}`);
        return response.data;
      } catch (error: any) {
        const errData = (error as AxiosError).response?.data;
        const errStr = JSON.stringify(errData) || error.message;
        log.warn(
          `[MANYCHAT] addTag by ID failed for user ${user.id}, subscriber ${subscriberId}, tag ${tagRaw} (id ${tagId}): ${errStr}. Trying addTagByName...`,
        );
        return tryAddByName();
      }
    }

    // If tagId is missing/0 (IDs differ across ManyChat workspaces), go straight to addTagByName.
    return tryAddByName();
  },
  getManyChatId: async function (user: Users) {
    let mcId = user.mc_id;

    if (mcId) return mcId;

    if (!isManyChatConfigured()) {
      warnMissingConfig('getManyChatId');
      return null;
    }

    const existingSubscriberByEmail = await this.findBySystemField(
      'email',
      user.email,
    );

    if (existingSubscriberByEmail?.length) {
      log.info(
        `[MANYCHAT:RETRIEVE_OR_CREATE] User ${user.id} found in many chat by email`,
      );

      return existingSubscriberByEmail?.[0].id;
    }

    const existingSubscriberByPhone = user.phone
      ? await this.findBySystemField('phone', user.phone)
      : null;

    if (existingSubscriberByPhone?.length) {
      log.info(
        `[MANYCHAT:RETRIEVE_OR_CREATE] User ${user.id} found in many chat by phone`,
      );

      return existingSubscriberByPhone?.[0].id;
    }

    log.info(
      `[MANYCHAT:RETRIEVE_OR_CREATE] User ${user.id} wasn't found in many chat, creating a new subscriber...`,
    );

    const subscriber = await this.createSubscriber(user, 'Consent');

    if (!subscriber) return null;

    log.info(
      `[MANYCHAT:RETRIEVE_OR_CREATE] Created new subscriber with id ${subscriber.id} for user ${user.id}`,
    );

    log.info(
      `[MANYCHAT:RETRIEVE_OR_CREATE] Updating user ${user.id} with mc_id ${subscriber.id}`,
    );

    await this.updateSubscriber(user, subscriber.id, 'Consent');

    try {
      await prisma.users.update({
        where: {
          id: user.id,
        },
        data: {
          mc_id: Number(subscriber.id),
        },
      });
    } catch (e: any) {
      log.error(
        `[MANYCHAT:GET_ID] Error updating user ${user.id} with mc_id ${subscriber.id}: ${e.message}`,
      );
    }

    return subscriber.id;
  },
};
