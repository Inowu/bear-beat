import Path from 'path';
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

  const hasFile = await fileService.exists(fullPath);
  if (!hasFile) {
    return res.status(404).send({ error: 'No encontramos este archivo' });
  }

  await fileService.stat(fullPath);

  const activeSubscription = await prisma.descargasUser.findFirst({
    where: {
      user_id: user.id,
      date_end: {
        gte: new Date(),
      },
    },
    select: {
      id: true,
    },
  });

  if (!activeSubscription) {
    return res.status(403).send({ error: 'Necesitas una membresía activa para reproducir completo' });
  }

  setStreamHeaders(res, fullPath);
  return res.sendFile(fullPath, (error) => {
    if (!error) return;
    const statusCode = typeof (error as any)?.statusCode === 'number' ? (error as any).statusCode : 500;
    const errorCode = typeof (error as any)?.code === 'string' ? (error as any).code : 'unknown';
    if (res.headersSent) {
      log.warn(
        `[STREAM] Error after headers sent (${errorCode}): ${error.message ?? ''}`,
      );
      return;
    }
    log.error(
      `[STREAM] Failed serving "${Path.basename(fullPath)}": ${error.message ?? 'unknown error'}`,
    );
    res.status(statusCode).send({ error: 'No pudimos reproducir este archivo' });
  });
};
