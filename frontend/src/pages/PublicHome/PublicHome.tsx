import { Link } from "react-router-dom";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import trpc from "../../api";
import { useTheme } from "../../contexts/ThemeContext";
import brandMarkBlack from "../../assets/brand/bearbeat-mark-black.png";
import brandMarkCyan from "../../assets/brand/bearbeat-mark-cyan.png";
import PublicTopNav from "../../components/PublicTopNav/PublicTopNav";
import { trackManyChatConversion, MC_EVENTS } from "../../utils/manychatPixel";
import { GROWTH_METRICS, trackGrowthMetric } from "../../utils/growthMetrics";
import {
  buildHomeFaqItems,
  getHomeCtaPrimaryLabel,
  HOME_HERO_MICROCOPY_BASE,
  HOME_HERO_MICROCOPY_TRIAL,
} from "./homeCopy";
import {
  formatCatalogSizeMarketing,
  formatInt,
  HOME_NUMBER_LOCALE,
  normalizeGenreDisplayName,
  normalizeSearchKey,
} from "./homeFormat";
import { buildMarketingVariables } from "../../utils/marketingSnapshot";
import HomeHero from "./sections/HomeHero";
import SocialProof from "./sections/SocialProof";
import Pricing, {
  type PricingPlan,
  type TrialSummary,
} from "./sections/Pricing";
import WhyBearBeat from "./sections/WhyBearBeat";
import GenresCoverage, { type HomeCatalogGenre } from "./sections/GenresCoverage";
import InsideExplorer, {
  type PublicExplorerPreviewSnapshot,
} from "./sections/InsideExplorer";
import type { PaymentMethodId } from "../../components/PaymentMethodLogos/PaymentMethodLogos";
import HomeFaq from "./sections/HomeFaq";
import StickyMobileCta from "./sections/StickyMobileCta";
import "./PublicHome.scss";
const TOP_DOWNLOADS_DAYS = 120;
const FOOTER_PLANS_CTA_LABEL = "¿Listo para tu primer gig con Bear Beat?";
const FAQ_WHATSAPP_CTA_LABEL = "¿Tienes más dudas? Escríbenos por WhatsApp";
const WHATSAPP_SUPPORT_NUMBER = "+15132828507";
const WHATSAPP_SUPPORT_URL = `https://wa.me/${WHATSAPP_SUPPORT_NUMBER.replace(/\D/g, "")}`;
const DEFAULT_LIMITS_NOTE =
  "La cuota de descarga es lo que puedes bajar en cada ciclo. El catálogo total es lo disponible para elegir.";
const PAYMENT_METHOD_VALUES: PaymentMethodId[] = [
  "visa",
  "mastercard",
  "amex",
  "paypal",
  "spei",
  "oxxo",
  "transfer",
];
type CurrencyKey = "mxn" | "usd";
const DAYS_PER_MONTH_FOR_DAILY_PRICE = 30;

const MEXICO_TIMEZONES = new Set<string>([
  "America/Mexico_City",
  "America/Cancun",
  "America/Monterrey",
  "America/Merida",
  "America/Mazatlan",
  "America/Chihuahua",
  "America/Ciudad_Juarez",
  "America/Ojinaga",
  "America/Matamoros",
  "America/Tijuana",
  "America/Hermosillo",
  "America/Bahia_Banderas",
]);

const UNITED_STATES_TIMEZONES = new Set<string>([
  "America/New_York",
  "America/Detroit",
  "America/Kentucky/Louisville",
  "America/Kentucky/Monticello",
  "America/Indiana/Indianapolis",
  "America/Indiana/Vincennes",
  "America/Indiana/Winamac",
  "America/Indiana/Marengo",
  "America/Indiana/Petersburg",
  "America/Indiana/Vevay",
  "America/Chicago",
  "America/Indiana/Tell_City",
  "America/Indiana/Knox",
  "America/Menominee",
  "America/North_Dakota/Center",
  "America/North_Dakota/New_Salem",
  "America/North_Dakota/Beulah",
  "America/Denver",
  "America/Boise",
  "America/Phoenix",
  "America/Los_Angeles",
  "America/Anchorage",
  "America/Juneau",
  "America/Sitka",
  "America/Metlakatla",
  "America/Yakutat",
  "America/Nome",
  "America/Adak",
  "Pacific/Honolulu",
]);

type TrialConfigResponse = {
  enabled: boolean;
  days: number;
  gb: number;
  eligible?: boolean | null;
};

type PublicTopDownloadsResponse = {
  audio: Array<{ path: string; name: string; downloads: number }>;
  video: Array<{ path: string; name: string; downloads: number }>;
  karaoke: Array<{ path: string; name: string; downloads: number }>;
  generatedAt: string;
  limit: number;
  sinceDays: number;
};

type PublicExplorerPreviewResponse = PublicExplorerPreviewSnapshot;

type PublicPricingUiSnapshot = {
  defaultCurrency: CurrencyKey;
  limitsNote: string;
  afterPriceLabel: string;
  genres: HomeCatalogGenre[];
  stats: {
    totalFiles: number;
    totalGenres: number;
    karaokes: number;
    totalTB: number;
    quotaGbDefault: number;
  };
};

function prettyMediaName(value: string): string {
  const name = `${value ?? ""}`.trim();
  if (!name) return "";
  const noExt = name.replace(/\.[a-z0-9]{2,5}$/i, "");
  return noExt.replace(/[_]+/g, " ").replace(/\s+/g, " ").trim();
}

