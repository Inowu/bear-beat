export interface IUser {
    email: string;
    exp: number;
    iat: number;
    id: number;
    phone: string;
    profileImg: string | null;
    role: string;
    username: string;
    ftpAccount: null;
  }
  export interface IQuota{
    available: number;
    used: number;
  }
  export interface IOrders{
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