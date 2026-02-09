import { shieldedProcedure } from '../../../procedures/shielded.procedure';
import { log } from '../../../server';
import { extendedAccountPostfix } from '../../../utils/constants';
import { TRPCError } from '@trpc/server';

/**
 * Returns the current logged in user
 * */
export const me = shieldedProcedure.query(
  async ({ ctx: { session, prisma } }) => {
    if (!session?.user) {
      throw new TRPCError({
        code: 'UNAUTHORIZED',
        message: 'No autorizado',
      });
    }

    const user = session!.user!;
    const currentDbUser = await prisma.users.findFirst({
      where: { id: user.id },
      select: { phone: true, verified: true },
    });

    const ftpAccounts = await prisma.ftpUser.findMany({
      where: {
        user_id: user.id,
      },
      orderBy: {
        accessed: 'desc',
      },
    });

    const extendedFtpAccount = ftpAccounts.find((acc) =>
      acc.userid.endsWith(extendedAccountPostfix),
    );

    const subscriptionAccount =
      ftpAccounts.length === 1
        ? ftpAccounts[0]
        : ftpAccounts.find(
          (acc) => !acc.userid.endsWith(extendedAccountPostfix),
        );

    const hasActiveSubscription = await prisma.descargasUser.findFirst({
      where: {
        AND: [
          {
            user_id: user.id,
          },
          {
            date_end: {
              // `date_end` is stored as DATE in MySQL (@db.Date). Passing an ISO string (with
              // time + timezone suffix) can break comparisons under strict SQL modes.
              // Always pass Date objects to Prisma and let the driver format correctly.
              gt: new Date(),
            },
          },
        ],
      },
      orderBy: [
        {
          date_end: 'desc',
        },
        {
          id: 'desc'
        },
      ]
    });

    let isSubscriptionCancelled = false;

    if (hasActiveSubscription) {
      const orderId = hasActiveSubscription.order_id;

      if (!orderId) log.warn('[ME] No orderId found for subscription');
      else {
        const order = await prisma.orders.findFirst({
          where: {
            id: orderId,
          },
          orderBy: {
            date_order: 'desc'
          }
        });

        isSubscriptionCancelled = Boolean(order?.is_canceled);
      }
    }

    return {
      ...session?.user,
      phone: currentDbUser?.phone ?? user.phone,
      verified: currentDbUser?.verified ?? user.verified,
      hasActiveSubscription: Boolean(hasActiveSubscription),
      isSubscriptionCancelled,
      stripeCusId: user.stripeCusId,
      extendedFtpAccount,
      ftpAccount: subscriptionAccount
        ? {
          ...subscriptionAccount,
          host: process.env.FTP_HOST,
          port: process.env.FTP_PORT,
        }
        : null,
    };
  },
);
