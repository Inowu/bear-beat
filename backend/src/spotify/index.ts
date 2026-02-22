import axios from 'axios';
import { log } from '../server';

const SPOTIFY_ACCOUNTS_URL = 'https://accounts.spotify.com/api/token';
const SPOTIFY_SEARCH_URL = 'https://api.spotify.com/v1/search';
const SPOTIFY_TOKEN_SKEW_MS = 30_000;
const MEMORY_COVER_CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const SPOTIFY_SEARCH_LIMIT = 8;
const SPOTIFY_MIN_SCORE = 28;
const SPOTIFY_EARLY_ACCEPT_SCORE = 72;

const AUDIO_VIDEO_EXT_REGEX = /\.(mp3|aac|m4a|flac|ogg|aiff|alac|mp4|mov|mkv|avi|wmv|webm|m4v)$/i;
const BPM_CAMLOT_REGEX = /\b(\d{2,3}\s*bpm|(?:1[0-2]|[1-9])[ab])\b/gi;
const REMIX_MARKERS_REGEX =
  /\b(remix|mix|edit|vip|bootleg|rework|flip|mashup|version|refix|redrum)\b/i;
const LIVE_MARKERS_REGEX = /\b(live|en vivo)\b/i;
const INSTRUMENTAL_MARKERS_REGEX = /\b(instrumental|acapella|acappella)\b/i;
const EXCLUDED_MARKERS_REGEX = /\b(karaoke|tribute)\b/i;
const VERSION_SEGMENT_MARKERS_REGEX =
  /\b(original mix|extended mix|radio edit|club mix|dub mix|remix|mix|edit|vip|bootleg|rework|flip|mashup|version)\b/i;

const REMIX_STOPWORDS = new Set([
  'remix',
  'mix',
  'edit',
  'vip',
  'bootleg',
  'rework',
  'flip',
  'mashup',
  'version',
  'original',
  'extended',
  'radio',
  'club',
  'dub',
  'clean',
  'dirty',
  'intro',
  'outro',
  'instrumental',
  'acapella',
  'acappella',
  'feat',
  'featuring',
  'ft',
  'x',
  'vs',
]);

type SpotifyTokenCache = {
  accessToken: string;
  expiresAt: number;
};

export type SpotifyTrackSearchInput = {
  artist?: string | null;
  title?: string | null;
  displayName?: string | null;
  fileName?: string | null;
};

type MatchKind = 'remix' | 'original_fallback';

export type SpotifyTrackMetadataResult = {
  coverUrl: string | null;
  title: string | null;
  artist: string | null;
  confidence: number;
  matchedType: MatchKind;
  spotifyTrackId: string | null;
};

type SearchDescriptor = {
  artist: string;
  fullTitle: string;
  baseTitle: string;
  displayName: string;
  fileName: string;
  artistNorm: string;
  fullTitleNorm: string;
  baseTitleNorm: string;
  artistTokens: string[];
  baseTitleTokens: string[];
  remixTokens: string[];
  hasRemixHint: boolean;
  hasLiveHint: boolean;
  hasInstrumentalHint: boolean;
};

type CandidateDescriptor = {
  titleNorm: string;
  baseTitleNorm: string;
  titleTokens: string[];
  baseTitleTokens: string[];
  artistsNorm: string;
  artistTokens: string[];
  remixTokens: string[];
  hasRemixHint: boolean;
  hasLiveHint: boolean;
  hasInstrumentalHint: boolean;
  hasExcludedHint: boolean;
};

let spotifyTokenCache: SpotifyTokenCache | null = null;
let spotifyTokenPromise: Promise<string> | null = null;
const spotifyMetadataCache = new Map<
  string,
  { value: SpotifyTrackMetadataResult | null; expiresAt: number }
>();

const toText = (value: unknown): string => `${value ?? ''}`.trim();
const normalizeWhitespace = (value: string): string => value.replace(/\s+/g, ' ').trim();

const normalizeForMatch = (value: string): string =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const tokenizeForMatch = (value: string): string[] =>
  normalizeForMatch(value)
    .split(' ')
    .map((token) => token.trim())
    .filter((token) => token.length > 1);

function sanitizeSpotifyText(value: string): string {
  return normalizeWhitespace(
    value
      .replace(AUDIO_VIDEO_EXT_REGEX, '')
      .replace(BPM_CAMLOT_REGEX, ' ')
      .replace(/[_[\]{}()]+/g, ' ')
      .replace(/\s+/g, ' '),
  );
}

