import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import axios from 'axios';
import { shieldedProcedure } from '../../procedures/shielded.procedure';
import { log } from '../../server';
import { PaymentService } from './services/types';
import { subscribe } from './services/subscribe';
import { paypal } from '../../paypal';
import { facebook } from '../../facebook';
import { manyChat } from '../../many-chat';

export const subscribeWithPaypal = shieldedProcedure
  .input(
    z.object({
      planId: z.number(),
      subscriptionId: z.string(),
      fbp: z.string(),
      url: z.string()
    }),
  )
  .mutation(
    async ({ input: { planId, subscriptionId, fbp, url }, ctx: { prisma, session, req } }) => {
      const user = session!.user!;

      const existingUser = await prisma.users.findFirst({
        where: {
          id: user.id,
        },
      })

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

        if (existingUser) {
          const remoteAddress = req.socket.remoteAddress;
          const userAgent = req.headers['user-agent'];
  
          if (remoteAddress && userAgent) {
            log.info('[PAYPAL] User has successfully paid for a plan, sending event to facebook');
            await facebook.setEvent('PagoExitosoAPI', remoteAddress, userAgent, fbp, url, existingUser);
          }

          await manyChat.addTagToUser(existingUser, 'SUCCESSFUL_PAYMENT');
        }

        return {
          message: 'La suscripción se creó correctamente',
        };
      } catch (e) {
        log.error(
          `[PAYPAL] An error happened while creating subscription with paypal ${e}`,
        );

        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Ocurrió un error al crear la suscripción',
        });
      }
    },
  );
