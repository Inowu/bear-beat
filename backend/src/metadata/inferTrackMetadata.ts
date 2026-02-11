import path from 'path';

const KEY_SUFFIX_REGEX = /\b(1[0-2]|[1-9])\s*([AB])\b/i;
const EXTENSION_REGEX = /\.([a-z0-9]{2,5})$/i;
const VERSION_SUFFIX_REGEX =
  /\s[-–]\s*(original mix|extended mix|radio edit|remix|edit|intro|outro|clean|dirty|acapella|instrumental|mashup|bootleg|live|vip)\s*$/i;
const TRACK_FILE_EXT_REGEX =
  /\.(mp3|wav|aac|m4a|flac|ogg|aiff|alac|mp4|mov|mkv|avi|wmv|webm|m4v)$/i;

export type InferredTrackMetadata = {
  artist: string | null;
  title: string;
  displayName: string;
  bpm: number | null;
  camelot: string | null;
  format: string | null;
  version: string | null;
  coverUrl: string | null;
  durationSeconds: number | null;
  source: 'inferred';
};

const normalizeWhitespace = (value: string): string => value.replace(/\s+/g, ' ').trim();

export function normalizeCatalogPath(value: string): string {
  const normalized = `${value ?? ''}`.trim().replace(/\\/g, '/');
  if (!normalized) return '/';
  const withLeadingSlash = normalized.startsWith('/') ? normalized : `/${normalized}`;
  const collapsed = withLeadingSlash.replace(/\/{2,}/g, '/');
  if (collapsed !== '/' && collapsed.endsWith('/')) {
    return collapsed.slice(0, -1);
  }
  return collapsed;
}

export function toCatalogRelativePath(absolutePath: string, songsPath: string): string {
  const relative = path.relative(songsPath, absolutePath).replace(/\\/g, '/');
  if (!relative || relative === '.') {
    return '/';
  }
  if (relative.startsWith('..')) {
    return normalizeCatalogPath(absolutePath);
  }
  return normalizeCatalogPath(relative);
}

export function prettyMediaName(value: string): string {
  const name = `${value ?? ''}`.trim();
  if (!name) return '';
  const noExt = name.replace(/\.[a-z0-9]{2,5}$/i, '');
  return normalizeWhitespace(noExt.replace(/_/g, ' '));
}

export function isTrackLikeFileName(name: string): boolean {
  const rawName = `${name ?? ''}`.trim();
  if (!rawName) return false;
  return TRACK_FILE_EXT_REGEX.test(rawName);
}

function isLikelyBpm(value: number): boolean {
  return Number.isFinite(value) && value >= 50 && value <= 220;
}

function extractCamelot(value: string): string | null {
  const match = KEY_SUFFIX_REGEX.exec(value);
  if (!match) return null;
  return `${match[1]}${match[2].toUpperCase()}`;
}

function extractBpm(value: string): number | null {
  const explicit = /(\d{2,3})\s*bpm\b/i.exec(value);
  if (explicit) {
    const candidate = Number(explicit[1]);
    return isLikelyBpm(candidate) ? candidate : null;
  }

  const candidates = Array.from(value.matchAll(/\b(\d{2,3})\b/g))
    .map((match) => Number(match[1]))
    .filter(isLikelyBpm);

  if (candidates.length === 0) return null;
  return candidates[candidates.length - 1] ?? null;
}

function toVersionLabel(value: string): string {
  const compact = normalizeWhitespace(value).toLowerCase();
  if (!compact) return '';
  if (compact === 'vip') return 'VIP';
  return compact
    .split(' ')
    .map((word) => `${word.charAt(0).toUpperCase()}${word.slice(1)}`)
    .join(' ');
}

