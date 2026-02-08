import { Link, useSearchParams } from "react-router-dom";
import { useRef, useEffect, useMemo, useState, useCallback } from "react";
import { motion, type Variants } from "framer-motion";
import { useTheme } from "../../contexts/ThemeContext";
import type { ThemeMode } from "../../contexts/ThemeContext";
import trpc from "../../api";
import Logo from "../../assets/images/osonuevo.png";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Shield,
  Gauge,
  TimerReset,
  DownloadCloud,
  FolderOpen,
  MessageCircle,
  Monitor,
  Moon,
  BadgeCheck,
  Sun,
  Target,
  Music2,
  Clapperboard,
  PlayCircle,
  RefreshCw,
  Video,
  Zap,
} from "lucide-react";
import { trackManyChatConversion, MC_EVENTS } from "../../utils/manychatPixel";
import { SUPPORT_CHAT_URL } from "../../utils/supportChat";
import { GROWTH_METRICS, trackGrowthMetric } from "../../utils/growthMetrics";
import { FALLBACK_GENRES } from "./fallbackGenres";
import PaymentMethodLogos from "../../components/PaymentMethodLogos/PaymentMethodLogos";
import PreviewModal from "../../components/PreviewModal/PreviewModal";
import "./PublicHome.scss";

const THEME_OPTIONS: { value: ThemeMode; label: string; icon: JSX.Element }[] = [
  { value: "light", label: "Claro", icon: <Sun size={16} aria-hidden /> },
  { value: "dark", label: "Oscuro", icon: <Moon size={16} aria-hidden /> },
  { value: "system", label: "Según sistema", icon: <Monitor size={16} aria-hidden /> },
  { value: "schedule", label: "Por horario", icon: <Clock size={16} aria-hidden /> },
];

type PriceRegion = "global" | "mexico";
type DjSegment = "amateur" | "semi-pro" | "pro";
const BEAR_EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];
const PLAN_PRICE_USD = 18;
const PLAN_PRICE_MXN = 350;
const CATALOG_TOTAL_FILES = 195_727;
const CATALOG_TOTAL_GB = 12_350.1;
const CATALOG_UNIQUE_GENRES = 209;
const CATALOG_VIDEOS = 90_651;
const CATALOG_VIDEOS_GB = 11_499.3;
const CATALOG_AUDIOS = 105_076;
const CATALOG_AUDIOS_GB = 850.8;
const CATALOG_KARAOKES = 1_353;
const CATALOG_KARAOKES_GB = 24.99;
const CATALOG_TOTAL_TB = CATALOG_TOTAL_GB / 1000;
const REAL_LIMITED_BONUS_ACTIVE = false;
const EXCHANGE_RATES_API_URL = "https://open.er-api.com/v6/latest/USD";
const GEO_IP_LOOKUP_URL = "https://ipwho.is/?fields=success,country_code,currency";
const LOCAL_ESTIMATE_REFRESH_MS = 10 * 60 * 1000;
const LOCAL_ESTIMATE_REQUEST_TIMEOUT_MS = 3_500;
const GUIDE_PDF_URL = "/guia-descarga-bear-beat-2026.pdf";
const GUIDE_PDF_FILENAME = "guia-descarga-bear-beat-2026.pdf";
const GENRE_PAGE_SIZE = 18;
const GENRE_AUTO_ROTATE_MS = 5_800;
const TOP_DOWNLOADS_LIMIT = 100;
const TOP_DOWNLOADS_PAGE_SIZE = 10;
const TOP_DOWNLOADS_WINDOW_DAYS = 120;
const LIVE_TOP_DOWNLOADS_ENABLED =
  process.env.REACT_APP_ENVIRONMENT === "development" ||
  process.env.REACT_APP_ENABLE_LIVE_TOP_DOWNLOADS === "true";
const COUNTRY_TO_CURRENCY: Record<string, string> = {
  US: "USD",
  MX: "MXN",
  ES: "EUR",
  CO: "COP",
  VE: "VES",
  AR: "ARS",
  CL: "CLP",
  PE: "PEN",
  UY: "UYU",
  PY: "PYG",
  BO: "BOB",
  BR: "BRL",
  EC: "USD",
  PA: "USD",
  CR: "CRC",
  GT: "GTQ",
  HN: "HNL",
  NI: "NIO",
  SV: "USD",
  DO: "DOP",
  PR: "USD",
  CA: "CAD",
  GB: "GBP",
  IE: "EUR",
  DE: "EUR",
  FR: "EUR",
  IT: "EUR",
  PT: "EUR",
  NL: "EUR",
  BE: "EUR",
  LU: "EUR",
  AT: "EUR",
  CH: "CHF",
  SE: "SEK",
  NO: "NOK",
  DK: "DKK",
  PL: "PLN",
  CZ: "CZK",
  HU: "HUF",
  RO: "RON",
  BG: "BGN",
  HR: "EUR",
  AU: "AUD",
  NZ: "NZD",
  JP: "JPY",
  KR: "KRW",
  CN: "CNY",
  HK: "HKD",
  SG: "SGD",
  IN: "INR",
  ID: "IDR",
  TH: "THB",
  PH: "PHP",
  MY: "MYR",
  VN: "VND",
  AE: "AED",
  SA: "SAR",
  IL: "ILS",
  TR: "TRY",
  ZA: "ZAR",
  EG: "EGP",
  MA: "MAD",
  NG: "NGN",
  KE: "KES",
  RU: "RUB",
  UA: "UAH",
};

interface LocalPriceEstimateState {
  visible: boolean;
  loading: boolean;
  error: string | null;
  currency: string | null;
  countryCode: string | null;
  locale: string;
  detectionSource: "ip" | "locale" | null;
  usdPlanLocal: number | null;
  mxnPlanLocal: number | null;
  updatedAt: string | null;
}

interface VisitorMonetaryContext {
  countryCode: string | null;
  currency: string | null;
  locale: string;
  detectionSource: "ip" | "locale";
}

type TopDownloadKind = "audio" | "video";
type TopDownloadsSource = "live" | "fallback";

interface TopDownloadItem {
  path: string;
  name: string;
  type: TopDownloadKind;
  downloads: number;
  totalGb: number;
  lastDownload: string;
}

interface PublicTopDownloadsResponse {
  audio: TopDownloadItem[];
  video: TopDownloadItem[];
  generatedAt: string;
  limit: number;
  sinceDays: number;
}

function buildFallbackTopDownloads(): PublicTopDownloadsResponse {
  const audio = [...FALLBACK_GENRES]
    .sort((left, right) => right.files - left.files)
    .slice(0, TOP_DOWNLOADS_LIMIT)
    .map((genre, index) => ({
      path: `fallback://audio/${index}-${genre.name}`,
      name: genre.name,
      type: "audio" as const,
      downloads: genre.files,
      totalGb: genre.gb,
      lastDownload: "",
    }));

  const video = [...FALLBACK_GENRES]
    .sort((left, right) => right.gb - left.gb)
    .slice(0, TOP_DOWNLOADS_LIMIT)
    .map((genre, index) => ({
      path: `fallback://video/${index}-${genre.name}`,
      name: genre.name,
      type: "video" as const,
      downloads: genre.files,
      totalGb: genre.gb,
      lastDownload: "",
    }));

  return {
    audio,
    video,
    generatedAt: new Date().toISOString(),
    limit: TOP_DOWNLOADS_LIMIT,
    sinceDays: TOP_DOWNLOADS_WINDOW_DAYS,
  };
}

const SEGMENT_PROFILES: Record<
  DjSegment,
  {
    label: string;
    title: string;
    summary: string;
    recommendedPath: string;
    cta: string;
  }
> = {
  amateur: {
    label: "DJ Amateur",
    title: "Evita decir \"no la tengo\" en tus primeras fechas.",
    summary: "Empieza con una librería estructurada para responder rápido en cada evento.",
    recommendedPath: "Empieza por plan México y activa checklist de cabina.",
    cta: "Quiero empezar sin fallar",
  },
  "semi-pro": {
    label: "DJ Semi-Pro",
    title: "Sube tu estándar y reduce el estrés en cabina.",
    summary: "Ten repertorio actualizado y carpetas listas por género, año y mood.",
    recommendedPath: "Activa plan de trabajo semanal con nuevas descargas.",
    cta: "Quiero escalar mi set",
  },
  pro: {
    label: "DJ Pro",
    title: "Protege tu reputación en vivo, evento tras evento.",
    summary: "Convierte la preparación en sistema: menos improvisación, más control.",
    recommendedPath: "Asegura flujo pro con onboarding y automatización de rutinas.",
    cta: "Quiero blindar mi reputación",
  },
};

