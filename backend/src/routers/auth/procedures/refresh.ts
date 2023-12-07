import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { publicProcedure } from '../../../procedures/public.procedure';
import { generateTokens } from './utils/generateTokens';
import { SessionUser } from '../utils/serialize-user';

export const refresh = publicProcedure
  .input(
    z.object({
      refreshToken: z.string(),
    }),
  )
  .query(async ({ ctx: { prisma }, input: { refreshToken } }) => {
    try {
      const tokenPayload = jwt.verify(
        refreshToken,
        process.env.JWT_SECRET as string,
        { ignoreExpiration: true },
      ) as SessionUser;

      if (!tokenPayload) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'Token inválido',
        });
      }

      const user = await prisma.users.findFirst({
        where: {
          id: tokenPayload.id,
        },
      });

      if (!user) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'Usuario no encontrado',
        });
      }

      if (!user.refresh_token) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'Token inválido',
        });
      }

      const isValid = bcrypt.compareSync(refreshToken, user.refresh_token);

      if (!isValid) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'Token inválido',
        });
      }

      return await generateTokens(prisma, user);
    } catch (error: unknown) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'Token inválido',
        });
      } else if (error instanceof jwt.JsonWebTokenError) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'Token inválido',
        });
      } else {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Error interno del servidor',
        });
      }
    }
  });
