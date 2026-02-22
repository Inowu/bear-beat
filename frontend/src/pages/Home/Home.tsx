import './Home.scss';
import { Link, useLocation } from 'react-router-dom';
import {
  FolderOpen, Folder, ArrowLeft, ChevronRight, Search, Play, Pause, Download, BookOpen, Server, FileMusic, FileVideoCamera, FileArchive, Microphone, File, X, RefreshCw, } from "src/icons";
import PreviewModal from '../../components/PreviewModal/PreviewModal';
import { type CSSProperties, useEffect, useMemo, useRef, useState } from 'react';
import type { Stripe } from '@stripe/stripe-js';
import trpc from '../../api';
import { IFiles, ITrackMetadata } from 'interfaces/Files';
import { sortArrayByName } from '../../functions/functions';
import { Spinner } from '../../components/Spinner/Spinner';
import { useUserContext } from '../../contexts/UserContext';
import { useTheme } from '../../contexts/ThemeContext';
import { getStripeAppearance } from '../../utils/stripeAppearance';
import { ErrorModal } from '../../components/Modals/ErrorModal/ErrorModal';
import { PlansModal, SuccessModal, VerifyUpdatePhoneModal } from '../../components/Modals';
import { useDownloadContext } from '../../contexts/DownloadContext';
import { ConditionModal } from '../../components/Modals/ConditionModal/ContitionModal';
import { of } from 'await-of';
import Pagination from '../../components/Pagination/Pagination';
import { UsersUHModal } from '../../components/Modals/UsersUHModal/UsersUHModal';
import { Elements } from '@stripe/react-stripe-js';
import { GROWTH_METRICS, trackGrowthMetric } from '../../utils/growthMetrics';
import { formatBytes } from '../../utils/format';
import { inferTrackMetadata } from '../../utils/fileMetadata';
import { apiBaseUrl } from '../../utils/runtimeConfig';
import { buildDemoPlaybackUrl, buildMemberPlaybackUrl } from '../../utils/demoUrl';
import { isRetryableMediaError, retryWithJitter } from '../../utils/retry';
import {
  ensureStripeReady, getStripeLoadFailureReason, } from '../../utils/stripeLoader';
import { Button, EmptyState, SkeletonCard, SkeletonRow, SkeletonTable, Input } from "../../components/ui";
import { appToast, truncateToastLabel } from "../../utils/toast";
import {
  MOBILE_LIBRARY_ROOT_EVENT,
  MOBILE_LIBRARY_ROOT_STORAGE_KEY,
  MOBILE_SEARCH_QUERY_STORAGE_KEY,
  MOBILE_SEARCH_SUBMIT_EVENT,
} from "../../constants/mobileNavigation";

interface IAlbumData {
  name: string;
  type: string;
  path?: string;
  size: number;
  idx: number;
  gbSize: number;
}

interface QueryFolder {
  back?: boolean;
  next?: string;
  folder?: number;
}

interface PendingDownload {
  file: IFiles;
  index: number;
  type: 'file' | 'folder';
}

type RecentPack = {
  folderPath: string;
  name: string;
  fileCount: number | string | bigint;
  addedAt: string | Date;
  genre: string | null;
};

type RootNewFileCounts = {
  Audios?: number;
  Karaoke?: number;
  Videos?: number;
  [key: string]: number | undefined;
};

type PublicTopDownloadItem = {
  path: string;
  name: string;
  downloads: number | string | bigint;
  lastDownload?: string | Date;
};

type PublicTopDownloadsResponse = {
  audio?: PublicTopDownloadItem[];
  video?: PublicTopDownloadItem[];
  karaoke?: PublicTopDownloadItem[];
};

type MonthlyTrendingRow = {
  path: string;
  name: string;
  downloads: number;
  format: string;
  hasPreview: boolean;
  lastDownloadMs: number;
};

type ForYouRecommendation = {
  path: string;
  name: string;
  type: string;
  size: number;
  metadata: ITrackMetadata | null;
  genre: string | null;
  hasPreview: boolean;
};

type ForYouFeed = {
  eligible: boolean;
  totalDownloads: number;
  recommendations: ForYouRecommendation[];
};

type FileVisualKind = 'folder' | 'audio' | 'video' | 'karaoke' | 'archive' | 'file';
type PreviewKind = 'audio' | 'video';
type PlaybackMode = 'demo' | 'full';
type MediaScope = 'audio' | 'video' | 'karaoke' | null;
type SearchQuickFilter = 'audio' | 'video' | 'karaoke' | 'mp3';
type ResolvedTrackMetadata = {
  artist: string | null;
  title: string;
  displayName: string;
  bpm: number | null;
  camelot: string | null;
  energyLevel: number | null;
  format: string | null;
  version: string | null;
  coverUrl: string | null;
  durationSeconds: number | null;
  source: 'database' | 'inferred';
};

const AUDIO_EXT_REGEX = /\.(mp3|aac|m4a|flac|ogg|aiff|alac)$/i;
const VIDEO_EXT_REGEX = /\.(mp4|mov|mkv|avi|wmv|webm|m4v)$/i;
const AUDIO_PATH_REGEX = /(^|\/)audios?(\/|$)/i;
const VIDEO_PATH_REGEX = /(^|\/)videos?(\/|$)/i;
const KARAOKE_PATH_REGEX = /(^|\/)karaokes?(\/|$)/i;
const PREVIEW_AUDIO_FORMATS = new Set([
  'MP3',
  'AAC',
  'M4A',
  'FLAC',
  'OGG',
  'AIFF',
  'ALAC',
]);
const PREVIEW_VIDEO_FORMATS = new Set([
  'MP4',
  'MOV',
  'MKV',
  'AVI',
  'WMV',
  'WEBM',
  'M4V',
]);
const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;
const WEEK_MS = 7 * DAY_MS;
const MONTH_MS = 30 * DAY_MS;
const YEAR_MS = 365 * DAY_MS;
const SEARCH_QUICK_FILTERS: Array<{ value: SearchQuickFilter; label: string }> = [
  { value: 'audio', label: 'Audio' },
  { value: 'video', label: 'Video' },
  { value: 'karaoke', label: 'Karaoke' },
  { value: 'mp3', label: 'MP3' },
];

const normalizeFilePath = (value?: string): string => (value ?? '').replace(/\\/g, '/');
const isTrackCoverKind = (kind: FileVisualKind): boolean =>
  kind === 'audio' || kind === 'video' || kind === 'karaoke';
const buildTrackCoverProxyUrl = (
  trackPath: string | undefined,
  token: string | null | undefined,
): string | null => {
  const normalizedPath = normalizeFilePath(trackPath).replace(/^\/+/, '').trim();
  const safeToken = `${token ?? ''}`.trim();
  if (!normalizedPath || !safeToken) return null;
  return `${apiBaseUrl}/track-cover?path=${encodeURIComponent(normalizedPath)}&token=${encodeURIComponent(safeToken)}`;
};
const normalizeDownloadMarkerPath = (value?: string): string => {
  const normalized = normalizeFilePath(value).trim().replace(/\/{2,}/g, '/');
  if (!normalized) return '';
  const withLeadingSlash = normalized.startsWith('/') ? normalized : `/${normalized}`;
  if (withLeadingSlash !== '/' && withLeadingSlash.endsWith('/')) {
    return withLeadingSlash.slice(0, -1);
  }
  return withLeadingSlash;
};
const normalizeOptionalText = (value: unknown): string | null => {
  const text = `${value ?? ''}`.trim();
  return text ? text : null;
};
const normalizeOptionalNumber = (value: unknown): number | null => {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return null;
  }
  return value;
};
const resolveCoverHue = (seed: string): number => {
  const normalized = `${seed ?? ''}`.trim().toLowerCase();
  if (!normalized) return 198;
  let hash = 0;
  for (let idx = 0; idx < normalized.length; idx += 1) {
    hash = ((hash << 5) - hash + normalized.charCodeAt(idx)) | 0;
  }
  return Math.abs(hash) % 360;
};
const buildTrackMetadata = (
  file: IFiles,
  kind: FileVisualKind,
): ResolvedTrackMetadata | null => {
  if (file.type === 'd') return null;
  if (kind !== 'audio' && kind !== 'video' && kind !== 'karaoke') return null;

  const inferred = inferTrackMetadata(file.name);
  const backend = (file.metadata ?? null) as ITrackMetadata | null;

  const artist = normalizeOptionalText(backend?.artist) ?? inferred.artist;
  const title =
    normalizeOptionalText(backend?.title) ??
    normalizeOptionalText(inferred.title) ??
    normalizeOptionalText(file.name) ??
    '';
  const bpm = normalizeOptionalNumber(backend?.bpm) ?? inferred.bpm;
  const camelot = normalizeOptionalText(backend?.camelot) ?? inferred.camelot;
  const energyLevel = normalizeOptionalNumber(backend?.energyLevel);
  const format = normalizeOptionalText(backend?.format) ?? inferred.format;
  const version = normalizeOptionalText(backend?.version) ?? inferred.version;
  const coverUrl = normalizeOptionalText(backend?.coverUrl);
  const durationSeconds = normalizeOptionalNumber(backend?.durationSeconds);
  const displayName =
    normalizeOptionalText(backend?.displayName) ??
    (artist ? `${artist} - ${title}` : title) ??
    normalizeOptionalText(inferred.displayName) ??
    file.name;

  return {
    artist,
    title,
    displayName,
    bpm,
    camelot,
    energyLevel,
    format,
    version,
    coverUrl,
    durationSeconds,
    source: normalizeOptionalText(backend?.source) === 'database' ? 'database' : 'inferred',
  };
};

type KeyTone = 'blue' | 'green' | 'teal' | 'amber' | 'violet' | 'rose';

const resolveKeyTone = (value: string | null): KeyTone => {
  const normalized = `${value ?? ''}`.trim().toUpperCase();
  if (!normalized) return 'blue';

  const camelotMatch = /^(\d{1,2})([AB])$/.exec(normalized);
  if (camelotMatch) {
    return camelotMatch[2] === 'A' ? 'green' : 'blue';
  }

  const note = /^([A-G])/.exec(normalized)?.[1];
  if (note === 'A') return 'green';
  if (note === 'B') return 'teal';
  if (note === 'C') return 'blue';
  if (note === 'D') return 'amber';
  if (note === 'E') return 'rose';
  if (note === 'F') return 'violet';
  if (note === 'G') return 'teal';
  return 'blue';
};

const getResolvedFormatBadge = (fileName: string, metadataFormat: string | null): string | null => {
  const fromMetadata = normalizeOptionalText(metadataFormat);
  if (fromMetadata) return fromMetadata.toUpperCase();
  const ext = fileName.includes('.')
    ? fileName.slice(fileName.lastIndexOf('.') + 1).trim()
    : '';
  if (!ext || ext.length > 5) return null;
  return ext.toUpperCase();
};

const toEnergyLabel = (value: number | null | undefined): string | null => {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return null;
  }
  const normalized = Math.max(1, Math.min(10, Math.round(value)));
  return `E${normalized}/10`;
};

const formatRecentPackAge = (value: string): string => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return 'Hace poco';
  }

  const diffMs = Math.max(0, Date.now() - parsed.getTime());

  if (diffMs >= YEAR_MS) {
    const years = Math.floor(diffMs / YEAR_MS);
    return `Hace ${years} año${years === 1 ? '' : 's'}`;
  }
  if (diffMs >= MONTH_MS) {
    const months = Math.floor(diffMs / MONTH_MS);
    return `Hace ${months} mes${months === 1 ? '' : 'es'}`;
  }
  if (diffMs >= WEEK_MS) {
    const weeks = Math.floor(diffMs / WEEK_MS);
    return `Hace ${weeks} semana${weeks === 1 ? '' : 's'}`;
  }
  if (diffMs >= DAY_MS) {
    const days = Math.floor(diffMs / DAY_MS);
    return `Hace ${days} día${days === 1 ? '' : 's'}`;
  }
  if (diffMs >= HOUR_MS) {
    const hours = Math.floor(diffMs / HOUR_MS);
    return `Hace ${hours} hora${hours === 1 ? '' : 's'}`;
  }
  if (diffMs >= MINUTE_MS) {
    const minutes = Math.floor(diffMs / MINUTE_MS);
    return `Hace ${minutes} min`;
  }
  return 'Hace unos segundos';
};

const formatRecentPackFileCount = (count: number): string =>
  `${count} archivo${count === 1 ? '' : 's'}`;

const formatNewBadgeLabel = (count: number): string =>
  `· ${count} nuevo${count === 1 ? '' : 's'}`;

const formatTrendingDownloads = (count: number): string =>
  new Intl.NumberFormat('es-MX').format(Math.max(0, Math.floor(count)));

const toTrendingNumber = (value: number | string | bigint): number => {
  if (typeof value === 'bigint') {
    const max = BigInt(Number.MAX_SAFE_INTEGER);
    return Number(value > max ? max : value);
  }
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  if (!Number.isFinite(value)) return 0;
  return value;
};

const toTrendingTimestamp = (value?: string | Date): number => {
  if (!value) return 0;
  const parsed = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(parsed.getTime())) return 0;
  return parsed.getTime();
};

const getTrendingFormatBadge = (nameOrPath: string): string => {
  const cleaned = `${nameOrPath ?? ''}`.trim();
  const ext = cleaned.includes('.')
    ? cleaned.slice(cleaned.lastIndexOf('.') + 1).toUpperCase()
    : '';
  if (!ext) return 'FILE';
  if (ext.length > 5) return 'FILE';
  return ext;
};

const canTrendingPreview = (format: string): boolean =>
  PREVIEW_AUDIO_FORMATS.has(format) || PREVIEW_VIDEO_FORMATS.has(format);

