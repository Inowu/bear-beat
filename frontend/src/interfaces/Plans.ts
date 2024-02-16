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
  paypal_plan_id: string;
  tokens: null;
  tokens_karaoke: null;
  tokens_video: null;
  video_ilimitado: null;
  vip_activo: null;
}
export interface IOxxoData {
  auth_code: null;
  barcode_url: string;
  cashier_id: null;
  expires_at: number;
  object: string;
  reference: string;
  service_name: string;
  store: null;
  sotre_name: string;
  type: string;
}
export interface ISpeiData {
  bank: string;
  clabe: string;
  description: null;
  executed_at: null;
  expires_at: number;
  issuing_account_bank: null;
  issuing_account_holder_name: null;
  issuing_account_number: null;
  issuing_account_tax_id: null;
  object: string;
  payment_attempts: [];
  receiving_account_bank: string;
  receiving_account_holder_name: null;
  receiving_account_number: string;
  receiving_account_tax_id: null;
  reference_number: null;
  tracking_code: null;
  type: string;
}
export interface IGBPlans {
  amount: number;
  id: number;
  name: string;
}
export interface ICreatePlans {
  description: string;
  interval: "month" | "year";
  name: string;
  price: number | "";
  paymentMethod: string;
  moneda: string;
  homedir: string;
  stripe_prod_id_test: string;
  gigas: string;
  duration: string;
}
export interface IUpdatePlans {
  description: string;
  interval: "month" | "year";
  name: string;
  price: number;
  moneda: string;
  gigas: string;
  duration: string;
  activated: number;
}
