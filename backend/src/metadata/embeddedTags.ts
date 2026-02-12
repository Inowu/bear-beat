import path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { log } from '../server';

const execFileAsync = promisify(execFile);

type FfprobeFormat = {
  duration?: string;
  tags?: Record<string, unknown>;
};

type FfprobeResponse = {
  format?: FfprobeFormat;
};

export type EmbeddedTrackTags = {
  artist: string | null;
  title: string | null;
  bpm: number | null;
  camelot: string | null;
  energyLevel: number | null;
  durationSeconds: number | null;
  comment: string | null;
};

const EMBEDDED_TAG_CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const embeddedTagCache = new Map<string, { value: EmbeddedTrackTags; expiresAt: number }>();
const embeddedTagInFlight = new Map<string, Promise<EmbeddedTrackTags>>();

const toText = (value: unknown): string => `${value ?? ''}`.trim();

function normalizeKeyName(value: string): string {
  return value.trim().toLowerCase();
}

function clampInt(value: number, min: number, max: number): number | null {
  if (!Number.isFinite(value)) return null;
  const int = Math.floor(value);
  if (int < min || int > max) return null;
  return int;
}

function parseBpm(value: string): number | null {
  const match = /(\d{2,3}(?:\.\d+)?)/.exec(value);
  if (!match) return null;
  const candidate = Number(match[1]);
  const asInt = clampInt(candidate, 50, 220);
  return asInt;
}

const CAMELOT_REGEX = /\b(1[0-2]|[1-9])\s*([AB])\b/i;

function parseCamelot(value: string): string | null {
  const match = CAMELOT_REGEX.exec(value);
  if (!match) return null;
  return `${match[1]}${match[2].toUpperCase()}`;
}

type MusicalKey = { root: string; mode: 'major' | 'minor' };

