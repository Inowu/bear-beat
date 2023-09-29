import { Plans, PrismaClient, Users } from '@prisma/client';

export enum SubscriptionService {
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
      user: Users;
      subId: string;
      orderId?: never;
      service: SubscriptionService;
      expirationDate: Date;
    }
  | {
      prisma: PrismaClient;
      user: Users;
      orderId: string;
      subId: string;
      plan?: never;
      service: SubscriptionService;
      expirationDate: Date;
    };
