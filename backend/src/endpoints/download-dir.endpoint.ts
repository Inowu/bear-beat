import Path from 'path';
import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { SessionUser } from '../routers/auth/utils/serialize-user';
import { log } from '../server';
import { prisma } from '../db';
import { JobStatus } from '../queue/jobStatus';
import { fileService } from '../ftp';
import { isSafeFileName, resolvePathWithinRoot } from '../utils/safePaths';

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

  const jobId = req.query.jobId as string;

  if (!jobId || typeof jobId !== 'string') {
    return res.status(400).send({ error: 'Bad request' });
  }

  const providedDirName = req.query.dirName as string;
  if (!providedDirName || typeof providedDirName !== 'string' || !isSafeFileName(providedDirName)) {
    return res.status(400).send({ error: 'Bad request' });
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

  const job = await prisma.jobs.findFirst({
    where: {
      AND: [
        { status: JobStatus.COMPLETED },
        { queue: process.env.COMPRESSION_QUEUE_NAME },
        { jobId: jobId },
        { user_id: user.id },
      ],
    },
  });

  if (!job) {
    log.error(`[DOWNLOAD] Job not found for jobId ${jobId}`);
    return res
      .status(404)
      .send({ error: 'Ocurrió un error al descargar la carpeta' });
  }

  const download = await prisma.dir_downloads.findFirst({
    where: {
      jobId: job.id,
      userId: user.id,
    },
  });

  if (!download) {
    log.error(`[DOWNLOAD] Download not found for jobId ${jobId}`);
    return res
      .status(404)
      .send({ error: 'Ocurrió un error al descargar la carpeta' });
  }

  if (download.expirationDate && new Date() >= download.expirationDate) {
    log.error(`[DOWNLOAD] Download expired for jobId ${jobId}`);
    return res.status(400).send({ error: 'Este url ha expirado' });
  }

  const downloadUrl = `${download.downloadUrl ?? ''}`.trim();
  const expectedSuffix = `-${user.id}-${jobId}.zip`;

  let expectedDirName = '';
  let expectedJobId = '';
  if (downloadUrl) {
    try {
      const parsed = new URL(downloadUrl);
      expectedDirName = `${parsed.searchParams.get('dirName') ?? ''}`.trim();
      expectedJobId = `${parsed.searchParams.get('jobId') ?? ''}`.trim();
    } catch {
      // ignore parse errors; handled below.
    }
  }

  if (expectedDirName) {
    if (!isSafeFileName(expectedDirName)) {
      log.error(
        `[DOWNLOAD] Invalid dirName in downloadUrl for jobId ${jobId}`,
      );
      return res.status(404).send({ error: 'Ocurrió un error al descargar la carpeta' });
    }

    if (expectedJobId && expectedJobId !== jobId) {
      log.error(
        `[DOWNLOAD] jobId mismatch: url=${expectedJobId} req=${jobId}`,
      );
      return res.status(404).send({ error: 'Ocurrió un error al descargar la carpeta' });
    }

    if (providedDirName !== expectedDirName) {
      // Prevent IDOR: the requested file name must match the server-generated download URL.
      log.warn(
        `[DOWNLOAD] dirName mismatch: expected=${expectedDirName} got=${providedDirName}`,
      );
      return res.status(404).send({ error: 'Ocurrió un error al descargar la carpeta' });
    }
  } else {
    // Reliability fallback: if downloadUrl wasn't persisted (e.g., DB hiccup), still allow
    // downloading only the zip that matches the worker naming scheme for this user+job.
    if (!providedDirName.endsWith(expectedSuffix)) {
      log.error(
        `[DOWNLOAD] Missing downloadUrl and dirName does not match expected suffix for jobId ${jobId}`,
      );
      return res.status(404).send({ error: 'Ocurrió un error al descargar la carpeta' });
    }
    expectedDirName = providedDirName;
  }

  const compressedRoot = Path.resolve(
    __dirname,
    `../../${process.env.COMPRESSED_DIRS_NAME}`,
  );
  const fullPath = resolvePathWithinRoot(compressedRoot, expectedDirName);
  if (!fullPath) {
    return res.status(400).send({ error: 'Bad request' });
  }

  const dirExists = await fileService.exists(fullPath);
  if (!dirExists) {
    log.error(
      `[DOWNLOAD] Directory not found for jobId ${jobId}`,
    );
    return res.status(404).send({ error: 'Esa carpeta no existe' });
  }

  log.info(`[DOWNLOAD] Downloading directory for jobId ${jobId}`);

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

  return res.sendFile(fullPath);
};

export const logPrefix = (extendedAccount: boolean) =>
  extendedAccount ? '[DOWNLOAD:EXTENDED]' : '[DOWNLOAD]';