const resolveRootBadgeKey = (folderName: string): string => {
  const normalized = folderName.trim().toLocaleLowerCase('es-MX');
  if (normalized.startsWith('audio')) return 'Audios';
  if (normalized.startsWith('video')) return 'Videos';
  if (normalized.startsWith('karaoke')) return 'Karaoke';
  return folderName;
};

const buildMonthlyTrending = (payload: PublicTopDownloadsResponse | null): MonthlyTrendingRow[] => {
  if (!payload) return [];

  const merged = [
    ...(Array.isArray(payload.audio) ? payload.audio : []),
    ...(Array.isArray(payload.video) ? payload.video : []),
    ...(Array.isArray(payload.karaoke) ? payload.karaoke : []),
  ];

  const byPath = new Map<string, MonthlyTrendingRow>();

  merged.forEach((item) => {
    const normalizedPath = normalizeFilePath(item?.path ?? '').replace(/^\/+/, '');
    if (!normalizedPath) return;

    const downloads = toTrendingNumber(item?.downloads ?? 0);
    if (!Number.isFinite(downloads) || downloads <= 0) return;

    const normalizedName = `${item?.name ?? ''}`.trim();
    const name = normalizedName || normalizedPath.split('/').pop() || normalizedPath;
    const format = getTrendingFormatBadge(name || normalizedPath);
    const lastDownloadMs = toTrendingTimestamp(item?.lastDownload);

    const row: MonthlyTrendingRow = {
      path: normalizedPath,
      name,
      downloads: Math.floor(downloads),
      format,
      hasPreview: canTrendingPreview(format),
      lastDownloadMs,
    };

    const previous = byPath.get(normalizedPath);
    if (!previous) {
      byPath.set(normalizedPath, row);
      return;
    }

    if (row.downloads > previous.downloads) {
      byPath.set(normalizedPath, row);
      return;
    }

    if (row.downloads === previous.downloads && row.lastDownloadMs > previous.lastDownloadMs) {
      byPath.set(normalizedPath, row);
    }
  });

  return Array.from(byPath.values())
    .sort((left, right) => {
      if (right.downloads !== left.downloads) return right.downloads - left.downloads;
      if (right.lastDownloadMs !== left.lastDownloadMs) return right.lastDownloadMs - left.lastDownloadMs;
      return left.name.localeCompare(right.name, 'es-MX');
    })
    .slice(0, 10);
};

