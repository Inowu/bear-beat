import { z } from 'zod';
import { shieldedProcedure } from '../../../procedures/shielded.procedure';
import { TRPCError } from '@trpc/server';
import { subscribe } from '../../subscriptions/services/subscribe';
import { log } from '../../../server';
import { PaymentService } from '../../subscriptions/services/types';
import { addDays } from 'date-fns';
import { hasActiveSubscription } from '../../subscriptions/utils/hasActiveSub';
import { createAdminAuditLog } from '../../utils/adminAuditLog';

export const activatePlanForUser = shieldedProcedure
  .input(
    z.object({
      userId: z.number(),
      planId: z.number(),
    }),
  )
  .mutation(
    async ({ input: { userId, planId }, ctx: { prisma, session, req } }) => {
      const plan = await prisma.plans.findFirst({
        where: {
          id: planId,
        },
      });

      if (!plan) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Plan not found',
        });
      }

      const user = await prisma.users.findFirst({
        where: {
          id: userId,
        },
      });

      if (!user) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'User not found',
        });
      }

      log.info('[ADMIN] Activating plan for user', { planId: plan.id });

      await hasActiveSubscription({
        user,
        prisma,
        service: PaymentService.ADMIN,
      });

      await subscribe({
        subId: 'ADMIN',
        user,
        plan,
        prisma,
        service: PaymentService.ADMIN,
        expirationDate: addDays(new Date(), Number(plan.duration)),
      });

      const actorUserId = session?.user?.id;
      if (actorUserId) {
        await createAdminAuditLog({
          prisma,
          req,
          actorUserId,
          action: 'activate_plan_for_user',
          targetUserId: user.id,
          metadata: {
            planId: plan.id,
            service: PaymentService.ADMIN,
          },
        });
      }

      return { message: 'El plan ha sido activado correctamente' };
    },
  );