function isPaymentMethodId(value: unknown): value is PaymentMethodId {
  return (
    typeof value === "string" &&
    PAYMENT_METHOD_VALUES.includes(value as PaymentMethodId)
  );
}

function parsePaymentMethods(
  value: unknown,
  fallback: PaymentMethodId[],
): PaymentMethodId[] {
  if (!Array.isArray(value)) return fallback;
  const parsed: PaymentMethodId[] = [];
  for (const method of value) {
    if (!isPaymentMethodId(method)) continue;
    if (parsed.includes(method)) continue;
    parsed.push(method);
  }
  return parsed.length > 0 ? parsed : fallback;
}

function formatCurrency(
  amount: number,
  currency: "mxn" | "usd",
  locale: string,
  opts?: { minimumFractionDigits?: number; maximumFractionDigits?: number },
): string {
  const code = currency === "mxn" ? "MXN" : "USD";
  const safeAmount = Number(amount);
  if (!Number.isFinite(safeAmount) || safeAmount <= 0) return `0 ${code}`;
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency: code,
      minimumFractionDigits: opts?.minimumFractionDigits,
      maximumFractionDigits: opts?.maximumFractionDigits,
    }).format(safeAmount);
  } catch {
    return `${safeAmount} ${code}`;
  }
}

function formatMonthlyPriceWithCode(
  amount: number,
  currency: "mxn" | "usd",
  locale: string,
): string {
  const code = currency === "mxn" ? "MXN" : "USD";
  const safeAmount = Number(amount);
  if (!Number.isFinite(safeAmount) || safeAmount <= 0) return `${code} $0/mes`;
  const hasDecimals = !Number.isInteger(safeAmount);
  const formatted = formatCurrency(safeAmount, currency, locale, {
    minimumFractionDigits: hasDecimals ? 2 : 0,
    maximumFractionDigits: 2,
  });
  return `${code} ${formatted}/mes`;
}

function getDailyPrice(monthlyPrice: number): number {
  const safe = Number(monthlyPrice);
  if (!Number.isFinite(safe) || safe <= 0) return 0;
  const rawDaily = safe / DAYS_PER_MONTH_FOR_DAILY_PRICE;
  return Math.floor(rawDaily * 10) / 10;
}

function buildHomeHeroAfterPriceLabel(input: {
  fallback: string;
  numberLocale: string;
  mxnPlan: PricingPlan | null;
  usdPlan: PricingPlan | null;
  withDailyUsd: boolean;
}): string {
  const monthlyParts: string[] = [];

  if (input.mxnPlan && Number(input.mxnPlan.price) > 0) {
    monthlyParts.push(
      formatMonthlyPriceWithCode(input.mxnPlan.price, "mxn", input.numberLocale),
    );
  }
  if (input.usdPlan && Number(input.usdPlan.price) > 0) {
    monthlyParts.push(
      formatMonthlyPriceWithCode(input.usdPlan.price, "usd", input.numberLocale),
    );
  }

  const base =
    monthlyParts.length > 0
      ? monthlyParts.join(" · ")
      : `${input.fallback ?? ""}`
          .replace(/^desde\s*/i, "")
          .replace(/[()]/g, "")
          .replace(/\s+/g, " ")
          .trim();

  if (!input.withDailyUsd || !input.usdPlan || Number(input.usdPlan.price) <= 0) {
    return base;
  }

  const usdDaily = formatCurrency(
    getDailyPrice(input.usdPlan.price),
    "usd",
    input.numberLocale,
    {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    },
  );

  return `${base} · (${usdDaily} USD al día)`;
}

function buildCatalogGenresSnapshot(value: unknown): HomeCatalogGenre[] {
  const rows = Array.isArray(value) ? value : [];
  const grouped = new Map<string, HomeCatalogGenre>();

  rows.forEach((row: any, index) => {
    const displayName =
      typeof row?.name === "string"
        ? normalizeGenreDisplayName(row.name).trim()
        : "";
    if (!displayName) return;

    const searchKey = normalizeSearchKey(displayName);
    if (!searchKey) return;

    const filesRaw = Number(row?.files ?? 0);
    const gbRaw = Number(row?.gb ?? 0);
    const files = Number.isFinite(filesRaw) && filesRaw > 0 ? filesRaw : 0;
    const gb = Number.isFinite(gbRaw) && gbRaw > 0 ? gbRaw : 0;
    const existing = grouped.get(searchKey);

    if (existing) {
      existing.files += files;
      existing.gb += gb;
      if (displayName.length > existing.name.length) existing.name = displayName;
      return;
    }

    grouped.set(searchKey, {
      id: `genre-${searchKey}-${index}`,
      name: displayName,
      searchKey,
      files,
      gb,
    });
  });

  return Array.from(grouped.values()).sort((a, b) => {
    if (b.files !== a.files) return b.files - a.files;
    return a.name.localeCompare(b.name, "es-MX");
  });
}

function readRegionFromLocale(locale: string): string | null {
  const tag = `${locale ?? ""}`.trim();
  if (!tag) return null;

  try {
    const parsed = new Intl.Locale(tag);
    const region = parsed.region?.toUpperCase();
    if (region) return region;
  } catch {
    // Fallback to regex parsing below.
  }

  const match = tag.match(/[-_]([a-z]{2})\b/i);
  return match ? match[1].toUpperCase() : null;
}