function Home() {
  const location = useLocation();
  const { theme } = useTheme();
  const { fileChange, closeFile, userToken, currentUser, startUser } = useUserContext();
  const { setShowDownload, setCurrentFile, setFileData } = useDownloadContext();
  const [showPreviewModal, setShowPreviewModal] = useState<boolean>(false);
  const [showModal, setShowModal] = useState<boolean>(false);
  const [showConditionModal, setShowConditionModal] = useState<boolean>(false);
  const [showPlan, setShowPlan] = useState<boolean>(false);
  const [albumData, setAlbumData] = useState<IAlbumData>({} as IAlbumData);
  const [error, setError] = useState<boolean>(false);
  const [errMsg, setErrMsg] = useState<any>('');
  const [files, setfiles] = useState<IFiles[]>([]);
  const [folderScopeFiles, setFolderScopeFiles] = useState<IFiles[]>([]);
  const [pastFile, setPastFile] = useState<string[]>([]);
  const [loader, setLoader] = useState<boolean>(false);
  const [loadFile, setLoadFile] = useState<boolean>(false);
  const [loadDownload, setLoadDownload] = useState<boolean>(false);
  const [fileToShow, setFileToShow] = useState<{
    url: string;
    name: string;
    kind: PreviewKind;
    playbackMode: PlaybackMode;
  } | null>(null);
  const [index, setIndex] = useState<number>(-1);
  const [show, setShow] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<any>('');
  const [showSuccess, setShowSuccess] = useState<boolean>(false);
  const [successTitle, setSuccessTitle] = useState<string>('');
  const [successMessage, setSuccessMessage] = useState<string>('');
  const [paginationLoader, setPaginationLoader] = useState(false);
  const [showPagination, setShowPagination] = useState(false);
  const [totalSearch, setTotalSearch] = useState(0);
  const [filters, setFilters] = useState<{ limit: number; page: number }>({
    limit: 20,
    page: 0,
  });
  const [searchValue, setSearchValue] = useState<string>('');
  const [searchQuickFilter, setSearchQuickFilter] = useState<SearchQuickFilter | null>(null);
  const [loadError, setLoadError] = useState<string>('');
  const [showVerifyModal, setShowVerifyModal] = useState<boolean>(false);
  const [pendingDownload, setPendingDownload] = useState<PendingDownload | null>(null);
  const [stripePromise, setStripePromise] = useState<Promise<Stripe | null> | null>(null);
  const [isNewUserOnboarding, setIsNewUserOnboarding] = useState(false);
  const [onboardingCheckLoading, setOnboardingCheckLoading] = useState(false);
  const [recommendedDownloadLoading, setRecommendedDownloadLoading] = useState(false);
  const [recentPacks, setRecentPacks] = useState<RecentPack[]>([]);
  const [recentPacksLoading, setRecentPacksLoading] = useState(true);
  const [newFileCounts, setNewFileCounts] = useState<RootNewFileCounts>({});
  const [monthlyTrending, setMonthlyTrending] = useState<MonthlyTrendingRow[]>([]);
  const [monthlyTrendingLoading, setMonthlyTrendingLoading] = useState(true);
  const [monthlyTrendingPreviewPath, setMonthlyTrendingPreviewPath] = useState<string | null>(null);
  const [monthlyTrendingDownloadPath, setMonthlyTrendingDownloadPath] = useState<string | null>(null);
  const [forYouRecommendations, setForYouRecommendations] = useState<ForYouRecommendation[]>([]);
  const [forYouLoading, setForYouLoading] = useState(true);
  const [forYouEligible, setForYouEligible] = useState(false);
  const [forYouPreviewPath, setForYouPreviewPath] = useState<string | null>(null);
  const [forYouDownloadPath, setForYouDownloadPath] = useState<string | null>(null);
  const [recentPackDownloadPath, setRecentPackDownloadPath] = useState<string | null>(null);
  const [downloadedPathFlags, setDownloadedPathFlags] = useState<Record<string, true>>({});
  const [inlinePreviewPath, setInlinePreviewPath] = useState<string | null>(null);
  const [inlinePreviewProgress, setInlinePreviewProgress] = useState(0);
  const [inlinePreviewPlaying, setInlinePreviewPlaying] = useState(false);
  const [inlinePreviewLoadingPath, setInlinePreviewLoadingPath] = useState<string | null>(null);
  const [inlineUnavailablePaths, setInlineUnavailablePaths] = useState<Record<string, true>>({});
  const searchRequestRef = useRef(0);
  const appliedGenreQueryRef = useRef('');
  const lastTrackedSearchRef = useRef<string>('');
  const stripeWarmupRef = useRef<Promise<boolean> | null>(null);
  const recentCarouselRef = useRef<HTMLDivElement | null>(null);
  const inlineAudioRef = useRef<HTMLAudioElement | null>(null);
  const inlinePreviewRequestRef = useRef(0);
  const inlineDemoUrlCacheRef = useRef<Map<string, string>>(new Map());
  const genreSearchFromQuery = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return `${params.get('genre') ?? ''}`.trim();
  }, [location.search]);

  const stripeOptions = useMemo(() => ({ appearance: getStripeAppearance(theme) }), [theme]);
  const canUseFullPlayback = Boolean(currentUser?.hasActiveSubscription && userToken);

  const getFileVisualKind = (file: IFiles): FileVisualKind => {
    if (file.type === 'd') {
      return 'folder';
    }

    const fileName = file.name.toLowerCase();
    const normalizedPath = normalizeFilePath(file.path).toLowerCase();
    const isKaraoke = KARAOKE_PATH_REGEX.test(normalizedPath) || fileName.includes('karaoke');
    if (isKaraoke) {
      return 'karaoke';
    }
    if (/\.(mp3|aac|m4a|flac|ogg|aiff|alac)$/i.test(fileName)) {
      return 'audio';
    }
    if (/\.(mp4|mov|mkv|avi|wmv|webm|m4v)$/i.test(fileName)) {
      return 'video';
    }
    if (/\.(zip|rar|7z|tar|gz)$/i.test(fileName)) {
      return 'archive';
    }
    return 'file';
  };

  const getFileCategoryLabel = (file: IFiles): string => {
    const kind = getFileVisualKind(file);
    if (kind === 'folder') {
      return 'Carpeta';
    }
    if (kind === 'audio') {
      return 'Audio';
    }
    if (kind === 'video') {
      return 'Video';
    }
    if (kind === 'karaoke') {
      return 'Karaoke';
    }
    if (kind === 'archive') {
      return 'Comprimido';
    }
    return 'Archivo';
  };

  const getRecentPackVisualKind = (pack: RecentPack): FileVisualKind => {
    const haystack = `${pack.folderPath} ${pack.genre ?? ''}`.toLowerCase();
    if (haystack.includes('video')) {
      return 'video';
    }
    if (pack.genre) {
      return 'audio';
    }
    return 'folder';
  };

  const matchesSearchQuickFilter = (file: IFiles, filter: SearchQuickFilter): boolean => {
    if (file.type !== '-') {
      return false;
    }

    const kind = getFileVisualKind(file);
    if (filter === 'audio') {
      return kind === 'audio';
    }
    if (filter === 'video') {
      return kind === 'video';
    }
    if (filter === 'karaoke') {
      return kind === 'karaoke';
    }

    const formatBadge = getResolvedFormatBadge(file.name, file.metadata?.format ?? null);
    if (!formatBadge) return false;
    if (filter === 'mp3') return formatBadge === 'MP3';
    return false;
  };

  const resolveMediaScope = (segments: string[]): MediaScope => {
    const firstSegment = (segments[0] ?? '').toLowerCase();
    if (firstSegment.includes('audio')) {
      return 'audio';
    }
    if (firstSegment.includes('video')) {
      return 'video';
    }
    if (firstSegment.includes('karaoke')) {
      return 'karaoke';
    }
    return null;
  };

  const fileMatchesScope = (file: IFiles, scope: MediaScope): boolean => {
    if (!scope) {
      return true;
    }
    const normalizedPath = normalizeFilePath(file.path).toLowerCase();
    const normalizedName = file.name.toLowerCase();
    const isAudio = AUDIO_EXT_REGEX.test(normalizedName) || AUDIO_EXT_REGEX.test(normalizedPath);
    const isVideo = VIDEO_EXT_REGEX.test(normalizedName) || VIDEO_EXT_REGEX.test(normalizedPath);
    const isFolder = file.type === 'd';

    if (scope === 'audio') {
      return isFolder ? AUDIO_PATH_REGEX.test(normalizedPath) : isAudio;
    }
    if (scope === 'video') {
      return isFolder ? VIDEO_PATH_REGEX.test(normalizedPath) : isVideo;
    }
    return KARAOKE_PATH_REGEX.test(normalizedPath) || normalizedName.includes('karaoke');
  };

  const fileMatchesPathPrefix = (file: IFiles, pathSegments: string[]): boolean => {
    if (!pathSegments.length) {
      return true;
    }
    const normalizedPath = normalizeFilePath(file.path).toLowerCase();
    if (!normalizedPath) {
      return false;
    }
    const prefix = `/${pathSegments.join('/').toLowerCase()}`;
    return normalizedPath.startsWith(prefix);
  };

  const resolveFilePath = (file: IFiles): string => {
    if (file.path) {
      return normalizeFilePath(file.path);
    }
    const joinedPath = [...pastFile, file.name].filter(Boolean).join('/');
    return `/${joinedPath}`;
  };

  const markItemAsDownloaded = (path: string, itemType: '-' | 'd') => {
    const normalizedTargetPath = normalizeDownloadMarkerPath(path);
    if (!normalizedTargetPath) return;
    setDownloadedPathFlags((prev) =>
      prev[normalizedTargetPath] ? prev : { ...prev, [normalizedTargetPath]: true }
    );

    const markRows = (rows: IFiles[]): IFiles[] =>
      rows.map((item) => {
        if (item.type !== itemType) return item;

        const fallbackPath = `/${[...pastFile, item.name].filter(Boolean).join('/')}`;
        const normalizedItemPath = normalizeDownloadMarkerPath(item.path ?? fallbackPath);
        if (!normalizedItemPath || normalizedItemPath !== normalizedTargetPath) {
          return item;
        }
        if (item.already_downloaded) return item;
        return {
          ...item,
          already_downloaded: true,
        };
      });

    setfiles((prev) => markRows(prev));
    setFolderScopeFiles((prev) => markRows(prev));
  };

  const resolvePreviewPath = (file: IFiles): string =>
    resolveFilePath(file).replace(/^\/+/, '');

  const resolveTrackPlaybackKind = (fileName: string, path: string): PreviewKind => {
    const signature = `${fileName} ${path}`.toLowerCase();
    return AUDIO_EXT_REGEX.test(signature) ? 'audio' : 'video';
  };

  const resolvePlaybackSource = async (
    path: string,
    opts: { forceDemo?: boolean } = {},
  ): Promise<{ url: string; playbackMode: PlaybackMode }> => {
    const normalizedPath = normalizeFilePath(path).replace(/^\/+/, '');
    const shouldUseFullPlayback = canUseFullPlayback && !opts.forceDemo;

    if (shouldUseFullPlayback) {
      return {
        url: buildMemberPlaybackUrl(normalizedPath, userToken, apiBaseUrl),
        playbackMode: 'full',
      };
    }

    const filesDemo = await retryWithJitter(
      async () => await trpc.ftp.demo.query({ path: normalizedPath }),
      {
        maxAttempts: 3,
        baseDelayMs: 250,
        maxDelayMs: 1800,
        jitterMs: 450,
        shouldRetry: isRetryableMediaError,
      },
    );
    return {
      url: buildDemoPlaybackUrl(filesDemo.demo, apiBaseUrl),
      playbackMode: 'demo',
    };
  };

  const isInlineDemoUnavailableError = (error: unknown): boolean => {
    const code = `${(error as any)?.data?.code ?? (error as any)?.shape?.data?.code ?? ''}`;
    if (
      code === 'NOT_FOUND' ||
      code === 'BAD_REQUEST' ||
      code === 'FORBIDDEN' ||
      code === 'INTERNAL_SERVER_ERROR'
    ) {
      return true;
    }
    const message = `${(error as any)?.message ?? ''}`.toLowerCase();
    return (
      message.includes('no existe') ||
      message.includes('no pudimos preparar el demo') ||
      message.includes('solo se permiten')
    );
  };

  const stopInlinePreviewAudio = (options: { clearSource?: boolean } = {}) => {
    const audio = inlineAudioRef.current;
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
      if (options.clearSource) {
        audio.removeAttribute('src');
        audio.load();
      }
    }
    inlinePreviewRequestRef.current += 1;
    setInlinePreviewPath(null);
    setInlinePreviewProgress(0);
    setInlinePreviewPlaying(false);
    setInlinePreviewLoadingPath(null);
  };

  const toggleInlineAudioPreview = async (file: IFiles) => {
    const audio = inlineAudioRef.current;
    if (!audio) return;

    const normalizedPath = resolvePreviewPath(file);
    if (!normalizedPath || inlinePreviewLoadingPath === normalizedPath) return;
    if (inlineUnavailablePaths[normalizedPath]) return;

    const isSameTrack = inlinePreviewPath === normalizedPath;
    if (isSameTrack && !audio.paused && !audio.ended) {
      audio.pause();
      return;
    }

    if (isSameTrack && audio.paused && !audio.ended) {
      try {
        await audio.play();
      } catch {
        appToast.error("No pudimos reproducir el preview. Reintentar.");
      }
      return;
    }

    stopInlinePreviewAudio();
    setInlinePreviewLoadingPath(normalizedPath);
    const requestId = ++inlinePreviewRequestRef.current;

    try {
      let playbackMode: PlaybackMode = canUseFullPlayback ? 'full' : 'demo';
      const cacheKey = `${playbackMode}:${normalizedPath}`;
      let previewUrl = inlineDemoUrlCacheRef.current.get(cacheKey);
      if (!previewUrl) {
        const playback = await resolvePlaybackSource(normalizedPath);
        previewUrl = playback.url;
        playbackMode = playback.playbackMode;
        inlineDemoUrlCacheRef.current.set(`${playbackMode}:${normalizedPath}`, previewUrl);
      }

      if (requestId !== inlinePreviewRequestRef.current) return;

      audio.src = previewUrl;
      audio.currentTime = 0;
      setInlinePreviewPath(normalizedPath);
      setInlinePreviewProgress(0);
      await audio.play();
      setInlinePreviewPlaying(true);

      if (playbackMode === 'demo') {
        trackGrowthMetric(GROWTH_METRICS.VIEW_DEMO_CLICK, {
          location: 'home_library_inline',
          kind: 'audio',
          pagePath: normalizedPath,
        });
      }
      trackGrowthMetric(GROWTH_METRICS.FILE_PREVIEW_OPENED, {
        fileType: 'audio',
        pagePath: normalizedPath,
        playbackMode,
      });
    } catch (error) {
      if (requestId !== inlinePreviewRequestRef.current) return;

      if (isInlineDemoUnavailableError(error)) {
        setInlineUnavailablePaths((previous) => ({
          ...previous,
          [normalizedPath]: true,
        }));
      } else {
        appToast.error("No pudimos cargar el preview. Reintentar.");
      }
      stopInlinePreviewAudio();
    } finally {
      if (requestId === inlinePreviewRequestRef.current) {
        setInlinePreviewLoadingPath(null);
      }
    }
  };

  const isVerificationRequiredMessage = (message?: string): boolean => {
    const normalized = (message ?? '').toLowerCase();
    return (
      normalized.includes('verificar') ||
      normalized.includes('whatsapp') ||
      normalized.includes('forbidden')
    );
  };

  const queueDownloadVerification = (payload: PendingDownload) => {
    setPendingDownload(payload);
    setShowVerifyModal(true);
  };

  const trackFolderNavigation = (
    targetPathSegments: string[],
    source: 'root' | 'next' | 'back' | 'breadcrumb' | 'search-reset',
  ) => {
    trackGrowthMetric(GROWTH_METRICS.FOLDER_NAVIGATED, {
      source,
      depth: targetPathSegments.length,
      pagePath: `/${targetPathSegments.join('/')}`,
      scope: resolveMediaScope(targetPathSegments) ?? 'mixed',
    });
  };

  const closeError = () => {
    setShow(false);
  };
  const closeSuccess = () => {
    setShowSuccess(false);
  };
  const closePlan = () => {
    setShowPlan(false);
  };
  const ensureStripeForSurface = async (surface: 'home_migration' | 'home_gb_topup'): Promise<boolean> => {
    if (stripePromise) return true;
    if (stripeWarmupRef.current) return stripeWarmupRef.current;

    const warmup = (async () => {
      try {
        const stripe = await ensureStripeReady({ timeoutMs: 4500 });
        setStripePromise(stripe.stripePromise);
        return true;
      } catch (error) {
        trackGrowthMetric(GROWTH_METRICS.CHECKOUT_ERROR, {
          method: 'card',
          reason: 'stripe_js_load_failed',
          errorCode: getStripeLoadFailureReason(error),
          surface,
        });
        setErrorMessage(
          'No cargó el pago con tarjeta. Reintenta en unos segundos para abrir el checkout.',
        );
        setShow(true);
        return false;
      } finally {
        stripeWarmupRef.current = null;
      }
    })();

    stripeWarmupRef.current = warmup;
    return warmup;
  };
  const openPlan = async () => {
    const ready = await ensureStripeForSurface('home_gb_topup');
    if (!ready) return;
    setShowPlan(true);
  };
  const openMigrationModal = async () => {
    const ready = await ensureStripeForSurface('home_migration');
    if (!ready) return;
    setShowModal(true);
  };
  const isOutOfGbMessage = (value: unknown): boolean => {
    const msg = `${value ?? ''}`.toLowerCase();
    return msg.includes('suficientes bytes');
  };
  const goToRoot = async () => {
    stopInlinePreviewAudio();
    setLoadError('');
    setLoader(true);
    setShowPagination(false);
    setSearchValue('');
    setFilters((prev) => ({ ...prev, page: 0 }));
    const [rootFiles, filesError] = await of(
      trpc.ftp.ls.query({
        path: '',
      })
    );
    if (filesError && !rootFiles) {
      setLoadError('No pudimos cargar la carpeta raíz. Revisa tu conexión e intenta nuevamente.');
      setLoader(false);
      return;
    }
    setPastFile([]);
    setfiles(rootFiles!);
    setFolderScopeFiles(rootFiles!);
    trackFolderNavigation([], 'root');
    setLoader(false);
  };
  const clearSearch = async () => {
    setLoadError('');
    setSearchValue('');
    setSearchQuickFilter(null);
    lastTrackedSearchRef.current = '';
    setFilters((prev) => ({ ...prev, page: 0 }));
    await startSearch('');
  };
  const handleError = () => {
    setError(!error);
  };
  const closeConditionModal = () => {
    setShowConditionModal(false);
  };
  const closeModalAdd = () => {
    setShowModal(false);
    startUser();
    getFiles();
  };
  const checkAlbumSize = (file: IFiles, idx: number) => {
    let gbSize = file.size / (1024 * 1024 * 1024);
    if (gbSize >= 1) {
      setAlbumData({ ...file, idx, gbSize });
      setShowConditionModal(true);
    } else {
      startAlbumDownload(file, idx);
    }
  };
  const getFiles = async () => {
    setLoadError('');
    setLoader(true);
    let body = {
      path: '',
    };
    try {
      const files = await trpc.ftp.ls.query(body);
      setPastFile([]);
      setfiles(files);
      setFolderScopeFiles(files);
      setLoader(false);
    } catch {
      setLoadError('No se pudieron cargar los archivos. Intenta nuevamente en unos segundos.');
      appToast.error("Error de red — Revisa tu conexión.");
      setLoader(false);
    }
  };

  const getRecentPacks = async () => {
    setRecentPacksLoading(true);
    try {
      const packs = (await trpc.catalog.getRecentPacks.query()) as RecentPack[];
      const normalized = (packs ?? [])
        .filter((pack) => Boolean(pack?.folderPath) && Number(pack?.fileCount ?? 0) > 0)
        .map((pack) => ({
          ...pack,
          folderPath: normalizeFilePath(pack.folderPath).replace(/^\/+|\/+$/g, ''),
          name: `${pack.name ?? ''}`.trim() || 'Pack',
          fileCount: Number(pack.fileCount ?? 0),
          addedAt:
            pack.addedAt instanceof Date
              ? pack.addedAt.toISOString()
              : `${pack.addedAt ?? ''}`,
          genre: pack.genre ? `${pack.genre}` : null,
        }));
      setRecentPacks(normalized);
    } catch {
      setRecentPacks([]);
    } finally {
      setRecentPacksLoading(false);
    }
  };

  const getNewFileCounts = async () => {
    try {
      const counts = (await trpc.catalog.getNewFileCounts.query()) as RootNewFileCounts;
      setNewFileCounts(counts ?? {});
    } catch {
      setNewFileCounts({});
    }
  };

  const getMonthlyTrending = async () => {
    setMonthlyTrendingLoading(true);
    try {
      const response = (await trpc.downloadHistory.getPublicTopDownloads.query({
        limit: 100,
        sinceDays: 30,
      })) as PublicTopDownloadsResponse;
      setMonthlyTrending(buildMonthlyTrending(response));
    } catch {
      setMonthlyTrending([]);
    } finally {
      setMonthlyTrendingLoading(false);
    }
  };

  const getForYouRecommendations = async () => {
    setForYouLoading(true);
    try {
      const response = (await trpc.catalog.getForYouRecommendations.query()) as ForYouFeed;
      const normalizedRecommendations = (response?.recommendations ?? [])
        .filter((recommendation) => Boolean(recommendation?.path))
        .map((recommendation) => ({
          ...recommendation,
          path: normalizeFilePath(recommendation.path).replace(/^\/+/, ''),
          name: `${recommendation.name ?? ''}`.trim() || 'Track',
          type: `${recommendation.type ?? '-'}`,
          size:
            typeof recommendation.size === 'number' && Number.isFinite(recommendation.size)
              ? recommendation.size
              : 0,
          metadata:
            recommendation.metadata && typeof recommendation.metadata === 'object'
              ? recommendation.metadata
              : null,
          genre: recommendation.genre ? `${recommendation.genre}` : null,
          hasPreview: Boolean(recommendation.hasPreview),
        }));

      setForYouEligible(Boolean(response?.eligible));
      setForYouRecommendations(normalizedRecommendations);
    } catch {
      setForYouEligible(false);
      setForYouRecommendations([]);
    } finally {
      setForYouLoading(false);
    }
  };

  const openMonthlyTrendingPreview = async (row: MonthlyTrendingRow) => {
    if (!row.hasPreview) return;
    if (monthlyTrendingPreviewPath === row.path) return;

    stopInlinePreviewAudio();
    setMonthlyTrendingPreviewPath(row.path);
    try {
      const playback = await resolvePlaybackSource(row.path);
      const kind = resolveTrackPlaybackKind(row.name, row.path);

      setFileToShow({
        url: playback.url,
        name: row.name || 'Preview',
        kind,
        playbackMode: playback.playbackMode,
      });
      setShowPreviewModal(true);

      if (playback.playbackMode === 'demo') {
        trackGrowthMetric(GROWTH_METRICS.VIEW_DEMO_CLICK, {
          location: 'home_trending',
          kind,
          source: 'top_descargas_mes',
        });
      }
      trackGrowthMetric(GROWTH_METRICS.FILE_PREVIEW_OPENED, {
        fileType: kind,
        pagePath: `/${normalizeFilePath(row.path).replace(/^\/+/, '')}`,
        playbackMode: playback.playbackMode,
      });
    } catch {
      appToast.error("No pudimos cargar el preview. Reintentar.");
    } finally {
      setMonthlyTrendingPreviewPath(null);
    }
  };
  const startMonthlyTrendingDownload = async (row: MonthlyTrendingRow) => {
    if (!row.path || monthlyTrendingDownloadPath === row.path) return;

    const trendingFile: IFiles = {
      name: row.name,
      type: '-',
      path: row.path,
      size: 0,
      already_downloaded: false,
    };

    setMonthlyTrendingDownloadPath(row.path);
    try {
      await downloadFile(trendingFile, -1);
    } finally {
      setMonthlyTrendingDownloadPath(null);
    }
  };

  const startForYouDownload = async (recommendation: ForYouRecommendation) => {
    const normalizedPath = normalizeFilePath(recommendation.path).replace(/^\/+/, '');
    if (!normalizedPath || forYouDownloadPath === normalizedPath) return;

    const recommendationFile: IFiles = {
      name: recommendation.name,
      type: recommendation.type === 'd' ? 'd' : '-',
      path: normalizedPath,
      size: recommendation.size,
      metadata: recommendation.metadata ?? undefined,
      already_downloaded: false,
    };

    setForYouDownloadPath(normalizedPath);
    try {
      if (recommendationFile.type === 'd') {
        await startAlbumDownload(recommendationFile, -1);
      } else {
        await downloadFile(recommendationFile, -1);
      }
    } finally {
      setForYouDownloadPath(null);
    }
  };

  const startRecentPackDownload = async (pack: RecentPack) => {
    const normalizedPath = normalizeFilePath(pack.folderPath).replace(/^\/+|\/+$/g, '');
    if (!normalizedPath || recentPackDownloadPath === normalizedPath) return;

    const folderName =
      normalizedPath.split('/').filter(Boolean).pop() || `${pack.name ?? ''}`.trim() || 'Pack';
    const packFolder: IFiles = {
      name: folderName,
      type: 'd',
      path: normalizedPath,
      size: 0,
      already_downloaded: false,
    };

    setRecentPackDownloadPath(normalizedPath);
    try {
      await startAlbumDownload(packFolder, -1);
    } finally {
      setRecentPackDownloadPath(null);
    }
  };

  const openForYouPreview = async (recommendation: ForYouRecommendation) => {
    if (!recommendation.hasPreview) return;
    if (forYouPreviewPath === recommendation.path) return;

    stopInlinePreviewAudio();
    setForYouPreviewPath(recommendation.path);
    try {
      const normalizedPath = `/${normalizeFilePath(recommendation.path).replace(/^\/+/, '')}`;
      const playback = await resolvePlaybackSource(normalizedPath);
      const kind = resolveTrackPlaybackKind(recommendation.name, normalizedPath);

      setFileToShow({
        url: playback.url,
        name: recommendation.name,
        kind,
        playbackMode: playback.playbackMode,
      });
      setShowPreviewModal(true);

      if (playback.playbackMode === 'demo') {
        trackGrowthMetric(GROWTH_METRICS.VIEW_DEMO_CLICK, {
          location: 'home_for_you',
          kind,
        });
      }
      trackGrowthMetric(GROWTH_METRICS.FILE_PREVIEW_OPENED, {
        fileType: kind,
        pagePath: normalizedPath,
        playbackMode: playback.playbackMode,
      });
    } catch {
      appToast.error("No pudimos cargar el preview. Reintentar.");
    } finally {
      setForYouPreviewPath(null);
    }
  };

  const scrollRecentPacks = (direction: 'prev' | 'next') => {
    const node = recentCarouselRef.current;
    if (!node) return;
    const offset = Math.max(node.clientWidth * 0.8, 280);
    node.scrollBy({
      left: direction === 'next' ? offset : -offset,
      behavior: 'smooth',
    });
  };

  const openRecentPack = async (pack: RecentPack) => {
    const targetPath = normalizeFilePath(pack.folderPath).replace(/^\/+|\/+$/g, '');
    if (!targetPath) return;

    stopInlinePreviewAudio();
    setLoadError('');
    setLoader(true);
    setShowPagination(false);
    setSearchValue('');
    setFilters((prev) => ({ ...prev, page: 0 }));

    const [nextFiles, filesError] = await of(
      trpc.ftp.ls.query({
        path: targetPath,
      })
    );

    if (filesError && !nextFiles) {
      setLoadError('No se pudo abrir este pack. Intenta de nuevo.');
      setLoader(false);
      return;
    }

    const safeNextFiles = nextFiles ?? [];
    const segments = targetPath.split('/').filter(Boolean);
    setPastFile(segments);
    setfiles(safeNextFiles);
    setFolderScopeFiles(safeNextFiles);
    trackFolderNavigation(segments, 'next');
    setLoader(false);
  };

  const checkUHUser = async () => {
    if (!currentUser) return;
    let body = {
      email: currentUser.email,
    };
    try {
      const userUH = await trpc.migration.checkUHSubscriber.query(body);
      if (
        userUH &&
        userUH.subscriptionEmail &&
        !currentUser.hasActiveSubscription
      ) {
        void openMigrationModal();
      }
    } catch {
    }
  };

  const getRecommendedFolderPriority = (value: string): number => {
    const text = value.toLocaleLowerCase('es-MX');
    if (text.includes('audio')) return 0;
    if (text.includes('video')) return 1;
    if (text.includes('karaoke')) return 2;
    return 3;
  };

  const findRecommendedDownloadTarget = async (): Promise<{
    type: 'file' | 'folder';
    file: IFiles;
  } | null> => {
    const root = await trpc.ftp.ls.query({ path: '' });
    const folders = (root ?? [])
      .filter((item: IFiles) => item.type === 'd')
      .sort((a: IFiles, b: IFiles) => {
        const byPriority =
          getRecommendedFolderPriority(a.name) - getRecommendedFolderPriority(b.name);
        if (byPriority !== 0) return byPriority;
        return a.name.localeCompare(b.name, 'es-MX');
      });

    for (const folder of folders) {
      const folderPath =
        normalizeFilePath(folder.path).replace(/^\/+/, '') || folder.name;
      const inside = await trpc.ftp.ls.query({ path: folderPath });
      const sortedInside = sortArrayByName([...(inside ?? [])]) as IFiles[];
      const firstFile = sortedInside.find((item) => item.type === '-');
      if (firstFile) {
        return { type: 'file', file: firstFile };
      }

      const firstSafeFolder = sortedInside.find((item) => {
        if (item.type !== 'd') return false;
        if (!Number.isFinite(item.size) || item.size <= 0) return false;
        const gbSize = item.size / (1024 * 1024 * 1024);
        return gbSize <= 50;
      });
      if (firstSafeFolder) {
        return { type: 'folder', file: firstSafeFolder };
      }
    }

    return null;
  };

  const handleRecommendedDownload = async () => {
    if (recommendedDownloadLoading) return;
    setRecommendedDownloadLoading(true);
    setLoadError('');
    try {
      const target = await findRecommendedDownloadTarget();
      if (!target) {
        setLoadError('No encontramos un pack recomendado por ahora. Intenta desde Audios o Videos.');
        return;
      }

      trackGrowthMetric(GROWTH_METRICS.CTA_CLICK, {
        id: 'home_onboarding_recommended_download',
        location: 'home_onboarding',
        targetType: target.type,
      });

      if (target.type === 'folder') {
        await startAlbumDownload(target.file, -1);
        return;
      }
      await downloadFile(target.file, -1);
    } catch {
      setLoadError('No se pudo preparar la descarga recomendada. Intenta nuevamente.');
    } finally {
      setRecommendedDownloadLoading(false);
    }
  };

  const goToFolder = async (query: QueryFolder) => {
    stopInlinePreviewAudio();
    setLoadError('');
    setLoader(true);
    let fileStructure = [...pastFile];

    // Goes back one level
    if (query.back) {
      fileStructure.pop();
    }

    // Goes up one level
    if (query.next) {
      fileStructure.push(query.next);
    }

    // Goes to specific folder
    if (query.folder) {
      fileStructure = pastFile.slice(0, query.folder);
    }

    const [files, filesError] = await of(
      trpc.ftp.ls.query({
        path: fileStructure.join('/'),
      })
    );

    if (filesError && !files) {
      setLoadError('No se pudo abrir esta carpeta. Intenta de nuevo.');
      setLoader(false);
      return;
    }

    const navigationSource: 'next' | 'back' | 'breadcrumb' | 'search-reset' =
      query.next
        ? 'next'
        : query.back
          ? 'back'
          : query.folder
            ? 'breadcrumb'
            : 'search-reset';

    setPastFile(fileStructure);
    setfiles(files!);
    setFolderScopeFiles(files!);
    trackFolderNavigation(fileStructure, navigationSource);
    setLoader(false);
  };

  const playFile = async (file: IFiles, index: number) => {
    stopInlinePreviewAudio();
    setLoadFile(true);
    setIndex(index);
    try {
      const path = resolveFilePath(file);
      const playback = await resolvePlaybackSource(path);
      const previewKind = resolveTrackPlaybackKind(file.name, path);
      setFileToShow({
        url: playback.url,
        name: file.name,
        kind: previewKind,
        playbackMode: playback.playbackMode,
      });
      setIndex(-1);
      setLoadFile(false);
      setShowPreviewModal(true);
      if (playback.playbackMode === 'demo') {
        trackGrowthMetric(GROWTH_METRICS.VIEW_DEMO_CLICK, {
          location: 'home_library',
          kind: previewKind,
          pagePath: path,
        });
      }
      trackGrowthMetric(GROWTH_METRICS.FILE_PREVIEW_OPENED, {
        fileType: previewKind,
        pagePath: path,
        playbackMode: playback.playbackMode,
      });
    } catch (error) {
      setIndex(-1);
      setLoadFile(false);
    }
  };
  const errorMethod = (message: string) => {
    setErrorMessage(message);
    setShow(true);
    setLoadDownload(false);
    setIndex(-1);
  };
  const downloadFile = async (
    file: IFiles,
    index: number,
    options: { skipVerificationGate?: boolean } = {},
  ) => {
    const resolvedPath = resolveFilePath(file).replace(/^\/+/, '');
    trackGrowthMetric(GROWTH_METRICS.FILE_DOWNLOAD_ATTEMPTED, {
      fileType: 'file',
      pagePath: `/${resolvedPath}`,
      sizeBytes: file.size ?? null,
      skipVerificationGate: Boolean(options.skipVerificationGate),
    });

    if (!currentUser?.hasActiveSubscription) {
      trackGrowthMetric(GROWTH_METRICS.FILE_DOWNLOAD_FAILED, {
        fileType: 'file',
        reason: 'no_active_subscription',
        pagePath: `/${resolvedPath}`,
      });
      errorMethod('Para descargar se necesita de una suscripción');
      return;
    }

    if (!options.skipVerificationGate && !currentUser?.verified) {
      queueDownloadVerification({ file, index, type: 'file' });
      appToast.info("Verifica tu cuenta para habilitar descargas.");
      return;
    }

    setLoadDownload(true);
    setIndex(index);
    const downloadName = file.name;
    const domain =
      process.env.REACT_APP_ENVIRONMENT === 'development'
        ? 'http://localhost:5001'
        : 'https://thebearbeatapi.lat';
    const url =
      domain +
      '/download?path=' +
      encodeURIComponent(resolvedPath) +
      '&token=' +
      userToken +
      '&rid=' +
      encodeURIComponent(createDownloadRequestId());

    await startDownload(url, downloadName, { file, index, type: 'file' });
  };
  const startAlbumDownload = async (
    file: IFiles,
    index: number,
    options: { skipVerificationGate?: boolean } = {},
  ) => {
    const resolvedPath = resolveFilePath(file).replace(/^\/+/, '');
    trackGrowthMetric(GROWTH_METRICS.FILE_DOWNLOAD_ATTEMPTED, {
      fileType: 'folder',
      pagePath: `/${resolvedPath}`,
      sizeBytes: file.size ?? null,
      skipVerificationGate: Boolean(options.skipVerificationGate),
    });

    if (!currentUser?.hasActiveSubscription) {
      trackGrowthMetric(GROWTH_METRICS.FILE_DOWNLOAD_FAILED, {
        fileType: 'folder',
        reason: 'no_active_subscription',
        pagePath: `/${resolvedPath}`,
      });
      errorMethod('Para descargar se necesita de una suscripción');
      return;
    }

    if (!options.skipVerificationGate && !currentUser?.verified) {
      queueDownloadVerification({ file, index, type: 'folder' });
      appToast.info("Verifica tu cuenta para habilitar descargas.");
      return;
    }

    setLoadDownload(true);
    setIndex(index);
    await downloadAlbum(resolvedPath, file, index);
    setLoadDownload(false);
    setIndex(-1);
  };
  const triggerBrowserDownload = (url: string, name: string) => {
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    a.remove();
  };
  const getFolderBaseName = (value: string): string => {
    const normalized = `${value ?? ''}`.replace(/\\/g, '/').replace(/\/+$/, '');
    if (!normalized) return '';
    const segments = normalized.split('/').filter(Boolean);
    return segments[segments.length - 1] ?? '';
  };
  const downloadAlbum = async (
    path: string,
    file: IFiles,
    index: number,
  ) => {
    let body = {
      path: path,
    };
    try {
      const response = await trpc.ftp.downloadDir.query(body);
      const mode = `${response?.mode ?? ''}`.trim();
      const resolvedMode =
        mode === 'artifact_ready' || mode === 'queued_user_job'
          ? mode
          : response?.downloadUrl
            ? 'artifact_ready'
            : 'queued_user_job';

      if (resolvedMode === 'artifact_ready' && response?.downloadUrl) {
        setShowDownload(false);
        triggerBrowserDownload(
          `${response.downloadUrl}&token=${encodeURIComponent(userToken)}`,
          file.name,
        );
        markItemAsDownloaded(path, 'd');
        const cacheTierLabel =
          response?.cacheTier === 'hot'
            ? ' (cache caliente)'
            : response?.cacheTier === 'warm'
              ? ' (cache)'
              : '';
        appToast.success(`Descarga inmediata${cacheTierLabel}: ${truncateToastLabel(file.name, 40)}`);
        trackGrowthMetric(GROWTH_METRICS.FILE_DOWNLOAD_SUCCEEDED, {
          fileType: 'folder',
          pagePath: `/${path}`,
          delivery: 'cached_zip',
        });
        return;
      }

      setShowDownload(true);
      setCurrentFile(file);
      const queuedJobId = `${response?.jobId ?? ''}`.trim();
      const fallbackBaseName = getFolderBaseName(path) || `${file?.name ?? ''}`.trim();
      const queueZipName =
        queuedJobId && currentUser?.id
          ? `${fallbackBaseName}-${currentUser.id}-${queuedJobId}.zip`
          : '';
      setFileData({
        path,
        name: file.name,
        jobId: queuedJobId,
        dirName: queueZipName,
      });
      markItemAsDownloaded(path, 'd');
      appToast.info(`Preparando archivo: ${truncateToastLabel(file.name, 40)}`);
      trackGrowthMetric(GROWTH_METRICS.FILE_DOWNLOAD_SUCCEEDED, {
        fileType: 'folder',
        pagePath: `/${path}`,
        delivery: 'queued',
      });
    } catch (error: any) {
      if (isVerificationRequiredMessage(error?.message)) {
        queueDownloadVerification({ file, index, type: 'folder' });
        return;
      }
      if (currentUser?.hasActiveSubscription && isOutOfGbMessage(error?.message ?? error)) {
        appToast.warning("Sin GB disponibles. Recarga para continuar.");
        void openPlan();
        return;
      }
      trackGrowthMetric(GROWTH_METRICS.FILE_DOWNLOAD_FAILED, {
        fileType: 'folder',
        reason: error?.message ?? 'unknown_error',
        pagePath: `/${path}`,
      });
      appToast.error("Error al descargar — Reintentar");
      setErrMsg(error.message);
      handleError();
    }
  };
  const createDownloadRequestId = (): string => {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
    return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
  };

  const startDownload = async (
    url: string,
    name: string,
    pending: PendingDownload,
  ) => {
    const a: HTMLAnchorElement = document.createElement('a');
    try {
      const response = await fetch(url);
      if (response.ok) {
        const blob = await response.blob();
        const objectUrl = window.URL.createObjectURL(blob);
        a.href = objectUrl;
        a.download = name;
        a.rel = 'noopener';
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.setTimeout(() => {
          window.URL.revokeObjectURL(objectUrl);
        }, 2_000);
        markItemAsDownloaded(
          resolveFilePath(pending.file),
          pending.type === 'folder' ? 'd' : '-',
        );
        appToast.success(`Descarga iniciada: ${truncateToastLabel(name, 40)}`);
        trackGrowthMetric(GROWTH_METRICS.FILE_DOWNLOAD_SUCCEEDED, {
          fileType: pending.type,
          pagePath: resolveFilePath(pending.file),
          delivery: 'direct',
        });
      } else {
        const payload = await response.json().catch(() => null);
        const backendMessage =
          payload?.error ?? 'Para descargar se necesita tener gb disponibles';

        if (response.status === 403 || isVerificationRequiredMessage(backendMessage)) {
          queueDownloadVerification(pending);
          appToast.info("Verifica tu cuenta para habilitar descargas.");
          setLoadDownload(false);
          setIndex(-1);
          return;
        }

        if (currentUser?.hasActiveSubscription && isOutOfGbMessage(backendMessage)) {
          appToast.warning("Sin GB disponibles. Recarga para continuar.");
          void openPlan();
          setLoadDownload(false);
          setIndex(-1);
          return;
        }

        trackGrowthMetric(GROWTH_METRICS.FILE_DOWNLOAD_FAILED, {
          fileType: pending.type,
          reason: backendMessage,
          pagePath: resolveFilePath(pending.file),
          statusCode: response.status,
        });
        appToast.error("Error al descargar — Reintentar");
        errorMethod(backendMessage);
      }
    } catch (error) {
      trackGrowthMetric(GROWTH_METRICS.FILE_DOWNLOAD_FAILED, {
        fileType: pending.type,
        reason: 'network_or_fetch_error',
        pagePath: resolveFilePath(pending.file),
      });
      appToast.error("Error de red — Revisa tu conexión.");
      errorMethod('Para descargar se necesita tener gb disponibles');
    } finally {
      setLoadDownload(false);
      setIndex(-1);
    }
  };
  const handleDownloadVerificationSuccess = async () => {
    const queuedDownload = pendingDownload;
    setShowVerifyModal(false);
    setPendingDownload(null);
    await startUser();

    if (!queuedDownload) {
      return;
    }

    if (queuedDownload.type === 'folder') {
      await startAlbumDownload(queuedDownload.file, queuedDownload.index, {
        skipVerificationGate: true,
      });
      return;
    }

    await downloadFile(queuedDownload.file, queuedDownload.index, {
      skipVerificationGate: true,
    });
  };
  const startSearch = async (
    value: string,
    options: { pathSegments?: string[]; page?: number; limit?: number } = {},
  ) => {
    const requestId = ++searchRequestRef.current;
    setLoadError('');
    const trimmedValue = value.trim();
    setSearchValue(value);
    const pathSegments = options.pathSegments ?? pastFile;
    const scope = resolveMediaScope(pathSegments);
    const shouldScopeByPath = pathSegments.length > 0;

    setShowPagination(!shouldScopeByPath);
    setPaginationLoader(true);
    if (trimmedValue === '') {
      lastTrackedSearchRef.current = '';
      setShowPagination(false);
      setPaginationLoader(false);
      if (shouldScopeByPath) {
        setfiles(folderScopeFiles);
        setTotalSearch(folderScopeFiles.length);
      } else {
        await goToFolder({});
      }
      return;
    }

    const effectiveLimit = options.limit ?? filters.limit;
    const effectivePage = options.page ?? filters.page;
    const body = {
      query: trimmedValue,
      limit: shouldScopeByPath ? 2000 : effectiveLimit,
      offset: shouldScopeByPath ? 0 : effectivePage * effectiveLimit,
    };
    try {
      const result = await trpc.ftp.search.query(body);
      if (requestId !== searchRequestRef.current) {
        return;
      }

      let values: IFiles[] = [];
      result.documents.forEach((val: any) => {
        if (val.value) {
          values.push(val.value as IFiles);
        } else {
          values.push(val as IFiles);
        }
      });

      if (shouldScopeByPath) {
        values = values.filter((file) => fileMatchesPathPrefix(file, pathSegments));
      }
      if (scope) {
        values = values.filter((file) => fileMatchesScope(file, scope));
      }

      setfiles(values);
      setTotalSearch(shouldScopeByPath ? values.length : result.total);
      if (trimmedValue.length >= 2) {
        const scopePath = pathSegments.join('/');
        const searchKey = `${trimmedValue.toLowerCase()}::${scopePath || 'global'}`;
        if (lastTrackedSearchRef.current !== searchKey) {
          lastTrackedSearchRef.current = searchKey;
          trackGrowthMetric(GROWTH_METRICS.FILE_SEARCH_PERFORMED, {
            queryLength: trimmedValue.length,
            queryText: trimmedValue.slice(0, 80),
            scope: shouldScopeByPath ? scope ?? 'folder' : scope ?? 'global',
            scopePath: scopePath || undefined,
            totalResults: shouldScopeByPath ? values.length : result.total,
          });
        }
      }
      setPaginationLoader(false);
    } catch {
      if (requestId !== searchRequestRef.current) {
        return;
      }
      setLoadError('La búsqueda no está disponible en este momento. Intenta nuevamente.');
      appToast.error("Error de red — Revisa tu conexión.");
      setPaginationLoader(false);
    }
  };

  const nextPage = (key: string, value: string | number) => {
    let tempFilters: any = { ...filters };
    if (key !== 'page') {
      tempFilters.page = 0;
    }

    tempFilters[key] = value;
    setFilters(tempFilters);
    startSearch(searchValue, {
      page: tempFilters.page,
      limit: tempFilters.limit,
    });
  };

  useEffect(() => {
    let cancelled = false;
    let nonCriticalTimer: number | null = null;

    const bootstrapHome = async () => {
      await getFiles();
      if (cancelled) return;

      void getNewFileCounts();

      nonCriticalTimer = window.setTimeout(() => {
        if (cancelled) return;
        void getRecentPacks();
        void getMonthlyTrending();
        void getForYouRecommendations();
      }, 160);
    };

    void bootstrapHome();

    return () => {
      cancelled = true;
      if (nonCriticalTimer !== null) {
        window.clearTimeout(nonCriticalTimer);
      }
    };
  }, []);
  useEffect(() => {
    checkUHUser();
  }, [currentUser]);
  useEffect(() => {
    let cancelled = false;
    const checkOnboarding = async () => {
      if (!currentUser?.id || !currentUser?.hasActiveSubscription) {
        setIsNewUserOnboarding(false);
        return;
      }

      setOnboardingCheckLoading(true);
      try {
        const downloads: any = await trpc.descargasuser.ownDescargas.query({});
        const hasDownloads = Array.isArray(downloads) && downloads.length > 0;
        if (!cancelled) {
          setIsNewUserOnboarding(!hasDownloads);
        }
      } catch {
        if (!cancelled) {
          setIsNewUserOnboarding(false);
        }
      } finally {
        if (!cancelled) {
          setOnboardingCheckLoading(false);
        }
      }
    };

    void checkOnboarding();

    return () => {
      cancelled = true;
    };
  }, [currentUser?.hasActiveSubscription, currentUser?.id]);
  useEffect(() => {
    if (fileChange) {
      closeFile();
      getFiles();
      setPastFile([]);
    }
  }, [fileChange, closeFile]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const executeMobileSearch = async (rawQuery: unknown) => {
      const query = `${rawQuery ?? ''}`.trim();
      await goToRoot();
      setFilters((prev) => ({ ...prev, page: 0 }));
      if (!query) {
        await startSearch('', { pathSegments: [] });
        return;
      }
      setSearchValue(query);
    };

    const handleMobileSearchSubmit = (event: Event) => {
      const detail = (event as CustomEvent<{ query?: string }>).detail;
      try {
        window.sessionStorage.removeItem(MOBILE_SEARCH_QUERY_STORAGE_KEY);
      } catch {
        // no-op
      }
      void executeMobileSearch(detail?.query ?? '');
    };

    const handleMobileLibraryRoot = () => {
      try {
        window.sessionStorage.removeItem(MOBILE_LIBRARY_ROOT_STORAGE_KEY);
      } catch {
        // no-op
      }
      void goToRoot();
    };

    window.addEventListener(MOBILE_SEARCH_SUBMIT_EVENT, handleMobileSearchSubmit);
    window.addEventListener(MOBILE_LIBRARY_ROOT_EVENT, handleMobileLibraryRoot);

    try {
      const queuedSearch = window.sessionStorage.getItem(MOBILE_SEARCH_QUERY_STORAGE_KEY);
      if (queuedSearch !== null) {
        window.sessionStorage.removeItem(MOBILE_SEARCH_QUERY_STORAGE_KEY);
        void executeMobileSearch(queuedSearch);
      } else {
        const queuedLibraryRoot = window.sessionStorage.getItem(MOBILE_LIBRARY_ROOT_STORAGE_KEY);
        if (queuedLibraryRoot === '1') {
          window.sessionStorage.removeItem(MOBILE_LIBRARY_ROOT_STORAGE_KEY);
          void goToRoot();
        }
      }
    } catch {
      // no-op: sessionStorage can be unavailable in private contexts
    }

    return () => {
      window.removeEventListener(MOBILE_SEARCH_SUBMIT_EVENT, handleMobileSearchSubmit);
      window.removeEventListener(MOBILE_LIBRARY_ROOT_EVENT, handleMobileLibraryRoot);
    };
  }, []);

  useEffect(() => {
    const query = genreSearchFromQuery;
    if (!query) return;
    if (appliedGenreQueryRef.current === query) return;

    appliedGenreQueryRef.current = query;
    setFilters((prev) => ({ ...prev, page: 0 }));
    setSearchQuickFilter(null);
    setSearchValue(query);
  }, [genreSearchFromQuery]);

  useEffect(() => {
    const trimmed = searchValue.trim();
    if (trimmed === '') {
      return;
    }

    const debounceTimer = window.setTimeout(() => {
      void startSearch(searchValue);
    }, 300);

    return () => {
      window.clearTimeout(debounceTimer);
    };
  }, [searchValue, pastFile]);

  useEffect(() => {
    const audio = inlineAudioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => {
      const duration = audio.duration;
      if (!Number.isFinite(duration) || duration <= 0) {
        setInlinePreviewProgress(0);
        return;
      }
      const ratio = Math.max(0, Math.min(1, audio.currentTime / duration));
      setInlinePreviewProgress(ratio);
    };

    const handlePlay = () => {
      setInlinePreviewPlaying(true);
    };

    const handlePause = () => {
      setInlinePreviewPlaying(false);
    };

    const handleEnded = () => {
      setInlinePreviewPlaying(false);
      setInlinePreviewPath(null);
      setInlinePreviewProgress(0);
      setInlinePreviewLoadingPath(null);
      audio.currentTime = 0;
    };

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('play', handlePlay);
    audio.addEventListener('pause', handlePause);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('pause', handlePause);
      audio.removeEventListener('ended', handleEnded);
      audio.pause();
      audio.removeAttribute('src');
      audio.load();
    };
  }, []);

  const isSearching = searchValue.trim() !== '';
  const visibleFiles =
    isSearching && searchQuickFilter
      ? files.filter((file) => matchesSearchQuickFilter(file, searchQuickFilter))
      : files;
  const sortedFiles = sortArrayByName(visibleFiles) as IFiles[];
  const isRootView = !showPagination && pastFile.length === 0;
  const showFirstStepsOnboarding =
    isRootView &&
    !loader &&
    currentUser?.hasActiveSubscription &&
    isNewUserOnboarding;
  const formatSize = (sizeInBytes?: number | null) => formatBytes(sizeInBytes);
  const totalVisibleBytes = sortedFiles.reduce((total, file) => {
    if (file.size == null || !Number.isFinite(file.size)) {
      return total;
    }
    return total + file.size;
  }, 0);
  const totalVisibleLabel = formatBytes(totalVisibleBytes);
  const itemCountLabel = visibleFiles.length === 1 ? 'elemento' : 'elementos';
  const hasLoadError = loadError.trim() !== '';
  const canNavigateBack = isSearching || showPagination || pastFile.length > 0;
  const routeLabel = pastFile.length > 0 ? `Inicio / ${pastFile.join(' / ')}` : 'Inicio';
  const currentRouteLabel = showPagination
    ? `Resultados para "${searchValue}"`
    : isSearching && pastFile.length > 0
      ? `Filtrando dentro de ${routeLabel}`
    : pastFile.length > 0
      ? routeLabel
      : 'Elige Audios, Karaoke o Videos para empezar.';

  const renderKindIcon = (kind: FileVisualKind) => {
    if (kind === 'folder') {
      return <Folder />;
    }
    if (kind === 'audio') {
      return <FileMusic />;
    }
    if (kind === 'video') {
      return <FileVideoCamera />;
    }
    if (kind === 'karaoke') {
      return <Microphone />;
    }
    if (kind === 'archive') {
      return <FileArchive />;
    }
    return <File />;
  };
  const renderTrackCover = (
    kind: FileVisualKind,
    options: {
      coverUrl: string | null;
      fallbackCoverUrl?: string | null;
      seed: string;
      className?: string;
    },
  ) => {
    const primaryCoverUrl = normalizeOptionalText(options.coverUrl);
    const fallbackCoverUrl = normalizeOptionalText(options.fallbackCoverUrl);
    const preferredCoverUrl = primaryCoverUrl || fallbackCoverUrl;
    const secondaryCoverUrl = primaryCoverUrl ? fallbackCoverUrl : null;
    const toneStyle = {
      '--bb-track-cover-hue': `${resolveCoverHue(options.seed)}`,
    } as CSSProperties;
    const className = `bb-track-cover bb-track-cover--thumb${kind === 'video' ? ' bb-track-cover--video' : ''}${options.className ? ` ${options.className}` : ''}`;
    return (
      <span className={className} style={toneStyle} aria-hidden>
        {preferredCoverUrl && (
          <img
            src={preferredCoverUrl}
            alt=""
            className="bb-track-cover-img"
            loading="lazy"
            referrerPolicy="no-referrer"
            decoding="async"
            data-fallback-url={secondaryCoverUrl ?? ''}
            onError={(event) => {
              const target = event.currentTarget;
              const nextFallback = normalizeOptionalText(target.dataset.fallbackUrl);
              if (nextFallback && target.src !== nextFallback) {
                target.dataset.fallbackUrl = '';
                target.src = nextFallback;
                return;
              }
              target.style.display = 'none';
            }}
          />
        )}
        <span className="bb-track-cover-fallback">
          {renderKindIcon(kind)}
        </span>
      </span>
    );
  };

  return (
    <div className="home-main-container bb-app-page overflow-x-hidden">
      <PreviewModal
        show={showPreviewModal}
        file={fileToShow}
        onHide={() => {
          setShowPreviewModal(false);
          setFileToShow(null);
        }}
      />
      <audio ref={inlineAudioRef} className="bb-inline-audio-element" preload="none" />
      {stripePromise && (
        <Elements stripe={stripePromise} options={stripeOptions}>
          <UsersUHModal showModal={showModal} onHideModal={closeModalAdd} />
          <PlansModal
            show={showPlan}
            onHide={closePlan}
            intro="Te quedaste sin GB disponibles para descargar. Recarga GB extra y sigue descargando."
            dataModals={{
              setShowError: setShow,
              setShowSuccess: setShowSuccess,
              setSuccessMessage: setSuccessMessage,
              setErrorMessage: setErrorMessage,
              setSuccessTitle: setSuccessTitle,
            }}
          />
        </Elements>
      )}
      <div className="bb-home-overview">
        {showFirstStepsOnboarding && (
          <section className="bb-onboarding-strip" aria-label="Primeros pasos">
            <div className="bb-onboarding-head">
              <h3>Primer paso recomendado</h3>
              <p>Haz esto una vez y empiezas a descargar más rápido.</p>
            </div>
            <div className="bb-onboarding-actions">
              <Link to="/instrucciones" className="bb-onboarding-btn bb-onboarding-btn--link">
                <BookOpen size={16} aria-hidden />
                Cómo descargar (web)
              </Link>
              <Link to="/micuenta" className="bb-onboarding-btn bb-onboarding-btn--link">
                <Server size={16} aria-hidden />
                Configurar FTP
              </Link>
              <Button unstyled
                type="button"
                className="bb-onboarding-btn bb-onboarding-btn--primary"
                onClick={handleRecommendedDownload}
                disabled={recommendedDownloadLoading || onboardingCheckLoading}
              >
                {recommendedDownloadLoading ? (
                  <Spinner size={1.8} width={0.2} color="var(--app-accent)" />
                ) : (
                  <Download size={16} aria-hidden />
                )}
                Descargar primer pack recomendado
              </Button>
            </div>
          </section>
        )}
        <div className="bb-library-header">
          <div className="bb-library-top">
            <div className="bb-library-left">
              <Button unstyled
                type="button"
                disabled={!canNavigateBack}
                onClick={() => {
                  if (isSearching) {
                    clearSearch();
                    return;
                  }
                  if (showPagination) {
                    clearSearch();
                    return;
                  }
                  goToFolder({ back: true });
                }}
                className="bb-back-btn bb-back-btn--header"
              >
                <ArrowLeft className="bb-back-icon" aria-hidden />
                <span className="bb-back-label">
                  {isSearching ? 'Limpiar filtro' : showPagination ? 'Volver a carpeta' : 'Volver'}
                </span>
              </Button>
              <div className="bb-home-title-wrap">
                <h1 className="bb-home-title">
                  <FolderOpen className="bb-home-title-icon" />
                  Tu biblioteca
                </h1>
                <p className="bb-home-subtitle">{currentRouteLabel}</p>
              </div>
            </div>

            <div className="bb-home-quick-actions" aria-label="Acciones rápidas">
              <Button unstyled
                type="button"
                className="bb-home-quick-btn bb-home-quick-btn--icon"
                onClick={() => {
                  if (showPagination && searchValue.trim() !== '') {
                    startSearch(searchValue);
                    return;
                  }
                  if (pastFile.length > 0) {
                    goToFolder({});
                    return;
                  }
                  getFiles();
                }}
                aria-label="Recargar"
                title="Recargar"
              >
                <RefreshCw size={18} aria-hidden />
                <span className="bb-quick-label">Recargar</span>
              </Button>
              <Link
                to="/instrucciones"
                className="bb-home-quick-btn bb-home-quick-btn--link bb-home-quick-btn--icon"
                aria-label="Guía FTP"
                title="Guía FTP"
              >
                <BookOpen size={18} aria-hidden />
                <span className="bb-quick-label">Guía FTP</span>
              </Link>
            </div>
          </div>

          <div className="bb-library-bar">
            <div className="bb-search-wrap">
              <Search className="bb-search-icon" aria-hidden />
              <Input
                placeholder="Busca por canción, artista o carpeta"
                value={searchValue}
                className="bb-search-input"
                onChange={(e: any) => {
                  const nextValue = `${e.target.value ?? ''}`;
                  setFilters((prev) => ({ ...prev, page: 0 }));
                  setSearchValue(nextValue);
                  if (nextValue.trim() === '') {
                    setSearchQuickFilter(null);
                    void startSearch('');
                  }
                }}
              />
              <Button unstyled
                type="button"
                className={`bb-search-clear ${searchValue !== '' ? 'is-visible' : ''}`}
                onClick={clearSearch}
                aria-label="Limpiar búsqueda"
                disabled={searchValue === ''}
                tabIndex={searchValue === '' ? -1 : 0}
                aria-hidden={searchValue === ''}
              >
                <X size={14} aria-hidden />
              </Button>
            </div>
            <div className="bb-search-pills" role="toolbar" aria-label="Filtros rápidos de búsqueda">
              {SEARCH_QUICK_FILTERS.map((filter) => {
                const isActive = searchQuickFilter === filter.value;
                return (
                  <Button unstyled
                    key={filter.value}
                    type="button"
                    className={`bb-search-pill ${isActive ? 'is-active' : ''}`}
                    onClick={() => {
                      setSearchQuickFilter((current) =>
                        current === filter.value ? null : filter.value,
                      );
                    }}
                    aria-pressed={isActive}
                    disabled={!isSearching}
                  >
                    {filter.label}
                  </Button>
                );
              })}
            </div>

	            <div className="bb-library-route">
	              <nav className="bb-breadcrumb" aria-label="Ruta" tabIndex={0} data-scroll-region>
	                <ol className="bb-breadcrumb-list">
	                  <li className="bb-breadcrumb-item">
	                    <Button unstyled type="button" onClick={goToRoot} className="bb-breadcrumb-link">
	                      Inicio
	                    </Button>
	                  </li>
                  {!showPagination &&
                    pastFile.map((file: any, index) => {
                      const isLastFolder = pastFile.length === index + 1;
	                      if (isLastFolder) {
	                        return (
	                          <li key={`folder_${index}`} className="bb-breadcrumb-item">
	                            <span className="bb-breadcrumb-current" aria-current="page">{file}</span>
	                          </li>
	                        );
	                      }
                      return (
                        <li key={`folder_${index}`} className="bb-breadcrumb-item">
                          <Button unstyled
                            type="button"
                            className="bb-breadcrumb-link"
                            onClick={() => {
                              goToFolder({ folder: index + 1 });
                            }}
                          >
                            {file}
                          </Button>
                        </li>
                      );
                    })}
                  {isSearching && (
                    <li className="bb-breadcrumb-item">
                      <span className="bb-breadcrumb-current" aria-current="page">
                        {showPagination ? 'Resultados:' : 'Filtro:'} <strong>{searchValue}</strong>
                      </span>
                    </li>
                  )}
                </ol>
              </nav>

              <div className="bb-home-meta-inline">
                <span className="bb-mini-pill">
                  {sortedFiles.length} {itemCountLabel}
                </span>
                <span className="bb-mini-pill">{totalVisibleLabel}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div
        className={`bb-content-stage ${!loader && isRootView ? 'is-root' : 'is-explorer'} ${
          loader ? "" : "bb-skeleton-fade-in"
        }`}
        onContextMenu={(e) => e.preventDefault()}
      >
        {loader ? (
          <div className="bb-stage-state" role="status" aria-live="polite" aria-busy="true">
            <div className="app-state-panel is-loading bb-skeleton-shell">
              <span className="sr-only">Actualizando contenido de biblioteca</span>
              <SkeletonTable />
              <SkeletonRow width="64%" />
            </div>
          </div>
        ) : hasLoadError ? (
          <div className="bb-stage-state">
            <EmptyState
              variant="connection-error"
              description={loadError}
              action={
                <Button
                  variant="secondary"
                  leftIcon={<RefreshCw size={18} />}
                  onClick={() => {
                    if (showPagination && searchValue.trim() !== '') {
                      startSearch(searchValue);
                      return;
                    }
                    if (pastFile.length > 0) {
                      goToFolder({});
                      return;
                    }
                    getFiles();
                  }}
                >
                  Reintentar
                </Button>
              }
            />
          </div>
        ) : isRootView ? (
          sortedFiles.length > 0 ? (
          <div className="bb-root-stack">
            {(recentPacksLoading || recentPacks.length > 0) && (
              <section className="bb-recent-section" aria-label="Recién agregado">
                <div className="bb-recent-head">
                  <h3 className="bb-recent-title">🆕 Recién Agregado</h3>
                  {recentPacks.length > 0 && (
                    <div className="bb-recent-nav">
                      <Button unstyled
                        type="button"
                        className="bb-recent-nav-btn"
                        onClick={() => scrollRecentPacks('prev')}
                        aria-label="Ver packs recientes anteriores"
                        title="Anterior"
                      >
                        <ArrowLeft size={16} aria-hidden />
                      </Button>
                      <Button unstyled
                        type="button"
                        className="bb-recent-nav-btn"
                        onClick={() => scrollRecentPacks('next')}
                        aria-label="Ver packs recientes siguientes"
                        title="Siguiente"
                      >
                        <ChevronRight size={16} aria-hidden />
                      </Button>
                    </div>
                  )}
                </div>
                {recentPacksLoading ? (
                  <div className="bb-recent-carousel bb-recent-carousel--loading" aria-hidden>
                    {Array.from({ length: 4 }).map((_, idx) => (
                      <div key={`recent-skeleton-${idx}`} className="bb-recent-card bb-recent-card--skeleton">
                        <SkeletonCard />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="bb-recent-carousel bb-skeleton-fade-in" ref={recentCarouselRef}>
                    {recentPacks.map((pack) => {
                      const kind = getRecentPackVisualKind(pack);
                      const normalizedPackPath = normalizeFilePath(pack.folderPath).replace(/^\/+|\/+$/g, '');
                      const recentPackPathKey = normalizeDownloadMarkerPath(normalizedPackPath);
                      const isRecentPackDownloaded = Boolean(
                        recentPackPathKey && downloadedPathFlags[recentPackPathKey]
                      );
                      const isRecentPackDownloading = recentPackDownloadPath === normalizedPackPath;
                      return (
                        <article
                          key={`recent-pack-${pack.folderPath}`}
                          className="bb-recent-card"
                          onContextMenu={(e) => e.preventDefault()}
                        >
                          <div className="bb-recent-card-main">
                            <span className={`bb-kind-icon bb-kind-${kind}`} aria-hidden>
                              {renderKindIcon(kind)}
                            </span>
                            <div className="bb-recent-copy">
                              <span className="bb-recent-name" title={pack.name}>
                                {pack.name}
                              </span>
                              <span className="bb-recent-meta">
                                {formatRecentPackFileCount(Number(pack.fileCount ?? 0))} · {formatRecentPackAge(`${pack.addedAt ?? ''}`)}
                              </span>
                            </div>
                          </div>
                          <div className="bb-recent-actions">
                            <Button unstyled
                              type="button"
                              className="bb-action-btn bb-action-btn--ghost bb-action-btn--recent"
                              onClick={() => {
                                openRecentPack(pack);
                              }}
                              aria-label={`Abrir pack ${pack.name}`}
                            >
                              <span className="bb-action-label">Abrir</span>
                              <ChevronRight className="bb-row-chevron" aria-hidden />
                            </Button>
                            <Button unstyled
                              type="button"
                              className={`bb-action-btn bb-action-btn--primary bb-recent-download${isRecentPackDownloaded ? ' bb-action-btn--downloaded' : ''}${isRecentPackDownloading ? ' bb-action-btn--downloading bb-action-btn--loading' : ''}`}
                              onClick={() => {
                                void startRecentPackDownload(pack);
                              }}
                              aria-label={
                                isRecentPackDownloading
                                  ? `Descargando ${pack.name}`
                                  : isRecentPackDownloaded
                                    ? `Re-descargar ${pack.name}`
                                    : `Descargar ${pack.name}`
                              }
                              disabled={isRecentPackDownloading}
                            >
                              {isRecentPackDownloading ? (
                                <>
                                  <Spinner size={2} width={0.2} color="currentColor" />
                                  <span className="bb-action-label">Descargando</span>
                                </>
                              ) : (
                                <>
                                  <Download size={16} aria-hidden />
                                  <span className="bb-action-label">{isRecentPackDownloaded ? 'Re-descargar' : 'Descargar'}</span>
                                </>
                              )}
                            </Button>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                )}
              </section>
            )}
            {(forYouLoading || forYouEligible) && (
              <section className="bb-for-you-section" aria-label="Para ti">
                <div className="bb-trending-head">
                  <h3 className="bb-trending-title">🎯 Para Ti</h3>
                </div>
                {forYouLoading ? (
                  <div className="bb-recent-carousel bb-recent-carousel--loading" aria-hidden>
                    {Array.from({ length: 3 }).map((_, idx) => (
                      <div key={`for-you-skeleton-${idx}`} className="bb-recent-card bb-recent-card--skeleton">
                        <SkeletonCard />
                      </div>
                    ))}
                  </div>
                ) : forYouRecommendations.length > 0 ? (
                  <div className="bb-recent-carousel bb-skeleton-fade-in">
                    {forYouRecommendations.map((recommendation) => {
                      const fileForKind: IFiles = {
                        name: recommendation.name,
                        type: recommendation.type,
                        size: recommendation.size,
                        path: recommendation.path,
                        metadata: recommendation.metadata,
                        already_downloaded: false,
                      };
                      const recommendationPathKey = normalizeDownloadMarkerPath(recommendation.path);
                      const isForYouDownloaded = Boolean(
                        recommendationPathKey && downloadedPathFlags[recommendationPathKey]
                      );
                      const isForYouDownloading = forYouDownloadPath === recommendation.path;
                      const kind = getFileVisualKind(fileForKind);
                      const title = normalizeOptionalText(recommendation.metadata?.title) ?? recommendation.name;
                      const artist = normalizeOptionalText(recommendation.metadata?.artist);
                      const coverUrl = normalizeOptionalText(recommendation.metadata?.coverUrl);
                      const fallbackCoverUrl = isTrackCoverKind(kind)
                        ? buildTrackCoverProxyUrl(recommendation.path, userToken)
                        : null;
                      const bpmLabel = recommendation.metadata?.bpm
                        ? `${recommendation.metadata.bpm} BPM`
                        : null;
                      const keyLabel = normalizeOptionalText(recommendation.metadata?.camelot);
                      const energyLabel = toEnergyLabel(recommendation.metadata?.energyLevel);
                      const formatBadge = getResolvedFormatBadge(
                        recommendation.name,
                        recommendation.metadata?.format ?? null,
                      );
                      return (
                        <article
                          key={`for-you-${recommendation.path}`}
                          className="bb-recent-card bb-for-you-card"
                          onContextMenu={(e) => e.preventDefault()}
                        >
                          <div className="bb-recent-card-main">
                            {renderTrackCover(kind, {
                              coverUrl,
                              fallbackCoverUrl,
                              seed: `${recommendation.path} ${title} ${artist ?? ''}`,
                            })}
                            <div className="bb-for-you-copy">
                              <span className="bb-recent-name" title={title}>
                                {title}
                              </span>
                              {artist && (
                                <span className="bb-for-you-artist" title={artist}>
                                  {artist}
                                </span>
                              )}
                              <div className="bb-for-you-meta">
                                {recommendation.genre && (
                                  <span className="bb-file-pill">{recommendation.genre}</span>
                                )}
                                {bpmLabel && (
                                  <span className="bb-file-pill bb-file-pill--tempo">{bpmLabel}</span>
                                )}
                                {keyLabel && (
                                  <span className="bb-file-pill bb-file-pill--key">{keyLabel}</span>
                                )}
                                {energyLabel && (
                                  <span className="bb-file-pill bb-file-pill--energy">{energyLabel}</span>
                                )}
                                {formatBadge && (
                                  <span className="bb-file-pill bb-file-pill--format">{formatBadge}</span>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="bb-for-you-actions">
                            {recommendation.hasPreview ? (
                              <Button unstyled
                                type="button"
                                className="bb-action-btn bb-action-btn--ghost bb-for-you-preview"
                                onClick={() => {
                                  void openForYouPreview(recommendation);
                                }}
                                aria-label={`${canUseFullPlayback ? 'Reproducir completo' : 'Reproducir preview'} de ${title}`}
                                disabled={forYouPreviewPath === recommendation.path}
                              >
                                {forYouPreviewPath === recommendation.path ? (
                                  <Spinner size={2} width={0.2} color="var(--app-accent)" />
                                ) : (
                                  <>
                                    <Play size={16} aria-hidden />
                                    <span className="bb-action-label">{canUseFullPlayback ? 'Escuchar' : 'Preview'}</span>
                                  </>
                                )}
                              </Button>
                            ) : (
                              <span className="bb-trending-no-preview" aria-hidden />
                            )}
                            <Button unstyled
                              type="button"
                              className={`bb-action-btn bb-action-btn--primary bb-for-you-download${isForYouDownloaded ? ' bb-action-btn--downloaded' : ''}${isForYouDownloading ? ' bb-action-btn--downloading bb-action-btn--loading' : ''}`}
                              onClick={() => {
                                void startForYouDownload(recommendation);
                              }}
                              aria-label={
                                isForYouDownloading
                                  ? `Descargando ${title}`
                                  : isForYouDownloaded
                                    ? `Re-descargar ${title}`
                                    : `Descargar ${title}`
                              }
                              disabled={isForYouDownloading}
                            >
                              {isForYouDownloading ? (
                                <>
                                  <Spinner size={2} width={0.2} color="currentColor" />
                                  <span className="bb-action-label">Descargando</span>
                                </>
                              ) : (
                                <>
                                  <Download size={16} aria-hidden />
                                  <span className="bb-action-label">{isForYouDownloaded ? 'Re-descargar' : 'Descargar'}</span>
                                </>
                              )}
                            </Button>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                ) : (
                  <p className="bb-for-you-empty">
                    Estamos preparando recomendaciones con tu historial reciente.
                  </p>
                )}
              </section>
            )}
            {(monthlyTrendingLoading || monthlyTrending.length > 0) && (
              <section className="bb-trending-section" aria-label="Top descargas del mes">
                <div className="bb-trending-head">
                  <h3 className="bb-trending-title">🔥 Top Descargas del Mes</h3>
                </div>
                {monthlyTrendingLoading ? (
                  <div className="bb-trending-loading bb-skeleton-shell" role="status" aria-live="polite">
                    <span className="sr-only">Cargando top descargas del mes</span>
                    <SkeletonTable rows={5} />
                  </div>
                ) : (
                  <ol className="bb-trending-list">
                    {monthlyTrending.map((row, idx) => {
                      const rank = idx + 1;
                      const isTop3 = rank <= 3;
                      const rowPathKey = normalizeDownloadMarkerPath(row.path);
                      const isTrendingDownloaded = Boolean(
                        rowPathKey && downloadedPathFlags[rowPathKey]
                      );
                      const isTrendingDownloading = monthlyTrendingDownloadPath === row.path;
                      return (
                        <li
                          key={`monthly-trending-${row.path}`}
                          className={`bb-trending-row ${isTop3 ? `is-top-${rank}` : ''}`}
                        >
                          <span className="bb-trending-rank">#{rank}</span>
                          <div className="bb-trending-main">
                            <span className="bb-trending-name" title={row.name}>
                              {row.name}
                            </span>
                            <div className="bb-trending-meta">
                              <span className="bb-trending-format">{row.format}</span>
                              <span className="bb-trending-count">
                                {formatTrendingDownloads(row.downloads)} descargas
                              </span>
                            </div>
                          </div>
                          <div className="bb-trending-actions">
                            {row.hasPreview ? (
                              <Button unstyled
                                type="button"
                                className="bb-action-btn bb-action-btn--ghost bb-trending-preview"
                                onClick={() => {
                                  openMonthlyTrendingPreview(row);
                                }}
                                aria-label={`${canUseFullPlayback ? 'Reproducir completo' : 'Reproducir preview'} de ${row.name}`}
                                disabled={monthlyTrendingPreviewPath === row.path}
                              >
                                {monthlyTrendingPreviewPath === row.path ? (
                                  <Spinner size={2} width={0.2} color="var(--app-accent)" />
                                ) : (
                                  <>
                                    <Play size={16} aria-hidden />
                                    <span className="bb-action-label">{canUseFullPlayback ? 'Escuchar' : 'Preview'}</span>
                                  </>
                                )}
                              </Button>
                            ) : (
                              <span className="bb-trending-no-preview" aria-hidden />
                            )}
                            <Button unstyled
                              type="button"
                              className={`bb-action-btn bb-action-btn--primary bb-trending-download${isTrendingDownloaded ? ' bb-action-btn--downloaded' : ''}${isTrendingDownloading ? ' bb-action-btn--downloading bb-action-btn--loading' : ''}`}
                              onClick={() => {
                                void startMonthlyTrendingDownload(row);
                              }}
                              aria-label={
                                isTrendingDownloading
                                  ? `Descargando ${row.name}`
                                  : isTrendingDownloaded
                                    ? `Re-descargar ${row.name}`
                                    : `Descargar ${row.name}`
                              }
                              disabled={isTrendingDownloading}
                            >
                              {isTrendingDownloading ? (
                                <Spinner size={2} width={0.2} color="currentColor" />
                              ) : (
                                <>
                                  <Download size={16} aria-hidden />
                                  <span className="bb-action-label">{isTrendingDownloaded ? 'Re-descargar' : 'Descargar'}</span>
                                </>
                              )}
                            </Button>
                          </div>
                        </li>
                      );
                    })}
                  </ol>
                )}
              </section>
            )}
            <div className="bb-root-intro">
              <h3>Empieza por una sección</h3>
              <p>Entra a Audios, Karaoke o Videos y encuentra tu pista más rápido.</p>
            </div>
          <div className="bb-root-grid">
            {sortedFiles.map((file: IFiles, idx: number) => {
              const sizeLabel = formatSize(file.size);
              const isFolder = file.type === 'd';
              const kind = getFileVisualKind(file);
              const rootBadgeKey = resolveRootBadgeKey(file.name);
              const newCount = isFolder ? Number(newFileCounts[rootBadgeKey] ?? 0) : 0;
              return (
                <article
                  key={`root-card-${idx}`}
                  className={`bb-root-card ${isFolder ? 'is-folder' : 'is-file'}`}
                  onContextMenu={(e) => e.preventDefault()}
                  onClick={() => {
                    if (isFolder) {
                      goToFolder({ next: file.name });
                    }
                  }}
                  role={isFolder ? 'button' : undefined}
                  tabIndex={isFolder ? 0 : undefined}
                  onKeyDown={(e) => {
                    if (isFolder && (e.key === 'Enter' || e.key === ' ')) {
                      e.preventDefault();
                      goToFolder({ next: file.name });
                    }
                  }}
                >
                  <div className="bb-root-card-main">
                    <span className={`bb-kind-icon bb-kind-${kind}`}>
                      {renderKindIcon(kind)}
                    </span>
                    <div className="bb-root-copy">
                      <span className="bb-root-name" title={file.name}>
                        {file.name}
                      </span>
                      <span className="bb-root-kind">{isFolder ? 'Carpeta principal' : getFileCategoryLabel(file)}</span>
                      {isFolder && newCount > 0 && (
                        <span className="bb-root-new-badge">{formatNewBadgeLabel(newCount)}</span>
                      )}
                    </div>
                  </div>
                  <div className="bb-root-size">{sizeLabel}</div>
                  <div className="bb-root-actions">
                    {isFolder && (
                      <span className="bb-open-cta" aria-hidden>
                        <span className="bb-open-cta-label">Abrir</span>
                        <ChevronRight className="bb-row-chevron" />
                      </span>
                    )}
                    {!isFolder && (
                      loadFile && index === idx ? (
                        <span className="bb-action-btn bb-action-btn--ghost bb-action-btn--loading">
                          <Spinner size={2} width={0.2} color="var(--app-accent)" />
                        </span>
                      ) : (
                        <Button unstyled
                          type="button"
                          className="bb-action-btn bb-action-btn--ghost"
                          onClick={(e) => {
                            e.stopPropagation();
                            playFile(file, idx);
                          }}
                          title="Escuchar"
                          aria-label="Escuchar"
                        >
                          <Play size={16} />
                          <span className="bb-action-label">Escuchar</span>
                        </Button>
                      )
                    )}
                  </div>
                </article>
              );
            })}
          </div>
          </div>
          ) : (
            <div className="bb-stage-state">
              <EmptyState
                variant="folder-empty"
                description="Cuando se detecte contenido aparecerá aquí automáticamente."
              />
            </div>
          )
        ) : (
          <div className="bb-explorer">
          <div className="bb-explorer-body">
            {sortedFiles.map((file: IFiles, idx: number) => {
                const gbSize = file.size != null && Number.isFinite(file.size)
                  ? file.size / (1024 * 1024 * 1024)
                  : 0;
                const sizeLabel = formatSize(file.size);
                const isFolder = file.type === 'd';
                const allowFolderDownload = isFolder && file.size != null && gbSize <= 50;
                const fileCategoryLabel = getFileCategoryLabel(file);
                const kind = getFileVisualKind(file);
                const resolvedTrack = buildTrackMetadata(file, kind);
                const trackTitle = normalizeOptionalText(resolvedTrack?.title) ?? file.name;
                const trackArtist = normalizeOptionalText(resolvedTrack?.artist);
                const trackCoverUrl = normalizeOptionalText(resolvedTrack?.coverUrl);
                const fallbackCoverUrl = isTrackCoverKind(kind)
                  ? buildTrackCoverProxyUrl(file.path, userToken)
                  : null;
                const bpmLabel = resolvedTrack?.bpm ? `${resolvedTrack.bpm} BPM` : null;
                const keyLabel = normalizeOptionalText(resolvedTrack?.camelot);
                const keyToneClass = keyLabel ? `is-${resolveKeyTone(keyLabel)}` : '';
                const energyLabel = toEnergyLabel(resolvedTrack?.energyLevel);
                const formatBadge = getResolvedFormatBadge(file.name, resolvedTrack?.format ?? null);
                const alreadyDownloaded = Boolean(file.already_downloaded);
                const resolvedPreviewPath = !isFolder ? resolvePreviewPath(file) : '';
                const isAudioTrack = file.type === '-' && kind === 'audio';
                const hasInlinePreview =
                  isAudioTrack &&
                  Boolean(resolvedPreviewPath) &&
                  !inlineUnavailablePaths[resolvedPreviewPath];
                const isInlinePreviewLoading =
                  hasInlinePreview && inlinePreviewLoadingPath === resolvedPreviewPath;
                const isInlinePreviewActive = hasInlinePreview && inlinePreviewPath === resolvedPreviewPath;
                const isRowDownloading = loadDownload && index === idx;
                const inlineProgressPercent = `${Math.max(
                  0,
                  Math.min(100, Math.round(inlinePreviewProgress * 100)),
                )}%`;
                const showFilePreviewAction = !isFolder && kind !== 'audio';
                const showAudioPreviewAction = !isFolder && kind === 'audio' && hasInlinePreview;
                return (
                  <article
                    key={`explorer-${idx}`}
                    className={`bb-explorer-row ${isFolder ? 'is-folder' : 'is-file'}${!isFolder ? ' is-track' : ''}`}
                    onContextMenu={(e) => e.preventDefault()}
                    onClick={() => {
                      if (isFolder) {
                        goToFolder({ next: file.name });
                      }
                    }}
                    role={isFolder ? 'button' : undefined}
                    tabIndex={isFolder ? 0 : undefined}
                    onKeyDown={(e) => {
                      if (isFolder && (e.key === 'Enter' || e.key === ' ')) {
                        e.preventDefault();
                        goToFolder({ next: file.name });
                      }
                    }}
                  >
                    <div className="bb-row-icon">
                      {isFolder ? (
                        <span className={`bb-kind-icon bb-kind-${kind}`} aria-hidden>
                          {renderKindIcon(kind)}
                        </span>
                      ) : (
                        <span className="bb-row-icon-wrap">
                          {renderTrackCover(kind, {
                            coverUrl: trackCoverUrl,
                            fallbackCoverUrl,
                            seed: `${file.path ?? file.name} ${trackTitle} ${trackArtist ?? ''}`,
                          })}
                        </span>
                      )}
                    </div>

                    <div className="bb-row-main">
                      {isFolder ? (
                        <div className="bb-file-copy">
                          <span className="bb-file-name" title={file.name}>
                            {file.name}
                          </span>
                          <div className="bb-file-meta">
                            <span className="bb-file-pill">{fileCategoryLabel}</span>
                            <span className="bb-file-pill bb-file-pill--size">{sizeLabel}</span>
                          </div>
                        </div>
                      ) : (
                        <div className="bb-track-columns">
                          <div className="bb-track-col bb-track-col--name">
                            <span className="bb-file-name" title={trackTitle}>
                              {trackTitle}
                            </span>
                            {trackArtist && (
                              <span className="bb-track-artist" title={trackArtist}>
                                {trackArtist}
                              </span>
                            )}
                            {(bpmLabel || keyLabel || energyLabel) && (
                              <div className="bb-track-inline-meta">
                                {bpmLabel && (
                                  <span className="bb-file-pill bb-file-pill--tempo">{bpmLabel}</span>
                                )}
                                {keyLabel && (
                                  <span className="bb-file-pill bb-file-pill--key">{keyLabel}</span>
                                )}
                                {energyLabel && (
                                  <span className="bb-file-pill bb-file-pill--energy">{energyLabel}</span>
                                )}
                              </div>
                            )}
                            {(formatBadge || sizeLabel) && (
                              <div className="bb-track-inline-secondary">
                                {formatBadge && (
                                  <span className="bb-track-inline-secondary-item bb-track-inline-secondary-item--format">
                                    {formatBadge}
                                  </span>
                                )}
                                {sizeLabel && (
                                  <span className="bb-track-inline-secondary-item bb-track-inline-secondary-item--size">
                                    {sizeLabel}
                                  </span>
                                )}
                              </div>
                            )}
                            {isInlinePreviewActive && (
                              <span className="bb-inline-preview-progress" aria-hidden>
                                <span
                                  className="bb-inline-preview-progress-fill"
                                  style={{ width: inlineProgressPercent }}
                                />
                              </span>
                            )}
                            {alreadyDownloaded && (
                              <span className="bb-track-downloaded bb-track-downloaded--inline">
                                <span className="bb-track-downloaded-check" aria-hidden>✓</span>
                                <span className="bb-track-downloaded-text">Descargado</span>
                              </span>
                            )}
                          </div>
                          <div className="bb-track-col bb-track-col--bpm">
                            {bpmLabel && <span className="bb-track-bpm-badge">{bpmLabel}</span>}
                          </div>
                          <div className="bb-track-col bb-track-col--key">
                            {keyLabel && (
                              <span className={`bb-track-key-badge ${keyToneClass}`}>{keyLabel}</span>
                            )}
                          </div>
                          <div className="bb-track-col bb-track-col--energy">
                            {energyLabel && <span className="bb-track-energy-badge">{energyLabel}</span>}
                          </div>
                          <div className="bb-track-col bb-track-col--format">
                            {formatBadge && <span className="bb-track-format-badge">{formatBadge}</span>}
                          </div>
                          <div className="bb-track-col bb-track-col--size">{sizeLabel}</div>
                        </div>
                      )}
                    </div>

                    <div className="bb-row-actions">
                      {isFolder ? (
                        <>
                          <Button unstyled
                            type="button"
                            className="bb-action-btn bb-action-btn--primary"
                            onClick={(e) => {
                              e.stopPropagation();
                              goToFolder({ next: file.name });
                            }}
                            title="Abrir carpeta"
                            aria-label="Abrir carpeta"
                          >
                            <span className="bb-action-label">Abrir</span>
                            <ChevronRight className="bb-row-chevron" aria-hidden />
                          </Button>

                          {allowFolderDownload && (
                            <Button unstyled
                              type="button"
                              className={`bb-action-btn bb-action-btn--ghost${alreadyDownloaded ? ' bb-action-btn--downloaded' : ''}${isRowDownloading ? ' bb-action-btn--downloading bb-action-btn--loading' : ''}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                if (isRowDownloading) return;
                                checkAlbumSize(file, idx);
                              }}
                              disabled={isRowDownloading}
                              title={
                                isRowDownloading
                                  ? "Descargando carpeta"
                                  : alreadyDownloaded
                                    ? "Descargar carpeta de nuevo"
                                    : "Descargar carpeta"
                              }
                              aria-label={
                                isRowDownloading
                                  ? "Descargando carpeta"
                                  : alreadyDownloaded
                                    ? "Descargar carpeta de nuevo"
                                    : "Descargar carpeta"
                              }
                            >
                              {isRowDownloading ? (
                                <>
                                  <Spinner size={2} width={0.2} color="currentColor" />
                                  <span className="bb-action-label">Descargando</span>
                                </>
                              ) : (
                                <>
                                  <Download size={18} aria-hidden />
                                  <span className="bb-action-label">{alreadyDownloaded ? "Re-descargar" : "Descargar"}</span>
                                </>
                              )}
                            </Button>
                          )}
                        </>
                      ) : (
                        <>
                          {showAudioPreviewAction && (
                            <Button unstyled
                              type="button"
                              className="bb-action-btn bb-action-btn--ghost"
                              onClick={(e) => {
                                e.stopPropagation();
                                void toggleInlineAudioPreview(file);
                              }}
                              title={
                                isInlinePreviewActive && inlinePreviewPlaying
                                  ? (canUseFullPlayback ? 'Pausar reproducción completa' : 'Pausar preview')
                                  : (canUseFullPlayback ? 'Reproducir completo' : 'Reproducir preview')
                              }
                              aria-label={
                                isInlinePreviewActive && inlinePreviewPlaying
                                  ? (canUseFullPlayback ? 'Pausar reproducción completa' : 'Pausar preview')
                                  : (canUseFullPlayback ? 'Reproducir completo' : 'Reproducir preview')
                              }
                            >
                              {isInlinePreviewLoading ? (
                                <>
                                  <Spinner size={2} width={0.2} color="var(--app-accent)" />
                                  <span className="bb-action-label">Cargando</span>
                                </>
                              ) : isInlinePreviewActive && inlinePreviewPlaying ? (
                                <>
                                  <Pause size={18} aria-hidden />
                                  <span className="bb-action-label">Pausar</span>
                                </>
                              ) : (
                                <>
                                  <Play size={18} aria-hidden />
                                  <span className="bb-action-label">{canUseFullPlayback ? 'Escuchar' : 'Preview'}</span>
                                </>
                              )}
                            </Button>
                          )}

                          {showFilePreviewAction && (
                            loadFile && index === idx ? (
                              <span
                                className="bb-action-btn bb-action-btn--ghost bb-action-btn--loading"
                                aria-live="polite"
                              >
                                <Spinner size={2} width={0.2} color="var(--app-accent)" />
                              </span>
                            ) : (
                              <Button unstyled
                                type="button"
                                className="bb-action-btn bb-action-btn--ghost"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  playFile(file, idx);
                                }}
                                title={canUseFullPlayback ? "Escuchar completo" : "Escuchar muestra"}
                                aria-label={canUseFullPlayback ? "Escuchar completo" : "Escuchar muestra"}
                              >
                                <Play size={18} aria-hidden />
                                <span className="bb-action-label">{canUseFullPlayback ? "Completo" : "Escuchar"}</span>
                              </Button>
                            )
                          )}

                          {file.type === '-' && (
                            <Button unstyled
                              type="button"
                              className={`bb-action-btn bb-action-btn--primary${alreadyDownloaded ? ' bb-action-btn--downloaded' : ''}${isRowDownloading ? ' bb-action-btn--downloading bb-action-btn--loading' : ''}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                if (isRowDownloading) return;
                                void downloadFile(file, idx);
                              }}
                              disabled={isRowDownloading}
                              title={
                                isRowDownloading
                                  ? "Descargando archivo"
                                  : alreadyDownloaded
                                    ? "Descargar archivo de nuevo"
                                    : "Descargar archivo"
                              }
                              aria-label={
                                isRowDownloading
                                  ? "Descargando archivo"
                                  : alreadyDownloaded
                                    ? "Descargar archivo de nuevo"
                                    : "Descargar archivo"
                              }
                            >
                              {isRowDownloading ? (
                                <>
                                  <Spinner size={2} width={0.2} color="currentColor" />
                                  <span className="bb-action-label">Descargando</span>
                                </>
                              ) : (
                                <>
                                  <Download size={18} aria-hidden />
                                  <span className="bb-action-label">{alreadyDownloaded ? "Re-descargar" : "Descargar"}</span>
                                </>
                              )}
                            </Button>
                          )}
                        </>
                      )}
                    </div>
                  </article>
                );
              })}
            {sortedFiles.length === 0 && (
              <div className="bb-empty-state">
                <EmptyState
                  variant={isSearching ? "search-empty" : "folder-empty"}
                  description={
                    isSearching
                      ? "Prueba con otra búsqueda o limpia los filtros para ver todo el contenido."
                      : undefined
                  }
                  action={
                    isSearching ? (
                      <Button variant="secondary" onClick={() => void clearSearch()}>
                        Limpiar filtros
                      </Button>
                    ) : undefined
                  }
                />
              </div>
            )}
          </div>
          {showPagination && (
            <div className="bb-pagination-wrap">
              <Pagination
                totalLoader={paginationLoader}
                totalData={totalSearch}
                title="ordenes"
                startFilter={nextPage}
                currentPage={filters.page}
                limit={filters.limit}
              />
            </div>
          )}
          </div>
        )}
      </div>

      <ConditionModal
        show={showConditionModal}
        onHide={closeConditionModal}
        action={() => startAlbumDownload(albumData, albumData.idx)}
        title="Descarga de Archivos"
        message={`El siguiente archivo pesa ${formatBytes(albumData.size)}, presiona confirmar para continuar con la descarga.`}
      />
      <VerifyUpdatePhoneModal
        showModal={showVerifyModal}
        onHideModal={handleDownloadVerificationSuccess}
        onDismissModal={() => {
          setShowVerifyModal(false);
          setPendingDownload(null);
        }}
        newUserPhone={currentUser?.phone ?? ''}
      />
      <ErrorModal
        show={show}
        onHide={closeError}
        message={errorMessage}
        user={currentUser}
      />
      <SuccessModal
        show={showSuccess}
        onHide={closeSuccess}
        title={successTitle}
        message={successMessage}
      />
      <ErrorModal show={error} onHide={handleError} message={errMsg} />
    </div>
  );
}

export default Home;
