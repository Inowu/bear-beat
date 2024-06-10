import { z } from 'zod';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { publicProcedure } from '../../../procedures/public.procedure';
import { log } from '../../../server';
import { brevo } from '../../../email';
import { addHours } from 'date-fns';
import { twilio } from '../../../twilio';

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

    const link = `${process.env.CLIENT_URL}/auth/reset-password?token=${token}&userId=${user.id}`;

    try {
      await brevo.smtp.sendTransacEmail({
        templateId: 1,
        to: [{ email: user.email, name: user.username }],
        params: {
          NAME: user.username,
          EMAIL: user.email,
          LINK: link,
        },
      });
    } catch (e) {
      log.error(e);
      return {
        error: 'Ocurrió un error al enviar el correo electrónico',
      };
    }

    try {
      log.info(`[TWILIO_SEND_MESSAGE] Sending WhatsApp to ${user.phone}`);

      await twilio.sendMessage(user.phone!, link);
    } catch (error) {
      log.error('[TWILIO_SEND_MESSAGE_ERROR]', error);
    }

    return {
      message:
        'Se ha enviado un correo electrónico con las instrucciones para restablecer la contraseña',
    };
  });
