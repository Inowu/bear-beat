import { Users } from '@prisma/client';
import * as bizSdk from 'facebook-nodejs-business-sdk';
import { log } from '../server';

const EventRequest = bizSdk.EventRequest;
const UserData = bizSdk.UserData;
const ServerEvent = bizSdk.ServerEvent;
const CustomData = bizSdk.CustomData;

const access_token = process.env.FACEBOOK_ACCESS_TOKEN;
const pixel_id = process.env.FACEBOOK_PIXEL_ID;

if (access_token) {
  bizSdk.FacebookAdsApi.init(access_token);
}

export type FacebookCustomData = {
  value?: number;
  currency?: string;
};

export type FacebookMarketingContext = {
  fbp?: string | null;
  fbc?: string | null;
  eventId?: string | null;
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
    remoteAddress: string | null,
    userAgent: string | null,
    marketing: FacebookMarketingContext,
    sourceUrl: string,
    user: Users,
    customData?: FacebookCustomData
  ) {
    if (!access_token || !pixel_id) {
      // No spamear warnings: es normal que en dev o entornos sin configuración no exista.
      log.debug('[FACEBOOK] CAPI no configurado: faltan FACEBOOK_ACCESS_TOKEN o FACEBOOK_PIXEL_ID');
      return;
    }

    const timestamp = Math.floor(Date.now() / 1000);

    const userData = new UserData()
      .setEmails([user.email])
      .setExternalId(String(user.id));

    const phone = typeof user.phone === 'string' ? user.phone.trim() : '';
    if (phone) {
      userData.setPhones([phone]);
    }

    if (remoteAddress) {
      userData.setClientIpAddress(remoteAddress);
    }

    if (userAgent) {
      userData.setClientUserAgent(userAgent);
    }

    const fbp =
      typeof marketing?.fbp === 'string' ? marketing.fbp.trim() : '';
    if (fbp) {
      userData.setFbp(fbp);
    }

    const fbc =
      typeof marketing?.fbc === 'string' ? marketing.fbc.trim() : '';
    if (fbc) {
      userData.setFbc(fbc);
    }

    const serverEvent = new ServerEvent()
      .setEventName(eventName)
      .setEventTime(timestamp)
      .setUserData(userData)
      .setEventSourceUrl(sourceUrl)
      .setActionSource('website');

    const eventId =
      typeof marketing?.eventId === 'string' ? marketing.eventId.trim() : '';
    if (eventId) {
      serverEvent.setEventId(eventId);
    }

    if (customData && (customData.value != null || customData.currency)) {
      const data = new CustomData();
      if (customData.value != null) data.setValue(customData.value);
      if (customData.currency) data.setCurrency(customData.currency.toUpperCase());
      serverEvent.setCustomData(data);
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