function parseMusicalKey(value: string): MusicalKey | null {
  const raw = toText(value);
  if (!raw) return null;

  const cleaned = raw
    .replace(/\u266f/g, '#')
    .replace(/\u266d/g, 'b')
    .replace(/[_]+/g, ' ')
    .trim();

  // Examples: "Am", "A minor", "A Min", "A#maj", "Bb Major", "F#"
  const match = /^([A-Ga-g])\s*([#b])?\s*(maj(or)?|min(or)?|m)?$/i.exec(cleaned);
  if (!match) return null;

  const letter = (match[1] ?? '').toUpperCase();
  const accidental = (match[2] ?? '').replace('B', 'b'); // keep as '#' or 'b'
  const quality = (match[3] ?? '').toLowerCase();

  const mode: MusicalKey['mode'] =
    quality === 'm' || quality.startsWith('min') ? 'minor' : 'major';

  const root = `${letter}${accidental}`;
  return { root, mode };
}

const CAM_BY_MUSICAL: Record<string, string> = {
  // Minor
  'G#|minor': '1A',
  'AB|minor': '1A',
  'D#|minor': '2A',
  'EB|minor': '2A',
  'A#|minor': '3A',
  'BB|minor': '3A',
  'F|minor': '4A',
  'C|minor': '5A',
  'G|minor': '6A',
  'D|minor': '7A',
  'A|minor': '8A',
  'E|minor': '9A',
  'B|minor': '10A',
  'F#|minor': '11A',
  'GB|minor': '11A',
  'C#|minor': '12A',
  'DB|minor': '12A',
  // Major
  'B|major': '1B',
  'F#|major': '2B',
  'GB|major': '2B',
  'C#|major': '3B',
  'DB|major': '3B',
  'G#|major': '4B',
  'AB|major': '4B',
  'D#|major': '5B',
  'EB|major': '5B',
  'A#|major': '6B',
  'BB|major': '6B',
  'F|major': '7B',
  'C|major': '8B',
  'G|major': '9B',
  'D|major': '10B',
  'A|major': '11B',
  'E|major': '12B',
};

function camelotFromMusical(value: string): string | null {
  const parsed = parseMusicalKey(value);
  if (!parsed) return null;
  const key = `${parsed.root.toUpperCase()}|${parsed.mode}`;
  return CAM_BY_MUSICAL[key] ?? null;
}

function parseEnergy(value: string): number | null {
  const match = /(\d{1,2})/.exec(value);
  if (!match) return null;
  return clampInt(Number(match[1]), 1, 10);
}

function parseEnergyFromComment(comment: string): number | null {
  const raw = toText(comment);
  if (!raw) return null;

  const explicit = /\benergy\s*[:\-]?\s*(\d{1,2})\b/i.exec(raw);
  if (explicit) {
    return clampInt(Number(explicit[1]), 1, 10);
  }

  // Common Mixed In Key style: "2A - Energy 6 - ..." or "2A - 6 - ..."
  const afterCamelot = new RegExp(
    `${CAMELOT_REGEX.source}\\s*[-\\u2013]\\s*(?:energy\\s*)?(\\d{1,2})\\b`,
    'i',
  ).exec(raw);
  if (afterCamelot) {
    return clampInt(Number(afterCamelot[afterCamelot.length - 1]), 1, 10);
  }

  return null;
}

function pickTag(
  tags: Record<string, unknown>,
  candidates: string[],
): string | null {
  const lower = new Map<string, string>();
  Object.entries(tags).forEach(([key, value]) => {
    const text = toText(value);
    if (!text) return;
    lower.set(normalizeKeyName(key), text);
  });

  for (const candidate of candidates) {
    const exact = lower.get(normalizeKeyName(candidate));
    if (exact) return exact;
  }

  // Fallback: substring match (handles iTunes custom tags like "----:com.apple.iTunes:initialkey")
  for (const candidate of candidates) {
    const needle = normalizeKeyName(candidate);
    for (const [key, value] of lower.entries()) {
      if (key.includes(needle)) {
        return value;
      }
    }
  }

  return null;
}

function buildCacheKey(fullPath: string, mtimeMs?: number, size?: number): string {
  const normalized = fullPath.replace(/\\/g, '/');
  // Include mtime/size when available to make the cache safe across edits.
  const statKey = `${Number.isFinite(mtimeMs as number) ? Math.floor(mtimeMs as number) : 'na'}:${Number.isFinite(size as number) ? size : 'na'}`;
  return `${normalized}|${statKey}`;
}

async function ffprobeTags(fullPath: string): Promise<FfprobeResponse | null> {
  try {
    const { stdout } = await execFileAsync(
      'ffprobe',
      [
        '-v',
        'error',
        '-print_format',
        'json',
        '-show_entries',
        'format=duration:format_tags',
        fullPath,
      ],
      {
        timeout: 12_000,
        maxBuffer: 1024 * 1024,
      },
    );
    return JSON.parse(stdout) as FfprobeResponse;
  } catch (error: any) {
    // ffprobe may be missing in some environments. Keep things resilient.
    log.debug?.(`[TRACK_TAGS] ffprobe failed for "${path.basename(fullPath)}": ${error?.message ?? 'unknown error'}`);
    return null;
  }
}

export async function getEmbeddedTrackTags(
  fullPath: string,
  options: { mtimeMs?: number; size?: number } = {},
): Promise<EmbeddedTrackTags> {
  const cacheKey = buildCacheKey(fullPath, options.mtimeMs, options.size);
  const cached = embeddedTagCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }

  const inFlight = embeddedTagInFlight.get(cacheKey);
  if (inFlight) return inFlight;

  const promise = (async () => {
    const probe = await ffprobeTags(fullPath);
    const tags = probe?.format?.tags ?? {};
    const durationRaw = toText(probe?.format?.duration);
    const durationSeconds = durationRaw ? clampInt(Number(durationRaw), 1, Number.MAX_SAFE_INTEGER) : null;

    const artist = pickTag(tags, ['artist', 'album_artist', 'albumartist', 'performer']);
    const title = pickTag(tags, ['title']);
    const comment = pickTag(tags, ['comment', 'description']);

    const bpmTag = pickTag(tags, ['tbpm', 'bpm', 'tmpo']);
    const bpm = bpmTag ? parseBpm(bpmTag) : null;

    const keyTag = pickTag(tags, ['initialkey', 'tkey', 'key']);
    const camelot = keyTag ? (parseCamelot(keyTag) ?? camelotFromMusical(keyTag)) : null;

    const energyTag = pickTag(tags, ['energylevel', 'energy_level', 'energy']);
    const energyLevel =
      (energyTag ? parseEnergy(energyTag) : null) ??
      (comment ? parseEnergyFromComment(comment) : null);

    const value: EmbeddedTrackTags = {
      artist: artist ? artist : null,
      title: title ? title : null,
      bpm,
      camelot,
      energyLevel,
      durationSeconds,
      comment: comment ? comment : null,
    };

    embeddedTagCache.set(cacheKey, { value, expiresAt: Date.now() + EMBEDDED_TAG_CACHE_TTL_MS });
    return value;
  })();

  embeddedTagInFlight.set(cacheKey, promise);
  try {
    return await promise;
  } finally {
    embeddedTagInFlight.delete(cacheKey);
  }
}
