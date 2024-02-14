import { FtpQuotaLimits, FtpUser, Ftpquotatallies } from '@prisma/client';
import { prisma } from '../../db';
import { SessionUser } from '../auth/utils/serialize-user';

export const getFtpUserInfo = async (
  user: SessionUser,
): Promise<{
  ftpUser?: FtpUser | null;
  limits?: FtpQuotaLimits | null;
  tallies?: Ftpquotatallies | null;
}> => {
  const ftpUser = await prisma.ftpUser.findFirst({
    where: {
      user_id: user.id,
    },
  });

  if (!ftpUser) {
    return { ftpUser, limits: null, tallies: null };
  }

  const limits = await prisma.ftpQuotaLimits.findFirst({
    where: {
      name: ftpUser.userid,
    },
  });

  const tallies = await prisma.ftpquotatallies.findFirst({
    where: {
      name: ftpUser.userid,
    },
  });

  return {
    ftpUser,
    limits,
    tallies,
  };
};
