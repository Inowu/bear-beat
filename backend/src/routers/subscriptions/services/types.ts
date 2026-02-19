import { Plans, PrismaClient, Users } from '@prisma/client';
import { SessionUser } from '../../auth/utils/serialize-user';

export enum PaymentService {
  STRIPE = 'Stripe',
  STRIPE_OXXO = 'Stripe OXXO',
  CONEKTA = 'Conekta',
  ADMIN = 'ADMIN',
  STRIPE_RENOVACION = 'Stripe Renovacion',
  PAYPAL = 'Paypal',
  STRIPE_PLAN_CHANGE = 'Stripe Plan Change',
  PAYPAL_PLAN_CHANGE = 'Paypal Plan Change',
}

export type Params =
  | {
      plan: Plans;
      prisma: PrismaClient;
      user: Users | SessionUser;
      subId: string;
      orderId?: never;
      service: PaymentService;
      expirationDate: Date;
      /**
       * When true and orderId is provided, reuses the existing PAID order
       * instead of creating a new renewal order.
       */
      reusePaidOrderId?: boolean;
      /** Override the download quota (in GB) to assign for this subscription period (e.g. trials). */
      quotaGb?: number;
      /** When true, does not mark the order as PAID (used for free trials). */
      isTrial?: boolean;
    }
  | {
      prisma: PrismaClient;
      user: Users | SessionUser;
      orderId: string | number;
      subId: string;
      plan?: never;
      service: PaymentService;
      expirationDate: Date;
      /**
       * When true and orderId is provided, reuses the existing PAID order
       * instead of creating a new renewal order.
       */
      reusePaidOrderId?: boolean;
      /** Override the download quota (in GB) to assign for this subscription period (e.g. trials). */
      quotaGb?: number;
      /** When true, does not mark the order as PAID (used for free trials). */
      isTrial?: boolean;
    };
