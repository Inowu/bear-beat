import { PrismaClient } from '@prisma/client';
import { TRPCError } from '@trpc/server';
import { SessionUser } from '../../auth/utils/serialize-user';
import { conektaClient } from '../../../conekta';
import { stripNonAlphabetic } from '../../auth/procedures/utils/formatUsername';
import { log } from '../../../server';

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
    try {
      const conektaUser = await conektaClient.createCustomer({
        name: stripNonAlphabetic(dbUser.username),
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
    } catch (e: any) {
      log.error(
        `There was an error creating the conekta customer for user ${user.id}, details: ${e.response?.data?.details}`,
      );
    }
  }

  return userConektaId;
};
