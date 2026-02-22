import Path from 'path';
import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { fileService } from '../ftp';
import { prisma } from '../db';
import { SessionUser } from '../routers/auth/utils/serialize-user';
import { log } from '../server';
import { extendedAccountPostfix } from '../utils/constants';
import {
  inferDownloadHistoryRollupCategories,
  normalizeDownloadHistoryFileName,
  toUtcDay,
} from '../utils/downloadHistoryRollup';
import { resolvePathWithinRoot } from '../utils/safePaths';

const DOWNLOAD_IDEMPOTENCY_TTL_MS = 2 * 60 * 1000;
const DOWNLOAD_IDEMPOTENCY_WAIT_TIMEOUT_MS = 30 * 1000;
const DOWNLOAD_REQUEST_ID_MAX_LENGTH = 128;

type DownloadIdempotencyOutcome = 'completed' | 'failed' | 'timeout';
type DownloadIdempotencyStatus = 'in_progress' | 'completed';

interface DownloadIdempotencyEntry {
  status: DownloadIdempotencyStatus;
  fullPath: string;
  expiresAt: number;
  waiters: Set<(outcome: DownloadIdempotencyOutcome) => void>;
}

const downloadIdempotencyCache = new Map<string, DownloadIdempotencyEntry>();

const cleanupDownloadIdempotencyCache = () => {
  const now = Date.now();
  for (const [key, entry] of downloadIdempotencyCache.entries()) {
    if (entry.expiresAt <= now) {
      downloadIdempotencyCache.delete(key);
    }
  }
};

const buildDownloadIdempotencyKey = (
  userId: number,
  requestedPath: string,
  requestId: string,
): string => `${userId}::${requestedPath}::${requestId}`;

const normalizeDownloadRequestId = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > DOWNLOAD_REQUEST_ID_MAX_LENGTH) return null;
  if (!/^[a-zA-Z0-9._-]+$/.test(trimmed)) return null;
  return trimmed;
};

const waitForIdempotencyResolution = async (
  key: string,
): Promise<DownloadIdempotencyOutcome> => {
  const entry = downloadIdempotencyCache.get(key);
  if (!entry) return 'failed';
  if (entry.status === 'completed') return 'completed';

  return new Promise<DownloadIdempotencyOutcome>((resolve) => {
    const timeoutId = setTimeout(() => {
      entry.waiters.delete(onDone);
      resolve('timeout');
    }, DOWNLOAD_IDEMPOTENCY_WAIT_TIMEOUT_MS);

    const onDone = (outcome: DownloadIdempotencyOutcome) => {
      clearTimeout(timeoutId);
      entry.waiters.delete(onDone);
      resolve(outcome);
    };

    entry.waiters.add(onDone);
  });
};

const resolveIdempotencyEntry = (
  key: string,
  outcome: DownloadIdempotencyOutcome,
  nextStatus?: DownloadIdempotencyStatus,
  fullPath?: string,
) => {
  const entry = downloadIdempotencyCache.get(key);
  if (!entry) return;

  if (nextStatus === 'completed') {
    entry.status = 'completed';
    if (fullPath) entry.fullPath = fullPath;
    entry.expiresAt = Date.now() + DOWNLOAD_IDEMPOTENCY_TTL_MS;
  }

  for (const notify of entry.waiters) {
    notify(outcome);
  }
  entry.waiters.clear();
};

const clearDownloadIdempotencyEntry = (key: string) => {
  const entry = downloadIdempotencyCache.get(key);
  if (!entry) return;

  for (const notify of entry.waiters) {
    notify('failed');
  }
  entry.waiters.clear();
  downloadIdempotencyCache.delete(key);
};

const setDownloadResponseHeaders = (
  res: Response,
  fullPath: string,
) => {
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
};

