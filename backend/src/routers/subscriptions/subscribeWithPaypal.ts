import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import axios from 'axios';
import { shieldedProcedure } from '../../procedures/shielded.procedure';
import { log } from '../../server';
import { PaymentService } from './services/types';
import { subscribe } from './services/subscribe';
import { paypal } from '../../paypal';
import { brevo } from '../../email';

export const subscribeWithPaypal = shieldedProcedure
  .input(
    z.object({
      planId: z.number(),
      subscriptionId: z.string(),
    }),
  )
  .mutation(
    async ({ input: { planId, subscriptionId }, ctx: { prisma, session } }) => {
      const user = session!.user!;

      const plan = await prisma.plans.findFirst({
        where: {
          id: planId,
        },
      });

      if (!plan) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Ese plan no existe',
        });
      }

      try {
        const paypalToken = await paypal.getToken();

        const subscription = (
          await axios(
            `${paypal.paypalUrl()}/v1/billing/subscriptions/${subscriptionId}`,
            {
              headers: {
                Authorization: `Bearer ${paypalToken}`,
              },
            },
          )
        ).data;

        await subscribe({
          prisma,
          user,
          plan,
          subId: subscriptionId,
          service: PaymentService.PAYPAL,
          expirationDate: new Date(subscription.billing_info.next_billing_time),
        });

        return {
          message: 'La suscripción se creó correctamente',
        };
      } catch (e) {
        log.error(
          `[PAYPAL] An error happened while creating subscription with paypal ${e}`,
        );

        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Ocurrion un error al crear la suscripción',
        });
      }
    },
  );
