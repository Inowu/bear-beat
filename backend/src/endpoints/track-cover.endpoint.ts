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
const COVER_CACHE_VERSION = 'v2';
const VIDEO_PREVIEW_MIN_SEEK_SECONDS = Number(process.env.TRACK_COVER_VIDEO_MIN_SEEK_SECONDS ?? 2);
const VIDEO_PREVIEW_MAX_SEEK_SECONDS = Number(process.env.TRACK_COVER_VIDEO_MAX_SEEK_SECONDS ?? 45);
const VIDEO_PREVIEW_SEEK_RATIO = Number(process.env.TRACK_COVER_VIDEO_SEEK_RATIO ?? 0.18);
const coverMissCache = new Map<string, number>(); // key -> expiresAt
const coverInFlight = new Map<string, Promise<boolean>>(); // key -> generation promise

type FfprobeStream = {
  index?: number;
  codec_type?: string;
  duration?: string | number;
  disposition?: {
    attached_pic?: number;
  };
};

type FfprobeFormat = {
  duration?: string | number;
};

type FfprobeStreamsResponse = {
  streams?: FfprobeStream[];
  format?: FfprobeFormat;
};

type CoverProbeSelection =
  | {
      mode: 'attached_pic';
      streamIndex: number;
      durationSeconds: number | null;
    }
  | {
      mode: 'video_frame';
      streamIndex: number;
      durationSeconds: number | null;
    }
  | {
      mode: 'none';
    }
  | {
      mode: 'unknown';
    };

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
    .update(`${COVER_CACHE_VERSION}|${relativePath}|${Math.floor(mtimeMs)}|${size}`)
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

async function ffprobeStreams(fullPath: string): Promise<FfprobeStreamsResponse | null> {
  try {
    const { stdout } = await execFileAsync(
      'ffprobe',
      [
        '-v',
        'error',
        '-print_format',
        'json',
        '-show_entries',
        'stream=index,codec_type,duration,disposition:format=duration',
        fullPath,
      ],
      {
        timeout: 12_000,
        maxBuffer: 1024 * 1024,
      },
    );
    return JSON.parse(stdout) as FfprobeStreamsResponse;
  } catch (error: any) {
    log.debug?.(
      `[TRACK_COVER] ffprobe failed for "${Path.basename(fullPath)}": ${error?.message ?? 'unknown error'}`,
    );
    return null;
  }
}

function parseDurationSeconds(value: unknown): number | null {
  const duration = Number(value);
  if (!Number.isFinite(duration) || duration <= 0) return null;
  return duration;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function resolveVideoSeekSeconds(durationSeconds: number | null): number {
  const minSeek = Number.isFinite(VIDEO_PREVIEW_MIN_SEEK_SECONDS) && VIDEO_PREVIEW_MIN_SEEK_SECONDS >= 0
    ? VIDEO_PREVIEW_MIN_SEEK_SECONDS
    : 2;
  const maxSeek = Number.isFinite(VIDEO_PREVIEW_MAX_SEEK_SECONDS) && VIDEO_PREVIEW_MAX_SEEK_SECONDS >= minSeek
    ? VIDEO_PREVIEW_MAX_SEEK_SECONDS
    : Math.max(minSeek, 45);
  const ratio = Number.isFinite(VIDEO_PREVIEW_SEEK_RATIO) && VIDEO_PREVIEW_SEEK_RATIO > 0
    ? VIDEO_PREVIEW_SEEK_RATIO
    : 0.18;

  if (!durationSeconds || durationSeconds <= minSeek + 0.5) {
    return minSeek;
  }

  return clamp(durationSeconds * ratio, minSeek, maxSeek);
}

async function resolveCoverProbeSelection(
  inputPath: string,
): Promise<CoverProbeSelection> {
  const probe = await ffprobeStreams(inputPath);
  if (!probe) return { mode: 'unknown' };

  const streams = Array.isArray(probe.streams) ? probe.streams : [];
  const formatDuration = parseDurationSeconds(probe.format?.duration);
  const attached = streams.find(
    (stream) =>
      stream?.codec_type === 'video' &&
      stream?.disposition?.attached_pic === 1 &&
      typeof stream.index === 'number' &&
      Number.isFinite(stream.index),
  );
  if (attached && typeof attached.index === 'number') {
    return {
      mode: 'attached_pic',
      streamIndex: attached.index,
      durationSeconds: parseDurationSeconds(attached.duration) ?? formatDuration,
    };
  }

  const firstVideo = streams.find(
    (stream) =>
      stream?.codec_type === 'video' &&
      typeof stream.index === 'number' &&
      Number.isFinite(stream.index),
  );
  if (firstVideo && typeof firstVideo.index === 'number') {
    return {
      mode: 'video_frame',
      streamIndex: firstVideo.index,
      durationSeconds: parseDurationSeconds(firstVideo.duration) ?? formatDuration,
    };
  }

  // No video streams at all -> no embedded cover and no video frame fallback.
  return { mode: 'none' };
}

type CoverGenerationResult = {
  ok: boolean;
  cacheableMiss: boolean;
};

async function generateCoverJpeg(inputPath: string, outputPath: string): Promise<CoverGenerationResult> {
  const selection = await resolveCoverProbeSelection(inputPath);
  if (selection.mode === 'none') {
    return { ok: false, cacheableMiss: true };
  }
  if (selection.mode === 'unknown') {
    return { ok: false, cacheableMiss: false };
  }

  const mapValue = `0:${selection.streamIndex}`;
  const args = [
    '-hide_banner',
    '-loglevel',
    'error',
    '-y',
  ];
  if (selection.mode === 'video_frame') {
    args.push('-ss', `${resolveVideoSeekSeconds(selection.durationSeconds)}`);
  }
  args.push(
    '-i',
    inputPath,
    '-map',
    mapValue,
    '-frames:v',
    '1',
    '-q:v',
    '2',
    outputPath,
  );

  try {
    await execFileAsync(
      'ffmpeg',
      args,
      {
        timeout: 25_000,
      },
    );
  } catch (error: any) {
    // Typical "no cover" case: no attached picture stream, and no video stream.
    const message = `${error?.message ?? ''}`.toLowerCase();
    const cacheableMiss =
      message.includes('matches no streams') ||
      message.includes('stream map') ||
      message.includes('attached_pic') ||
      message.includes('unknown stream');
    log.debug?.(
      `[TRACK_COVER] ffmpeg extract failed for "${inputPath}": ${error?.message ?? 'unknown error'}`,
    );
    return { ok: false, cacheableMiss };
  }

  const ok = await fileExists(outputPath);
  return { ok, cacheableMiss: true };
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

    const result = await generateCoverJpeg(fullPath, coverPath);
    if (!result.ok) {
      if (result.cacheableMiss) {
        coverMissCache.set(cacheKey, Date.now() + COVER_MISS_TTL_MS);
      }
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
