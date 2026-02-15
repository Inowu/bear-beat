import { z } from 'zod';
import bcrypt from 'bcrypt';
import { publicProcedure } from '../../../procedures/public.procedure';
import { TRPCError } from '@trpc/server';
import { log } from '../../../server';
import { generateTokens } from './utils/generateTokens';

export const changePassword = publicProcedure
  .input(
    z.object({
      token: z.string(),
      userId: z.number(),
      password: z.string().min(6),
    }),
  )
  .mutation(async ({ input: { token, userId, password }, ctx: { prisma } }) => {
    const user = await prisma.users.findFirst({
      where: {
        id: userId,
      },
    });

    if (!user) {
      log.error(`[CHANGE_PASSWORD] The user was not found`);
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'El usuario no fue encontrado',
      });
    }

    const validToken = bcrypt.compareSync(token, user.activationcode ?? '');

    if (!validToken || user.token_expiration! < new Date()) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'El token no es válido',
      });
    }

    const newPassword = bcrypt.hashSync(password, 10);

    log.info('[CHANGE_PASSWORD] Changing password');

    await prisma.users.update({
      where: {
        id: user.id,
      },
      data: {
        password: newPassword,
        activationcode: null,
        token_expiration: null,
      },
    });

    const { token: accessToken, refreshToken } = await generateTokens(prisma, user);
    return { token: accessToken, refreshToken };
  });
