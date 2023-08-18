import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { shieldedProcedure } from '../../procedures/shielded.procedure';
import {
  conektaClient,
  conektaPaymentMethods,
  conektaSubscriptions,
} from '../../conekta';
import { log } from '../../server';

export const subscribeWithCardConekta = shieldedProcedure
  .input(
    z.object({
      cardToken: z.string(),
      conektaPlanId: z.string(),
      makeDefault: z.string().optional(),
    }),
  )
  .mutation(
    async ({
      input: { cardToken, conektaPlanId, makeDefault },
      ctx: { prisma, session },
    }) => {
      const { user } = session!;

      if (!user) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
        });
      }

      const plan = await prisma.plans.findFirst({
        where: {
          [process.env.NODE_ENV === 'production'
            ? 'conekta_prod_id'
            : 'conekta_test_id']: conektaPlanId,
        },
      });

      if (!plan) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'The specified plant does not exist',
        });
      }

      const dbUser = await prisma.users.findFirst({
        where: {
          id: user?.id,
        },
      });

      if (!dbUser) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'No user with the specified was found',
        });
      }

      let userConektaId: string = dbUser?.conekta_cusid ?? '';

      if (!userConektaId) {
        const conektaUser = await conektaClient.createCustomer({
          name: dbUser.username,
          phone: dbUser.phone ?? '',
          email: dbUser.email,
        });

        await prisma.users.update({
          where: {
            id: dbUser.id,
          },
          data: {
            conekta_cusid: conektaUser.data.id,
          },
        });

        userConektaId = conektaUser.data.id;
      }

      try {
        const paymentSource =
          await conektaPaymentMethods.createCustomerPaymentMethods(
            userConektaId,
            {
              type: 'card',
              token_id: cardToken,
            },
          );

        if (makeDefault) {
          await conektaClient.updateCustomer(userConektaId, {
            default_payment_source_id: paymentSource.data.id,
          });
        }

        await conektaSubscriptions.createSubscription(userConektaId, {
          plan_id: conektaPlanId,
          card_id: paymentSource.data.id,
        });
      } catch (e) {
        log.error(`Error while creating subscription: ${e}`);

        if (e instanceof TRPCError) throw e;

        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `There was an error while creating subscription: ${
            (e as any).message
          }`,
        });
      }
    },
  );