function containsVersionMarkers(value: string): boolean {
  return VERSION_SEGMENT_MARKERS_REGEX.test(value);
}

function stripVersionTail(value: string): { baseTitle: string; versionSegments: string[] } {
  let clean = normalizeWhitespace(value);
  const versionSegments: string[] = [];

  while (clean) {
    let changed = false;

    const trailingParen = /\s*[\(\[]([^\)\]]{2,90})[\)\]]\s*$/;
    const parenMatch = trailingParen.exec(clean);
    if (parenMatch) {
      const inside = normalizeWhitespace(parenMatch[1] ?? '');
      if (inside && containsVersionMarkers(inside)) {
        versionSegments.push(inside);
        clean = normalizeWhitespace(clean.slice(0, parenMatch.index));
        changed = true;
      }
    }

    if (changed) continue;

    const trailingDash = /\s[-–]\s([^–-]{2,90})$/;
    const dashMatch = trailingDash.exec(clean);
    if (dashMatch) {
      const segment = normalizeWhitespace(dashMatch[1] ?? '');
      if (segment && containsVersionMarkers(segment)) {
        versionSegments.push(segment);
        clean = normalizeWhitespace(clean.slice(0, dashMatch.index));
        changed = true;
      }
    }

    if (!changed) break;
  }

  return {
    baseTitle: clean || normalizeWhitespace(value),
    versionSegments,
  };
}

function splitArtistAndTitle(value: string): { artist: string; title: string } | null {
  const normalized = normalizeWhitespace(value);
  if (!normalized) return null;
  const separator = /\s[-–]\s/.exec(normalized);
  if (!separator) return null;

  const separatorIndex = separator.index ?? -1;
  const separatorLength = separator[0].length;
  const artist = normalizeWhitespace(normalized.slice(0, separatorIndex));
  const title = normalizeWhitespace(normalized.slice(separatorIndex + separatorLength));

  if (!artist || !title) return null;
  return { artist, title };
}

function extractRemixTokens(value: string): string[] {
  const tokens = tokenizeForMatch(value);
  if (!tokens.length) return [];
  return Array.from(
    new Set(
      tokens.filter((token) => token.length > 1 && !REMIX_STOPWORDS.has(token)),
    ),
  );
}

function buildSearchDescriptor(input: SpotifyTrackSearchInput): SearchDescriptor {
  const artistFromInput = sanitizeSpotifyText(toText(input.artist));
  const titleFromInput = sanitizeSpotifyText(toText(input.title));
  const displayName = sanitizeSpotifyText(toText(input.displayName));
  const fileName = sanitizeSpotifyText(toText(input.fileName));
  const splitDisplay = splitArtistAndTitle(displayName);

  const artist = artistFromInput || splitDisplay?.artist || '';
  const fullTitle = titleFromInput || splitDisplay?.title || displayName || fileName;
  const versionSplit = stripVersionTail(fullTitle || fileName);
  const baseTitle = versionSplit.baseTitle || fullTitle;
  const remixTokenSource = `${versionSplit.versionSegments.join(' ')} ${fullTitle}`;
  const remixTokens = extractRemixTokens(remixTokenSource);

  return {
    artist,
    fullTitle,
    baseTitle,
    displayName,
    fileName,
    artistNorm: normalizeForMatch(artist),
    fullTitleNorm: normalizeForMatch(fullTitle),
    baseTitleNorm: normalizeForMatch(baseTitle),
    artistTokens: tokenizeForMatch(artist),
    baseTitleTokens: tokenizeForMatch(baseTitle),
    remixTokens,
    hasRemixHint: REMIX_MARKERS_REGEX.test(fullTitle),
    hasLiveHint: LIVE_MARKERS_REGEX.test(fullTitle),
    hasInstrumentalHint: INSTRUMENTAL_MARKERS_REGEX.test(fullTitle),
  };
}

