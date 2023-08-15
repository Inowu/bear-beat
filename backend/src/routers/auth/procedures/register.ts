import { z } from 'zod';
import bcrypt from 'bcrypt';
import { TRPCError } from '@trpc/server';
import { publicProcedure } from '../../../procedures/public.procedure';
import { RolesIds } from '../interfaces/roles.interface';
import { ActiveState } from '../interfaces/active-state.interface';
import { generateJwt } from '../utils/generateJwt';

export const register = publicProcedure
  .input(
    z.object({
      username: z.string().min(3),
      email: z.string().email(),
      password: z.string().min(6),
      phone: z.string(),
    }),
  )
  .mutation(
    async ({
      input: { username, email, password, phone },
      ctx: { req, prisma },
    }) => {
      const existingUser = await prisma.users.findFirst({
        where: {
          OR: [
            {
              username: {
                equals: username,
              },
            },
            {
              email: {
                equals: email,
              },
            },
          ],
        },
      });

      if (existingUser) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Ese email o nombre de usuario ya está registrado',
        });
      }

      // TODO: Stripe customer id
      // TODO: Send confirmation email and generate token
      // ? ManyChat ?
      const newUser = await prisma.users.create({
        data: {
          email,
          username,
          password: bcrypt.hashSync(password, 10),
          phone,
          role_id: RolesIds.normal,
          ip_registro: req.ip,
          registered_on: new Date().toISOString(),
          active: ActiveState.Active,
        },
      });

      return {
        token: generateJwt(newUser),
        message: 'Usuario fue creado correctamente',
      };
    },
  );