function detectVisitorCurrencyDefault(): CurrencyKey | null {
  if (typeof window === "undefined" || typeof navigator === "undefined")
    return null;

  const localeCandidates: string[] = [];
  if (Array.isArray(navigator.languages))
    localeCandidates.push(...navigator.languages);
  if (typeof navigator.language === "string")
    localeCandidates.push(navigator.language);

  const intlLocale = Intl.DateTimeFormat().resolvedOptions().locale;
  if (typeof intlLocale === "string" && intlLocale.trim())
    localeCandidates.push(intlLocale);

  for (const locale of localeCandidates) {
    const region = readRegionFromLocale(locale);
    if (region === "MX") return "mxn";
    if (region === "US") return "usd";
  }

  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "";
  if (MEXICO_TIMEZONES.has(timezone)) return "mxn";
  if (UNITED_STATES_TIMEZONES.has(timezone) || timezone.startsWith("US/"))
    return "usd";

  return null;
}

function resolveCurrencyForPlans(
  preferred: CurrencyKey | null,
  fallback: CurrencyKey,
  plans: { mxn: PricingPlan | null; usd: PricingPlan | null },
): CurrencyKey {
  if (preferred === "mxn" && plans.mxn) return "mxn";
  if (preferred === "usd" && plans.usd) return "usd";
  if (fallback === "mxn" && plans.mxn) return "mxn";
  if (fallback === "usd" && plans.usd) return "usd";
  return plans.mxn ? "mxn" : "usd";
}

