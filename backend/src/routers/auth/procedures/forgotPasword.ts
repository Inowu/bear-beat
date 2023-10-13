import { z } from 'zod';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import sib from 'sib-api-v3-typescript';
import { publicProcedure } from '../../../procedures/public.procedure';
import { log } from '../../../server';
import { brevo } from '../../../email';
import { addHours } from 'date-fns';

export const forgotPassword = publicProcedure
  .input(
    z.object({
      email: z.string().email(),
    }),
  )
  .mutation(async ({ input: { email }, ctx: { prisma } }) => {
    const user = await prisma.users.findFirst({
      where: {
        email,
      },
    });

    if (!user) {
      log.info(`[FORGOT_PASSWORD] User with email ${email} not found`);
      return;
    }

    const token = crypto.randomBytes(32).toString('hex');

    const hashedToken = bcrypt.hashSync(token, 10);

    await prisma.users.update({
      where: {
        id: user.id,
      },
      data: {
        activationcode: hashedToken,
        token_expiration: addHours(new Date(), 1),
      },
    });

    log.info(`[FORGOT_PASSWORD] Sending email to ${user.email}`);

    console.log({
      name: user.username,
      email: user.email,
      link: `${process.env.CLIENT_URL}/reset-password?token=${token}&userId=${user.id}`,
    });

    try {
      await brevo.smtp.sendTransacEmail({
        templateId: 1,
        to: [{ email: user.email, name: user.username }],
        params: {
          NAME: user.username,
          EMAIL: user.email,
          LINK: `${process.env.CLIENT_URL}/reset-password?token=${token}&userId=${user.id}`,
        },
      });
    } catch (e) {
      log.error(e);
      return {
        error: 'Ocurrió un error al enviar el correo electrónico',
      };
    }

    return {
      message:
        'Se ha enviado un correo electrónico con las instrucciones para restablecer la contraseña',
    };
  });
