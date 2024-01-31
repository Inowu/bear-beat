import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import bcrypt from 'bcrypt';
import { publicProcedure } from '../../../procedures/public.procedure';
import { generateTokens } from './utils/generateTokens';

export const login = publicProcedure
  .input(
    z.object({
      username: z.string(),
      password: z.string(),
    }),
  )
  .query(async ({ input: { password, username }, ctx: { prisma } }) => {
    const user = await prisma.users.findFirst({
      where: {
        OR: [
          {
            username,
          },
          {
            email: username,
          },
        ],
      },
    });

    if (!user) {
      throw new TRPCError({
        code: 'UNAUTHORIZED',
        message: 'Credenciales inválidas',
      });
    }

    // Apparently 2y prefix does not work with this bcrypt library so
    // I have to replace the prefix for compatibility
    const hash = user.password.replace('$2y$', '$2b$');

    const isPasswordCorrect = bcrypt.compareSync(password, hash);

    if (!isPasswordCorrect) {
      throw new TRPCError({
        code: 'UNAUTHORIZED',
        message: 'Credenciales inválidas',
      });
    }

    const isBlocked = user.blocked;

    if (isBlocked) {
      throw new TRPCError({
        code: 'UNAUTHORIZED',
        message: 'Usuario Bloqueado',
      });
    }

    return generateTokens(prisma, user);
  });
