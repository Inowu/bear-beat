import Path from 'path';
import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { fileService } from '../ftp';
import { prisma } from '../db';
import { SessionUser } from '../routers/auth/utils/serialize-user';
import { log } from '../server';
import { extendedAccountPostfix } from '../utils/constants';

export const downloadEndpoint = async (req: Request, res: Response) => {
  const token = req.query.token as string;

  if (!token || typeof token !== 'string') {
    return res.status(401).send({ error: 'Unauthorized' });
  }

  let user: SessionUser | null = null;

  try {
    user = jwt.verify(token, process.env.JWT_SECRET as string) as SessionUser;

    if (!user) return res.status(401).send({ error: 'Unauthorized' });
  } catch (e) {
    return res.status(401).send({ error: 'Unauthorized' });
  }

  const path = req.query.path as string;

  const fullPath = Path.join(process.env.SONGS_PATH as string, path);
  const fileExists = await fileService.exists(fullPath);

  if (!fileExists) {
    return res.status(500).send({ error: 'Este archivo o carpeta no existe' });
  }

  const activePlans = await prisma.descargasUser.findMany({
    where: {
      AND: [
        {
          date_end: {
            gte: new Date().toISOString(),
          },
        },
        {
          user_id: user?.id,
        },
      ],
    },
    orderBy: {
      date_end: 'desc',
    },
    take: 1,
  });

  const ftpAccounts = await prisma.ftpUser.findMany({
    where: {
      user_id: user?.id,
    },
  });

  let ftpUser = ftpAccounts.find(
    (ftpAccount) => !ftpAccount.userid.endsWith(extendedAccountPostfix),
  );

  let extended = false;

  if (ftpAccounts.length === 0 || !ftpUser) {
    log.error(`[DOWNLOAD] This user does not have an ftp user (${user.id})`);

    return res
      .status(400)
      .send({ error: 'Este usuario no tiene una cuenta FTP' });
  }

  if (activePlans.length === 0) {
    if (ftpAccounts.length === 1) {
      return res
        .status(400)
        .send({ error: 'Este usuario no tiene un plan activo' });
    }

    const extendedAccount = ftpAccounts.find((ftpAccount) =>
      ftpAccount.userid.endsWith(extendedAccountPostfix),
    );

    if (!extendedAccount) {
      log.warn(
        `[DOWNLOAD] This user does not have an extended account  and has more than one ftp account (${user.id})`,
      );
      return res
        .status(400)
        .send({ error: 'Este usuario no tiene un plan activo' });
    }

    log.info(`[DOWNLOAD] Using extended account for user ${user.id}`);
    ftpUser = extendedAccount;
    extended = true;
  }

  const quotaLimit = await prisma.ftpQuotaLimits.findFirst({
    where: {
      name: ftpUser.userid,
    },
  });

  const quotaUsed = await prisma.ftpquotatallies.findFirst({
    where: {
      name: ftpUser.userid,
    },
  });

  if (!quotaLimit || !quotaUsed) {
    log.error(
      `${logPrefix(extended)} This user does not have quotas (${user.id})`,
    );
    return res
      .status(400)
      .send({ error: 'No hay quotas activas para este usuario' });
  }

  const fileStat = await fileService.stat(fullPath);

  const availableBytes = quotaLimit.bytes_out_avail - quotaUsed.bytes_out_used;

  if (availableBytes < fileStat.size) {
    log.error(
      `${logPrefix(extended)} Not enough bytes left, user id: ${
        user.id
      }, song path: ${fullPath}`,
    );

    return res
      .status(400)
      .send({ error: 'Este usuario no tiene suficientes bytes disponibles' });
  }

  log.info(
    `${logPrefix(
      extended,
    )} id: ${user?.id}, username: ${user?.username}, bytes available left: ${availableBytes}`,
  );

  await prisma.$transaction([
    prisma.ftpQuotaLimits.update({
      where: {
        id: quotaLimit.id,
      },
      data: {
        bytes_out_avail: quotaLimit.bytes_out_avail - BigInt(fileStat.size),
      },
    }),
    prisma.ftpquotatallies.update({
      where: {
        id: quotaUsed.id,
      },
      data: {
        bytes_out_used: quotaUsed.bytes_out_used + BigInt(fileStat.size),
      },
    }),
  ]);

  res.setHeader(
    'Content-Disposition',
    `attachment; filename="${encodeURI(Path.basename(fullPath))}"`,
  );

  return res.sendFile(fullPath);
};

const logPrefix = (extendedAccount: boolean) =>
  extendedAccount ? '[DOWNLOAD:EXTENDED]' : '[DOWNLOAD]';
