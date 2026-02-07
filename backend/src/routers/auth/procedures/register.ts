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
import { facebook } from '../../../facebook';
import {
  getBlockedEmailDomains,
  normalizeEmailDomain,
} from '../../../utils/blockedEmailDomains';
import {
  getBlockedPhoneNumbers,
  normalizePhoneNumber,
} from '../../../utils/blockedPhoneNumbers';
import { verifyTurnstileToken } from '../../../utils/turnstile';
import { getClientIpFromRequest } from '../../../analytics';

export const register = publicProcedure
  .input(
    z.object({
      username: z
        .string()
        .min(3, 'El nombre de usuario debe tener al menos 3 caracteres')
        // At least one alphabetic character
        .regex(
          /^[a-zA-Z0-9 ]*$/,
          'El nombre de usuario no tiene un formato valido, no incluya caracteres especiales',
        ),
      email: z.string().email('Email inválido'),
      password: z
        .string()
        .min(6, 'La contraseña debe tener al menos 6 caracteres'),
      phone: z.string(),
      fbp: z.string().optional(),
      fbc: z.string().optional(),
      eventId: z.string().optional(),
      url: z.string(),
      turnstileToken: z
        .string()
        .min(1, 'La verificación de seguridad es requerida'),
    }),
  )
  .mutation(
    async ({
      input: { username, email, password, phone, fbp, fbc, eventId, url, turnstileToken },
      ctx: { req, prisma },
    }) => {
      const clientIp = getClientIpFromRequest(req);
      await verifyTurnstileToken({
        token: turnstileToken,
        remoteIp: clientIp ?? req.ip,
      });

      const emailDomain = normalizeEmailDomain(email);
      if (emailDomain) {
        const blockedDomains = await getBlockedEmailDomains(prisma);
        if (blockedDomains.includes(emailDomain)) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'El dominio del correo no está permitido',
          });
        }
      }

      const normalizedPhone = normalizePhoneNumber(phone);
      if (normalizedPhone) {
        const blockedPhones = await getBlockedPhoneNumbers(prisma);
        if (blockedPhones.includes(normalizedPhone)) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'El telefono no esta permitido',
          });
        }
      }

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

      const existingUserWithPhone = await prisma.users.findFirst({
        where: {
          OR: [
            {
              phone: {
                equals: phone,
              },
            },
          ],
        },
      });

      if (existingUserWithPhone) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Ese teléfono ya está registrado',
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
          ip_registro: clientIp ?? req.ip,
          registered_on: new Date().toISOString(),
          active: ActiveState.Active,
          verified: process.env.NODE_ENV === 'production' ? false : true,
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

      const userAgentRaw = req.headers['user-agent'];
      const userAgent =
        typeof userAgentRaw === 'string'
          ? userAgentRaw
          : Array.isArray(userAgentRaw)
            ? userAgentRaw[0] ?? null
            : null;

      try {
        log.info('[REGISTER] Sending sign up event to Facebook CAPI');
        await facebook.setEvent(
          'CompleteRegistration',
          clientIp,
          userAgent,
          { fbp, fbc, eventId },
          url,
          newUser,
        );
      } catch (error) {
        log.error('[REGISTER] Error sending CAPI event', {
          error: error instanceof Error ? error.message : error,
        });
      }
      // This implicitly creates a new subscriber in ManyChat or retrieves an existing one
      await manyChat.addTagToUser(newUser, 'USER_REGISTERED');

      const tokens = await generateTokens(prisma, newUser);

      return {
        ...tokens,
        message: 'Usuario fue creado correctamente',
        user: newUser,
      };
    },
  );
