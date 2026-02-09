import { TRPCError } from '@trpc/server';
import { shieldedProcedure } from '../../../procedures/shielded.procedure';
import { log } from '../../../server';
import stripeInstance, { isStripeConfigured } from '../../../stripe';
import { getStripeCustomer } from '../utils/getStripeCustomer';

export const listStripeCards = shieldedProcedure.query(
  async ({ ctx: { prisma, session } }) => {
    const user = session!.user!;
    if (!isStripeConfigured()) {
      // Local/dev environments may not have Stripe secret keys; do not spam console/network with 500s.
      return { data: [] };
    }

    const stripeCustomerId = await getStripeCustomer(prisma, user);

    try {
      return stripeInstance.customers.listPaymentMethods(
        stripeCustomerId,
        {
          type: 'card',
        },
      );
    } catch (e) {
      log.info(
        `[STRIPE:PAYMENT_METHOD:LIST] Error while listing payment methods, user: ${user.id}`,
      );

      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Error al listar los métodos de pago.',
      });
    }
  },
);
