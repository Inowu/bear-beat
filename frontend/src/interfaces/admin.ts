export interface IAdminUser {
  email: string;
  username: string;
  active: number;
  id: number;
  registered_on: Date;
  blocked: boolean;
  phone: string;
  role: number;
}
export interface IAdminOrders {
  city: string;
  date_order: Date;
  email: string;
  id: number;
  payment_method: "Paypal" | "Stripe" | null;
  phone: string;
  status: number;
  total_price: number;
  txn_id: string;
}
export interface IAdminCoupons {
  active: number;
  code: string;
  cupon_condition: null;
  description: string;
  discount: number;
  id: number;
  parameter: number;
  type: 1;
}

export interface IAdminDownloadHistory {
  id: number;
  userId: number;
  size: bigint;
  date: Date;
  fileName: string;
  isFolder: boolean;
  email: string;
  phone: string;
}

export enum USER_ROLES {
  'ADMIN' = 1,
  'SUBADMIN' = 2,
  'EDITOR' = 3,
  'NORMAL' = 4,
}

export enum ORDER_STATUS {
  PENDING = 0,
  PAID = 1,
  FAILED = 2,
  CANCELLED = 3,
  EXPIRED = 4,
}
