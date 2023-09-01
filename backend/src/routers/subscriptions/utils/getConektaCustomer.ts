import { PrismaClient } from '@prisma/client';
import { TRPCError } from '@trpc/server';
import { SessionUser } from '../../auth/utils/serialize-user';
import { conektaClient } from '../../../conekta';

/**
 * Returns the conekta customer id for this user orCreates
 * creates a conekta customer otherwise
 * */
export const getConektaCustomer = async ({
  prisma,
  user,
}: {
  prisma: PrismaClient;
  user?: SessionUser | null;
}): Promise<string> => {
  if (!user) {
    throw new TRPCError({
      code: 'UNAUTHORIZED',
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

  return userConektaId;
};
