import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import Path from 'path';
import { fileService } from '../ftp';
import { prisma } from '../db';
import { SessionUser } from '../routers/auth/utils/serialize-user';
import { log } from '../server';

export const verifyResetPasswordToken = async (req: Request, res: Response) => {
  const token = req.query.token as string;

  if (!token || typeof token !== 'string') {
    log.error(`[RESET_PASSWORD] Invalid token ${token}`);
    return res.redirect(
      'http://thebearbeat.com/reset-password?error=invalid_token',
    );
  }

  const user = await prisma.users.findFirst({
    where: {
      activationcode: token,
    },
  });
};