function toSpotifyField(value: string): string {
  return value.replace(/["']/g, ' ').trim();
}

function buildQueryCandidates(descriptor: SearchDescriptor): string[] {
  const candidates = new Set<string>();
  const artist = toSpotifyField(descriptor.artist);
  const fullTitle = toSpotifyField(descriptor.fullTitle);
  const baseTitle = toSpotifyField(descriptor.baseTitle);
  const displayName = toSpotifyField(descriptor.displayName);
  const fileName = toSpotifyField(descriptor.fileName);

  if (artist && fullTitle) {
    candidates.add(`artist:"${artist}" track:"${fullTitle}"`);
    candidates.add(`${artist} ${fullTitle}`);
  }
  if (fullTitle) {
    candidates.add(`track:"${fullTitle}"`);
    candidates.add(fullTitle);
  }

  if (artist && baseTitle && normalizeForMatch(baseTitle) !== normalizeForMatch(fullTitle)) {
    candidates.add(`artist:"${artist}" track:"${baseTitle}"`);
    candidates.add(`${artist} ${baseTitle}`);
  }
  if (baseTitle && normalizeForMatch(baseTitle) !== normalizeForMatch(fullTitle)) {
    candidates.add(`track:"${baseTitle}"`);
  }
  if (displayName) {
    candidates.add(displayName);
  }
  if (fileName) {
    candidates.add(fileName);
  }
  return Array.from(candidates).slice(0, 8);
}

function makeMetadataCacheKey(input: SpotifyTrackSearchInput): string {
  return [
    normalizeForMatch(toText(input.artist)),
    normalizeForMatch(toText(input.title)),
    normalizeForMatch(toText(input.displayName)),
    normalizeForMatch(toText(input.fileName)),
  ].join('|');
}

function getSpotifyCredentials(): { clientId: string; clientSecret: string } | null {
  const clientId = toText(process.env.SPOTIFY_CLIENT_ID);
  const clientSecret = toText(process.env.SPOTIFY_CLIENT_SECRET);
  if (!clientId || !clientSecret) return null;
  return { clientId, clientSecret };
}

export function isSpotifyMetadataEnabled(): boolean {
  if (process.env.TRACK_METADATA_SPOTIFY_ENABLED !== '1') {
    return false;
  }
  return Boolean(getSpotifyCredentials());
}

async function requestSpotifyToken(forceRefresh = false): Promise<string> {
  const now = Date.now();

  if (
    !forceRefresh &&
    spotifyTokenCache &&
    spotifyTokenCache.expiresAt - SPOTIFY_TOKEN_SKEW_MS > now
  ) {
    return spotifyTokenCache.accessToken;
  }

  if (!forceRefresh && spotifyTokenPromise) {
    return spotifyTokenPromise;
  }

  const credentials = getSpotifyCredentials();
  if (!credentials) {
    throw new Error('Spotify credentials not configured');
  }

  spotifyTokenPromise = (async () => {
    const encoded = Buffer.from(`${credentials.clientId}:${credentials.clientSecret}`).toString('base64');
    const body = new URLSearchParams({ grant_type: 'client_credentials' }).toString();

    const response = await axios.post(
      SPOTIFY_ACCOUNTS_URL,
      body,
      {
        headers: {
          Authorization: `Basic ${encoded}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        timeout: 10_000,
      },
    );

    const accessToken = toText(response.data?.access_token);
    const expiresInSec = Number(response.data?.expires_in ?? 3600);
    if (!accessToken) {
      throw new Error('Spotify token response missing access_token');
    }

    spotifyTokenCache = {
      accessToken,
      expiresAt: Date.now() + Math.max(60, expiresInSec) * 1000,
    };
    return accessToken;
  })();

  try {
    return await spotifyTokenPromise;
  } finally {
    spotifyTokenPromise = null;
  }
}

type SpotifyImage = { url: string; width: number | null; height: number | null };
type SpotifyTrackItem = {
  id?: string;
  name?: string;
  artists?: Array<{ name?: string }>;
  popularity?: number;
  album?: { images?: SpotifyImage[] };
};

function tokenOverlapRatio(left: string[], right: string[]): number {
  if (!left.length || !right.length) return 0;
  const rightSet = new Set(right);
  let overlap = 0;
  left.forEach((token) => {
    if (rightSet.has(token)) overlap += 1;
  });
  return overlap / left.length;
}

function tokenJaccard(left: string[], right: string[]): number {
  if (!left.length || !right.length) return 0;
  const leftSet = new Set(left);
  const rightSet = new Set(right);
  let intersection = 0;
  leftSet.forEach((token) => {
    if (rightSet.has(token)) intersection += 1;
  });
  const union = leftSet.size + rightSet.size - intersection;
  if (union <= 0) return 0;
  return intersection / union;
}

function buildCandidateDescriptor(item: SpotifyTrackItem): CandidateDescriptor {
  const rawTitle = sanitizeSpotifyText(toText(item.name));
  const split = stripVersionTail(rawTitle);
  const artistsText = (item.artists ?? [])
    .map((artist) => sanitizeSpotifyText(toText(artist?.name)))
    .filter(Boolean)
    .join(' ');
  const remixTokenSource = `${split.versionSegments.join(' ')} ${rawTitle}`;

  return {
    titleNorm: normalizeForMatch(rawTitle),
    baseTitleNorm: normalizeForMatch(split.baseTitle),
    titleTokens: tokenizeForMatch(rawTitle),
    baseTitleTokens: tokenizeForMatch(split.baseTitle),
    artistsNorm: normalizeForMatch(artistsText),
    artistTokens: tokenizeForMatch(artistsText),
    remixTokens: extractRemixTokens(remixTokenSource),
    hasRemixHint: REMIX_MARKERS_REGEX.test(rawTitle),
    hasLiveHint: LIVE_MARKERS_REGEX.test(rawTitle),
    hasInstrumentalHint: INSTRUMENTAL_MARKERS_REGEX.test(rawTitle),
    hasExcludedHint: EXCLUDED_MARKERS_REGEX.test(rawTitle),
  };
}

function scoreSpotifyTrack(
  item: SpotifyTrackItem,
  descriptor: SearchDescriptor,
): { score: number; matchedType: MatchKind } {
  const candidate = buildCandidateDescriptor(item);
  let matchedType: MatchKind = 'original_fallback';
  let score = 0;

  if (descriptor.baseTitleNorm && candidate.baseTitleNorm) {
    if (candidate.baseTitleNorm === descriptor.baseTitleNorm) {
      score += 42;
    } else if (
      candidate.baseTitleNorm.includes(descriptor.baseTitleNorm)
      || descriptor.baseTitleNorm.includes(candidate.baseTitleNorm)
    ) {
      score += 30;
    } else {
      score += Math.round(tokenJaccard(descriptor.baseTitleTokens, candidate.baseTitleTokens) * 22);
    }
  }

  if (descriptor.fullTitleNorm && candidate.titleNorm) {
    if (candidate.titleNorm === descriptor.fullTitleNorm) {
      score += 22;
    } else if (
      candidate.titleNorm.includes(descriptor.fullTitleNorm)
      || descriptor.fullTitleNorm.includes(candidate.titleNorm)
    ) {
      score += 12;
    } else {
      score += Math.round(tokenJaccard(descriptor.baseTitleTokens, candidate.titleTokens) * 10);
    }
  }

  if (descriptor.artistNorm && candidate.artistsNorm) {
    if (
      candidate.artistsNorm.includes(descriptor.artistNorm)
      || descriptor.artistNorm.includes(candidate.artistsNorm)
    ) {
      score += 26;
    } else {
      score += Math.round(tokenOverlapRatio(descriptor.artistTokens, candidate.artistTokens) * 16);
    }
  }

  if (descriptor.hasRemixHint) {
    if (candidate.hasRemixHint) {
      matchedType = 'remix';
      score += 10;

      if (descriptor.remixTokens.length > 0) {
        const remixOverlap = tokenOverlapRatio(descriptor.remixTokens, candidate.remixTokens);
        if (remixOverlap > 0) {
          score += Math.round(remixOverlap * 16);
        } else {
          score -= 8;
        }
      }
    } else {
      score -= 4;
    }
  } else if (candidate.hasRemixHint) {
    score -= 2;
  }

  if (!descriptor.hasLiveHint && candidate.hasLiveHint) {
    score -= 12;
  }
  if (!descriptor.hasInstrumentalHint && candidate.hasInstrumentalHint) {
    score -= 8;
  }
  if (candidate.hasExcludedHint) {
    score -= 18;
  }

  if (Array.isArray(item.album?.images) && item.album!.images!.length > 0) {
    score += 3;
  }
  if (typeof item.popularity === 'number' && Number.isFinite(item.popularity)) {
    score += Math.min(4, Math.max(0, Math.round(item.popularity / 30)));
  }

  return { score, matchedType };
}

function toConfidence(score: number): number {
  const normalized = (score - SPOTIFY_MIN_SCORE) / 72;
  return Math.max(0, Math.min(1, Number(normalized.toFixed(2))));
}

async function searchTracksByQuery(query: string, forceTokenRefresh = false): Promise<SpotifyTrackItem[]> {
  const accessToken = await requestSpotifyToken(forceTokenRefresh);
  const market = toText(process.env.SPOTIFY_MARKET) || 'MX';

  const response = await axios.get(
    SPOTIFY_SEARCH_URL,
    {
      params: {
        q: query,
        type: 'track',
        limit: SPOTIFY_SEARCH_LIMIT,
        market,
      },
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      timeout: 10_000,
      validateStatus: (status) => status >= 200 && status < 500,
    },
  );

  if (response.status === 401 && !forceTokenRefresh) {
    return searchTracksByQuery(query, true);
  }

  if (response.status < 200 || response.status >= 300) {
    throw new Error(`Spotify search failed with status ${response.status}`);
  }

  const items = response.data?.tracks?.items;
  if (!Array.isArray(items)) return [];
  return items as SpotifyTrackItem[];
}

export async function searchSpotifyTrackMetadata(
  input: SpotifyTrackSearchInput,
): Promise<SpotifyTrackMetadataResult | null> {
  if (!isSpotifyMetadataEnabled()) return null;

  const cacheKey = makeMetadataCacheKey(input);
  const cached = spotifyMetadataCache.get(cacheKey);
  const now = Date.now();
  if (cached && cached.expiresAt > now) {
    return cached.value;
  }

  const descriptor = buildSearchDescriptor(input);
  const queries = buildQueryCandidates(descriptor);
  if (!queries.length) {
    spotifyMetadataCache.set(cacheKey, {
      value: null,
      expiresAt: now + MEMORY_COVER_CACHE_TTL_MS,
    });
    return null;
  }

  const candidatesByKey = new Map<
    string,
    { item: SpotifyTrackItem; score: number; matchedType: MatchKind }
  >();

  for (const query of queries) {
    try {
      const items = await searchTracksByQuery(query);
      items.forEach((item) => {
        const key = toText(item.id)
          || [
            normalizeForMatch(toText(item.name)),
            normalizeForMatch(
              (item.artists ?? [])
                .map((artist) => toText(artist?.name))
                .filter(Boolean)
                .join(' '),
            ),
          ].join('|');
        if (!key) return;

        const scored = scoreSpotifyTrack(item, descriptor);
        const previous = candidatesByKey.get(key);
        if (!previous || scored.score > previous.score) {
          candidatesByKey.set(key, {
            item,
            score: scored.score,
            matchedType: scored.matchedType,
          });
        }
      });

      const topScore = Math.max(
        ...Array.from(candidatesByKey.values()).map((entry) => entry.score),
        Number.MIN_SAFE_INTEGER,
      );
      if (topScore >= SPOTIFY_EARLY_ACCEPT_SCORE) {
        break;
      }
    } catch (error: any) {
      log.warn(`[SPOTIFY] cover lookup failed for query "${query}": ${error?.message ?? 'unknown error'}`);
    }
  }

  const bestCandidate = Array.from(candidatesByKey.values()).sort((left, right) => {
    if (right.score !== left.score) return right.score - left.score;
    const rightPopularity = Number(right.item.popularity ?? 0);
    const leftPopularity = Number(left.item.popularity ?? 0);
    return rightPopularity - leftPopularity;
  })[0];

  if (!bestCandidate || bestCandidate.score < SPOTIFY_MIN_SCORE) {
    spotifyMetadataCache.set(cacheKey, {
      value: null,
      expiresAt: now + MEMORY_COVER_CACHE_TTL_MS,
    });
    return null;
  }

  const bestImages = bestCandidate.item.album?.images ?? [];
  const result: SpotifyTrackMetadataResult = {
    coverUrl: toText(bestImages[0]?.url) || null,
    title: toText(bestCandidate.item.name) || null,
    artist: toText(bestCandidate.item.artists?.[0]?.name) || null,
    confidence: toConfidence(bestCandidate.score),
    matchedType: bestCandidate.matchedType,
    spotifyTrackId: toText(bestCandidate.item.id) || null,
  };

  if (!result.coverUrl && !result.title && !result.artist) {
    spotifyMetadataCache.set(cacheKey, {
      value: null,
      expiresAt: now + MEMORY_COVER_CACHE_TTL_MS,
    });
    return null;
  }

  spotifyMetadataCache.set(cacheKey, {
    value: result,
    expiresAt: now + MEMORY_COVER_CACHE_TTL_MS,
  });

  return result;
}

export async function searchSpotifyTrackCover(
  input: SpotifyTrackSearchInput,
): Promise<string | null> {
  const metadata = await searchSpotifyTrackMetadata(input);
  return metadata?.coverUrl ?? null;
}
