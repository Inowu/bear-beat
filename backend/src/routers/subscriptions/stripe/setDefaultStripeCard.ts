import z from 'zod';
import { TRPCError } from '@trpc/server';
import { shieldedProcedure } from '../../../procedures/shielded.procedure';
import stripeInstance from '../../../stripe';
import { log } from '../../../server';
import { getStripeCustomer } from '../utils/getStripeCustomer';

export const setDefaultStripePm = shieldedProcedure
  .input(
    z.object({
      paymentMethodId: z.string(),
    }),
  )
  .mutation(
    async ({ input: { paymentMethodId }, ctx: { prisma, session } }) => {
      const user = session!.user!;
      const stripeCustomer = await getStripeCustomer(prisma, user);

      try {
        log.error(
          `[STRIPE:PAYMENT_METHOD:DEFAULT] Setting default payment method for user: ${user.id} `,
        );

        await stripeInstance.customers.update(stripeCustomer, {
          invoice_settings: {
            default_payment_method: paymentMethodId,
          },
        });
      } catch (e) {
        log.error(
          `[STRIPE:PAYMENT_METHOD:DEFAULT] Error setting default payment method for user: ${user.id}`,
        );

        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Error al establecer el método de pago por defecto.',
        });
      }
    },
  );
