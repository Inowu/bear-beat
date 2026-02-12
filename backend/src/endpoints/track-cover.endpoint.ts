import Path from 'path';
import fs from 'fs/promises';
import jwt from 'jsonwebtoken';
import { createHash } from 'crypto';
import { execFile } from 'child_process';
import { promisify } from 'util';
import type { Request, Response } from 'express';
import { log } from '../server';

const execFileAsync = promisify(execFile);

const COVER_MISS_TTL_MS = 24 * 60 * 60 * 1000;
const coverMissCache = new Map<string, number>(); // key -> expiresAt
const coverInFlight = new Map<string, Promise<boolean>>(); // key -> generation promise

const toText = (value: unknown): string => `${value ?? ''}`.trim();

function sanitizeCatalogRelativePath(value: unknown): string | null {
  const raw = toText(value);
  if (!raw) return null;

  // Catalog paths always use forward slashes. Strip leading slashes to keep it relative.
  const stripped = raw.replace(/^\/+/, '');
  const normalized = Path.posix.normalize(stripped).replace(/^\/+/, '');
  if (!normalized || normalized === '.' || normalized.startsWith('..')) return null;
  if (normalized.includes('/..')) return null;
  if (normalized.includes('\\')) return null;
  return normalized;
}

function resolveCoversDir(): string {
  const configured = toText(process.env.TRACK_METADATA_COVERS_PATH);
  if (configured) return configured;
  // build/endpoints -> build -> backend -> covers
  return Path.resolve(__dirname, '../../covers');
}

function computeCoverCacheKey(relativePath: string, mtimeMs: number, size: number): string {
  return createHash('sha1')
    .update(`${relativePath}|${Math.floor(mtimeMs)}|${size}`)
    .digest('hex');
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function generateCoverJpeg(inputPath: string, outputPath: string): Promise<boolean> {
  try {
    await execFileAsync(
      'ffmpeg',
      [
        '-hide_banner',
        '-loglevel',
        'error',
        '-y',
        '-i',
        inputPath,
        '-map',
        '0:v:0',
        '-frames:v',
        '1',
        '-q:v',
        '2',
        outputPath,
      ],
      {
        timeout: 25_000,
      },
    );
  } catch (error: any) {
    // Typical "no cover" case: Stream map '0:v:0' matches no streams.
    log.debug?.(
      `[TRACK_COVER] ffmpeg extract failed for "${inputPath}": ${error?.message ?? 'unknown error'}`,
    );
    return false;
  }

  return fileExists(outputPath);
}

async function ensureCoverCached(fullPath: string, coverPath: string, cacheKey: string): Promise<boolean> {
  if (await fileExists(coverPath)) return true;

  const missUntil = coverMissCache.get(cacheKey);
  if (missUntil && missUntil > Date.now()) {
    return false;
  }

  const existing = coverInFlight.get(cacheKey);
  if (existing) return existing;

  const promise = (async () => {
    try {
      await fs.mkdir(Path.dirname(coverPath), { recursive: true });
    } catch {
      // best effort
    }

    const ok = await generateCoverJpeg(fullPath, coverPath);
    if (!ok) {
      coverMissCache.set(cacheKey, Date.now() + COVER_MISS_TTL_MS);
      return false;
    }
    return true;
  })();

  coverInFlight.set(cacheKey, promise);
  try {
    return await promise;
  } finally {
    coverInFlight.delete(cacheKey);
  }
}

export const trackCoverEndpoint = async (req: Request, res: Response) => {
  const token = toText(req.query.token);
  if (!token) {
    return res.status(401).send({ error: 'Unauthorized' });
  }

  try {
    jwt.verify(token, process.env.JWT_SECRET as string);
  } catch {
    return res.status(401).send({ error: 'Unauthorized' });
  }

  const relativePath = sanitizeCatalogRelativePath(req.query.path);
  if (!relativePath) {
    return res.status(400).send({ error: 'Invalid path' });
  }

  const songsPath = toText(process.env.SONGS_PATH);
  if (!songsPath) {
    return res.status(500).send({ error: 'SONGS_PATH not configured' });
  }

  const fullPath = Path.join(songsPath, relativePath);

  let stat: { mtimeMs: number; size: number; isFile: () => boolean };
  try {
    stat = await fs.stat(fullPath);
    if (!stat.isFile()) {
      return res.status(404).end();
    }
  } catch {
    return res.status(404).end();
  }

  const coversDir = resolveCoversDir();
  const cacheKey = computeCoverCacheKey(relativePath, stat.mtimeMs, stat.size);
  const coverPath = Path.join(coversDir, `${cacheKey}.jpg`);

  const ok = await ensureCoverCached(fullPath, coverPath, cacheKey);
  if (!ok) {
    return res.status(404).end();
  }

  res.setHeader('Cache-Control', 'private, max-age=604800, immutable');
  return res.sendFile(coverPath);
};

