import Path from 'path';
import fs from 'fs';
import type { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../db';
import { fileService } from '../ftp';
import type { SessionUser } from '../routers/auth/utils/serialize-user';
import { log } from '../server';
import { resolvePathWithinRoot } from '../utils/safePaths';

const STREAMABLE_MEDIA_REGEX =
  /\.(mp3|aac|m4a|flac|ogg|aiff|alac|wav|mp4|mov|mkv|avi|wmv|webm|m4v)$/i;

const parseSessionUser = (token: unknown): SessionUser | null => {
  if (typeof token !== 'string' || !token.trim()) return null;
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET as string) as SessionUser;
    if (!payload || typeof payload.id !== 'number' || !Number.isFinite(payload.id)) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
};

const setStreamHeaders = (res: Response, fullPath: string) => {
  const fileName = Path.basename(fullPath);
  res.setHeader(
    'Content-Disposition',
    `inline; filename="${fileName}"; filename*=UTF-8''${encodeURIComponent(fileName)}`,
  );
  res.setHeader('Cache-Control', 'private, no-store, max-age=0');
};

type StreamByteRange = {
  start: number;
  end: number;
};

type CachedFileSize = {
  size: number;
  expiresAtMs: number;
};

const FILE_SIZE_CACHE_TTL_MS = 5 * 60 * 1000;
const ACTIVE_SUBSCRIPTION_CACHE_TTL_MS = 45 * 1000;
const fileSizeCache = new Map<string, CachedFileSize>();
const activeSubscriptionCache = new Map<number, number>();

const getCachedFileSize = async (fullPath: string): Promise<number | null> => {
  const nowMs = Date.now();
  const cached = fileSizeCache.get(fullPath);
  if (cached && cached.expiresAtMs > nowMs && Number.isFinite(cached.size) && cached.size > 0) {
    return cached.size;
  }

  try {
    const fileStats = await fileService.stat(fullPath);
    const fileSize = Number(fileStats?.size ?? 0);
    if (!Number.isFinite(fileSize) || fileSize <= 0) {
      fileSizeCache.delete(fullPath);
      return null;
    }

    fileSizeCache.set(fullPath, {
      size: fileSize,
      expiresAtMs: nowMs + FILE_SIZE_CACHE_TTL_MS,
    });
    return fileSize;
  } catch {
    fileSizeCache.delete(fullPath);
    return null;
  }
};

const hasActiveSubscriptionCached = async (userId: number): Promise<boolean> => {
  const nowMs = Date.now();
  const cachedUntilMs = activeSubscriptionCache.get(userId) ?? 0;
  if (cachedUntilMs > nowMs) {
    return true;
  }

  const activeSubscription = await prisma.descargasUser.findFirst({
    where: {
      user_id: userId,
      date_end: {
        gte: new Date(nowMs),
      },
    },
    select: {
      id: true,
      date_end: true,
    },
    orderBy: {
      date_end: 'desc',
    },
  });

  if (!activeSubscription) {
    activeSubscriptionCache.delete(userId);
    return false;
  }

  const subscriptionEndMs = new Date(activeSubscription.date_end).getTime();
  const nextCacheExpiryMs = Math.min(subscriptionEndMs, nowMs + ACTIVE_SUBSCRIPTION_CACHE_TTL_MS);
  if (Number.isFinite(nextCacheExpiryMs) && nextCacheExpiryMs > nowMs) {
    activeSubscriptionCache.set(userId, nextCacheExpiryMs);
  }

  return true;
};

