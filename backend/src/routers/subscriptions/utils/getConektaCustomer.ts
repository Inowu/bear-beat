import { PrismaClient } from '@prisma/client';
import { TRPCError } from '@trpc/server';
import { SessionUser } from '../../auth/utils/serialize-user';
import { conektaCustomers } from '../../../conekta';
import { stripNonAlphabetic } from '../../auth/procedures/utils/formatUsername';
import { log } from '../../../server';
import {
  formatConektaErrorForClient,
  getConektaErrorInfo,
  isConektaCustomerReferenceError,
  normalizeConektaPhoneE164Mx,
} from './conektaErrorHelpers';

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

  if (userConektaId) {
    try {
      await conektaCustomers.getCustomerById(userConektaId);
      return userConektaId;
    } catch (error) {
      if (isConektaCustomerReferenceError(error)) {
        log.warn(
          `[CONEKTA_CUSTOMER] Stored customer ${userConektaId} not found for user ${user.id}. Recreating customer.`,
        );
        await prisma.users.update({
          where: { id: dbUser.id },
          data: { conekta_cusid: null },
        });
        userConektaId = '';
      } else {
        const info = getConektaErrorInfo(error);
        log.error(
          `[CONEKTA_CUSTOMER] Could not validate customer ${userConektaId} for user ${user.id}: ${info.message}`,
          {
            status: info.status,
            details: info.detailMessages,
          },
        );
        return userConektaId;
      }
    }
  }

  if (!userConektaId) {
    const nameCandidate = stripNonAlphabetic(dbUser).trim();
    const fallbackName = dbUser.username?.trim() || dbUser.email?.split('@')?.[0] || `User ${dbUser.id}`;
    const normalizedPhone = normalizeConektaPhoneE164Mx(dbUser.phone);

    try {
      const conektaUser = await conektaCustomers.createCustomer({
        name: (nameCandidate || fallbackName).slice(0, 120),
        phone: normalizedPhone,
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
    } catch (error) {
      const info = getConektaErrorInfo(error);
      log.error(
        `[CONEKTA_CUSTOMER] There was an error creating customer for user ${user.id}: ${info.message}`,
        {
          status: info.status,
          details: info.detailMessages,
          phone: normalizedPhone,
        },
      );

      // Keep checkout resilient: payment flows can still proceed using customer_info fallback.
      if (info.status === 401 || info.status === 403) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Conekta: ${formatConektaErrorForClient(error)}`,
        });
      }
    }
  }

  return userConektaId;
};
