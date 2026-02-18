import './Home.scss';
import { Link } from 'react-router-dom';
import {
  FolderOpen,
  Folder,
  ArrowLeft,
  ChevronRight,
  Search,
  Play,
  Download,
  BookOpen,
  Server,
  FileMusic,
  FileVideoCamera,
  FileArchive,
  File,
  X,
  AlertTriangle,
  RefreshCw,
} from "src/icons";
import PreviewModal from '../../components/PreviewModal/PreviewModal';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
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
import { buildDemoPlaybackUrl } from '../../utils/demoUrl';
import { isRetryableMediaError, retryWithJitter } from '../../utils/retry';
import {
  ensureStripeReady,
  getStripeLoadFailureReason,
} from '../../utils/stripeLoader';

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

type FileVisualKind = 'folder' | 'audio' | 'video' | 'archive' | 'file';
type PreviewKind = 'audio' | 'video';
type MediaScope = 'audio' | 'video' | 'karaoke' | null;
type TrackCardTheme = 'audio' | 'video';
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

const AUDIO_EXT_REGEX = /\.(mp3|wav|aac|m4a|flac|ogg|aiff|alac)$/i;
const VIDEO_EXT_REGEX = /\.(mp4|mov|mkv|avi|wmv|webm|m4v)$/i;
const AUDIO_PATH_REGEX = /(^|\/)audios?(\/|$)/i;
const VIDEO_PATH_REGEX = /(^|\/)videos?(\/|$)/i;
const KARAOKE_PATH_REGEX = /(^|\/)karaokes?(\/|$)/i;

const normalizeFilePath = (value?: string): string => (value ?? '').replace(/\\/g, '/');
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
const toTrackCardTheme = (kind: FileVisualKind): TrackCardTheme | null => {
  if (kind === 'audio') return 'audio';
  if (kind === 'video') return 'video';
  return null;
};
const formatDurationPill = (durationSeconds: number | null): string | null => {
  if (!durationSeconds || durationSeconds < 1) return null;
  const totalSeconds = Math.floor(durationSeconds);
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};
const buildTrackMetadata = (
  file: IFiles,
  kind: FileVisualKind,
): ResolvedTrackMetadata | null => {
  if (file.type === 'd') return null;
  const trackTheme = toTrackCardTheme(kind);
  if (!trackTheme) return null;

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
const getTrackCoverSeed = (value: string): number => {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) % 360;
  }
  return Math.abs(hash);
};

