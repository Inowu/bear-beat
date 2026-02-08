import { z } from 'zod';

/** IDs de etiquetas en ManyChat. Verifica con: cd backend && npm run manychat:tags */
export const manyChatTags = {
  USER_CHECKED_PLANS: 80813943,
  USER_REGISTERED: 80813944,
  CHECKOUT_PLAN_ORO: 80813945,
  CHECKOUT_PLAN_CURIOSO: 80813946,
  SUCCESSFUL_PAYMENT: 80813947,
  // New (2026) lifecycle tags. IDs may differ per ManyChat workspace; addTag falls back to addTagByName.
  TRIAL_STARTED: 0,
  TRIAL_CONVERTED: 0,
  SUBSCRIPTION_RENEWED: 0,
  CANCELLED_SUBSCRIPTION: 80814857,
  FAILED_PAYMENT: 80814910,
};

/** Nombres de etiquetas (fallback cuando addTag por ID falla). Ajusta a los nombres en ManyChat. */
export const manyChatTagNames: Record<keyof typeof manyChatTags, string> = {
  USER_CHECKED_PLANS: 'Usuario revisó planes',
  USER_REGISTERED: 'Usuario registrado',
  CHECKOUT_PLAN_ORO: 'Checkout Plan Oro',
  CHECKOUT_PLAN_CURIOSO: 'Checkout Plan Curioso',
  SUCCESSFUL_PAYMENT: 'Pago exitoso',
  TRIAL_STARTED: 'Trial iniciado',
  TRIAL_CONVERTED: 'Trial convertido',
  SUBSCRIPTION_RENEWED: 'Renovación de suscripción',
  CANCELLED_SUBSCRIPTION: 'Canceló suscripción',
  FAILED_PAYMENT: 'Pago fallido',
};

export const _manyChatTagsEnum = zodEnumFromObjKeys(manyChatTags);

export type ManyChatTags = z.infer<typeof _manyChatTagsEnum>;

function zodEnumFromObjKeys<K extends string>(
  obj: Record<K, any>,
): z.ZodEnum<[K, ...K[]]> {
  const [firstKey, ...otherKeys] = Object.keys(obj) as K[];
  return z.enum([firstKey, ...otherKeys]);
}
