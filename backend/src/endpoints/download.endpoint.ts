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

  const dbUser = await prisma.users.findFirst({
    where: { id: user.id },
    select: { verified: true },
  });

  if (!dbUser?.verified) {
    return res.status(403).send({
      error: 'Debes verificar tu WhatsApp antes de descargar',
    });
  }

  const activePlans = await prisma.descargasUser.findMany({
    where: {
      AND: [
        {
          date_end: {
            gte: new Date(),
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

  let regularFtpUser = ftpAccounts.find(
    (ftpAccount) => !ftpAccount.userid.endsWith(extendedAccountPostfix),
  );

  let useExtendedAccount = false;

  if (ftpAccounts.length === 0 || !regularFtpUser) {
    log.error(`[DOWNLOAD] This user does not have an ftp user (${user.id})`);

    return res
      .status(400)
      .send({ error: 'Este usuario no tiene una cuenta FTP' });
  }

  const extendedAccount = ftpAccounts.find((ftpAccount) =>
    ftpAccount.userid.endsWith(extendedAccountPostfix),
  );

  if (activePlans.length === 0 && !extendedAccount) {
    return res
      .status(400)
      .send({ error: 'Este usuario no tiene un plan activo' });
  }

  let quotaTallies = await prisma.ftpquotatallies.findFirst({
    where: {
      name: regularFtpUser.userid,
    },
  });

  let quotaLimits = await prisma.ftpQuotaLimits.findFirst({
    where: {
      name: regularFtpUser.userid,
    },
  });

  if (!quotaLimits || !quotaTallies) {
    log.error(
      `${logPrefix(useExtendedAccount)} This user does not have quotas (${
        user.id
      })`,
    );
    return res
      .status(400)
      .send({ error: 'No hay quotas activas para este usuario' });
  }

  const hasRemainingGb =
    quotaTallies.bytes_out_used < quotaLimits.bytes_out_avail;

  if ((activePlans.length === 0 || !hasRemainingGb) && extendedAccount) {
    log.info(`[DOWNLOAD] Using extended account for user ${user.id}`);
    regularFtpUser = extendedAccount;
    useExtendedAccount = true;
  }

  if (useExtendedAccount && extendedAccount) {
    quotaLimits = await prisma.ftpQuotaLimits.findFirst({
      where: {
        name: extendedAccount.userid,
      },
    });

    quotaTallies = await prisma.ftpquotatallies.findFirst({
      where: {
        name: extendedAccount.userid,
      },
    });
  }

  if (!quotaLimits || !quotaTallies) {
    log.error(
      `${logPrefix(useExtendedAccount)} This user does not have quotas (${
        user.id
      })`,
    );
    return res
      .status(400)
      .send({ error: 'No hay quotas activas para este usuario' });
  }

  const fileStat = await fileService.stat(fullPath);

  const availableBytes =
    quotaLimits.bytes_out_avail - quotaTallies.bytes_out_used;

  if (availableBytes < fileStat.size) {
    log.error(
      `${logPrefix(useExtendedAccount)} Not enough bytes left, user id: ${
        user.id
      }, song path: ${fullPath}`,
    );

    return res
      .status(400)
      .send({ error: 'Este usuario no tiene suficientes bytes disponibles' });
  }

  log.info(
    `${logPrefix(
      useExtendedAccount,
    )} id: ${user?.id}, username: ${user?.username}, bytes available left: ${availableBytes}`,
  );

  await prisma.ftpquotatallies.update({
    where: {
      id: quotaTallies.id,
    },
    data: {
      bytes_out_used: quotaTallies.bytes_out_used + BigInt(fileStat.size),
    },
  });

  // Observability: log successful file downloads so PublicHome can show "Top 100" real.
  // Never break the download if analytics logging fails.
  try {
    await prisma.downloadHistory.create({
      data: {
        userId: user.id,
        size: fileStat.size,
        date: new Date(),
        fileName: path,
        isFolder: false,
      },
    });
  } catch (e: any) {
    log.warn(
      `[DOWNLOAD] Failed to write download_history for user ${user.id}: ${e?.message ?? e}`,
    );
  }

  try {
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${Path.basename(
        fullPath,
      )}"; filename*=UTF-8''${encodeURIComponent(Path.basename(fullPath))}`,
    );
  } catch (e: any) {
    log.warn(
      `[DOWNLOAD] Error setting header: ${e.message}, file: ${Path.basename(
        fullPath,
      )}. Using fallback header instead`,
    );

    res.setHeader(
      'Content-Disposition',
      `attachment; filename*=UTF-8''${encodeURIComponent(
        Path.basename(fullPath),
      )}`,
    );
  }

  return res.sendFile(fullPath);
};

export const logPrefix = (extendedAccount: boolean) =>
  extendedAccount ? '[DOWNLOAD:EXTENDED]' : '[DOWNLOAD]';