function extractTempoAndKey(value: string): {
  clean: string;
  bpm: number | null;
  camelot: string | null;
} {
  const trimmed = normalizeWhitespace(value);
  if (!trimmed) {
    return { clean: '', bpm: null, camelot: null };
  }

  let clean = trimmed;
  let bpm: number | null = null;
  let camelot: string | null = null;

  const trailingParen = /\s*\(([^)]*)\)\s*$/;
  const parenMatch = trailingParen.exec(clean);
  if (parenMatch) {
    const inside = normalizeWhitespace(parenMatch[1] ?? '');
    const maybeBpm = extractBpm(inside);
    const maybeCamelot = extractCamelot(inside);
    if (maybeBpm || maybeCamelot) {
      bpm = maybeBpm ?? bpm;
      camelot = maybeCamelot ?? camelot;
      clean = normalizeWhitespace(clean.slice(0, parenMatch.index));
    }
  }

  const suffixCamelotFirst =
    /\s+\b((?:1[0-2]|[1-9])[AB])\b\s*[–-]?\s*\b(\d{2,3})\b(?:\s*bpm)?\s*$/i.exec(clean);
  if (suffixCamelotFirst) {
    const maybeBpm = Number(suffixCamelotFirst[2]);
    if (isLikelyBpm(maybeBpm)) {
      camelot = suffixCamelotFirst[1].toUpperCase();
      bpm = maybeBpm;
      clean = normalizeWhitespace(clean.slice(0, suffixCamelotFirst.index));
    }
  } else {
    const suffixBpmFirst =
      /\s+\b(\d{2,3})\b(?:\s*bpm)?\s*[–-]?\s*\b((?:1[0-2]|[1-9])[AB])\b\s*$/i.exec(clean);
    if (suffixBpmFirst) {
      const maybeBpm = Number(suffixBpmFirst[1]);
      if (isLikelyBpm(maybeBpm)) {
        bpm = maybeBpm;
        camelot = suffixBpmFirst[2].toUpperCase();
        clean = normalizeWhitespace(clean.slice(0, suffixBpmFirst.index));
      }
    }
  }

  return { clean, bpm, camelot };
}

function extractVersion(value: string): {
  clean: string;
  version: string | null;
} {
  const trimmed = normalizeWhitespace(value);
  if (!trimmed) return { clean: '', version: null };

  let clean = trimmed;
  let version: string | null = null;

  const trailingParen = /\s*\(([^)]{2,36})\)\s*$/;
  const parenMatch = trailingParen.exec(clean);
  if (parenMatch) {
    const inside = normalizeWhitespace(parenMatch[1] ?? '');
    if (inside && !extractBpm(inside) && !extractCamelot(inside)) {
      version = toVersionLabel(inside);
      clean = normalizeWhitespace(clean.slice(0, parenMatch.index));
    }
  }

  if (!version) {
    const trailingBracket = /\s*\[([^\]]{2,36})\]\s*$/;
    const bracketMatch = trailingBracket.exec(clean);
    if (bracketMatch) {
      const inside = normalizeWhitespace(bracketMatch[1] ?? '');
      if (inside && !extractBpm(inside) && !extractCamelot(inside)) {
        version = toVersionLabel(inside);
        clean = normalizeWhitespace(clean.slice(0, bracketMatch.index));
      }
    }
  }

  if (!version) {
    const versionMatch = VERSION_SUFFIX_REGEX.exec(clean);
    if (versionMatch) {
      version = toVersionLabel(versionMatch[1] ?? '');
      clean = normalizeWhitespace(clean.slice(0, versionMatch.index));
    }
  }

  return { clean, version };
}

function splitArtistAndTitle(value: string): { artist: string | null; title: string } {
  const normalized = normalizeWhitespace(value);
  const sepMatch = normalized.match(/\s[-–]\s/);
  if (!sepMatch) {
    return {
      artist: null,
      title: normalized,
    };
  }

  const sepIndex = sepMatch.index ?? -1;
  const sepLength = sepMatch[0].length;
  const artist = normalizeWhitespace(normalized.slice(0, sepIndex));
  const title = normalizeWhitespace(normalized.slice(sepIndex + sepLength));
  return {
    artist: artist || null,
    title: title || normalized,
  };
}

export function inferTrackMetadataFromName(name: string): InferredTrackMetadata | null {
  const rawName = `${name ?? ''}`.trim();
  if (!rawName) return null;
  if (!isTrackLikeFileName(rawName)) return null;

  const extension = EXTENSION_REGEX.exec(rawName)?.[1] ?? null;
  const normalizedName = prettyMediaName(rawName);
  const versionFirstPass = extractVersion(normalizedName);
  const tempoKeyMeta = extractTempoAndKey(versionFirstPass.clean);
  const versionMeta = versionFirstPass.version
    ? { clean: tempoKeyMeta.clean, version: versionFirstPass.version }
    : extractVersion(tempoKeyMeta.clean);
  const split = splitArtistAndTitle(versionMeta.clean);
  const fallbackTitle =
    versionMeta.clean || tempoKeyMeta.clean || versionFirstPass.clean || normalizedName || rawName;
  const title = split.title || fallbackTitle;
  const displayName = split.artist ? `${split.artist} - ${title}` : title;

  return {
    artist: split.artist,
    title,
    displayName,
    bpm: tempoKeyMeta.bpm,
    camelot: tempoKeyMeta.camelot,
    format: extension ? extension.toUpperCase() : null,
    version: versionMeta.version,
    coverUrl: null,
    durationSeconds: null,
    source: 'inferred',
  };
}
