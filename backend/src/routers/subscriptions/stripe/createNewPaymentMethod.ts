import z from 'zod';
import { TRPCError } from '@trpc/server';
import { shieldedProcedure } from '../../../procedures/shielded.procedure';
import stripeInstance from '../../../stripe';
import { log } from '../../../server';
import { getStripeCustomer } from '../utils/getStripeCustomer';

export const createNewPaymentMethod = shieldedProcedure
  .input(
    z.object({
      paymentMethodId: z.string(),
    }),
  )
  .mutation(async ({ input: { paymentMethodId }, ctx: { prisma, session } }) => {
    const user = session!.user!;
    const stripeCustomerId = await getStripeCustomer(prisma, user);

    try {
      log.info(
        `[STRIPE:PAYMENT_METHOD:CREATE] Linking payment method for user ${user.id}`,
      );
      const pm = await stripeInstance.paymentMethods.retrieve(paymentMethodId);
      const pmCustomerId =
        typeof pm.customer === 'string' ? pm.customer : pm.customer?.id ?? null;
      if (pmCustomerId && pmCustomerId !== stripeCustomerId) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Ese método de pago ya está asociado a otra cuenta.',
        });
      }

      if (!pmCustomerId) {
        log.info(
          `[STRIPE:PAYMENT_METHOD:ATTACH] Attaching payment method to user ${user.id}`,
        );
        await stripeInstance.paymentMethods.attach(pm.id, {
          customer: stripeCustomerId,
        });
      }

      await stripeInstance.customers.update(stripeCustomerId, {
        invoice_settings: { default_payment_method: pm.id },
      });

      return { paymentMethodId: pm.id };
    } catch (e: any) {
      log.error(
        `[STRIPE:PAYMENT_METHOD:CREATE] Error creating payment method for user ${user.id}: ${e.message}`,
      );
      if (e instanceof TRPCError) throw e;

      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Error al crear el método de pago.',
      });
    }
  });
