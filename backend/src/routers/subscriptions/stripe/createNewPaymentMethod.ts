import z from 'zod';
import { TRPCError } from '@trpc/server';
import { shieldedProcedure } from '../../../procedures/shielded.procedure';
import stripeInstance from '../../../stripe';
import { log } from '../../../server';

export const createNewPaymentMethod = shieldedProcedure
  .input(
    z.object({
      cardToken: z.string(),
    }),
  )
  .mutation(async ({ input: { cardToken }, ctx: { prisma, session } }) => {
    const user = session!.user!;

    const dbUser = await prisma.users.findFirst({
      where: {
        id: user.id,
      },
    });

    try {
      log.info(
        `[STRIPE:PAYMENT_METHOD:CREATE] Creating payment method for user ${user.id}`,
      );
      const pm = await stripeInstance.paymentMethods.create({
        type: 'card',
        card: {
          token: cardToken,
        },
      });

      log.info(
        `[STRIPE:PAYMENT_METHOD:ATTACH] Attaching payment method to user ${user.id}`,
      );
      await stripeInstance.paymentMethods.attach(pm.id, {
        customer: dbUser?.stripe_cusid!,
      });
    } catch (e: any) {
      log.error(
        `[STRIPE:PAYMENT_METHOD:CREATE] Error creating payment method for user ${user.id}: ${e.message}`,
      );

      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Error al crear el método de pago.',
      });
    }
  });
