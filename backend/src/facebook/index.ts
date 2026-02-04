import { Users } from '@prisma/client';
import * as bizSdk from 'facebook-nodejs-business-sdk';
import { log } from '../server';

const EventRequest = bizSdk.EventRequest;
const UserData = bizSdk.UserData;
const ServerEvent = bizSdk.ServerEvent;

const access_token = process.env.FACEBOOK_ACCESS_TOKEN;
const pixel_id = process.env.FACEBOOK_PIXEL_ID;

if (access_token) {
  bizSdk.FacebookAdsApi.init(access_token);
}

export type FacebookCustomData = {
  value?: number;
  currency?: string;
};

/**
 * Envía un evento al Conversions API de Meta (CAPI).
 * Usar nombres estándar: "CompleteRegistration" (registro), "Purchase" (compra).
 * Para Purchase, pasar customData con value y currency (requeridos por Meta).
 * Si FACEBOOK_ACCESS_TOKEN o FACEBOOK_PIXEL_ID no están definidos, no se envía nada.
 */
export const facebook = {
  setEvent: async function (
    eventName: string,
    remoteAddress: string,
    userAgent: string,
    fbp: string,
    sourceUrl: string,
    user: Users,
    customData?: FacebookCustomData
  ) {
    if (!access_token || !pixel_id) {
      log.warn('[FACEBOOK] CAPI no configurado: faltan FACEBOOK_ACCESS_TOKEN o FACEBOOK_PIXEL_ID');
      return;
    }

    const timestamp = Math.floor(Date.now() / 1000);

    const userData = new UserData()
      .setEmails([user.email])
      .setPhones([user.phone || ''])
      .setClientIpAddress(remoteAddress)
      .setClientUserAgent(userAgent)
      .setFbp(fbp);

    const serverEvent = new ServerEvent()
      .setEventName(eventName)
      .setEventTime(timestamp)
      .setUserData(userData)
      .setEventSourceUrl(sourceUrl)
      .setActionSource('website');

    if (customData && (customData.value != null || customData.currency)) {
      const data: Record<string, unknown> = {};
      if (customData.value != null) data.value = customData.value;
      if (customData.currency) data.currency = customData.currency.toUpperCase();
      serverEvent.setCustomData(data as any);
    }

    const eventRequest = new EventRequest(access_token, pixel_id).setEvents([serverEvent]);

    eventRequest
      .execute()
      .then((response: unknown) => {
        log.info('[FACEBOOK] CAPI event sent', { eventName, response: (response as any)?.toString?.() ?? response });
      })
      .catch((err: unknown) => {
        log.error('[FACEBOOK] CAPI error', { eventName, err: err instanceof Error ? err.message : err });
      });
  },
};
