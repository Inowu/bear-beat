import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import axios, { AxiosError } from 'axios';
import { shieldedProcedure } from '../../procedures/shielded.procedure';
import { log } from '../../server';
import { PaymentService } from './services/types';
import { subscribe } from './services/subscribe';
import { paypal } from '../../paypal';
import { paypal as uhPaypal } from '../migration/uhPaypal';
import { facebook } from '../../facebook';
import { manyChat } from '../../many-chat';
import { checkIfUserIsSubscriber } from '../migration/checkUHSubscriber';

export const subscribeWithPaypal = shieldedProcedure
  .input(
    z.object({
      planId: z.number(),
      subscriptionId: z.string(),
      fbp: z.string().optional(),
      url: z.string(),
    }),
  )
  .mutation(
    async ({
      input: { planId, subscriptionId, fbp, url },
      ctx: { prisma, session, req },
    }) => {
      const user = session!.user!;
      let migrationUser = null;

      if (process.env.UH_MIGRATION_ACTIVE === 'true') {
        migrationUser = await checkIfUserIsSubscriber({
          email: user.email!,
        });

        if (migrationUser?.service === 'paypal') {
          const subscription = (
            await axios(
              `${uhPaypal.paypalUrl()}/v1/billing/subscriptions/${
                migrationUser.subscriptionId
              }`,
              {
                headers: {
                  Authorization: `Bearer ${await uhPaypal.getToken()}`,
                },
              },
            )
          ).data;

          if (subscription.status === 'ACTIVE') {
            log.info(
              `[MIGRATION] Cancelling active paypal subscription for user ${user.email}`,
            );

            try {
              await axios.post(
                `${uhPaypal.paypalUrl()}/v1/billing/subscriptions/${
                  migrationUser.subscriptionId
                }/cancel`,
                {
                  reason: 'CANCEL_BY_USER',
                },
                {
                  headers: {
                    Authorization: `Bearer ${await uhPaypal.getToken()}`,
                  },
                },
              );

              log.info(
                `[MIGRATION] Active paypal subscription cancelled for user ${user.email}`,
              );
            } catch (e) {
              log.error(
                `[MIGRATION] An error happened while cancelling active paypal subscription for user ${
                  user.email
                }: ${(e as AxiosError).response?.data}`,
              );

              throw new TRPCError({
                code: 'INTERNAL_SERVER_ERROR',
                message: 'Ocurrió un error al migrar la suscripción',
              });
            }
          }
        }
      }

      const existingUser = await prisma.users.findFirst({
        where: {
          id: user.id,
        },
      });

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

          if (fbp) {
            if (remoteAddress && userAgent) {
              log.info(
                '[PAYPAL] User has successfully paid for a plan, sending event to facebook',
              );
              await facebook.setEvent(
                'PagoExitosoAPI',
                remoteAddress,
                userAgent,
                fbp,
                url,
                existingUser,
              );
            }
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
