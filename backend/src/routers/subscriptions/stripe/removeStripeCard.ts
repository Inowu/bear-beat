import z from 'zod';
import { TRPCError } from '@trpc/server';
import { shieldedProcedure } from '../../../procedures/shielded.procedure';
import stripeInstance from '../../../stripe';
import { log } from '../../../server';

export const removeStripeCard = shieldedProcedure
  .input(
    z.object({
      paymentMethodId: z.string(),
    }),
  )
  .mutation(async ({ input: { paymentMethodId } }) => {
    try {
      log.info(
        `[STRIPE:PAYMENT_METHOD:DETACH] Detaching payment method: ${paymentMethodId}`,
      );
      return stripeInstance.paymentMethods.detach(paymentMethodId);
    } catch (e: any) {
      log.error(
        `[STRIPE:PAYMENT_METHOD:DETACH] Error detaching payment method: ${e.message} [${paymentMethodId}]`,
      );

      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Error al eliminar el método de pago.',
      });
    }
  });
