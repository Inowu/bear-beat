import Path from 'path';
import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { SessionUser } from '../routers/auth/utils/serialize-user';
import { log } from '../server';
import { prisma } from '../db';
import { JobStatus } from '../queue/jobStatus';
import { fileService } from '../ftp';

export const downloadDirEndpoint = async (req: Request, res: Response) => {
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

  const dirName = req.query.dirName as string;
  const jobId = req.query.jobId as string;

  if (!dirName || typeof dirName !== 'string') {
    return res.status(400).send({ error: 'Bad request' });
  }

  if (!jobId || typeof jobId !== 'string') {
    return res.status(400).send({ error: 'Bad request' });
  }

  const fullPath = Path.resolve(
    __dirname,
    `../../${process.env.COMPRESSED_DIRS_NAME}/${dirName}`,
  );
  const dirExists = await fileService.exists(fullPath);

  if (!dirExists) {
    log.error(
      `[DOWNLOAD] Directory not found for user ${user.id} and jobId ${jobId}`,
    );
    return res.status(404).send({ error: 'Esa carpeta no existe' });
  }

  log.info(`[DOWNLOAD] Downloading directory ${fullPath} for user ${user.id}`);

  const job = await prisma.jobs.findFirst({
    where: {
      AND: [
        { status: JobStatus.COMPLETED },
        { jobId: jobId },
        { user_id: user.id },
      ],
    },
  });

  if (!job) {
    log.error(
      `[DOWNLOAD] Job not found for user ${user.id} and jobId ${jobId}`,
    );
    return res
      .status(404)
      .send({ error: 'Ocurrió un error al descargar la carpeta' });
  }

  const download = await prisma.dir_downloads.findFirst({
    where: {
      jobId: job.id,
    },
  });

  if (!download) {
    log.error(
      `[DOWNLOAD] Download not found for user ${user.id} and jobId ${jobId}`,
    );
    return res
      .status(404)
      .send({ error: 'Ocurrió un error al descargar la carpeta' });
  }

  if (download.expirationDate && new Date() >= download.expirationDate) {
    log.error(
      `[DOWNLOAD] Download expired for user ${user.id} and jobId ${jobId}`,
    );
    return res.status(400).send({ error: 'Este url ha expirado' });
  }

  try {
    // Can fail with weird characters
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
  console.log('Before sending file');

  return res.sendFile(fullPath);
};

export const logPrefix = (extendedAccount: boolean) =>
  extendedAccount ? '[DOWNLOAD:EXTENDED]' : '[DOWNLOAD]';
