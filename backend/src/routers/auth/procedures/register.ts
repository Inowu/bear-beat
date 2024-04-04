import { z } from 'zod';
import bcrypt from 'bcrypt';
import { TRPCError } from '@trpc/server';
import { publicProcedure } from '../../../procedures/public.procedure';
import { RolesIds } from '../interfaces/roles.interface';
import { ActiveState } from '../interfaces/active-state.interface';
import { generateTokens } from '../procedures/utils/generateTokens';
import stripe from '../../../stripe';
import { conektaCustomers } from '../../../conekta';
import { stripNonAlphabetic } from './utils/formatUsername';
import { log } from '../../../server';
import { brevo } from '../../../email';
import { manyChat } from '../../../many-chat';

export const register = publicProcedure
  .input(
    z.object({
      username: z
        .string()
        .min(3, {
          message: 'El nombre de usuario debe tener al menos 3 caracteres',
        })
        // At least one alphabetic character
        .regex(/^[a-zA-Z0-9]*[a-zA-Z]+[a-zA-Z0-9]*$/, {
          message: 'El nombre de usuario debe tener por lo menos una letra',
        }),
      email: z.string().email({ message: 'Email inválido' }),
      password: z
        .string()
        .min(6, { message: 'La contraseña debe tener al menos 6 caracteres' }),
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
        const customer = await stripe.customers.create({
          email,
          metadata: {
            id: newUser.id,
          },
        });

        await prisma.users.update({
          where: {
            id: newUser.id,
          },
          data: {
            stripe_cusid: customer.id,
          },
        });
      } catch (e) {
        log.error(
          `There was an error creating the stripe customer for user ${newUser.id}`,
        );
      }

      try {
        const customer = await conektaCustomers.createCustomer({
          email,
          name: stripNonAlphabetic(newUser),
          phone: newUser.phone ?? '',
          metadata: {
            id: newUser.id,
          },
        });

        await prisma.users.update({
          where: {
            id: newUser.id,
          },
          data: {
            conekta_cusid: customer.data.id,
          },
        });
      } catch (e: any) {
        log.error(
          `There was an error creating the conekta customer for user ${
            newUser.id
          }, details: ${JSON.stringify(e.response?.data?.details)}`,
        );
      }

      try {
        log.info('[REGISTER] Sending email to user');
        await brevo.smtp.sendTransacEmail({
          templateId: 3,
          to: [{ email: newUser.email, name: newUser.username }],
          params: {
            NAME: newUser.username,
            EMAIL: newUser.email,
          },
        });
      } catch (e: any) {
        log.error(`[REGISTER] Error while sending email ${e.message}`);
      }

      // This implicitly creates a new subscriber in ManyChat or retrieves an existing one
      await manyChat.addTagToUser(newUser, 'USER_REGISTERED');

      const tokens = await generateTokens(prisma, newUser);

      return {
        ...tokens,
        message: 'Usuario fue creado correctamente',
      };
    },
  );
