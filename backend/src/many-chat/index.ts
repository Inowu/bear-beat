import axios, { AxiosError } from 'axios';
import { log } from '../server';
import { Users } from '@prisma/client';
import { ManyChatTags, manyChatTags } from './tags';
import { prisma } from '../db';

const client = axios.create({
  baseURL: 'https://api.manychat.com',
  headers: {
    Authorization: `Bearer ${process.env.MC_API_KEY}`,
  },
});

export const manyChat = {
  getInfo: async function (mcId: number): Promise<Record<any, any> | null> {
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
    try {
      const response = await client.post('/fb/subscriber/createSubscriber', {
        first_name: user.first_name,
        last_name: user.last_name,
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
    try {
      const response = await client(
        `/fb/subscriber/findBySystemField?${systemField}=${systemFieldValue}`,
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
    tag: ManyChatTags,
  ): Promise<Array<Record<any, any>> | null> {
    const mcId = await this.getManyChatId(user);

    if (!mcId) return null;

    try {
      const response = await client.post('/fb/subscriber/addTag', {
        subscriber_id: mcId,
        tag_id: manyChatTags[tag],
      });

      return response.data;
    } catch (error: any) {
      log.error(
        `[MANYCHAT] Error while adding tag to subscriber with id ${mcId}: ${
          JSON.stringify((error as AxiosError).response?.data) || error.message
        }`,
      );

      return null;
    }
  },
  getManyChatId: async function (user: Users) {
    let mcId = user.mc_id;

    if (mcId) return mcId;

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
