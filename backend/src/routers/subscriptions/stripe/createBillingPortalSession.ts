import z from 'zod';
import { TRPCError } from '@trpc/server';
import { shieldedProcedure } from '../../../procedures/shielded.procedure';
import stripeInstance from '../../../stripe';
import { getStripeCustomer } from '../utils/getStripeCustomer';

/**
 * Crea una sesión del Customer Billing Portal de Stripe.
 * El usuario puede actualizar tarjeta, ver facturas y cancelar desde el portal de Stripe.
 */
export const createBillingPortalSession = shieldedProcedure
  .input(
    z.object({
      returnUrl: z.string().url(),
    }),
  )
  .mutation(async ({ input: { returnUrl }, ctx: { prisma, session } }) => {
    const user = session!.user!;
    const stripeCustomerId = await getStripeCustomer(prisma, user);

    try {
      const portalSession = await stripeInstance.billingPortal.sessions.create({
        customer: stripeCustomerId,
        return_url: returnUrl,
      });
      return { url: portalSession.url };
    } catch (e: any) {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'No se pudo abrir el portal de pagos. Intenta más tarde.',
      });
    }
  });
