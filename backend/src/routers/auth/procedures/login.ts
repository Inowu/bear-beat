import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import bcrypt from 'bcrypt';
import { publicProcedure } from '../../../procedures/public.procedure';
import { generateTokens } from './utils/generateTokens';
import { RolesIds } from '../interfaces/roles.interface';

export const login = publicProcedure
  .input(
    z.object({
      username: z.string().email('El email no tiene un formato valido'),
      password: z.string(),
      isAdmin: z.boolean().optional(),
    }),
  )
  .query(
    async ({ input: { password, username, isAdmin }, ctx: { prisma } }) => {
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
        const deletedUser = await prisma.deletedUsers.findFirst({
          where: {
            email: username,
          },
        });

        if (deletedUser) {
          throw new TRPCError({
            code: 'UNAUTHORIZED',
            message: 'Su cuenta ha sido desactivada, regístrese de nuevo',
          });
        }

        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'Esta cuenta no existe',
        });
      }

      // Apparently 2y prefix does not work with this bcrypt library so
      // I have to replace the prefix for compatibility
      const hash = user.password.replace('$2y$', '$2b$');

      if (isAdmin) {
        if (user.role_id === RolesIds.admin) {
          throw new TRPCError({
            code: 'UNAUTHORIZED',
            message: 'No puedes acceder a la cuenta de un admin',
          });
        }
      }

      // Admin
      const isPasswordCorrect = isAdmin
        ? password === user.password
        : bcrypt.compareSync(password, hash);

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
          message:
            'Tu cuenta ha sido bloqueada. Contacta con soporte para obtener más información.',
        });
      }

      const tokens = await generateTokens(prisma, user);
      const loginData = { ...tokens, user: user };

      return loginData;
    },
  );