const TESTIMONIAL_PATTERNS = [
  {
    city: "CDMX",
    djType: "DJ social",
    result: "+3 horas ahorradas por evento",
    quote: "Pasé de improvisar búsquedas a llegar con carpetas listas por género.",
  },
  {
    city: "Guadalajara",
    djType: "DJ de antro",
    result: "Menos interrupciones en cabina",
    quote: "Ahora respondo pedidos más rápido y mantengo la pista sin cortes.",
  },
  {
    city: "Monterrey",
    djType: "DJ móvil",
    result: "Más confianza para cerrar eventos",
    quote: "La estructura del catálogo me ayuda a vender seguridad al cliente.",
  },
];

const VALUE_EQUATION = [
  {
    title: "Beneficio alto",
    detail: "Reputación protegida en vivo con repertorio listo por carpeta.",
    Icon: Target,
  },
  {
    title: "Tiempo corto",
    detail: "Primer valor en menos de 10 minutos después del pago.",
    Icon: TimerReset,
  },
  {
    title: "Esfuerzo bajo",
    detail: "Descarga FTP + estructura ya ordenada para tocar sin fricción.",
    Icon: Gauge,
  },
  {
    title: "Riesgo bajo",
    detail: "Soporte por chat y garantía de activación guiada.",
    Icon: Shield,
  },
];

const ACTIVATION_STEPS = [
  {
    step: "01",
    title: "Elige tu plan",
    detail: "Selecciona MXN o USD según cómo cobras tus eventos.",
  },
  {
    step: "02",
    title: "Paga en flujo simple",
    detail: "Checkout en una pantalla con tarjeta o SPEI.",
  },
  {
    step: "03",
    title: "Empieza a descargar",
    detail: "Te guiamos por chat para entrar al FTP sin fricción.",
  },
];

function normalizeSegment(rawValue: string | null): DjSegment {
  if (rawValue === "amateur" || rawValue === "semi-pro" || rawValue === "pro") {
    return rawValue;
  }
  return "semi-pro";
}

function getBrowserLocales(): string[] {
  if (typeof window === "undefined") return [];
  const localeSet = new Set<string>();
  if (Array.isArray(navigator.languages)) {
    navigator.languages.forEach((locale) => {
      if (locale) localeSet.add(locale);
    });
  }
  if (navigator.language) localeSet.add(navigator.language);
  const intlLocale = Intl.DateTimeFormat().resolvedOptions().locale;
  if (intlLocale) localeSet.add(intlLocale);
  return Array.from(localeSet);
}

function extractRegionFromLocale(locale: string): string | null {
  const tokens = locale.replace("_", "-").split("-").filter(Boolean);
  for (let i = tokens.length - 1; i >= 0; i -= 1) {
    // If locale has no explicit region (example: "es"), do not assume a country.
    if (i > 0 && /^[a-z]{2}$/i.test(tokens[i])) {
      return tokens[i].toUpperCase();
    }
  }
  return null;
}

function detectVisitorCountryCode(): string | null {
  const locales = getBrowserLocales();
  for (const locale of locales) {
    const region = extractRegionFromLocale(locale);
    if (region) return region;
  }
  return null;
}

function resolveCurrencyFromCountry(countryCode: string | null): string | null {
  if (!countryCode) return null;
  return COUNTRY_TO_CURRENCY[countryCode] ?? null;
}

async function detectCountryAndCurrencyFromIp(): Promise<{ countryCode: string | null; currency: string | null } | null> {
  if (typeof window === "undefined") return null;
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), LOCAL_ESTIMATE_REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(GEO_IP_LOOKUP_URL, {
      cache: "no-store",
      signal: controller.signal,
    });
    if (!response.ok) return null;
    const data = (await response.json()) as {
      success?: boolean;
      country_code?: string;
      currency?: { code?: string } | null;
    };
    if (data?.success === false) return null;

    const countryCode =
      typeof data?.country_code === "string" ? data.country_code.toUpperCase() : null;
    const currencyFromIp =
      typeof data?.currency?.code === "string" ? data.currency.code.toUpperCase() : null;
    const currency = currencyFromIp ?? resolveCurrencyFromCountry(countryCode);

    if (!countryCode && !currency) return null;
    return { countryCode, currency };
  } catch {
    return null;
  } finally {
    window.clearTimeout(timeoutId);
  }
}

function resolveLocaleMonetaryContext(): VisitorMonetaryContext {
  const locales = getBrowserLocales();
  const locale = locales[0] ?? "es-MX";
  const countryCode = detectVisitorCountryCode();
  const currency = resolveCurrencyFromCountry(countryCode);
  return {
    countryCode,
    currency,
    locale,
    detectionSource: "locale",
  };
}

async function resolveVisitorMonetaryContext(): Promise<VisitorMonetaryContext> {
  const localeContext = resolveLocaleMonetaryContext();
  const ipContext = await detectCountryAndCurrencyFromIp();

  if (ipContext?.currency) {
    return {
      countryCode: ipContext.countryCode ?? localeContext.countryCode,
      currency: ipContext.currency,
      locale: localeContext.locale,
      detectionSource: "ip",
    };
  }

  if (ipContext?.countryCode) {
    const currencyFromCountry = resolveCurrencyFromCountry(ipContext.countryCode);
    if (currencyFromCountry) {
      return {
        countryCode: ipContext.countryCode,
        currency: currencyFromCountry,
        locale: localeContext.locale,
        detectionSource: "ip",
      };
    }
  }

  return localeContext;
}

