import { TRPCError } from '@trpc/server';
import { PrismaClient } from '@prisma/client';
import { log } from '../../../server';
import { SessionUser } from '../../auth/utils/serialize-user';

export const canBuyMoreGB = async ({
  prisma,
  user,
  productId,
}: {
  prisma: PrismaClient;
  user: SessionUser;
  productId: number;
}) => {
  const userFTP = await prisma.ftpUser.findFirst({
    where: {
      user_id: user.id,
    },
  });

  if (!userFTP) {
    log.info('[PRODUCT:PURCHASE] User does not have an FTP');

    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'El usuario no tiene una cuenta FTP',
    });
  }

  const quotaLimits = await prisma.ftpQuotaLimits.findFirst({
    where: {
      name: userFTP.userid,
    },
  });

  if (!quotaLimits) {
    log.info('[PRODUCT:PURCHASE] User does not have a quota limit');

    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'El usuario no tiene quotas activas',
    });
  }

  const quotaTallies = await prisma.ftpquotatallies.findFirst({
    where: {
      name: userFTP.userid,
    },
  });

  if (!quotaTallies) {
    log.info('[PRODUCT:PURCHASE] User does not have quota tallies');

    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'El usuario no tiene quotas activas',
    });
  }

  // This causes problems when the user has space available but it is not enough to download a file

  // if (quotaTallies.bytes_out_used < quotaLimits.bytes_out_avail) {
  //   log.info('[PRODUCT:PURCHASE] User still has storage available');
  //
  //   throw new TRPCError({
  //     code: 'CONFLICT',
  //     message: 'El usuario aun tiene bytes disponible',
  //   });
  // }

  const product = await prisma.products.findFirst({
    where: {
      id: productId,
    },
  });

  if (!product) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'El producto no existe.',
    });
  }

  const descargasUser = await prisma.descargasUser.findFirst({
    where: {
      AND: [
        {
          user_id: user.id,
        },
        {
          date_end: {
            gt: new Date(),
          },
        },
      ],
    },
  });

  if (!descargasUser) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'El usuario no tiene una suscripción activa.',
    });
  }

  return product;
};
