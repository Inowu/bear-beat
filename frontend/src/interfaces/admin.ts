export interface IAdminUser {
  email: string;
  username: string;
  active: number;
  id: number;
  registered_on: Date;
  blocked: boolean;
  phone: string;
}
export interface IAdminOrders {
  city: string;
  email: string;
  phone: string;
  payment_method: "Paypal" | "Stripe" | null;
  txn_id: string;
  total_price: number;
  date_order: Date;
  status: number;
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