function formatCurrencyAmount(amount: number, currency: string, locale: string): string {
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency}`;
  }
}

function detectMexicoRegion(): boolean {
  if (typeof window === "undefined") return false;
  const simulated = localStorage.getItem("bear_region_mexico");
  if (simulated !== null) return simulated === "true";
  return detectVisitorCountryCode() === "MX";
}

const heroVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.15,
      delayChildren: 0.1,
    },
  },
};

const heroItemVariants: Variants = {
  hidden: { opacity: 0, y: 24 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: BEAR_EASE },
  },
};

const bentoGridVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.3,
    },
  },
};

function CompareSlider() {
  return (
    <div className="ph__compare-slider">
      <div className="ph__compare-head">
        <span>DJ Amateur</span>
        <span>DJ Bear Beat</span>
      </div>
      <div className="ph__compare-grid">
        <motion.div
          className="ph__compare-slider-card ph__compare-slider-card--bad"
          initial={{ opacity: 0, x: -20 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true, amount: 0.25 }}
          transition={{ duration: 0.35 }}
        >
          <AlertTriangle className="ph__compare-icon" aria-hidden />
          <h3>DJ Amateur</h3>
          <p>Estresado, YouTube, mala calidad. Una pista que no tienes = una pista que no suena.</p>
        </motion.div>
        <motion.div
          className="ph__compare-slider-card ph__compare-slider-card--good"
          initial={{ opacity: 0, x: 20 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true, amount: 0.25 }}
          transition={{ duration: 0.35 }}
        >
          <CheckCircle2 className="ph__compare-icon" aria-hidden />
          <h3>DJ Bear Beat</h3>
          <p>Carpeta lista, reputación blindada. No arriesgues tu reputación dependiendo del WiFi del lugar.</p>
        </motion.div>
      </div>
    </div>
  );
}

function PublicHome() {
  const { mode, theme, setMode } = useTheme();
  const [searchParams, setSearchParams] = useSearchParams();
  const querySegment = normalizeSegment(searchParams.get("segmento"));
  const [themeMenuOpen, setThemeMenuOpen] = useState(false);
  const [segment, setSegment] = useState<DjSegment>(querySegment);
  const [trialConfig, setTrialConfig] = useState<{
    enabled: boolean;
    days: number;
    gb: number;
    eligible?: boolean | null;
  } | null>(null);
  const [genreQuery, setGenreQuery] = useState("");
  const [genrePage, setGenrePage] = useState(0);
  const [genreAutoPlay, setGenreAutoPlay] = useState(true);
  const [guideDownloadLoading, setGuideDownloadLoading] = useState(false);
  const [guideDownloadNotice, setGuideDownloadNotice] = useState<string | null>(null);
  const [topDownloadsLoading, setTopDownloadsLoading] = useState(false);
  const [topDownloadsError, setTopDownloadsError] = useState<string | null>(null);
  const [topDownloads, setTopDownloads] = useState<PublicTopDownloadsResponse | null>(null);
  const [topDownloadsSource, setTopDownloadsSource] = useState<TopDownloadsSource>("live");
  const [topDownloadsTab, setTopDownloadsTab] = useState<TopDownloadKind>("audio");
  const [topDownloadsPage, setTopDownloadsPage] = useState(0);
  const [topDemoLoadingPath, setTopDemoLoadingPath] = useState<string>("");
  const [topDemoNotice, setTopDemoNotice] = useState<string | null>(null);
  const [showTopDemoModal, setShowTopDemoModal] = useState(false);
  const [topDemoFile, setTopDemoFile] = useState<{
    url: string;
    name: string;
    kind: "audio" | "video";
  } | null>(null);
  const [localPriceEstimate, setLocalPriceEstimate] = useState<LocalPriceEstimateState>(() => ({
    visible: false,
    loading: false,
    error: null,
    currency: null,
    countryCode: null,
    locale: typeof navigator !== "undefined" ? navigator.language : "es-MX",
    detectionSource: null,
    usdPlanLocal: null,
    mxnPlanLocal: null,
    updatedAt: null,
  }));
  const localEstimateRequestRef = useRef(false);
  const preferredRegion = useMemo<PriceRegion>(() =>
    detectMexicoRegion() ? "mexico" : "global"
  , []);
  const menuRef = useRef<HTMLDivElement>(null);
  const allGenres = useMemo(() => FALLBACK_GENRES, []);
  const normalizedGenreQuery = genreQuery.trim().toLocaleLowerCase("es-MX");
  const isSearchingGenres = normalizedGenreQuery.length > 0;
  const filteredGenres = useMemo(() => {
    if (!normalizedGenreQuery) return allGenres;
    return allGenres.filter((genre) =>
      genre.name.toLocaleLowerCase("es-MX").includes(normalizedGenreQuery)
    );
  }, [allGenres, normalizedGenreQuery]);
  const genrePages = useMemo(() => {
    const pages: typeof filteredGenres[] = [];
    for (let index = 0; index < filteredGenres.length; index += GENRE_PAGE_SIZE) {
      pages.push(filteredGenres.slice(index, index + GENRE_PAGE_SIZE));
    }
    return pages;
  }, [filteredGenres]);
  const totalGenrePages = genrePages.length;
  const currentGenrePage = Math.min(genrePage, Math.max(totalGenrePages - 1, 0));
  const visibleGenres = genrePages[currentGenrePage] ?? [];
  const firstGenreIndex = visibleGenres.length > 0 ? currentGenrePage * GENRE_PAGE_SIZE + 1 : 0;
  const lastGenreIndex = visibleGenres.length > 0 ? firstGenreIndex + visibleGenres.length - 1 : 0;
  const filteredGenresLabel = filteredGenres.length.toLocaleString("es-MX");
  const topAudioCountLabel = topDownloads ? topDownloads.audio.length.toLocaleString("es-MX") : "—";
  const topVideoCountLabel = topDownloads ? topDownloads.video.length.toLocaleString("es-MX") : "—";
  const activeTopDownloads =
    topDownloadsTab === "audio" ? topDownloads?.audio ?? [] : topDownloads?.video ?? [];
  const topDownloadsTotalPages = Math.max(
    1,
    Math.ceil(activeTopDownloads.length / TOP_DOWNLOADS_PAGE_SIZE)
  );
  const safeTopDownloadsPage = Math.min(topDownloadsPage, topDownloadsTotalPages - 1);
  const topPageStart = activeTopDownloads.length === 0
    ? 0
    : safeTopDownloadsPage * TOP_DOWNLOADS_PAGE_SIZE + 1;
  const topPageEnd = activeTopDownloads.length === 0
    ? 0
    : Math.min(topPageStart + TOP_DOWNLOADS_PAGE_SIZE - 1, activeTopDownloads.length);
  const visibleTopDownloads = activeTopDownloads.slice(
    safeTopDownloadsPage * TOP_DOWNLOADS_PAGE_SIZE,
    safeTopDownloadsPage * TOP_DOWNLOADS_PAGE_SIZE + TOP_DOWNLOADS_PAGE_SIZE
  );
  const topDownloadsAreFallback = topDownloadsSource === "fallback";
  const activeTopLabel = topDownloadsAreFallback
    ? "Géneros"
    : topDownloadsTab === "audio"
      ? "Audios"
      : "Videos";
  const selectedSegment = SEGMENT_PROFILES[segment];
  const isGlobalRecommended = preferredRegion === "global";
  const isMexicoRecommended = preferredRegion === "mexico";

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const cfg = await trpc.plans.getTrialConfig.query();
        if (!cancelled) setTrialConfig(cfg);
      } catch {
        if (!cancelled) setTrialConfig({ enabled: false, days: 0, gb: 0, eligible: null });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const usdLocalEstimateLabel = useMemo(() => {
    if (!localPriceEstimate.currency || localPriceEstimate.usdPlanLocal === null) return null;
    return formatCurrencyAmount(localPriceEstimate.usdPlanLocal, localPriceEstimate.currency, localPriceEstimate.locale);
  }, [localPriceEstimate.currency, localPriceEstimate.locale, localPriceEstimate.usdPlanLocal]);
  const mxnLocalEstimateLabel = useMemo(() => {
    if (!localPriceEstimate.currency || localPriceEstimate.mxnPlanLocal === null) return null;
    return formatCurrencyAmount(localPriceEstimate.mxnPlanLocal, localPriceEstimate.currency, localPriceEstimate.locale);
  }, [localPriceEstimate.currency, localPriceEstimate.locale, localPriceEstimate.mxnPlanLocal]);
  const localEstimateDateLabel = useMemo(() => {
    if (!localPriceEstimate.updatedAt) return null;
    const parsedDate = new Date(localPriceEstimate.updatedAt);
    if (Number.isNaN(parsedDate.getTime())) return null;
    return parsedDate.toLocaleString(localPriceEstimate.locale, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  }, [localPriceEstimate.locale, localPriceEstimate.updatedAt]);

  const totalTBLabel = `${CATALOG_TOTAL_TB.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} TB`;
  const totalGBLabel = `${CATALOG_TOTAL_GB.toLocaleString("es-MX", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} GB`;
  const totalFilesLabel = CATALOG_TOTAL_FILES.toLocaleString("es-MX");
  const uniqueGenresLabel = CATALOG_UNIQUE_GENRES.toLocaleString("es-MX");
  const videosLabel = CATALOG_VIDEOS.toLocaleString("es-MX");
  const videosGbLabel = `${CATALOG_VIDEOS_GB.toLocaleString("es-MX", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} GB`;
  const audiosLabel = CATALOG_AUDIOS.toLocaleString("es-MX");
  const audiosGbLabel = `${CATALOG_AUDIOS_GB.toLocaleString("es-MX", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} GB`;
  const karaokesLabel = CATALOG_KARAOKES.toLocaleString("es-MX");
  const karaokesGbLabel = `${CATALOG_KARAOKES_GB.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} GB`;

  useEffect(() => {
    trackManyChatConversion(MC_EVENTS.VIEW_HOME);
  }, []);

  useEffect(() => {
    setSegment(querySegment);
  }, [querySegment]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setThemeMenuOpen(false);
      }
    }
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, []);

  useEffect(() => {
    setGenrePage(0);
    setGenreAutoPlay(!isSearchingGenres);
  }, [isSearchingGenres, normalizedGenreQuery]);

  useEffect(() => {
    if (totalGenrePages <= 0) {
      setGenrePage(0);
      return;
    }
    if (genrePage > totalGenrePages - 1) {
      setGenrePage(totalGenrePages - 1);
    }
  }, [genrePage, totalGenrePages]);

  useEffect(() => {
    if (isSearchingGenres || !genreAutoPlay || totalGenrePages <= 1) return;
    if (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }
    const intervalId = window.setInterval(() => {
      setGenrePage((prev) => (prev + 1) % totalGenrePages);
    }, GENRE_AUTO_ROTATE_MS);
    return () => window.clearInterval(intervalId);
  }, [genreAutoPlay, isSearchingGenres, totalGenrePages]);

  const handleSegmentChange = (nextSegment: DjSegment) => {
    setSegment(nextSegment);
    const params = new URLSearchParams(searchParams);
    params.set("segmento", nextSegment);
    setSearchParams(params, { replace: true });
    trackManyChatConversion(MC_EVENTS.LP_SEGMENT_SELECTED);
    trackGrowthMetric(GROWTH_METRICS.SEGMENT_SELECTED, { segment: nextSegment });
  };

  const handleRegisterIntent = (surface: string) => {
    trackManyChatConversion(MC_EVENTS.CLICK_CTA_REGISTER);
    trackGrowthMetric(GROWTH_METRICS.LP_TO_REGISTER, { surface, segment });
  };

  const handlePlanIntent = (currency: "usd" | "mxn") => {
    if (currency === "usd") {
      trackManyChatConversion(MC_EVENTS.CLICK_PLAN_USD);
    } else {
      trackManyChatConversion(MC_EVENTS.CLICK_PLAN_MXN);
    }
    trackGrowthMetric(GROWTH_METRICS.CHECKOUT_STARTED, { currency, segment });
  };

  const handleLeadMagnetDownload = () => {
    trackManyChatConversion(MC_EVENTS.DOWNLOAD_CHECKLIST);
    trackGrowthMetric(GROWTH_METRICS.LEAD_MAGNET_DOWNLOAD, { segment });
  };

  const handleGuideDownload = async (event: React.MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    if (guideDownloadLoading) return;

    handleLeadMagnetDownload();
    setGuideDownloadLoading(true);
    setGuideDownloadNotice(null);

    try {
      const response = await fetch(GUIDE_PDF_URL, { cache: "no-store" });
      if (!response.ok) {
        throw new Error("GUIDE_UNAVAILABLE");
      }
      const fileBlob = await response.blob();
      const objectUrl = window.URL.createObjectURL(fileBlob);
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = GUIDE_PDF_FILENAME;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.URL.revokeObjectURL(objectUrl);
    } catch {
      window.open(GUIDE_PDF_URL, "_blank", "noopener,noreferrer");
      setGuideDownloadNotice("Si no inicia la descarga automática, guarda el PDF desde la pestaña que se abrió.");
    } finally {
      setGuideDownloadLoading(false);
    }
  };

  const loadTopDownloads = useCallback(async () => {
    setTopDownloadsPage(0);
    setTopDownloadsLoading(true);
    setTopDownloadsError(null);
    setTopDownloadsSource("live");

    if (!LIVE_TOP_DOWNLOADS_ENABLED) {
      setTopDownloads(buildFallbackTopDownloads());
      setTopDownloadsSource("fallback");
      setTopDownloadsLoading(false);
      return;
    }

    try {
      const response = (await trpc.downloadHistory.getPublicTopDownloads.query({
        limit: TOP_DOWNLOADS_LIMIT,
        sinceDays: TOP_DOWNLOADS_WINDOW_DAYS,
      })) as PublicTopDownloadsResponse;

      setTopDownloads(response);
      setTopDownloadsSource("live");

      if (response.audio.length === 0 && response.video.length > 0) {
        setTopDownloadsTab("video");
      }
    } catch (error: any) {
      const message = error?.message ? String(error.message) : "";
      const normalizedMessage = message.toLocaleLowerCase("es-MX");
      const isMissingPublicTopEndpoint =
        normalizedMessage.includes("getpublictopdownloads") ||
        normalizedMessage.includes("query-procedure");
      const isNetworkError =
        normalizedMessage.includes("failed to fetch") ||
        normalizedMessage.includes("network") ||
        normalizedMessage.includes("timeout");

      if (isMissingPublicTopEndpoint || isNetworkError) {
        setTopDownloads(buildFallbackTopDownloads());
        setTopDownloadsSource("fallback");
        setTopDownloadsError(null);
        setTopDemoNotice(
          "Estamos sincronizando el Top en vivo. Te mostramos una referencia útil del catálogo mientras tanto.",
        );
      } else {
        setTopDownloadsError("No pudimos cargar el Top 100 en este momento. Intenta de nuevo.");
      }
    } finally {
      setTopDownloadsLoading(false);
    }
  }, []);

  const handleTopDemo = useCallback(async (item: TopDownloadItem) => {
    if (topDownloadsAreFallback || item.path.startsWith("fallback://")) {
      setTopDemoNotice(
        "Los demos de este bloque se habilitan cuando termine la sincronización del Top en vivo.",
      );
      return;
    }
    if (topDemoLoadingPath !== "") return;
    setTopDemoNotice(null);
    setTopDemoLoadingPath(item.path);

    try {
      const demoResponse = (await trpc.downloadHistory.getPublicTopDemo.query({
        path: item.path,
      })) as {
        demo: string;
        kind: "audio" | "video";
        name: string;
      };

      const apiBaseUrl =
        process.env.REACT_APP_API_BASE_URL ??
        (process.env.REACT_APP_ENVIRONMENT === "development"
          ? "http://localhost:5001"
          : "https://thebearbeatapi.lat");
      const demoUrl = encodeURI(`${apiBaseUrl}${demoResponse.demo}`);

      setTopDemoFile({
        url: demoUrl,
        name: demoResponse.name ?? item.name,
        kind: demoResponse.kind ?? item.type,
      });
      setShowTopDemoModal(true);
    } catch {
      setTopDemoNotice("No pudimos abrir esta muestra ahora. Prueba con otro elemento del Top 100.");
    } finally {
      setTopDemoLoadingPath("");
    }
  }, [topDownloadsAreFallback, topDemoLoadingPath]);

  useEffect(() => {
    void loadTopDownloads();
  }, [loadTopDownloads]);

  useEffect(() => {
    setTopDownloadsPage(0);
  }, [topDownloadsTab]);

  useEffect(() => {
    if (topDownloadsPage > topDownloadsTotalPages - 1) {
      setTopDownloadsPage(Math.max(topDownloadsTotalPages - 1, 0));
    }
  }, [topDownloadsPage, topDownloadsTotalPages]);

  const refreshLocalPriceEstimate = useCallback(async (options?: { silent?: boolean }) => {
    if (localEstimateRequestRef.current) return;
    const silent = options?.silent ?? false;
    const localeContext = resolveLocaleMonetaryContext();

    localEstimateRequestRef.current = true;
    if (!silent) {
      setLocalPriceEstimate((prev) => ({
        ...prev,
        visible: true,
        loading: true,
        error: null,
        locale: localeContext.locale,
      }));
    }

    try {
      const monetaryContext = await resolveVisitorMonetaryContext();
      const currency = monetaryContext.currency;

      if (!currency) {
        throw new Error("NO_CURRENCY");
      }

      const response = await fetch(EXCHANGE_RATES_API_URL, { cache: "no-store" });
      if (!response.ok) throw new Error("RATES_UNAVAILABLE");

      const data = (await response.json()) as {
        rates?: Record<string, number>;
        time_last_update_utc?: string;
      };
      const rates = data?.rates;
      const mxnRate = rates?.MXN;
      const localRate = rates?.[currency];

      if (!rates || typeof mxnRate !== "number" || typeof localRate !== "number") {
        throw new Error("RATE_NOT_FOUND");
      }

      const usdPlanLocal = PLAN_PRICE_USD * localRate;
      const mxnPlanLocal = (PLAN_PRICE_MXN / mxnRate) * localRate;

      setLocalPriceEstimate((prev) => ({
        ...prev,
        visible: true,
        loading: false,
        error: null,
        currency,
        countryCode: monetaryContext.countryCode,
        locale: monetaryContext.locale,
        detectionSource: monetaryContext.detectionSource,
        usdPlanLocal,
        mxnPlanLocal,
        updatedAt: data?.time_last_update_utc ?? new Date().toISOString(),
      }));
    } catch (error) {
      if (silent) {
        setLocalPriceEstimate((prev) => ({
          ...prev,
          loading: false,
        }));
        return;
      }

      const errorCode = error instanceof Error ? error.message : "UNKNOWN";
      const message =
        errorCode === "NO_CURRENCY"
          ? "No pudimos detectar tu moneda local automáticamente."
          : "No se pudo calcular el aproximado en este momento. Intenta de nuevo.";

      setLocalPriceEstimate((prev) => ({
        ...prev,
        visible: true,
        loading: false,
        error: message,
        countryCode: prev.countryCode ?? localeContext.countryCode,
        locale: localeContext.locale,
        detectionSource: prev.detectionSource ?? localeContext.detectionSource,
      }));
    } finally {
      localEstimateRequestRef.current = false;
    }
  }, []);

  const handleShowLocalPriceEstimate = () => {
    void refreshLocalPriceEstimate();
  };

  const handlePreviousGenrePage = () => {
    if (totalGenrePages <= 1) return;
    setGenreAutoPlay(false);
    setGenrePage((prev) => (prev - 1 + totalGenrePages) % totalGenrePages);
  };

  const handleNextGenrePage = () => {
    if (totalGenrePages <= 1) return;
    setGenreAutoPlay(false);
    setGenrePage((prev) => (prev + 1) % totalGenrePages);
  };

  useEffect(() => {
    if (!localPriceEstimate.visible || !localPriceEstimate.currency || localPriceEstimate.error) return;
    const intervalId = window.setInterval(() => {
      void refreshLocalPriceEstimate({ silent: true });
    }, LOCAL_ESTIMATE_REFRESH_MS);
    return () => window.clearInterval(intervalId);
  }, [localPriceEstimate.currency, localPriceEstimate.error, localPriceEstimate.visible, refreshLocalPriceEstimate]);

  return (
    <div className="ph ph--light-premium">
      <PreviewModal
        show={showTopDemoModal}
        file={topDemoFile}
        onHide={() => {
          setShowTopDemoModal(false);
          setTopDemoFile(null);
        }}
      />
      <header className="ph__nav">
        <div className="ph__container ph__nav-inner">
          <Link to="/" className="ph__nav-logo">
            <img src={Logo} alt="Bear Beat" />
          </Link>
          <nav className="ph__nav-mini" aria-label="Navegación principal">
            <a href="#inicio">Home</a>
            <a href="#planes">Planes</a>
            <Link to="/legal">FAQ y Políticas</Link>
            <Link to="/auth">Acceso</Link>
          </nav>
          <div className="ph__nav-actions">
            <div className="ph__theme-wrap" ref={menuRef}>
              <button
                type="button"
                className="ph__theme-btn"
                onClick={() => setThemeMenuOpen((o) => !o)}
                title={THEME_OPTIONS.find((o) => o.value === mode)?.label ?? "Tema"}
                aria-label="Cambiar tema"
              >
                {theme === "light" ? <Sun size={16} aria-hidden /> : <Moon size={16} aria-hidden />}
              </button>
              {themeMenuOpen && (
                <div className="ph__theme-dropdown">
                  {THEME_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      className={mode === opt.value ? "ph__theme-dropdown-item--active" : ""}
                      onClick={() => {
                        setMode(opt.value);
                        setThemeMenuOpen(false);
                      }}
                    >
                      {opt.icon}
                      <span>{opt.label}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <Link to="/auth" state={{ from: "/planes" }} className="ph__nav-btn ph__nav-btn--ghost" onClick={() => handleRegisterIntent("nav-login")}>
              Iniciar Sesión
            </Link>
            <Link to="/auth/registro" state={{ from: "/planes" }} className="ph__nav-btn ph__nav-btn--primary" onClick={() => handleRegisterIntent("nav-register")}>
              Obtener Acceso
            </Link>
          </div>
        </div>
      </header>

      <motion.section
        className="ph__hero ph__hero--split"
        id="inicio"
        variants={heroVariants}
        initial="hidden"
        animate="visible"
      >
        <div className="ph__hero-atmosphere ph__hero-atmosphere--one" aria-hidden />
        <div className="ph__hero-atmosphere ph__hero-atmosphere--two" aria-hidden />
        <div className="ph__container">
          <div className="ph__hero-inner">
            <div className="ph__hero-left">
              <motion.h1 className="ph__hero-h1" variants={heroItemVariants}>
                {selectedSegment.title}
              </motion.h1>
              <motion.div className="ph__hero-keywords" variants={heroItemVariants}>
                <span className="ph__hero-big-number">{totalTBLabel}</span>
                <span className="ph__hero-keyword">Reputación Protegida</span>
              </motion.div>
              <motion.p className="ph__hero-sub" variants={heroItemVariants}>
                No es solo música: es seguridad en vivo para tu nombre como DJ.
              </motion.p>
              <motion.p className="ph__hero-promise" variants={heroItemVariants}>
                <strong>Nunca volver a decir “No la tengo” en cabina.</strong>
              </motion.p>
              <motion.div className="ph__hero-proof" variants={heroItemVariants}>
                <span>Acceso Inmediato</span>
                <span>Cancela cuando quieras</span>
                <span>500 GB descarga</span>
                <span>Resultado inicial &lt; 10 min</span>
              </motion.div>
              <motion.div className="ph__segment-picker" variants={heroItemVariants}>
                {(Object.keys(SEGMENT_PROFILES) as DjSegment[]).map((segmentKey) => (
                  <button
                    key={segmentKey}
                    type="button"
                    className={segment === segmentKey ? "is-active" : ""}
                    onClick={() => handleSegmentChange(segmentKey)}
                  >
                    {SEGMENT_PROFILES[segmentKey].label}
                  </button>
                ))}
              </motion.div>
              <motion.p className="ph__segment-summary" variants={heroItemVariants}>
                {selectedSegment.summary}
              </motion.p>
              <motion.div variants={heroItemVariants}>
                <Link
                  to="/auth/registro"
                  state={{ from: "/planes" }}
                  className="ph__hero-cta ph__hero-cta--pill"
                  onClick={() => handleRegisterIntent("hero-primary")}
                >
                  {selectedSegment.cta} →
                </Link>
              </motion.div>
              <motion.p className="ph__hero-micro" variants={heroItemVariants}>
                Cuesta menos que perder un evento por no tener la canción correcta.
              </motion.p>
            </div>

            <motion.div className="ph__hero-right" variants={heroItemVariants} aria-hidden>
              <div className="ph__hero-visual">
                <div className="ph__hero-visual-frame">
                  <div className="ph__hero-visual-head">
                    <span className="ph__hero-visual-label">Video Remixes</span>
                    <strong className="ph__hero-visual-value">{totalTBLabel}</strong>
                  </div>
                  <p className="ph__hero-visual-copy">{selectedSegment.recommendedPath}</p>
                  <div className="ph__hero-visual-folders">
                    <div className="ph__hero-visual-folder ph__hero-visual-folder--1" />
                    <div className="ph__hero-visual-folder ph__hero-visual-folder--2" />
                    <div className="ph__hero-visual-folder ph__hero-visual-folder--3" />
                    <div className="ph__hero-visual-folder ph__hero-visual-folder--4" />
                  </div>
                  <div className="ph__hero-visual-meta">
                    <span>{totalFilesLabel} Archivos</span>
                    <span>Acceso Total</span>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </motion.section>

      <motion.section
        className="ph__value"
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.2 }}
        transition={{ duration: 0.45 }}
      >
        <div className="ph__container">
          <div className="ph__value-shell">
            <h2 className="ph__section-title ph__section-title--left">Por qué te conviene hoy</h2>
            <div className="ph__value-grid">
              {VALUE_EQUATION.map(({ title, detail, Icon }) => (
                <article className="ph__value-card" key={title}>
                  <span className="ph__value-icon" aria-hidden>
                    <Icon />
                  </span>
                  <h3>{title}</h3>
                  <p>{detail}</p>
                </article>
              ))}
            </div>
            <p className="ph__value-anchor">
              Una sola noche con mala respuesta puede costarte más que tu membresía mensual.
            </p>
          </div>
        </div>
      </motion.section>

      <motion.section
        className="ph__spine"
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.25 }}
        transition={{ duration: 0.45 }}
      >
        <div className="ph__container">
          <div className="ph__spine-grid">
            <article className="ph__spine-card">
              <span className="ph__spine-label">El Arsenal</span>
              <strong className="ph__spine-value">{totalGBLabel}</strong>
              <p className="ph__spine-meta">{totalFilesLabel} archivos</p>
            </article>
            <article className="ph__spine-card">
              <span className="ph__spine-label">Videos</span>
              <strong className="ph__spine-value">{videosLabel}</strong>
              <p className="ph__spine-meta">{videosGbLabel}</p>
            </article>
            <article className="ph__spine-card">
              <span className="ph__spine-label">Géneros únicos</span>
              <strong className="ph__spine-value">{uniqueGenresLabel}</strong>
              <p className="ph__spine-meta">por carpeta</p>
            </article>
          </div>
        </div>
      </motion.section>

      <motion.section
        className="ph__arsenal"
        variants={bentoGridVariants}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.1 }}
      >
        <div className="ph__container">
          <h2 className="ph__section-title ph__section-title--left">El Arsenal</h2>
          <div className="ph__arsenal-grid">
            <motion.div className="ph__arsenal-card ph__arsenal-card--wide" variants={bentoGridVariants}>
              <Zap className="ph__arsenal-icon" aria-hidden />
              <h3>FTP Ultra Rápido</h3>
              <p>Servidores de alta velocidad. Sin límites de bajada. 500 GB/mes con FileZilla.</p>
              <div className="ph__arsenal-visual ph__arsenal-visual--speed">
                <span className="ph__arsenal-visual-bar" style={{ width: "92%" }} />
              </div>
            </motion.div>
            <motion.div className="ph__arsenal-card ph__arsenal-card--tall" variants={bentoGridVariants}>
              <FolderOpen className="ph__arsenal-icon" aria-hidden />
              <h3>Estructura Inteligente</h3>
              <div className="ph__arsenal-folder-tree">
                <span>Video Remixes</span>
                <span>→ 2024 → Enero</span>
                <span>→ Género → Año → Mes</span>
              </div>
              <p>Ahorra 10 horas de trabajo de oficina.</p>
            </motion.div>
            <motion.div className="ph__arsenal-card ph__arsenal-card--square" variants={bentoGridVariants}>
              <span className="ph__arsenal-stat-value">{totalTBLabel}</span>
              <span className="ph__arsenal-stat-label">Contenido Total</span>
            </motion.div>
            <motion.div className="ph__arsenal-card ph__arsenal-card--square" variants={bentoGridVariants}>
              <span className="ph__arsenal-stat-value">{totalFilesLabel}</span>
              <span className="ph__arsenal-stat-label">Archivos</span>
            </motion.div>
            <motion.div className="ph__arsenal-card ph__arsenal-card--wide ph__arsenal-card--genres" variants={bentoGridVariants}>
              <Video className="ph__arsenal-icon" aria-hidden />
              <h3>Video Remixes</h3>
              <p>Videos: {videosLabel} ({videosGbLabel}) · Audios: {audiosLabel} ({audiosGbLabel}) · Karaokes: {karaokesLabel} ({karaokesGbLabel})</p>
            </motion.div>
          </div>
        </div>
      </motion.section>

      <motion.section
        className="ph__compare"
        initial={{ opacity: 0, y: 40 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.2 }}
        transition={{ duration: 0.5 }}
      >
        <div className="ph__container">
          <h2 className="ph__section-title ph__section-title--left">¿Cuánto te cuesta decir &quot;No la tengo&quot;?</h2>
          <CompareSlider />
        </div>
      </motion.section>

      <motion.section
        className="ph__proof"
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.2 }}
        transition={{ duration: 0.45 }}
      >
        <div className="ph__container">
          <h2 className="ph__section-title ph__section-title--left">Resultados reales de DJs</h2>
          <div className="ph__proof-grid">
            {TESTIMONIAL_PATTERNS.map((caseStudy) => (
              <article key={`${caseStudy.city}-${caseStudy.djType}`} className="ph__proof-card">
                <p className="ph__proof-head">
                  {caseStudy.djType} · {caseStudy.city}
                </p>
                <p className="ph__proof-quote">“{caseStudy.quote}”</p>
                <p className="ph__proof-result">{caseStudy.result}</p>
              </article>
            ))}
          </div>
          <div className="ph__authority-strip" role="list" aria-label="Indicadores auditables">
            <span role="listitem">
              <BadgeCheck aria-hidden />
              {totalFilesLabel} archivos auditables
            </span>
            <span role="listitem">
              <Gauge aria-hidden />
              {totalGBLabel} de contenido medible
            </span>
            <span role="listitem">
              <Shield aria-hidden />
              Uptime monitoreado 24/7
            </span>
          </div>
        </div>
      </motion.section>

      <motion.section
        className="ph__genres"
        initial={{ opacity: 0, y: 36 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.02 }}
        transition={{ duration: 0.45 }}
      >
        <div className="ph__container">
          <h2 className="ph__section-title ph__section-title--left">Encuentra por género en segundos</h2>
          <p className="ph__genres-caption">
            Catálogo ordenado para que ubiques la pista correcta sin cortar el ritmo.
          </p>
          <div className="ph__genres-stats" role="list" aria-label="Resumen del catálogo por género">
            <article role="listitem" className="ph__genres-stat">
              <strong>{CATALOG_UNIQUE_GENRES.toLocaleString("es-MX")}</strong>
              <span>géneros en catálogo</span>
            </article>
            <article role="listitem" className="ph__genres-stat">
              <strong>{totalFilesLabel}</strong>
              <span>archivos totales</span>
            </article>
            <article role="listitem" className="ph__genres-stat">
              <strong>{totalGenrePages > 0 ? `${currentGenrePage + 1}/${totalGenrePages}` : "0/0"}</strong>
              <span>{isSearchingGenres ? "páginas con coincidencias" : "paginación automática"}</span>
            </article>
          </div>
          <div className="ph__genres-tools">
            <label className="ph__genres-search">
              <span>Escribe un género</span>
              <input
                type="search"
                value={genreQuery}
                onChange={(e) => setGenreQuery(e.target.value)}
                placeholder="Ej. Cumbia, House, Reggaeton, Retro"
                aria-label="Buscar género"
              />
            </label>
            <div className="ph__genres-tools-actions">
              {genreQuery && (
                <button type="button" className="ph__genres-clear" onClick={() => setGenreQuery("")}>
                  Limpiar
                </button>
              )}
              {!isSearchingGenres && totalGenrePages > 1 && (
                <button
                  type="button"
                  className="ph__genres-auto"
                  onClick={() => setGenreAutoPlay((prev) => !prev)}
                  aria-pressed={genreAutoPlay}
                >
                  {genreAutoPlay ? "Pausar auto" : "Reanudar auto"}
                </button>
              )}
            </div>
          </div>
          <div className="ph__genres-pagination" role="status" aria-live="polite">
            {totalGenrePages > 0 ? (
              <p className="ph__genres-range">
                {isSearchingGenres
                  ? `Mostrando ${firstGenreIndex}-${lastGenreIndex} de ${filteredGenresLabel} coincidencias.`
                  : `Mostrando ${firstGenreIndex}-${lastGenreIndex} de ${filteredGenresLabel} géneros cargados (total catálogo auditado: ${uniqueGenresLabel}).`}
              </p>
            ) : (
              <p className="ph__genres-range">No hay coincidencias para tu búsqueda.</p>
            )}
            {totalGenrePages > 1 && (
              <div className="ph__genres-page-controls">
                <button type="button" onClick={handlePreviousGenrePage}>
                  Anterior
                </button>
                <span>
                  Página {currentGenrePage + 1} / {totalGenrePages}
                </span>
                <button type="button" onClick={handleNextGenrePage}>
                  Siguiente
                </button>
              </div>
            )}
          </div>
          <div className="ph__genres-grid">
            {visibleGenres.map((genre, index) => (
              <article key={`${genre.name}-${firstGenreIndex + index}`} className="ph__genre-chip">
                <strong>{genre.name}</strong>
                <span>{genre.files.toLocaleString("es-MX")} archivos</span>
                <span>{genre.gb.toLocaleString("es-MX", { maximumFractionDigits: 2 })} GB</span>
              </article>
            ))}
          </div>
        </div>
      </motion.section>

      <motion.section
        className="ph__top-downloads"
        initial={{ opacity: 0, y: 34 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.1 }}
        transition={{ duration: 0.45 }}
      >
        <div className="ph__container">
          <div className="ph__top-downloads-shell">
            <h2 className="ph__section-title ph__section-title--left">
              {topDownloadsAreFallback
                ? "Top 100 por género (referencia de catálogo)"
                : "Top 100 más descargado por DJs reales"}
            </h2>
            <p className="ph__top-downloads-caption">
              {topDownloadsAreFallback
                ? "Mientras sincronizamos el histórico de descargas en vivo, te mostramos una referencia útil por género (archivos y GB) para que veas qué pesa más en el catálogo."
                : "Descubre lo que más baja la comunidad y escucha muestras rápidas para validar energía antes de registrarte."}
            </p>
            <div className="ph__top-downloads-controls" role="tablist" aria-label="Tipo de top">
              <button
                type="button"
                role="tab"
                aria-selected={topDownloadsTab === "audio"}
                className={`ph__top-downloads-tab ${topDownloadsTab === "audio" ? "is-active" : ""}`}
                onClick={() => setTopDownloadsTab("audio")}
              >
                <Music2 size={16} />
                {topDownloadsAreFallback ? "Top géneros (por archivos)" : "Top Audios"}
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={topDownloadsTab === "video"}
                className={`ph__top-downloads-tab ${topDownloadsTab === "video" ? "is-active" : ""}`}
                onClick={() => setTopDownloadsTab("video")}
              >
                <Clapperboard size={16} />
                {topDownloadsAreFallback ? "Top géneros (por GB)" : "Top Videos"}
              </button>
              <button
                type="button"
                className="ph__top-downloads-refresh"
                onClick={() => void loadTopDownloads()}
                disabled={topDownloadsLoading}
              >
                <RefreshCw size={15} />
                {topDownloadsLoading ? "Actualizando..." : "Actualizar"}
              </button>
            </div>
            <div className="ph__top-downloads-stats" role="list" aria-label="Resumen top descargas">
              <article role="listitem" className="ph__top-downloads-stat">
                <strong>{topAudioCountLabel}</strong>
                <span>
                  {topDownloadsAreFallback ? "géneros" : "audios"} en Top {TOP_DOWNLOADS_LIMIT}
                </span>
              </article>
              <article role="listitem" className="ph__top-downloads-stat">
                <strong>{topVideoCountLabel}</strong>
                <span>
                  {topDownloadsAreFallback ? "géneros" : "videos"} en Top {TOP_DOWNLOADS_LIMIT}
                </span>
              </article>
              <article role="listitem" className="ph__top-downloads-stat">
                <strong>{TOP_DOWNLOADS_WINDOW_DAYS}</strong>
                <span>días de historial analizado</span>
              </article>
            </div>
            {topDownloadsLoading && (
              <p className="ph__top-downloads-state">Cargando ranking real de descargas...</p>
            )}
            {!topDownloadsLoading && topDownloadsError && (
              <div className="ph__top-downloads-state ph__top-downloads-state--error">
                <p>{topDownloadsError}</p>
                <button type="button" onClick={() => void loadTopDownloads()}>
                  Reintentar
                </button>
              </div>
            )}
            {!topDownloadsLoading && !topDownloadsError && topDownloadsAreFallback && (
              <p className="ph__top-downloads-state">
                Ranking mostrado con referencia del catálogo mientras sincronizamos el histórico de descargas en vivo.
              </p>
            )}
            {!topDownloadsLoading && !topDownloadsError && activeTopDownloads.length > 0 && (
              <>
                <p className="ph__top-downloads-range">
                  Mostrando {topPageStart}-{topPageEnd} de {activeTopDownloads.length.toLocaleString("es-MX")} en Top {TOP_DOWNLOADS_LIMIT} de {activeTopLabel}.
                </p>
                <ol className="ph__top-downloads-list" aria-label={`Top ${TOP_DOWNLOADS_LIMIT} de ${activeTopLabel}`}>
                  {visibleTopDownloads.map((item, index) => (
                  <li key={`${item.type}-${item.path}`} className="ph__top-downloads-item">
                    <span className="ph__top-downloads-rank">#{topPageStart + index}</span>
                    <div className="ph__top-downloads-meta">
                      <strong title={item.name}>{item.name}</strong>
                      <span>
                        {item.downloads.toLocaleString("es-MX")}{" "}
                        {topDownloadsAreFallback ? "archivos" : "descargas"} ·{" "}
                        {item.totalGb.toLocaleString("es-MX", { maximumFractionDigits: 2 })} GB
                      </span>
                    </div>
                    {topDownloadsAreFallback ? (
                      <span className="ph__top-downloads-pending">Demo en sincronización</span>
                    ) : (
                      <button
                        type="button"
                        className="ph__top-downloads-play"
                        onClick={() => void handleTopDemo(item)}
                        disabled={topDemoLoadingPath !== "" && topDemoLoadingPath !== item.path}
                      >
                        <PlayCircle size={16} />
                        {topDemoLoadingPath === item.path ? "Abriendo..." : "Escuchar demo"}
                      </button>
                    )}
                  </li>
                  ))}
                </ol>
                {topDownloadsTotalPages > 1 && (
                  <div className="ph__top-downloads-pagination">
                    <button
                      type="button"
                      onClick={() => setTopDownloadsPage((prev) => (prev - 1 + topDownloadsTotalPages) % topDownloadsTotalPages)}
                    >
                      Anterior
                    </button>
                    <span>
                      Página {safeTopDownloadsPage + 1} / {topDownloadsTotalPages}
                    </span>
                    <button
                      type="button"
                      onClick={() => setTopDownloadsPage((prev) => (prev + 1) % topDownloadsTotalPages)}
                    >
                      Siguiente
                    </button>
                  </div>
                )}
              </>
            )}
            {!topDownloadsLoading && !topDownloadsError && activeTopDownloads.length === 0 && (
              <p className="ph__top-downloads-state">Todavía no hay suficiente data para este ranking.</p>
            )}
            {topDemoNotice && <p className="ph__top-downloads-note">{topDemoNotice}</p>}
            <p className="ph__top-downloads-footnote">
              ¿Quieres buscar todo el catálogo y descargar?{" "}
              <Link
                to="/auth/registro"
                state={{ from: "/planes" }}
                onClick={() => handleRegisterIntent("top-downloads")}
              >
                Crea tu cuenta aquí
              </Link>
              .
            </p>
          </div>
        </div>
      </motion.section>

      <motion.section
        className="ph__reciprocity"
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.2 }}
        transition={{ duration: 0.45 }}
      >
        <div className="ph__container">
          <div className="ph__reciprocity-shell">
            <h2 className="ph__section-title ph__section-title--left">Activa tu cuenta con ayuda real</h2>
            <p>
              Te guiamos por chat para activar tu acceso, entrar al FTP y empezar a descargar sin fricción.
            </p>
            <div className="ph__reciprocity-actions">
              <a
                href={SUPPORT_CHAT_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="ph__reciprocity-btn ph__reciprocity-btn--primary"
                onClick={() => {
                  trackManyChatConversion(MC_EVENTS.CLICK_CHAT);
                  trackGrowthMetric(GROWTH_METRICS.LEAD_MAGNET_DOWNLOAD, { segment, source: "chat_onboarding" });
                }}
              >
                <MessageCircle size={16} />
                Abrir soporte por chat
              </a>
              <a
                href={GUIDE_PDF_URL}
                download={GUIDE_PDF_FILENAME}
                className="ph__reciprocity-btn ph__reciprocity-btn--ghost"
                onClick={handleGuideDownload}
                aria-disabled={guideDownloadLoading}
              >
                <DownloadCloud size={16} />
                {guideDownloadLoading ? "Preparando PDF..." : "Descargar guía rápida"}
              </a>
            </div>
            {guideDownloadNotice && <p className="ph__reciprocity-note">{guideDownloadNotice}</p>}
          </div>
        </div>
      </motion.section>

      <motion.section
        className="ph__activation"
        initial={{ opacity: 0, y: 28 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.18 }}
        transition={{ duration: 0.42 }}
      >
        <div className="ph__container">
          <h2 className="ph__section-title ph__section-title--left">De pago a cabina en menos de 10 minutos</h2>
          <div className="ph__activation-grid">
            {ACTIVATION_STEPS.map((step) => (
              <article key={step.step} className="ph__activation-card">
                <span className="ph__activation-step">{step.step}</span>
                <h3>{step.title}</h3>
                <p>{step.detail}</p>
              </article>
            ))}
          </div>
        </div>
      </motion.section>

      {REAL_LIMITED_BONUS_ACTIVE && (
        <section className="ph__scarcity" aria-label="Ventana especial">
          <div className="ph__container">
            <div className="ph__scarcity-shell">
              <strong>Ventana activa:</strong> bono disponible por tiempo real y cupos limitados.
            </div>
          </div>
        </section>
      )}

      <motion.section
        className="ph__pricing ph__pricing--membership"
        id="planes"
        initial={{ opacity: 0, y: 40 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.2 }}
        transition={{ duration: 0.5 }}
      >
        <div className="ph__container">
          <div className="ph__pricing-shell">
            <h2 className="ph__section-title ph__section-title--membership">Activa hoy tu acceso Pro</h2>
            <p className="ph__pricing-intro">
              Entra hoy, descarga hoy y llega a tu próximo evento con repertorio listo.
            </p>
            <div className="ph__pricing-cards">
              <motion.article
                className={`ph__pricing-card ph__pricing-card--single ph__pricing-card--global ${isGlobalRecommended ? "ph__pricing-card--recommended" : ""}`}
                initial={{ opacity: 0, x: -14 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, amount: 0.2 }}
                transition={{ duration: 0.3, ease: "easeOut" }}
              >
                {isGlobalRecommended && <span className="ph__pricing-card-badge">Recomendado para ti</span>}
                <div className="ph__pricing-card-header ph__pricing-card-header--global">Acceso Pro USD</div>
                <div className="ph__pricing-card-body">
                  <span className="ph__pricing-amount">$18</span>
                  <span className="ph__pricing-period">USD / mes</span>
                  {usdLocalEstimateLabel && (
                    <p className="ph__pricing-local">Aprox. {usdLocalEstimateLabel}</p>
                  )}
                  <p className="ph__pricing-fit">Para DJs fuera de México o que cobran en USD.</p>
                  <p className="ph__pricing-anchor">Si una sola canción faltante te cuesta un cliente, este plan se paga solo.</p>
                  <p className="ph__pricing-cost">Desde $0.036 USD por GB descargado.</p>
                  <ul className="ph__pricing-features">
                    <li>500 GB de descarga al mes</li>
                    <li>Catálogo completo para cubrir peticiones en vivo</li>
                    <li>Pago con Tarjeta o PayPal</li>
                  </ul>
                  <PaymentMethodLogos
                    methods={["visa", "mastercard", "amex", "paypal"]}
                    className="ph__pricing-methods"
                    ariaLabel="Métodos de pago para plan en USD"
                  />
                  {trialConfig?.enabled && (
                    <p className="ph__pricing-trial-note" role="note">
                      <strong>{trialConfig.days} días gratis</strong> solo con tarjeta (Stripe) para nuevos usuarios. Incluye{" "}
                      {trialConfig.gb} GB de descarga. Después se cobra automáticamente.
                    </p>
                  )}
                  <Link to="/auth/registro" state={{ from: "/planes" }} className="ph__pricing-cta" onClick={() => handlePlanIntent("usd")}>
                    Empezar ahora en USD
                  </Link>
                  <p className="ph__pricing-risk">Activación guiada por chat al instante.</p>
                </div>
              </motion.article>

              <motion.article
                className={`ph__pricing-card ph__pricing-card--single ph__pricing-card--mexico ${isMexicoRecommended ? "ph__pricing-card--recommended" : ""}`}
                initial={{ opacity: 0, x: 14 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, amount: 0.2 }}
                transition={{ duration: 0.3, ease: "easeOut" }}
              >
                {isMexicoRecommended && <span className="ph__pricing-card-badge">Más conveniente en México</span>}
                <div className="ph__pricing-card-header ph__pricing-card-header--mexico">Acceso Pro MXN</div>
                <div className="ph__pricing-card-body">
                  <span className="ph__pricing-amount">$350</span>
                  <span className="ph__pricing-period">MXN / mes</span>
                  {mxnLocalEstimateLabel && (
                    <p className="ph__pricing-local">Aprox. {mxnLocalEstimateLabel}</p>
                  )}
                  <p className="ph__pricing-fit">Para DJs que cobran en pesos y prefieren pago local.</p>
                  <p className="ph__pricing-anchor">Una sola noche con respuestas lentas puede costarte más que este acceso.</p>
                  <p className="ph__pricing-cost">Desde $0.70 MXN por GB descargado.</p>
                  <ul className="ph__pricing-features">
                    <li>500 GB de descarga al mes</li>
                    <li>SPEI o Tarjeta</li>
                    <li>Catálogo completo para cubrir peticiones en vivo</li>
                  </ul>
                  <PaymentMethodLogos
                    methods={["visa", "mastercard", "amex", "spei"]}
                    className="ph__pricing-methods"
                    ariaLabel="Métodos de pago para plan en MXN"
                  />
                  {trialConfig?.enabled && (
                    <p className="ph__pricing-trial-note" role="note">
                      <strong>{trialConfig.days} días gratis</strong> solo con tarjeta (Stripe) para nuevos usuarios. Incluye{" "}
                      {trialConfig.gb} GB de descarga. Después se cobra automáticamente.
                    </p>
                  )}
                  <Link to="/auth/registro" state={{ from: "/planes" }} className="ph__pricing-cta" onClick={() => handlePlanIntent("mxn")}>
                    Empezar ahora en MXN
                  </Link>
                  <p className="ph__pricing-risk">Activas hoy y te guiamos paso a paso por chat.</p>
                </div>
              </motion.article>
            </div>
            <div className="ph__pricing-estimator">
              <button
                type="button"
                className="ph__pricing-estimator-btn"
                onClick={handleShowLocalPriceEstimate}
                disabled={localPriceEstimate.loading}
              >
                {localPriceEstimate.loading ? "Calculando conversión..." : "Ver precio estimado en mi moneda"}
              </button>
              {localPriceEstimate.visible && !localPriceEstimate.error && localPriceEstimate.currency && (
                <p className="ph__pricing-estimator-note">
                  Estimado referencial en {localPriceEstimate.currency}
                  {localPriceEstimate.countryCode ? ` (${localPriceEstimate.countryCode})` : ""} detectado por{" "}
                  {localPriceEstimate.detectionSource === "ip" ? "IP" : "configuración del navegador"}. Puede variar
                  por tipo de cambio y comisiones bancarias
                  {localEstimateDateLabel ? ` • actualizado ${localEstimateDateLabel}` : ""}.
                </p>
              )}
              {localPriceEstimate.error && (
                <p className="ph__pricing-estimator-error">{localPriceEstimate.error}</p>
              )}
            </div>
            <p className="ph__guarantee">Activa hoy • Cancela cuando quieras • Soporte por chat 1 a 1</p>
            <p className="ph__guarantee-terms">
              Si no logras activar y descargar en tu primera sesión, te acompañamos por chat hasta que todo quede funcionando.
            </p>
            <Link to="/legal" className="ph__faq-link">
              Ver FAQ, privacidad y reembolsos
            </Link>
          </div>
        </div>
      </motion.section>

      <footer className="ph__footer ph__footer--2026">
        <div className="ph__container">
          <Link to="/" className="ph__footer-logo">
            <img src={Logo} alt="Bear Beat" />
          </Link>
          <div className="ph__footer-links">
            <Link to="/auth" state={{ from: "/planes" }}>Iniciar sesión</Link>
            <Link to="/auth/registro" state={{ from: "/planes" }}>Registrarme</Link>
            <Link to="/legal">FAQ y Políticas</Link>
          </div>
          <div className="ph__footer-payments" aria-label="Pagos seguros">
            <PaymentMethodLogos
              methods={["visa", "mastercard", "amex", "paypal", "spei"]}
              className="ph__footer-payment-logos"
              ariaLabel="Métodos de pago aceptados en Bear Beat"
            />
          </div>
          <p className="ph__footer-copy">© Bear Beat. Todos los derechos reservados.</p>
        </div>
      </footer>

      <div className="ph__sticky-cta">
        <Link
          to="/auth/registro"
          state={{ from: "/planes" }}
          className="ph__sticky-cta-btn"
          onClick={() => handleRegisterIntent("sticky-mobile")}
        >
          Obtener Acceso
        </Link>
      </div>
    </div>
  );
}

export default PublicHome;