function Home() {
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
  const [loadError, setLoadError] = useState<string>('');
  const [showVerifyModal, setShowVerifyModal] = useState<boolean>(false);
  const [pendingDownload, setPendingDownload] = useState<PendingDownload | null>(null);
  const [stripePromise, setStripePromise] = useState<Promise<Stripe | null> | null>(null);
  const [isNewUserOnboarding, setIsNewUserOnboarding] = useState(false);
  const [onboardingCheckLoading, setOnboardingCheckLoading] = useState(false);
  const [recommendedDownloadLoading, setRecommendedDownloadLoading] = useState(false);
  const searchRequestRef = useRef(0);
  const lastTrackedSearchRef = useRef<string>('');
  const stripeWarmupRef = useRef<Promise<boolean> | null>(null);

  const stripeOptions = useMemo(() => ({ appearance: getStripeAppearance(theme) }), [theme]);

  const getFileVisualKind = (file: IFiles): FileVisualKind => {
    if (file.type === 'd') {
      return 'folder';
    }

    const fileName = file.name.toLowerCase();
    if (/\.(mp3|wav|aac|m4a|flac|ogg|aiff|alac)$/i.test(fileName)) {
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
    if (kind === 'archive') {
      return 'Comprimido';
    }
    return 'Archivo';
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
    lastTrackedSearchRef.current = '';
    setShowPagination(false);
    setFilters((prev) => ({ ...prev, page: 0 }));
    await goToFolder({});
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
      setLoader(false);
    }
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
    setLoadFile(true);
    setIndex(index);
    try {
      const path = resolveFilePath(file);
      const filesDemo = await retryWithJitter(
        async () => await trpc.ftp.demo.query({ path }),
        {
          maxAttempts: 3,
          baseDelayMs: 250,
          maxDelayMs: 1800,
          jitterMs: 450,
          shouldRetry: isRetryableMediaError,
        },
      );
      const previewUrl = buildDemoPlaybackUrl(filesDemo.demo, apiBaseUrl);
      const previewSignature = `${file.name} ${path} ${previewUrl}`.toLowerCase();
      setFileToShow({
        url: previewUrl,
        name: file.name,
        kind: AUDIO_EXT_REGEX.test(previewSignature) ? 'audio' : 'video',
      });
      setIndex(-1);
      setLoadFile(false);
      setShowPreviewModal(true);
      trackGrowthMetric(GROWTH_METRICS.VIEW_DEMO_CLICK, {
        location: 'home_library',
        kind: AUDIO_EXT_REGEX.test(previewSignature) ? 'audio' : 'video',
        pagePath: path,
      });
      trackGrowthMetric(GROWTH_METRICS.FILE_PREVIEW_OPENED, {
        fileType: AUDIO_EXT_REGEX.test(previewSignature) ? 'audio' : 'video',
        pagePath: path,
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
      userToken;

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
      return;
    }

    setLoadDownload(true);
    setIndex(index);
    const domain =
      process.env.REACT_APP_ENVIRONMENT === 'development'
        ? 'http://localhost:5001'
        : 'https://thebearbeatapi.lat';
    const url =
      domain +
      '/download-dir?path=' +
      encodeURIComponent(resolvedPath) +
      '&token=' +
      userToken;

    await downloadAlbum(resolvedPath, file, url, index);
    setLoadDownload(false);
    setIndex(-1);
  };
  const downloadAlbum = async (
    path: string,
    file: IFiles,
    url: string,
    index: number,
  ) => {
    let body = {
      path: path,
    };
    try {
      setShowDownload(true);
      await trpc.ftp.downloadDir.query(body);
      setCurrentFile(file);
      setFileData({
        path: url,
        name: file.name,
      });
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
        void openPlan();
        return;
      }
      trackGrowthMetric(GROWTH_METRICS.FILE_DOWNLOAD_FAILED, {
        fileType: 'folder',
        reason: error?.message ?? 'unknown_error',
        pagePath: `/${path}`,
      });
      setErrMsg(error.message);
      handleError();
    }
  };
  const startDownload = async (
    url: string,
    name: string,
    pending: PendingDownload,
  ) => {
    const a: any = document.createElement('a');
    try {
      const response = await fetch(url);
      if (response.ok) {
        a.href = url;
        a.download = name;
        a.click();
        window.URL.revokeObjectURL(url);
        trackGrowthMetric(GROWTH_METRICS.FILE_DOWNLOAD_SUCCEEDED, {
          fileType: pending.type,
          pagePath: resolveFilePath(pending.file),
          delivery: 'direct',
        });
        setLoadDownload(false);
        setIndex(-1);
      } else {
        const payload = await response.json().catch(() => null);
        const backendMessage =
          payload?.error ?? 'Para descargar se necesita tener gb disponibles';

        if (response.status === 403 || isVerificationRequiredMessage(backendMessage)) {
          queueDownloadVerification(pending);
          setLoadDownload(false);
          setIndex(-1);
          return;
        }

        if (currentUser?.hasActiveSubscription && isOutOfGbMessage(backendMessage)) {
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
        errorMethod(backendMessage);
      }
    } catch (error) {
      trackGrowthMetric(GROWTH_METRICS.FILE_DOWNLOAD_FAILED, {
        fileType: pending.type,
        reason: 'network_or_fetch_error',
        pagePath: resolveFilePath(pending.file),
      });
      errorMethod('Para descargar se necesita tener gb disponibles');
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
  const startSearch = async (value: string) => {
    const requestId = ++searchRequestRef.current;
    setLoadError('');
    const trimmedValue = value.trim();
    setSearchValue(value);
    const scope = resolveMediaScope(pastFile);
    const shouldScopeByPath = pastFile.length > 0;

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

    if (shouldScopeByPath) {
      setTotalSearch(folderScopeFiles.length);
      if (trimmedValue.length >= 2) {
        const searchKey = `${trimmedValue.toLowerCase()}::${pastFile.join('/')}`;
        if (lastTrackedSearchRef.current !== searchKey) {
          lastTrackedSearchRef.current = searchKey;
          trackGrowthMetric(GROWTH_METRICS.FILE_SEARCH_PERFORMED, {
            queryLength: trimmedValue.length,
            queryText: trimmedValue.slice(0, 80),
            scope: 'folder',
            scopePath: pastFile.join('/'),
            totalResults: folderScopeFiles.length,
          });
        }
      }
      setPaginationLoader(false);
      return;
    }

    let body = {
      query: trimmedValue,
      limit: shouldScopeByPath ? 2000 : filters.limit,
      offset: shouldScopeByPath ? 0 : filters.page * filters.limit,
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
        values = values.filter((file) => fileMatchesPathPrefix(file, pastFile));
      }
      if (scope) {
        values = values.filter((file) => fileMatchesScope(file, scope));
      }

      setfiles(values);
      setTotalSearch(shouldScopeByPath ? values.length : result.total);
      if (trimmedValue.length >= 2) {
        const searchKey = `${trimmedValue.toLowerCase()}::global`;
        if (lastTrackedSearchRef.current !== searchKey) {
          lastTrackedSearchRef.current = searchKey;
          trackGrowthMetric(GROWTH_METRICS.FILE_SEARCH_PERFORMED, {
            queryLength: trimmedValue.length,
            queryText: trimmedValue.slice(0, 80),
            scope: scope ?? 'global',
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
    startSearch(searchValue);
  };

  useEffect(() => {
    getFiles();
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

  const normalizedSearchValue = searchValue.trim().toLocaleLowerCase('es-MX');
  const shouldLocalFolderFilter =
    pastFile.length > 0 && normalizedSearchValue !== '' && !showPagination;
  const visibleFiles = shouldLocalFolderFilter
    ? folderScopeFiles.filter((file) => {
      const normalizedName = file.name.toLocaleLowerCase('es-MX');
      const normalizedPath = normalizeFilePath(file.path).toLocaleLowerCase('es-MX');
      return (
        normalizedName.includes(normalizedSearchValue) ||
        normalizedPath.includes(normalizedSearchValue)
      );
    })
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
  const isSearching = searchValue.trim() !== '';
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
    if (kind === 'archive') {
      return <FileArchive />;
    }
    return <File />;
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
              <button
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
              </button>
            </div>
          </section>
        )}
        <div className="bb-library-header">
          <div className="bb-library-top">
            <div className="bb-library-left">
              <button
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
              </button>
              <div className="bb-home-title-wrap">
                <h2 className="bb-home-title">
                  <FolderOpen className="bb-home-title-icon" />
                  Tu biblioteca
                </h2>
                <p className="bb-home-subtitle">{currentRouteLabel}</p>
              </div>
            </div>

            <div className="bb-home-quick-actions" aria-label="Acciones rápidas">
              <button
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
              </button>
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
              <input
                placeholder="Busca por canción, artista o carpeta"
                value={searchValue}
                className="bb-search-input"
                onChange={(e: any) => {
                  setFilters((prev) => ({ ...prev, page: 0 }));
                  startSearch(e.target.value);
                }}
              />
              <button
                type="button"
                className={`bb-search-clear ${searchValue !== '' ? 'is-visible' : ''}`}
                onClick={clearSearch}
                aria-label="Limpiar búsqueda"
                disabled={searchValue === ''}
                tabIndex={searchValue === '' ? -1 : 0}
                aria-hidden={searchValue === ''}
              >
                <X size={14} aria-hidden />
              </button>
            </div>

	            <div className="bb-library-route">
	              <nav className="bb-breadcrumb" aria-label="Ruta" tabIndex={0} data-scroll-region>
	                <ol className="bb-breadcrumb-list">
	                  <li className="bb-breadcrumb-item">
	                    <button type="button" onClick={goToRoot} className="bb-breadcrumb-link">
	                      Inicio
	                    </button>
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
                          <button
                            type="button"
                            className="bb-breadcrumb-link"
                            onClick={() => {
                              goToFolder({ folder: index + 1 });
                            }}
                          >
                            {file}
                          </button>
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
        className={`bb-content-stage ${!loader && isRootView ? 'is-root' : 'is-explorer'}`}
        onContextMenu={(e) => e.preventDefault()}
      >
        {loader ? (
          <div className="bb-stage-state">
            <div className="app-state-panel is-loading" role="status" aria-live="polite">
              <span className="app-state-icon" aria-hidden>
                <Spinner size={2.8} width={0.25} color="var(--app-accent)" />
              </span>
              <h3 className="app-state-title">Cargando contenido</h3>
              <p className="app-state-copy">Estamos preparando tu biblioteca para mostrarte todo de forma ordenada.</p>
            </div>
          </div>
        ) : hasLoadError ? (
          <div className="bb-stage-state">
            <div className="app-state-panel is-error" role="alert">
              <span className="app-state-icon" aria-hidden>
                <AlertTriangle />
              </span>
              <h3 className="app-state-title">No pudimos cargar esta vista</h3>
              <p className="app-state-copy">{loadError}</p>
              <div className="app-state-actions">
                <button
                  type="button"
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
                  <RefreshCw size={16} />
                  Reintentar
                </button>
              </div>
            </div>
          </div>
        ) : isRootView ? (
          sortedFiles.length > 0 ? (
          <div className="bb-root-stack">
            <div className="bb-root-intro">
              <h3>Empieza por una sección</h3>
              <p>Entra a Audios, Karaoke o Videos y encuentra tu pista más rápido.</p>
            </div>
          <div className="bb-root-grid">
            {sortedFiles.map((file: IFiles, idx: number) => {
              const sizeLabel = formatSize(file.size);
              const isFolder = file.type === 'd';
              const kind = getFileVisualKind(file);
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
                        <button
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
                        </button>
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
              <div className="app-state-panel is-empty">
                <span className="app-state-icon" aria-hidden>
                  <FolderOpen />
                </span>
                <h3 className="app-state-title">Tu raíz está vacía</h3>
                <p className="app-state-copy">
                  Cuando se detecte contenido aparecerá aquí automáticamente.
                </p>
              </div>
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
                const trackTheme = toTrackCardTheme(kind);
                const resolvedTrack = buildTrackMetadata(file, kind);
                const displayFileName = resolvedTrack?.displayName || file.name;
                const trackTitle = resolvedTrack?.title || displayFileName;
                const trackArtist = resolvedTrack?.artist;
                const trackCoverUrl = resolvedTrack
                  ? resolvedTrack.coverUrl ??
                    (userToken
                      ? `${apiBaseUrl}/track-cover?path=${encodeURIComponent(
                        resolveFilePath(file),
                      )}&token=${encodeURIComponent(userToken)}`
                      : null)
                  : null;
                const trackCoverSeed = getTrackCoverSeed(
                  `${trackArtist ?? ''}${trackTitle}${file.path ?? ''}`.toLowerCase(),
                );
                const trackDurationPill = formatDurationPill(resolvedTrack?.durationSeconds ?? null);
                return (
                  <article
                    key={`explorer-${idx}`}
                    className={`bb-explorer-row ${isFolder ? 'is-folder' : 'is-file'} ${resolvedTrack ? 'is-track' : ''}`}
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
                    <div className="bb-row-icon" aria-hidden>
                      {resolvedTrack ? (
                        <span
                          className={`bb-track-cover bb-track-cover--${trackTheme ?? 'audio'} bb-track-cover--thumb`}
                          style={{
                            '--bb-track-cover-hue': trackCoverSeed,
                          } as CSSProperties}
                        >
                          <span className="bb-track-cover-fallback" aria-hidden>
                            {renderKindIcon(kind)}
                          </span>
                          {trackCoverUrl && (
                            <>
                              <img
                                src={trackCoverUrl}
                                alt=""
                                loading="lazy"
                                decoding="async"
                                className="bb-track-cover-img"
                                onError={(e) => {
                                  // If cover extraction fails (no embedded image), keep fallback visible.
                                  e.currentTarget.style.display = 'none';
                                  const badge = e.currentTarget.parentElement?.querySelector(
                                    '.bb-track-cover-badge',
                                  ) as HTMLElement | null;
                                  if (badge) badge.style.display = 'none';
                                }}
                                onLoad={(e) => {
                                  const badge = e.currentTarget.parentElement?.querySelector(
                                    '.bb-track-cover-badge',
                                  ) as HTMLElement | null;
                                  if (badge) badge.style.display = '';
                                }}
                              />
                              <span className="bb-track-cover-badge" aria-hidden style={{ display: 'none' }}>
                                {renderKindIcon(kind)}
                              </span>
                            </>
                          )}
                        </span>
                      ) : (
                        <span className={`bb-kind-icon bb-kind-${kind}`}>
                          {renderKindIcon(kind)}
                        </span>
                      )}
                    </div>

                    <div className="bb-row-main">
                      <div className={`bb-file-copy ${resolvedTrack ? 'bb-file-copy--track' : ''}`}>
                        <div className="bb-track-copy">
                        <span className="bb-file-name" title={file.name}>
                          {resolvedTrack ? trackTitle : displayFileName}
                        </span>
                        {resolvedTrack && trackArtist && (
                          <span className="bb-track-artist" title={trackArtist}>
                            {trackArtist}
                          </span>
                        )}
                        <div className="bb-file-meta">
                          {!resolvedTrack && (
                            <span className="bb-file-pill">{fileCategoryLabel}</span>
                          )}
                          {resolvedTrack?.source === 'database' && (
                            <span className="bb-file-pill bb-file-pill--db">Meta</span>
                          )}
                          {resolvedTrack?.format && (
                            <span className="bb-file-pill bb-file-pill--format">{resolvedTrack.format}</span>
                          )}
                          {resolvedTrack?.bpm && (
                            <span className="bb-file-pill bb-file-pill--tempo">
                              {resolvedTrack.bpm} BPM
                            </span>
                          )}
                          {resolvedTrack?.energyLevel && (
                            <span
                              className="bb-file-pill bb-file-pill--energy"
                              title={`Energy ${resolvedTrack.energyLevel}`}
                            >
                              E{resolvedTrack.energyLevel}
                            </span>
                          )}
                          {resolvedTrack?.camelot && (
                            <span className="bb-file-pill bb-file-pill--key">{resolvedTrack.camelot}</span>
                          )}
                          {resolvedTrack?.version && (
                            <span
                              className="bb-file-pill bb-file-pill--version"
                              title={resolvedTrack.version}
                            >
                              {resolvedTrack.version}
                            </span>
                          )}
                          {trackDurationPill && (
                            <span className="bb-file-pill bb-file-pill--duration">{trackDurationPill}</span>
                          )}
                          <span className="bb-file-pill bb-file-pill--size">{sizeLabel}</span>
                        </div>
                        </div>
                      </div>
                    </div>

                    <div className="bb-row-actions">
                      {isFolder ? (
                        <>
                          <button
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
                          </button>

                          {allowFolderDownload && (
                            <button
                              type="button"
                              className="bb-action-btn bb-action-btn--ghost"
                              onClick={(e) => {
                                e.stopPropagation();
                                checkAlbumSize(file, idx);
                              }}
                              title="Descargar carpeta"
                              aria-label="Descargar carpeta"
                            >
                              {loadDownload && index === idx ? (
                                <Spinner size={2} width={0.2} color="var(--app-accent)" />
                              ) : (
                                <>
                                  <Download size={18} aria-hidden />
                                  <span className="bb-action-label">Descargar</span>
                                </>
                              )}
                            </button>
                          )}
                        </>
                      ) : (
                        <>
                          {loadFile && index === idx ? (
                            <span
                              className="bb-action-btn bb-action-btn--ghost bb-action-btn--loading"
                              aria-live="polite"
                            >
                              <Spinner size={2} width={0.2} color="var(--app-accent)" />
                            </span>
                          ) : (
                            <button
                              type="button"
                              className="bb-action-btn bb-action-btn--ghost"
                              onClick={(e) => {
                                e.stopPropagation();
                                playFile(file, idx);
                              }}
                              title="Escuchar muestra"
                              aria-label="Escuchar muestra"
                            >
                              <Play size={18} aria-hidden />
                              <span className="bb-action-label">Escuchar</span>
                            </button>
                          )}

                          {file.type === '-' && (
                            loadDownload && index === idx ? (
                              <span className="bb-action-btn bb-action-btn--primary bb-action-btn--loading">
                                <Spinner size={2} width={0.2} color="var(--app-accent)" />
                              </span>
                            ) : (
                              <button
                                type="button"
                                className="bb-action-btn bb-action-btn--primary"
                                onClick={() => downloadFile(file, idx)}
                                title="Descargar archivo"
                                aria-label="Descargar archivo"
                              >
                                <Download size={18} aria-hidden />
                                <span className="bb-action-label">Descargar</span>
                              </button>
                            )
                          )}
                        </>
                      )}
                    </div>
                  </article>
                );
              })}
            {sortedFiles.length === 0 && (
              <div className="bb-empty-state">
                <div className="app-state-panel is-empty">
                  <span className="app-state-icon" aria-hidden>
                    <Search />
                  </span>
                  <h3 className="app-state-title">No se encontraron resultados</h3>
                  <p className="app-state-copy">Prueba con otra búsqueda o vuelve a la carpeta anterior.</p>
                </div>
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