const parseByteRange = (
  rawRangeHeader: string | undefined,
  fileSize: number,
): StreamByteRange | null => {
  const rangeHeader = `${rawRangeHeader ?? ''}`.trim();
  if (!rangeHeader) return null;

  const match = /^bytes=(\d*)-(\d*)$/i.exec(rangeHeader);
  if (!match) return null;

  const startToken = `${match[1] ?? ''}`.trim();
  const endToken = `${match[2] ?? ''}`.trim();

  if (!startToken && !endToken) {
    return null;
  }

  if (!startToken) {
    const suffixLength = Number(endToken);
    if (!Number.isFinite(suffixLength) || suffixLength <= 0) {
      return null;
    }
    const safeLength = Math.min(fileSize, Math.floor(suffixLength));
    return {
      start: Math.max(0, fileSize - safeLength),
      end: fileSize - 1,
    };
  }

  const parsedStart = Number(startToken);
  if (!Number.isFinite(parsedStart) || parsedStart < 0 || parsedStart >= fileSize) {
    return null;
  }

  const parsedEnd = endToken ? Number(endToken) : fileSize - 1;
  if (!Number.isFinite(parsedEnd) || parsedEnd < parsedStart) {
    return null;
  }

  return {
    start: Math.floor(parsedStart),
    end: Math.min(fileSize - 1, Math.floor(parsedEnd)),
  };
};

export const streamEndpoint = async (req: Request, res: Response) => {
  const user = parseSessionUser(req.query.token);
  if (!user) {
    return res.status(401).send({ error: 'Unauthorized' });
  }

  const requestedPath = `${req.query.path ?? ''}`.trim();
  if (!requestedPath) {
    return res.status(400).send({ error: 'Parámetro path inválido' });
  }

  if (!STREAMABLE_MEDIA_REGEX.test(requestedPath)) {
    return res.status(400).send({ error: 'Solo se permite reproducir audio o video' });
  }

  const songsRoot = `${process.env.SONGS_PATH ?? ''}`.trim();
  const fullPath = resolvePathWithinRoot(songsRoot, requestedPath);
  if (!fullPath) {
    return res.status(400).send({ error: 'Parámetro path inválido' });
  }

  const fileSize = await getCachedFileSize(fullPath);
  if (!fileSize) {
    return res.status(404).send({ error: 'No encontramos este archivo' });
  }

  const hasActiveSubscription = await hasActiveSubscriptionCached(user.id);
  if (!hasActiveSubscription) {
    return res.status(403).send({ error: 'Necesitas una membresía activa para reproducir completo' });
  }

  setStreamHeaders(res, fullPath);
  res.setHeader('Accept-Ranges', 'bytes');
  res.type(Path.extname(fullPath));

  const requestRange = typeof req.headers.range === 'string' ? req.headers.range : undefined;
  const byteRange = parseByteRange(requestRange, fileSize);
  if (requestRange && !byteRange) {
    res.status(416);
    res.setHeader('Content-Range', `bytes */${fileSize}`);
    return res.end();
  }

  const start = byteRange?.start ?? 0;
  const end = byteRange?.end ?? fileSize - 1;
  const chunkSize = end - start + 1;

  if (byteRange) {
    res.status(206);
    res.setHeader('Content-Range', `bytes ${start}-${end}/${fileSize}`);
  } else {
    res.status(200);
  }
  res.setHeader('Content-Length', `${chunkSize}`);

  if (req.method === 'HEAD') {
    return res.end();
  }

  const fileStream = fs.createReadStream(fullPath, { start, end });
  fileStream.on('error', (error) => {
    const errorCode = typeof (error as any)?.code === 'string' ? (error as any).code : 'unknown';
    if (res.headersSent) {
      log.warn(
        `[STREAM] Stream error after headers sent (${errorCode}) for "${Path.basename(fullPath)}": ${error.message ?? ''}`,
      );
      return;
    }
    const statusCode = errorCode === 'ENOENT' ? 404 : 500;
    log.error(
      `[STREAM] Failed serving "${Path.basename(fullPath)}": ${error.message ?? 'unknown error'}`,
    );
    res.status(statusCode).send({ error: 'No pudimos reproducir este archivo' });
  });

  fileStream.pipe(res);
  return;
};
