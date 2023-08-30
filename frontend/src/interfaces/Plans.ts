export interface PlanI {
  id: number;
  title: string;
  price: string;
  description: string;
  duration: number;
  included: Array<string>;
  space: number;
  priceIdStripe: string;
  priceIdPaypal: string;
}
export interface IPlans {
  activated: number;
  audio_ilimitado: null;
  conekta_plan_id: null;
  conekta_plan_id_test: null;
  description: string;
  duration: string;
  gigas: bigint;
  homedir: string;
  id: number;
  ilimitado_activo: null;
  ilimitado_dias: null;
  karaoke_ilimitado: null;
  moneda: string;
  name: string;
  price: string;
  stripe_prod_id: string;
  stripe_prod_id_test: string;
  tokens: null;
  tokens_karaoke: null;
  tokens_video: null;
  video_ilimitado: null;
  vip_activo: null;
}