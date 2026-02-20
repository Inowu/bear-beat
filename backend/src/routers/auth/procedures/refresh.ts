import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { publicProcedure } from '../../../procedures/public.procedure';
import { getStoredRefreshTokenHashes } from './utils/generateTokens';
import { SessionUser } from '../utils/serialize-user';
import { generateJwt } from '../utils/generateJwt';

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

      const storedRefreshTokenHashes = getStoredRefreshTokenHashes(
        user.refresh_token,
      );
      const isValid = storedRefreshTokenHashes.some((hash) =>
        bcrypt.compareSync(refreshToken, hash),
      );

      if (!isValid) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'Token inválido',
        });
      }

      return {
        token: generateJwt(user),
        refreshToken,
      };
    } catch (error: unknown) {
      if (error instanceof TRPCError) {
        throw error;
      }
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
