import bcrypt from 'bcrypt';
import { PrismaClient, Users } from '@prisma/client';
import { generateJwt } from '../../utils/generateJwt';

export const generateTokens = async (prisma: PrismaClient, user: Users) => {
  const refreshToken = generateJwt(user, { expiresIn: '30d' });

  await prisma.users.update({
    where: {
      id: user.id,
    },
    data: {
      refresh_token: bcrypt.hashSync(refreshToken, 10),
    },
  });

  return {
    token: generateJwt(user),
    refreshToken,
  };
};
