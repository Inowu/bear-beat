import { z } from 'zod';

export const manyChatTags = {
  USER_CHECKED_PLANS: 43151699,
  USER_REGISTERED: 43150681,
  CHECKOUT_PLAN_ORO: 41612832,
  CHECKOUT_PLAN_CURIOSO: 41612820,
};

export const _manyChatTagsEnum = zodEnumFromObjKeys(manyChatTags);

export type ManyChatTags = z.infer<typeof _manyChatTagsEnum>;

function zodEnumFromObjKeys<K extends string>(
  obj: Record<K, any>,
): z.ZodEnum<[K, ...K[]]> {
  const [firstKey, ...otherKeys] = Object.keys(obj) as K[];
  return z.enum([firstKey, ...otherKeys]);
}
