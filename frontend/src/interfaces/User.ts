export interface IUser {
  email: string;
  exp: number;
  iat: number;
  id: number;
  phone: string;
  profileImg: string | null;
  role: string;
  username: string;
  ftpAccount: null | IFtpAccount;
  hasActiveSubscription: boolean;
  isSubscriptionCancelled: boolean;
}
interface IFtpAccount {
  expiration: Date;
  passwd: string;
  userid: string;
  host: string;
  port: string;
}
export interface IQuota {
  available: bigint;
  used: bigint;
}
export interface IPaymentMethod {
  card: string;
  expire: string;
  name: string;
  type: string;
  default: boolean;
}
export interface IOrders {
  cupon_id: null;
  date_order: Date;
  discount: number;
  id: number;
  invoice_id: null;
  is_canceled: number;
  is_plan: number;
  payment_id: null;
  payment_method: string;
  plan_id: number;
  status: number;
  total_discount: null;
  total_price: number;
  txn_id: null;
  user_id: number;
}
export interface IUser_downloads {
  order_id: number;
  user_id: number;
  ilimitado: number;
  date_end: Date;
  available: number;
}