export default function PublicHome() {
  const { theme } = useTheme();
  const brandMark = theme === "light" ? brandMarkBlack : brandMarkCyan;
  const [pricingUi, setPricingUi] = useState<PublicPricingUiSnapshot>({
    defaultCurrency: "mxn",
    limitsNote: DEFAULT_LIMITS_NOTE,
    afterPriceLabel: "precio mensual",
    genres: [],
    stats: {
      totalFiles: 0,
      totalGenres: 0,
      karaokes: 0,
      totalTB: 0,
      quotaGbDefault: 500,
    },
  });
  const preferredCurrency = pricingUi.defaultCurrency;
  const [trialConfig, setTrialConfig] = useState<TrialConfigResponse | null>(
    null,
  );
  const [topDownloads, setTopDownloads] =
    useState<PublicTopDownloadsResponse | null>(null);
  const [insideExplorer, setInsideExplorer] =
    useState<PublicExplorerPreviewResponse | null>(null);
  const [insideExplorerLoading, setInsideExplorerLoading] = useState(true);
  const [pricingPlans, setPricingPlans] = useState<{
    mxn: PricingPlan | null;
    usd: PricingPlan | null;
  }>({
    mxn: null,
    usd: null,
  });
  const [pricingStatus, setPricingStatus] = useState<
    "loading" | "loaded" | "error"
  >("loading");

  const pricingRef = useRef<HTMLDivElement | null>(null);
  const pricingViewedRef = useRef(false);

  const prefetchRegisterOnceRef = useRef(false);
  const prefetchRegisterRoute = useCallback(() => {
    if (prefetchRegisterOnceRef.current) return;
    prefetchRegisterOnceRef.current = true;

    void Promise.all([
      import("../Auth/Auth"),
      import("../../components/Auth/SignUpForm/SignUpForm"),
    ]).catch(() => {
      // Best-effort: allow retry if the prefetch fails.
      prefetchRegisterOnceRef.current = false;
    });
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const onIntent = () => {
      prefetchRegisterRoute();
    };

    window.addEventListener("pointerdown", onIntent, {
      once: true,
      passive: true,
    });
    window.addEventListener("keydown", onIntent, { once: true });
    return () => {
      window.removeEventListener("pointerdown", onIntent);
      window.removeEventListener("keydown", onIntent);
    };
  }, [prefetchRegisterRoute]);

  useEffect(() => {
    trackGrowthMetric(GROWTH_METRICS.HOME_VIEW, { section: "home" });
    trackManyChatConversion(MC_EVENTS.VIEW_HOME);
  }, []);

  useEffect(() => {
    let cancelled = false;
    let staleTimeout: number | null = null;

    const applyPricingConfig = (response: any) => {
      const cfg = response?.trialConfig;
      setTrialConfig({
        enabled: Boolean(cfg?.enabled),
        days: Number(cfg?.days ?? 0),
        gb: Number(cfg?.gb ?? 0),
        eligible: cfg?.eligible ?? null,
      });

      const mxn = response?.plans?.mxn ?? null;
      const usd = response?.plans?.usd ?? null;
      const toPlan = (raw: any, currency: CurrencyKey): PricingPlan | null => {
        if (!raw || typeof raw !== "object") return null;
        const price = Number(raw?.price ?? 0);
        const gigas = Number(raw?.gigas ?? 0);
        const pricingMethodsFallback: PaymentMethodId[] =
          currency === "mxn"
            ? ["visa", "mastercard", "amex", "spei"]
            : ["visa", "mastercard", "amex"];
        const trialMethodsFallback: PaymentMethodId[] = [
          "visa",
          "mastercard",
          "amex",
        ];

        return {
          planId: Number(raw?.planId ?? 0),
          currency,
          name: String(raw?.name ?? "").trim() || "Membresía Bear Beat",
          price: Number.isFinite(price) ? price : 0,
          gigas: Number.isFinite(gigas) ? gigas : 0,
          hasPaypal: Boolean(raw?.hasPaypal),
          pricingPaymentMethods: parsePaymentMethods(
            raw?.pricingPaymentMethods,
            pricingMethodsFallback,
          ),
          trialPricingPaymentMethods: parsePaymentMethods(
            raw?.trialPricingPaymentMethods,
            trialMethodsFallback,
          ),
          altPaymentLabel:
            typeof raw?.altPaymentLabel === "string"
              ? raw.altPaymentLabel.trim()
              : "",
        } satisfies PricingPlan;
      };

      const nextPlans = {
        mxn: toPlan(mxn, "mxn"),
        usd: toPlan(usd, "usd"),
      };
      const marketingVariables = buildMarketingVariables({
        pricingConfig: response,
      });

      const defaultCurrencyRaw = String(
        response?.ui?.defaultCurrency ?? response?.currencyDefault ?? "mxn",
      )
        .trim()
        .toLowerCase();
      const defaultCurrencyFromApi: CurrencyKey =
        defaultCurrencyRaw === "usd" ? "usd" : "mxn";
      const visitorCurrency = detectVisitorCurrencyDefault();
      const defaultCurrency = resolveCurrencyForPlans(
        visitorCurrency,
        defaultCurrencyFromApi,
        nextPlans,
      );
      const totalFiles = Math.max(0, Number(marketingVariables.TOTAL_FILES));
      const totalGenres = Math.max(0, Number(marketingVariables.TOTAL_GENRES));
      const karaokes = Math.max(0, Number(marketingVariables.TOTAL_KARAOKE));
      const genres = buildCatalogGenresSnapshot(response?.catalog?.genresDetail);
      const totalTB = Math.max(0, Number(marketingVariables.TOTAL_TB));
      const quotaFromUi = Math.max(
        0,
        Number(marketingVariables.MONTHLY_GB ?? 0),
      );
      const quotaFromPlans =
        defaultCurrency === "mxn"
          ? Number(nextPlans.mxn?.gigas ?? 0)
          : Number(nextPlans.usd?.gigas ?? 0);
      const quotaGbDefault =
        Number.isFinite(quotaFromUi) && quotaFromUi > 0
          ? quotaFromUi
          : Number.isFinite(quotaFromPlans) && quotaFromPlans > 0
            ? quotaFromPlans
            : 500;
      const limitsNoteRaw =
        typeof response?.ui?.limitsNote === "string"
          ? response.ui.limitsNote.trim()
          : "";
      const normalizedLimitsNote = limitsNoteRaw
        ? limitsNoteRaw.replace(/cuota mensual/gi, "cuota de descarga")
        : "";
      const afterPriceLabelRaw =
        typeof response?.ui?.afterPriceLabel === "string"
          ? response.ui.afterPriceLabel.trim()
          : "";
      const afterPriceLabelFallback = `${marketingVariables.MONTHLY_LABEL_DUAL}`.trim();

      setPricingUi({
        defaultCurrency,
        limitsNote: normalizedLimitsNote || DEFAULT_LIMITS_NOTE,
        afterPriceLabel:
          afterPriceLabelRaw || afterPriceLabelFallback || "precio mensual",
        genres,
        stats: {
          totalFiles: Number.isFinite(totalFiles) ? totalFiles : 0,
          totalGenres: Number.isFinite(totalGenres) ? totalGenres : 0,
          karaokes: Number.isFinite(karaokes) ? karaokes : 0,
          totalTB: Number.isFinite(totalTB) ? totalTB : 0,
          quotaGbDefault: Number.isFinite(quotaGbDefault)
            ? quotaGbDefault
            : 500,
        },
      });
      setPricingPlans(nextPlans);
      setPricingStatus(nextPlans.mxn || nextPlans.usd ? "loaded" : "error");
    };

    const fetchPricingConfig = async () => {
      if (!cancelled) setPricingStatus("loading");
      try {
        const response: any = await trpc.plans.getPublicPricingConfig.query();
        if (cancelled) return;
        applyPricingConfig(response);

        // Stale-while-revalidate: retry once shortly after if server is refreshing.
        if (response?.catalog?.stale && typeof window !== "undefined") {
          if (staleTimeout) window.clearTimeout(staleTimeout);
          staleTimeout = window.setTimeout(() => {
            if (!cancelled) void fetchPricingConfig();
          }, 10_000);
        }
      } catch {
        if (!cancelled) {
          setTrialConfig({ enabled: false, days: 0, gb: 0, eligible: null });
          setPricingPlans({ mxn: null, usd: null });
          setPricingUi((current) => ({
            ...current,
            defaultCurrency: "mxn",
            limitsNote: DEFAULT_LIMITS_NOTE,
          }));
          setPricingStatus("error");
        }
      }
    };

    void fetchPricingConfig();

    return () => {
      cancelled = true;
      if (staleTimeout && typeof window !== "undefined")
        window.clearTimeout(staleTimeout);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const response =
          (await trpc.downloadHistory.getPublicTopDownloads.query({
            limit: 25,
            sinceDays: TOP_DOWNLOADS_DAYS,
          })) as PublicTopDownloadsResponse;

        if (!cancelled) setTopDownloads(response);
      } catch {
        if (!cancelled) setTopDownloads(null);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    if (!cancelled) setInsideExplorerLoading(true);

    (async () => {
      try {
        const response =
          (await trpc.downloadHistory.getPublicExplorerPreview.query({
            limit: 6,
          })) as PublicExplorerPreviewResponse;

        if (!cancelled) setInsideExplorer(response);
      } catch {
        if (!cancelled) setInsideExplorer(null);
      } finally {
        if (!cancelled) setInsideExplorerLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const trialSummary = useMemo<TrialSummary | null>(() => {
    if (!trialConfig) return null;
    return {
      enabled: Boolean(trialConfig.enabled) && trialConfig.eligible !== false,
      days: Number(trialConfig.days ?? 0),
      gb: Number(trialConfig.gb ?? 0),
    };
  }, [trialConfig]);

  const ctaPrimaryLabel = useMemo(
    () => getHomeCtaPrimaryLabel(trialSummary),
    [trialSummary],
  );
  const primaryCheckoutFrom = useMemo(() => {
    const preferredPlan =
      preferredCurrency === "mxn" ? pricingPlans.mxn : pricingPlans.usd;
    const fallbackPlan =
      preferredCurrency === "mxn" ? pricingPlans.usd : pricingPlans.mxn;
    const selectedPlan = preferredPlan ?? fallbackPlan;
    const selectedPlanId = Number(selectedPlan?.planId ?? 0);

    if (Number.isFinite(selectedPlanId) && selectedPlanId > 0) {
      return `/comprar?priceId=${selectedPlanId}&entry=fastlane`;
    }
    return "/planes?entry=compare";
  }, [preferredCurrency, pricingPlans.mxn, pricingPlans.usd]);
  const comparePlansTo = "/planes?entry=compare";
  const primaryCheckoutPlanId = useMemo(() => {
    const match = primaryCheckoutFrom.match(/[?&]priceId=(\d+)/);
    if (!match) return null;
    const parsed = Number(match[1]);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  }, [primaryCheckoutFrom]);
  const primaryCheckoutCurrency = useMemo(() => {
    if (!primaryCheckoutPlanId) return null;
    if (pricingPlans.mxn?.planId === primaryCheckoutPlanId) return "MXN";
    if (pricingPlans.usd?.planId === primaryCheckoutPlanId) return "USD";
    return preferredCurrency.toUpperCase();
  }, [
    preferredCurrency,
    pricingPlans.mxn?.planId,
    pricingPlans.usd?.planId,
    primaryCheckoutPlanId,
  ]);
  const footerMicrocopy = useMemo(() => {
    if (trialSummary?.enabled) {
      // Mantén el detalle de la prueba arriba (hero/pricing) y deja el footer en modo "micro".
      return HOME_HERO_MICROCOPY_TRIAL;
    }
    return HOME_HERO_MICROCOPY_BASE;
  }, [trialSummary?.enabled]);

  const faqItems = useMemo(
    () =>
      buildHomeFaqItems({
        totalFiles: pricingUi.stats.totalFiles,
        totalGenres: pricingUi.stats.totalGenres,
        karaokes: pricingUi.stats.karaokes,
        quotaGbDefault: pricingUi.stats.quotaGbDefault,
        trialEnabled: Boolean(trialConfig?.enabled),
        trialDays: Number(trialConfig?.days ?? 7),
        trialGb: Number(trialConfig?.gb ?? 100),
        genres: pricingUi.genres,
      }),
    [
      pricingUi.genres,
      pricingUi.stats.karaokes,
      pricingUi.stats.quotaGbDefault,
      pricingUi.stats.totalFiles,
      pricingUi.stats.totalGenres,
      trialConfig?.days,
      trialConfig?.gb,
    ],
  );

  const afterPriceLabel = pricingUi.afterPriceLabel;
  const heroAfterPriceLabel = useMemo(
    () =>
      buildHomeHeroAfterPriceLabel({
        fallback: afterPriceLabel,
        numberLocale: HOME_NUMBER_LOCALE,
        mxnPlan: pricingPlans.mxn,
        usdPlan: pricingPlans.usd,
        withDailyUsd: Boolean(trialSummary?.enabled),
      }),
    [
      afterPriceLabel,
      pricingPlans.mxn,
      pricingPlans.usd,
      trialSummary?.enabled,
    ],
  );

  const effectiveTotalTB = Math.max(0, Number(pricingUi.stats.totalTB ?? 0));
  const totalTBLabel = formatCatalogSizeMarketing(effectiveTotalTB);
  const footerBrandLead = useMemo(() => {
    const totalFiles = Math.max(0, Number(pricingUi.stats.totalFiles ?? 0));
    const totalGenres = Math.max(0, Number(pricingUi.stats.totalGenres ?? 0));
    if (totalFiles <= 0 || totalGenres <= 0) {
      return "Catálogo real. Géneros latinos. Actualizaciones cada semana.";
    }
    return `${formatInt(totalFiles)} archivos. ${formatInt(totalGenres)}+ géneros. Actualizaciones cada semana.`;
  }, [pricingUi.stats.totalFiles, pricingUi.stats.totalGenres]);

  const socialAudio = useMemo(() => {
    const items = topDownloads?.audio ?? [];
    return items
      .filter(
        (item) =>
          item &&
          typeof item.name === "string" &&
          typeof item.path === "string",
      )
      .map((item) => ({
        path: item.path,
        name: prettyMediaName(item.name) || item.name,
        downloads: Number(item.downloads ?? 0),
      }));
  }, [topDownloads]);

  const socialVideo = useMemo(() => {
    const items = topDownloads?.video ?? [];
    return items
      .filter(
        (item) =>
          item &&
          typeof item.name === "string" &&
          typeof item.path === "string",
      )
      .map((item) => ({
        path: item.path,
        name: prettyMediaName(item.name) || item.name,
        downloads: Number(item.downloads ?? 0),
      }));
  }, [topDownloads]);

  const socialKaraoke = useMemo(() => {
    const items = topDownloads?.karaoke ?? [];
    return items
      .filter(
        (item) =>
          item &&
          typeof item.name === "string" &&
          typeof item.path === "string",
      )
      .map((item) => ({
        path: item.path,
        name: prettyMediaName(item.name) || item.name,
        downloads: Number(item.downloads ?? 0),
      }));
  }, [topDownloads]);

  const onPrimaryCtaClick = useCallback(
    (location: "hero" | "mid" | "pricing" | "footer" | "sticky" | "nav") => {
      const entry = primaryCheckoutFrom.startsWith("/comprar")
        ? "fastlane"
        : "compare";
      if (entry === "fastlane") {
        trackGrowthMetric(GROWTH_METRICS.HOME_FASTLANE_CLICK, {
          location,
          entry,
          target: primaryCheckoutFrom,
          planId: primaryCheckoutPlanId,
        });
      } else {
        trackGrowthMetric(GROWTH_METRICS.PLANS_COMPARE_CLICK, {
          source: "home_fallback",
          location,
          target: primaryCheckoutFrom,
        });
      }
      trackGrowthMetric(GROWTH_METRICS.CTA_PRIMARY_CLICK, {
        location,
        target: primaryCheckoutFrom,
        planId: primaryCheckoutPlanId,
        currency: primaryCheckoutCurrency,
        entry,
      });
      trackGrowthMetric(GROWTH_METRICS.CTA_CLICK, {
        id: "home_primary",
        location,
        target: primaryCheckoutFrom,
        planId: primaryCheckoutPlanId,
        currency: primaryCheckoutCurrency,
        funnel: "fast_lane_checkout",
        entry,
      });
      trackManyChatConversion(MC_EVENTS.CLICK_CTA_REGISTER);
    },
    [primaryCheckoutCurrency, primaryCheckoutFrom, primaryCheckoutPlanId],
  );

  const onSecondaryCtaClick = useCallback(
    (location: "top_downloads" | "sticky_demo") => {
      trackGrowthMetric(GROWTH_METRICS.CTA_SECONDARY_CLICK, { location });
      trackGrowthMetric(GROWTH_METRICS.CTA_CLICK, {
        id: `home_secondary_${location}`,
        location,
      });
    },
    [],
  );
  const onGenreCoverageClick = useCallback((genre: HomeCatalogGenre) => {
    trackGrowthMetric(GROWTH_METRICS.CTA_SECONDARY_CLICK, {
      location: "genres_coverage",
      genre: genre.name,
      target: `/?genre=${encodeURIComponent(genre.name)}`,
    });
  }, []);
  const onComparePlansClick = useCallback(
    (location: "topnav" | "footer") => {
      trackGrowthMetric(GROWTH_METRICS.PLANS_COMPARE_CLICK, {
        source: "home_compare",
        location,
        target: comparePlansTo,
      });
    },
    [comparePlansTo],
  );
  const onFaqWhatsappClick = useCallback(() => {
    const target = WHATSAPP_SUPPORT_URL;
    trackGrowthMetric(GROWTH_METRICS.CTA_SECONDARY_CLICK, {
      location: "faq_whatsapp",
      target,
    });
    trackGrowthMetric(GROWTH_METRICS.CTA_CLICK, {
      id: "home_faq_whatsapp",
      location: "faq",
      target,
    });
    trackManyChatConversion(MC_EVENTS.CLICK_CHAT);
  }, []);

  const findSectionByIds = useCallback((ids: string[]) => {
    for (const id of ids) {
      const section = document.getElementById(id);
      if (section) return section;
    }
    return null;
  }, []);

  type ScrollAlignmentOptions = {
    maxDurationMs?: number;
    thresholdPx?: number;
    onDone?: () => void;
  };

  const scrollAlignmentTokenRef = useRef(0);

  const getHomeStickyTopOffset = useCallback(() => {
    const stickyNav = document.querySelector<HTMLElement>(".home-topnav");
    if (!stickyNav) return 12;

    const rect = stickyNav.getBoundingClientRect();
    const navHeight = stickyNav.offsetHeight || rect.height || 80;

    // If the nav isn't visible (sticky not supported due to an ancestor overflow, etc.),
    // don't reserve space for it.
    if (rect.bottom <= 0) return 12;

    const navTop = Math.max(0, rect.top);
    return Math.max(12, navTop + navHeight + 10);
  }, []);

  const alignScrollToTarget = useCallback(
    (
      getTarget: () => HTMLElement | null,
      options: ScrollAlignmentOptions = {},
    ) => {
      if (typeof window === "undefined") return;

      const token = (scrollAlignmentTokenRef.current += 1);
      const maxDurationMs = Math.max(250, options.maxDurationMs ?? 5200);
      const thresholdPx = Math.max(0, options.thresholdPx ?? 22);
      const start = window.performance?.now
        ? window.performance.now()
        : Date.now();

      let lastY = window.scrollY;
      let lastDelta = Number.NaN;
      let stableScroll = 0;
      let stableDelta = 0;

      const tick = () => {
        if (scrollAlignmentTokenRef.current !== token) return;

        const now = window.performance?.now
          ? window.performance.now()
          : Date.now();
        const elapsed = now - start;
        const el = getTarget();

        if (!el) {
          if (elapsed >= maxDurationMs) {
            options.onDone?.();
            return;
          }
          window.requestAnimationFrame(tick);
          return;
        }

        const desiredTop = getHomeStickyTopOffset();
        const delta = el.getBoundingClientRect().top - desiredTop;

        const y = window.scrollY;
        if (Math.abs(y - lastY) < 1) stableScroll += 1;
        else stableScroll = 0;
        lastY = y;

        if (Number.isFinite(lastDelta) && Math.abs(delta - lastDelta) < 1)
          stableDelta += 1;
        else stableDelta = 0;
        lastDelta = delta;

        // We're stable and aligned.
        if (
          stableScroll >= 10 &&
          stableDelta >= 10 &&
          Math.abs(delta) <= thresholdPx
        ) {
          options.onDone?.();
          return;
        }

        // Smooth scroll / layout shifts can pause for a few frames. Only correct after scrollY is stable.
        if (stableScroll >= 6 && Math.abs(delta) > thresholdPx) {
          window.scrollTo({ top: Math.max(0, y + delta), behavior: "auto" });
          stableScroll = 0;
          stableDelta = 0;
        }

        if (elapsed >= maxDurationMs) {
          if (Math.abs(delta) > thresholdPx) {
            window.scrollTo({
              top: Math.max(0, window.scrollY + delta),
              behavior: "auto",
            });
          }
          options.onDone?.();
          return;
        }

        window.requestAnimationFrame(tick);
      };

      window.requestAnimationFrame(tick);
    },
    [getHomeStickyTopOffset],
  );

  const scrollToDemo = useCallback(
    (options: { behavior?: ScrollBehavior; focusSearch?: boolean } = {}) => {
      if (typeof window === "undefined") return;

      const scrollToTarget = (
        element: HTMLElement | null,
        behavior: ScrollBehavior = "smooth",
      ) => {
        if (!element) return;
        const top = Math.max(
          0,
          window.scrollY +
            element.getBoundingClientRect().top -
            getHomeStickyTopOffset(),
        );
        window.scrollTo({
          top,
          behavior,
        });
      };

      const fallbackDemoSection = document.getElementById("demo");
      const section =
        findSectionByIds([
          "inside-explorer",
          "top100",
          "top-audios",
          "top-videos",
          "top-karaokes",
          "catalogo",
          "demo",
        ]) ?? fallbackDemoSection;

      const getFinalTarget = () =>
        (document.getElementById("inside-explorer") as HTMLElement | null) ??
        (document.getElementById("top100") as HTMLElement | null) ??
        section;

      if (section) {
        scrollToTarget(section, options.behavior ?? "smooth");
        alignScrollToTarget(getFinalTarget, {
          // Mobile: content-visibility and images can change section height while/after we scroll.
          // Keep correcting until the anchor is actually aligned (or we time out).
          maxDurationMs: options.behavior === "auto" ? 4200 : 5600,
        });
      }
      if (options.focusSearch) {
        // Keep focus in the demo section after scrolling without forcing keyboard input on mobile.
        window.setTimeout(() => {
          const insideHeading = document.querySelector(
            ".inside-explorer h2",
          ) as HTMLHeadingElement | null;
          if (insideHeading) {
            insideHeading.focus({ preventScroll: true });
            return;
          }
          const play = document.querySelector(
            "[data-testid='home-topdemo-play']",
          ) as HTMLButtonElement | null;
          if (play) {
            play.focus({ preventScroll: true });
            return;
          }
          const jump = document.querySelector(
            ".social-proof__jump-link",
          ) as HTMLAnchorElement | null;
          jump?.focus({ preventScroll: true });
        }, 0);
      }
    },
    [alignScrollToTarget, findSectionByIds, getHomeStickyTopOffset],
  );

  const onDemoScroll = useCallback(() => {
    trackGrowthMetric(GROWTH_METRICS.VIEW_DEMO_CLICK, {
      location: "hero_block",
    });
    scrollToDemo({ behavior: "smooth", focusSearch: true });
  }, [scrollToDemo]);

  const onFaqExpand = useCallback((id: string) => {
    trackGrowthMetric(GROWTH_METRICS.FAQ_EXPAND, { question: id });
  }, []);

  useEffect(() => {
    const el = pricingRef.current;
    if (!el) return;
    if (pricingViewedRef.current) return;
    if (typeof IntersectionObserver === "undefined") return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (pricingViewedRef.current) return;
        const visible = entries.some((entry) => entry.isIntersecting);
        if (!visible) return;

        pricingViewedRef.current = true;
        trackGrowthMetric(GROWTH_METRICS.PRICING_VIEW, {
          currencyDefault: preferredCurrency,
        });
        observer.disconnect();
      },
      { threshold: 0.25 },
    );

    observer.observe(el);

    return () => observer.disconnect();
  }, [preferredCurrency]);

  useEffect(() => {
    if (typeof document === "undefined") return;

    const offers: Array<{
      "@type": "Offer";
      priceCurrency: string;
      price: number;
      url: string;
      availability: string;
    }> = [];

    if (pricingPlans.usd && pricingPlans.usd.price > 0) {
      offers.push({
        "@type": "Offer",
        priceCurrency: "USD",
        price: pricingPlans.usd.price,
        url: "https://thebearbeat.com/planes",
        availability: "https://schema.org/InStock",
      });
    }

    if (pricingPlans.mxn && pricingPlans.mxn.price > 0) {
      offers.push({
        "@type": "Offer",
        priceCurrency: "MXN",
        price: pricingPlans.mxn.price,
        url: "https://thebearbeat.com/planes",
        availability: "https://schema.org/InStock",
      });
    }

    const existing = document.querySelector(
      "script[data-schema='bb-product']",
    ) as HTMLScriptElement | null;
    if (offers.length === 0) {
      existing?.remove();
      return;
    }

    const schema = {
      "@context": "https://schema.org",
      "@type": "Product",
      name: "Membresía Bear Beat",
      brand: { "@type": "Brand", name: "Bear Beat" },
      url: "https://thebearbeat.com/planes",
      offers: offers.length === 1 ? offers[0] : offers,
    } as const;

    const script = existing ?? document.createElement("script");
    script.type = "application/ld+json";
    script.setAttribute("data-schema", "bb-product");
    script.text = JSON.stringify(schema);
    if (!existing) document.head.appendChild(script);

    return () => {
      // Mantén el schema solo en la landing pública.
      script.remove();
    };
  }, [pricingPlans.mxn, pricingPlans.usd]);

  return (
    <div className="public-home bb-marketing-page">
      <a className="home-skip" href="#home-main">
        Saltar al contenido
      </a>
      <PublicTopNav
        brandAriaCurrent
        plansTo={comparePlansTo}
        onPlansClick={() => onComparePlansClick("topnav")}
        cta={
          <Link
            to="/auth/registro"
            state={{ from: primaryCheckoutFrom }}
            className="home-cta home-cta--primary home-topnav__cta"
            data-testid="home-nav-primary-cta"
            onClick={() => onPrimaryCtaClick("nav")}
            onPointerEnter={prefetchRegisterRoute}
            onFocus={prefetchRegisterRoute}
          >
            {ctaPrimaryLabel}
          </Link>
        }
      />

      <div id="home-main" className="home-main">
        <HomeHero
          totalFiles={pricingUi.stats.totalFiles}
          totalGenres={pricingUi.stats.totalGenres}
          totalTBLabel={totalTBLabel}
          afterPriceLabel={heroAfterPriceLabel}
          trial={trialSummary}
          ctaLabel={ctaPrimaryLabel}
          primaryCheckoutFrom={primaryCheckoutFrom}
          onPrimaryCtaClick={() => onPrimaryCtaClick("hero")}
          onDemoScroll={onDemoScroll}
        />

        <div ref={pricingRef}>
          <Pricing
            plans={pricingPlans}
            status={pricingStatus}
            defaultCurrency={preferredCurrency}
            numberLocale={HOME_NUMBER_LOCALE}
            totalFiles={pricingUi.stats.totalFiles}
            totalGenres={pricingUi.stats.totalGenres}
            karaokes={pricingUi.stats.karaokes}
            trial={trialSummary}
            ctaLabel={ctaPrimaryLabel}
            primaryCheckoutFrom={primaryCheckoutFrom}
            onPrimaryCtaClick={() => onPrimaryCtaClick("pricing")}
          />
        </div>

        <WhyBearBeat
          totalGenres={pricingUi.stats.totalGenres}
          karaokes={pricingUi.stats.karaokes}
          totalTBLabel={totalTBLabel}
          usdMonthlyPrice={pricingPlans.usd?.price ?? null}
          mxnMonthlyPrice={pricingPlans.mxn?.price ?? null}
          numberLocale={HOME_NUMBER_LOCALE}
        />

        <GenresCoverage
          genres={pricingUi.genres}
          totalGenres={pricingUi.stats.totalGenres}
          onGenreClick={onGenreCoverageClick}
        />

        <InsideExplorer
          snapshot={insideExplorer}
          loading={insideExplorerLoading}
        />

        <SocialProof
          audio={socialAudio}
          video={socialVideo}
          karaoke={socialKaraoke}
          onMoreClick={() => onSecondaryCtaClick("top_downloads")}
        />

        <HomeFaq
          items={faqItems}
          onFaqExpand={onFaqExpand}
          postCta={{
            label: FAQ_WHATSAPP_CTA_LABEL,
            href: WHATSAPP_SUPPORT_URL,
          }}
          onPostCtaClick={onFaqWhatsappClick}
        />
      </div>

      <footer className="home-footer" aria-label="Footer">
        <div className="ph__container home-footer__inner">
          <div className="home-footer__brand">
            <img src={brandMark} alt="Bear Beat" width={46} height={46} />
            <p>
              {footerBrandLead}
              <br />
              El record pool latino más completo del mercado.
            </p>
          </div>

          <div className="home-footer__links" aria-label="Enlaces">
            <Link to={comparePlansTo} onClick={() => onComparePlansClick("footer")}>
              Planes
            </Link>
            <Link to="/auth">Iniciar sesión</Link>
          </div>

          <div className="home-footer__cta" aria-label="Activar">
            <Link
              to={comparePlansTo}
              className="home-footer__hook-link"
              onClick={() => onComparePlansClick("footer")}
            >
              {FOOTER_PLANS_CTA_LABEL}
            </Link>
            <Link
              to="/auth/registro"
              state={{ from: primaryCheckoutFrom }}
              className="home-cta home-cta--primary"
              data-testid="home-footer-primary-cta"
              onClick={() => onPrimaryCtaClick("footer")}
              onPointerEnter={prefetchRegisterRoute}
              onFocus={prefetchRegisterRoute}
            >
              {ctaPrimaryLabel}
            </Link>
            <p className="home-footer__micro">{footerMicrocopy}</p>
          </div>

          <p className="home-footer__copy">
            © Bear Beat. Todos los derechos reservados.
          </p>
        </div>
      </footer>

      <StickyMobileCta
        ctaLabel={ctaPrimaryLabel}
        trial={trialSummary}
        primaryCheckoutFrom={primaryCheckoutFrom}
        onPrimaryCtaClick={() => onPrimaryCtaClick("sticky")}
        onDemoClick={() => {
          onSecondaryCtaClick("sticky_demo");
          onDemoScroll();
        }}
      />
    </div>
  );
}
