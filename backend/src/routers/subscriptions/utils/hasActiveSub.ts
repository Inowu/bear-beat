import { PrismaClient } from '@prisma/client';
import { TRPCError } from '@trpc/server';
import { SessionUser } from '../../auth/utils/serialize-user';

export const hasActiveSubscription = async (
  user: SessionUser,
  prisma: PrismaClient,
) => {
  const existingSubscription = await prisma.descargasUser.findFirst({
    where: {
      AND: [
        { user_id: user.id },
        {
          date_end: {
            gte: new Date().toISOString(),
          },
        },
      ],
    },
  });

  if (existingSubscription) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'There is already an active subscription for this user',
    });
  }
};
