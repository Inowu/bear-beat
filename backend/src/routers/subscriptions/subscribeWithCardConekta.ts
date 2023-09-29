import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { shieldedProcedure } from '../../procedures/shielded.procedure';
import {
  conektaClient,
  conektaPaymentMethods,
  conektaSubscriptions,
} from '../../conekta';
import { log } from '../../server';
import { getConektaCustomer } from './utils/getConektaCustomer';
import { getPlanKey } from '../../utils/getPlanKey';
import { hasActiveSubscription } from './utils/hasActiveSub';
import { SubscriptionService } from './services/types';

export const subscribeWithCardConekta = shieldedProcedure
  .input(
    z.object({
      cardToken: z.string(),
      planId: z.number(),
      makeDefault: z.string().optional(),
    }),
  )
  .mutation(
    async ({
      input: { cardToken, planId, makeDefault },
      ctx: { prisma, session },
    }) => {
      const user = session!.user!;

      const userConektaId = await getConektaCustomer({
        prisma,
        user: session?.user,
      });

      await hasActiveSubscription({
        user,
        customerId: userConektaId,
        prisma,
        service: SubscriptionService.CONEKTA,
      });

      const plan = await prisma.plans.findFirst({
        where: {
          id: planId,
        },
      });

      if (!plan) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'There are no plans with the specified id',
        });
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
          plan_id: plan[getPlanKey()] as string,
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
