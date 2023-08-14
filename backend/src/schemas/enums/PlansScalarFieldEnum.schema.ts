import { z } from 'zod';

export const PlansScalarFieldEnumSchema = z.enum([
  'id',
  'name',
  'description',
  'moneda',
  'homedir',
  'gigas',
  'price',
  'duration',
  'activated',
  'tokens',
  'audio_ilimitado',
  'tokens_video',
  'video_ilimitado',
  'tokens_karaoke',
  'karaoke_ilimitado',
  'ilimitado_activo',
  'ilimitado_dias',
  'stripe_prod_id',
  'stripe_prod_id_test',
  'vip_activo',
]);
