import { TRPCError } from '@trpc/server';
import { shieldedProcedure } from '../../../procedures/shielded.procedure';
import { log } from '../../../server';
import stripeInstance from '../../../stripe';
import { getStripeCustomer } from '../utils/getStripeCustomer';

export const listStripeCards = shieldedProcedure.query(
  async ({ ctx: { prisma, session } }) => {
    const user = session!.user!;
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
