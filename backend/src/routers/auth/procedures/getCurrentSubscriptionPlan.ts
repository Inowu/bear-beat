import { shieldedProcedure } from '../../../procedures/shielded.procedure';

export const getCurrentSubscriptionPlan = shieldedProcedure.query(
  async ({ ctx: { session, prisma } }) => {
    const user = session!.user!;

    const sub = await prisma.descargasUser.findFirst({
      where: {
        user_id: user.id,
      },
      orderBy: {
        id: 'desc'
      }
    });

    // Expected state for many users (trial expired / never purchased): return null instead of 404
    // to avoid noisy console/network errors in the client.
    if (!sub || !sub.order_id) return null;

    const order = await prisma.orders.findFirst({
      where: {
        id: sub?.order_id,
      },
    });

    if (!order || !order.plan_id) return null;

    const plan = await prisma.plans.findFirst({
      where: {
        id: order.plan_id,
      },
    });

    if (!plan) return null;

    return plan;
  },
);
