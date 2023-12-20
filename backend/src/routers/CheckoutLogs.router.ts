import { shieldedProcedure } from '../procedures/shielded.procedure';
import { log } from '../server';
import { router } from '../trpc';

export const checkoutLogsRouter = router({
  registerCheckoutLog: shieldedProcedure.mutation(
    async ({ ctx: { prisma, session } }) => {
      const user = session!.user!;

      const lastCheckout = await prisma.checkout_logs.findFirst({
        where: {
          user_id: user.id,
        },
      });

      if (lastCheckout) {
        await prisma.checkout_logs.update({
          where: {
            id: lastCheckout.id,
          },
          data: {
            last_checkout_date: new Date(),
          },
        });
      } else {
        log.info(
          `[CHECKOUT_LOGS] Creating new checkout log for user ${user.id}`,
        );
        await prisma.checkout_logs.create({
          data: {
            user_id: user.id,
            last_checkout_date: new Date(),
          },
        });
      }

      return {
        message: 'Log de checkout registrado exitosamente',
      };
    },
  ),
});