export const __clearDownloadIdempotencyCacheForTests = () => {
  downloadIdempotencyCache.clear();
};

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

  const requestedPath = req.query.path as string;
  if (!requestedPath || typeof requestedPath !== 'string') {
    return res.status(400).send({ error: 'Bad request' });
  }

  const songsRoot = String(process.env.SONGS_PATH || '').trim();
  const fullPath = resolvePathWithinRoot(songsRoot, requestedPath);
  if (!fullPath) {
    return res.status(400).send({ error: 'Bad request' });
  }
  const fileExists = await fileService.exists(fullPath);

  if (!fileExists) {
    return res.status(404).send({ error: 'Este archivo o carpeta no existe' });
  }

  const requestId = normalizeDownloadRequestId(req.query.rid);
  const isProbeRequest = `${req.query.probe ?? ''}`.trim() === '1';
  let idempotencyKey: string | null = null;

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

  if (activePlans.length === 0) {
    return res
      .status(403)
      .send({ error: 'Necesitas una membresía activa para descargar' });
  }

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
    log.error('[DOWNLOAD] This user does not have an ftp user');

    return res
      .status(400)
      .send({ error: 'Este usuario no tiene una cuenta FTP' });
  }

  const extendedAccount = ftpAccounts.find((ftpAccount) =>
    ftpAccount.userid.endsWith(extendedAccountPostfix),
  );

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

  const fileStat = await fileService.stat(fullPath);

  const availableBytesRegular =
    quotaLimits.bytes_out_avail - quotaTallies.bytes_out_used;

  // Use extended account only when the user has an active membership but
  // regular quota is not enough for this specific file download.
  if (extendedAccount) {
    const shouldUseExtended =
      availableBytesRegular < BigInt(fileStat.size);

    if (shouldUseExtended) {
      log.info('[DOWNLOAD] Using extended account');
      regularFtpUser = extendedAccount;
      useExtendedAccount = true;
    }
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
      `${logPrefix(useExtendedAccount)} This user does not have quotas`,
    );
    return res
      .status(400)
      .send({ error: 'No hay quotas activas para este usuario' });
  }

  const availableBytes =
    quotaLimits.bytes_out_avail - quotaTallies.bytes_out_used;

  if (requestId) {
    cleanupDownloadIdempotencyCache();
    idempotencyKey = buildDownloadIdempotencyKey(user.id, requestedPath, requestId);
    const existing = downloadIdempotencyCache.get(idempotencyKey);

    if (existing && existing.expiresAt > Date.now()) {
      if (existing.status === 'completed') {
        const completedPath = existing.fullPath || fullPath;
        setDownloadResponseHeaders(res, completedPath);
        return res.sendFile(completedPath);
      }

      const outcome = await waitForIdempotencyResolution(idempotencyKey);
      const resolvedEntry = downloadIdempotencyCache.get(idempotencyKey);
      if (outcome === 'completed' && resolvedEntry?.status === 'completed') {
        const completedPath = resolvedEntry.fullPath || fullPath;
        setDownloadResponseHeaders(res, completedPath);
        return res.sendFile(completedPath);
      }

      if (outcome === 'timeout') {
        setDownloadResponseHeaders(res, fullPath);
        return res.sendFile(fullPath);
      }
    }
  }

  if (availableBytes < fileStat.size) {
    log.error(`${logPrefix(useExtendedAccount)} Not enough bytes left`, {
      availableBytes: availableBytes.toString(),
      requiredBytes: String(fileStat.size),
      path: requestedPath,
    });

    return res
      .status(400)
      .send({ error: 'Este usuario no tiene suficientes bytes disponibles' });
  }

  if (isProbeRequest) {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-BB-Download-Probe', 'ok');
    res.setHeader('X-BB-File-Size', String(fileStat.size));
    return res.status(204).end();
  }

  if (idempotencyKey) {
    downloadIdempotencyCache.set(idempotencyKey, {
      status: 'in_progress',
      fullPath,
      expiresAt: Date.now() + DOWNLOAD_IDEMPOTENCY_TTL_MS,
      waiters: new Set(),
    });
  }

  log.info(
    `${logPrefix(useExtendedAccount)} bytes available left: ${availableBytes}`,
  );

  try {
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
    const downloadedAt = new Date();
    try {
      await prisma.downloadHistory.create({
        data: {
          userId: user.id,
          size: fileStat.size,
          date: downloadedAt,
          fileName: requestedPath,
          isFolder: false,
        },
      });
    } catch (e: any) {
      log.warn(
        `[DOWNLOAD] Failed to write download_history: ${e?.message ?? e}`,
      );
    }

    const normalizedFileName = normalizeDownloadHistoryFileName(requestedPath);
    const categories = normalizedFileName
      ? inferDownloadHistoryRollupCategories(normalizedFileName)
      : [];
    if (normalizedFileName && categories.length > 0) {
      const day = toUtcDay(downloadedAt);
      for (const category of categories) {
        try {
          await prisma.downloadHistoryRollupDaily.upsert({
            where: {
              category_day_fileName: {
                category,
                day,
                fileName: normalizedFileName,
              },
            },
            create: {
              category,
              day,
              fileName: normalizedFileName,
              downloads: BigInt(1),
              totalBytes: BigInt(fileStat.size),
              lastDownload: downloadedAt,
            },
            update: {
              downloads: {
                increment: BigInt(1),
              },
              totalBytes: {
                increment: BigInt(fileStat.size),
              },
              lastDownload: downloadedAt,
            },
          });
        } catch (e: any) {
          log.warn(
            `[DOWNLOAD] Failed to write download_history_rollup_daily: ${e?.message ?? e}`,
          );
        }
      }
    }
  } catch (e: any) {
    if (idempotencyKey) {
      clearDownloadIdempotencyEntry(idempotencyKey);
    }
    log.error(`[DOWNLOAD] Failed to finalize download: ${e?.message ?? e}`);
    return res.status(500).send({ error: 'Ocurrió un error al preparar la descarga' });
  }

  if (idempotencyKey) {
    resolveIdempotencyEntry(idempotencyKey, 'completed', 'completed', fullPath);
  }

  setDownloadResponseHeaders(res, fullPath);
  return res.sendFile(fullPath);
};

export const logPrefix = (extendedAccount: boolean) =>
  extendedAccount ? '[DOWNLOAD:EXTENDED]' : '[DOWNLOAD]';
