import { Plans, PrismaClient, Users } from '@prisma/client';
import { SessionUser } from '../../auth/utils/serialize-user';

export enum PaymentService {
  STRIPE = 'Stripe',
  CONEKTA = 'Conekta',
  ADMIN = 'ADMIN',
  STRIPE_RENOVACION = 'Stripe Renovacion',
  PAYPAL = 'Paypal',
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
    }
  | {
      prisma: PrismaClient;
      user: Users | SessionUser;
      orderId: string | number;
      subId: string;
      plan?: never;
      service: PaymentService;
      expirationDate: Date;
    };
