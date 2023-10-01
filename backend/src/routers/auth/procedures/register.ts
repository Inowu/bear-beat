import { z } from 'zod';
import bcrypt from 'bcrypt';
import { TRPCError } from '@trpc/server';
import { publicProcedure } from '../../../procedures/public.procedure';
import { RolesIds } from '../interfaces/roles.interface';
import { ActiveState } from '../interfaces/active-state.interface';
import { generateJwt } from '../utils/generateJwt';
import stripe from '../../../stripe';
import { conektaClient } from '../../../conekta';
import { stripNonAlphabetic } from './utils/formatUsername';
import { log } from '../../../server';

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

      // TODO: Send confirmation email and generate token
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

      try {
        await stripe.customers.create({
          email,
          metadata: {
            id: newUser.id,
          },
        });
      } catch (e) {
        log.error(
          `There was an error creating the stripe customer for user ${newUser.id}`,
        );
      }

      try {
        await conektaClient.createCustomer({
          email,
          name: stripNonAlphabetic(newUser.username),
          phone: newUser.phone ?? '',
          metadata: {
            id: newUser.id,
          },
        });
      } catch (e: any) {
        log.error(
          `There was an error creating the conekta customer for user ${newUser.id}, details: ${e.response?.data?.details}`,
        );
      }

      return {
        token: generateJwt(newUser),
        message: 'Usuario fue creado correctamente',
      };
    },
  );
