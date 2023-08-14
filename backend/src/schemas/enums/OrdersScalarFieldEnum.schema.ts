import { z } from 'zod';

export const OrdersScalarFieldEnumSchema = z.enum([
  'id',
  'date_order',
  'payment_id',
  'user_id',
  'total_price',
  'status',
  'discount',
  'total_discount',
  'cupon_id',
  'is_plan',
  'plan_id',
  'txn_id',
  'payment_method',
  'invoice_id',
  'is_canceled',
]);
