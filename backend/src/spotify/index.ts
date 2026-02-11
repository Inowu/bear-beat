import axios from 'axios';
import { log } from '../server';

const SPOTIFY_ACCOUNTS_URL = 'https://accounts.spotify.com/api/token';
const SPOTIFY_SEARCH_URL = 'https://api.spotify.com/v1/search';
const SPOTIFY_TOKEN_SKEW_MS = 30_000;
const MEMORY_COVER_CACHE_TTL_MS = 6 * 60 * 60 * 1000;

type SpotifyTokenCache = {
  accessToken: string;
  expiresAt: number;
};

type SpotifyTrackSearchInput = {
  artist?: string | null;
  title?: string | null;
  displayName?: string | null;
  fileName?: string | null;
};

let spotifyTokenCache: SpotifyTokenCache | null = null;
let spotifyTokenPromise: Promise<string> | null = null;
const spotifyCoverCache = new Map<string, { value: string | null; expiresAt: number }>();

const toText = (value: unknown): string => `${value ?? ''}`.trim();

const normalizeForMatch = (value: string): string =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

function sanitizeSpotifyQuery(value: string): string {
  return value
    .replace(/\.(mp3|wav|aac|m4a|flac|ogg|aiff|alac|mp4|mov|mkv|avi|wmv|webm|m4v)$/i, '')
    .replace(/\b(\d{2,3}\s*bpm|(?:1[0-2]|[1-9])[ab])\b/gi, ' ')
    .replace(
      /\b(original mix|extended mix|radio edit|remix|edit|intro|outro|clean|dirty|acapella|instrumental|mashup|bootleg|live|vip)\b/gi,
      ' ',
    )
    .replace(/[_[\]()]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function buildQueryCandidates(input: SpotifyTrackSearchInput): string[] {
  const artist = sanitizeSpotifyQuery(toText(input.artist));
  const title = sanitizeSpotifyQuery(toText(input.title));
  const displayName = sanitizeSpotifyQuery(toText(input.displayName));
  const fileName = sanitizeSpotifyQuery(toText(input.fileName));
  const candidates = new Set<string>();

  if (artist && title) {
    candidates.add(`artist:${artist} track:${title}`);
    candidates.add(`${artist} ${title}`);
  }
  if (title) {
    candidates.add(`track:${title}`);
  }
  if (displayName) {
    candidates.add(displayName);
  }
  if (fileName) {
    candidates.add(fileName);
  }
  return Array.from(candidates).slice(0, 4);
}

function makeCoverCacheKey(input: SpotifyTrackSearchInput): string {
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
  name?: string;
  artists?: Array<{ name?: string }>;
  album?: { images?: SpotifyImage[] };
};

function scoreSpotifyTrack(item: SpotifyTrackItem, input: SpotifyTrackSearchInput): number {
  const titleTarget = normalizeForMatch(sanitizeSpotifyQuery(toText(input.title)));
  const artistTarget = normalizeForMatch(sanitizeSpotifyQuery(toText(input.artist)));
  const displayTarget = normalizeForMatch(sanitizeSpotifyQuery(toText(input.displayName)));
  const candidateTitle = normalizeForMatch(toText(item.name));
  const candidateArtists = normalizeForMatch(
    (item.artists ?? [])
      .map((artist) => toText(artist?.name))
      .filter(Boolean)
      .join(' '),
  );
  let score = 0;

  if (titleTarget) {
    if (candidateTitle === titleTarget) score += 8;
    else if (candidateTitle.includes(titleTarget) || titleTarget.includes(candidateTitle)) score += 5;
  }

  if (artistTarget) {
    if (candidateArtists.includes(artistTarget) || artistTarget.includes(candidateArtists)) score += 6;
  }

  if (displayTarget && !titleTarget && !artistTarget) {
    if (candidateTitle.includes(displayTarget) || displayTarget.includes(candidateTitle)) score += 4;
  }

  if (Array.isArray(item.album?.images) && item.album!.images!.length > 0) {
    score += 1;
  }

  return score;
}

function pickBestCoverFromTracks(
  items: SpotifyTrackItem[],
  input: SpotifyTrackSearchInput,
): string | null {
  const best = items
    .map((item) => ({ item, score: scoreSpotifyTrack(item, input) }))
    .sort((a, b) => b.score - a.score)[0];

  if (!best || best.score < 4) return null;
  const images = best.item.album?.images ?? [];
  if (!images.length) return null;
  return toText(images[0]?.url) || null;
}

async function searchCoverByQuery(query: string, forceTokenRefresh = false): Promise<SpotifyTrackItem[]> {
  const accessToken = await requestSpotifyToken(forceTokenRefresh);
  const market = toText(process.env.SPOTIFY_MARKET) || 'MX';

  const response = await axios.get(
    SPOTIFY_SEARCH_URL,
    {
      params: {
        q: query,
        type: 'track',
        limit: 6,
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
    return searchCoverByQuery(query, true);
  }

  if (response.status < 200 || response.status >= 300) {
    throw new Error(`Spotify search failed with status ${response.status}`);
  }

  const items = response.data?.tracks?.items;
  if (!Array.isArray(items)) return [];
  return items as SpotifyTrackItem[];
}

export async function searchSpotifyTrackCover(
  input: SpotifyTrackSearchInput,
): Promise<string | null> {
  if (!isSpotifyMetadataEnabled()) return null;

  const cacheKey = makeCoverCacheKey(input);
  const cached = spotifyCoverCache.get(cacheKey);
  const now = Date.now();
  if (cached && cached.expiresAt > now) {
    return cached.value;
  }

  const queries = buildQueryCandidates(input);
  if (!queries.length) {
    return null;
  }

  let bestCover: string | null = null;
  for (const query of queries) {
    try {
      const items = await searchCoverByQuery(query);
      bestCover = pickBestCoverFromTracks(items, input);
      if (bestCover) break;
    } catch (error: any) {
      log.warn(`[SPOTIFY] cover lookup failed for query "${query}": ${error?.message ?? 'unknown error'}`);
    }
  }

  spotifyCoverCache.set(cacheKey, {
    value: bestCover,
    expiresAt: now + MEMORY_COVER_CACHE_TTL_MS,
  });

  return bestCover;
}
