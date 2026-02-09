import { Link } from "react-router-dom";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import trpc from "../../api";
import Logo from "../../assets/images/osonuevo.png";
import { trackManyChatConversion, MC_EVENTS } from "../../utils/manychatPixel";
import { GROWTH_METRICS, trackGrowthMetric } from "../../utils/growthMetrics";
import { FALLBACK_GENRES, type GenreStats } from "./fallbackGenres";
import type { IPlans } from "../../interfaces/Plans";
import { getHomeCtaPrimaryLabel, HOME_HERO_MICROCOPY_BASE, HOME_HERO_MICROCOPY_TRIAL } from "./homeCopy";
import {
  HOME_NUMBER_LOCALE,
  formatInt,
  formatTB,
  normalizeGenreDisplayName,
  normalizeSearchKey,
} from "./homeFormat";
import HomeHero from "./sections/HomeHero";
import TrustBar from "./sections/TrustBar";
import UseCases from "./sections/UseCases";
import CatalogDemo, { type CatalogGenre } from "./sections/CatalogDemo";
import HumanSocialProof from "./sections/HumanSocialProof";
import SocialProof from "./sections/SocialProof";
import Compatibility from "./sections/Compatibility";
import ActivationSteps from "./sections/ActivationSteps";
import Pricing, { type PricingPlan, type TrialSummary } from "./sections/Pricing";
import HomeFaq from "./sections/HomeFaq";
import HomeDemoModal from "./sections/HomeDemoModal";
import StickyMobileCta from "./sections/StickyMobileCta";
import "./PublicHome.scss";

const TOP_DOWNLOADS_DAYS = 120;

const FALLBACK_TOTAL_FILES = 195_727;
const FALLBACK_TOTAL_GB = 12_350.1;

type TrialConfigResponse = {
  enabled: boolean;
  days: number;
  gb: number;
  eligible?: boolean | null;
};

type PublicCatalogSummary = {
  error?: string;
  totalFiles: number;
  totalGB: number;
  videos: number;
  audios: number;
  karaokes: number;
  other: number;
  gbVideos: number;
  gbAudios: number;
  gbKaraokes: number;
  totalGenres: number;
  genresDetail: GenreStats[];
  generatedAt: string;
  stale: boolean;
};

type PublicTopDownloadsResponse = {
  audio: Array<{ name: string; downloads: number }>;
  video: Array<{ name: string; downloads: number }>;
  karaoke: Array<{ name: string; downloads: number }>;
  generatedAt: string;
  limit: number;
  sinceDays: number;
};

function detectPreferredCurrency(): "mxn" | "usd" {
  if (typeof window === "undefined") return "usd";
  const lang = navigator.language?.toLowerCase() ?? "";
  return lang.includes("mx") || lang.startsWith("es") ? "mxn" : "usd";
}

function parsePrice(value: string | null | undefined): number {
  const raw = `${value ?? ""}`.trim();
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeCurrency(value: string | null | undefined): "mxn" | "usd" | null {
  const cur = `${value ?? ""}`.trim().toLowerCase();
  if (cur === "mxn") return "mxn";
  if (cur === "usd") return "usd";
  return null;
}

function hasPaypal(plan: IPlans): boolean {
  return Boolean(plan.paypal_plan_id || plan.paypal_plan_id_test);
}

function pickBestPlan(plans: IPlans[], currency: "mxn" | "usd"): IPlans | null {
  let best: IPlans | null = null;

  for (const plan of plans) {
    if (plan.id === 41) continue;
    const planCurrency = normalizeCurrency(plan.moneda);
    if (planCurrency !== currency) continue;

    const price = parsePrice(plan.price);
    const gigas = Number(plan.gigas ?? 0);
    if (price <= 0 || gigas <= 0) continue;

    if (!best) {
      best = plan;
      continue;
    }

    const bestPrice = parsePrice(best.price);
    const bestPaypal = hasPaypal(best) ? 1 : 0;
    const candidatePaypal = hasPaypal(plan) ? 1 : 0;

    if (
      price < bestPrice ||
      (price === bestPrice && candidatePaypal > bestPaypal) ||
      (price === bestPrice && candidatePaypal === bestPaypal && plan.id < best.id)
    ) {
      best = plan;
    }
  }

  return best;
}

function prettyMediaName(value: string): string {
  const name = `${value ?? ""}`.trim();
  if (!name) return "";
  const noExt = name.replace(/\.[a-z0-9]{2,5}$/i, "");
  return noExt.replace(/[_]+/g, " ").replace(/\s+/g, " ").trim();
}

function toPricingPlan(plan: IPlans, currency: "mxn" | "usd"): PricingPlan {
  return {
    currency,
    name: (plan.name ?? "").trim() || "Membresía Bear Beat",
    price: parsePrice(plan.price),
    gigas: Number(plan.gigas ?? 0),
    hasPaypal: hasPaypal(plan),
  };
}

export default function PublicHome() {
  const preferredCurrency = useMemo(() => detectPreferredCurrency(), []);
  const [trialConfig, setTrialConfig] = useState<TrialConfigResponse | null>(null);
  const [catalogSummary, setCatalogSummary] = useState<PublicCatalogSummary | null>(null);
  const [topDownloads, setTopDownloads] = useState<PublicTopDownloadsResponse | null>(null);
  const [plans, setPlans] = useState<IPlans[]>([]);
  const [showDemo, setShowDemo] = useState(false);

  const pricingRef = useRef<HTMLDivElement | null>(null);
  const pricingViewedRef = useRef(false);

  useEffect(() => {
    trackGrowthMetric(GROWTH_METRICS.HOME_VIEW, { section: "home" });
    trackManyChatConversion(MC_EVENTS.VIEW_HOME);
  }, []);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const cfg = (await trpc.plans.getTrialConfig.query()) as TrialConfigResponse;
        if (!cancelled) setTrialConfig(cfg);
      } catch {
        if (!cancelled) setTrialConfig({ enabled: false, days: 0, gb: 0, eligible: null });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    const fetchCatalog = async () => {
      try {
        const summary = (await trpc.catalog.getPublicCatalogSummary.query()) as PublicCatalogSummary;
        if (cancelled) return;
        setCatalogSummary(summary);

        // Stale-while-revalidate: retry once shortly after if server is refreshing.
        if (summary?.stale && typeof window !== "undefined") {
          window.setTimeout(() => {
            if (!cancelled) void fetchCatalog();
          }, 10_000);
        }
      } catch {
        if (!cancelled) setCatalogSummary(null);
      }
    };

    void fetchCatalog();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const response = (await trpc.downloadHistory.getPublicTopDownloads.query({
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

    (async () => {
      try {
        const body = { where: { activated: 1 } };
        const fetched = (await trpc.plans.findManyPlans.query(body)) as unknown;
        const asArray = Array.isArray(fetched) ? (fetched as IPlans[]) : [];
        if (!cancelled) setPlans(asArray);
      } catch {
        if (!cancelled) setPlans([]);
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

  const ctaPrimaryLabel = useMemo(() => getHomeCtaPrimaryLabel(trialSummary), [trialSummary]);
  const footerMicrocopy = useMemo(() => {
    return trialSummary?.enabled ? HOME_HERO_MICROCOPY_TRIAL : HOME_HERO_MICROCOPY_BASE;
  }, [trialSummary?.enabled]);

  const pricingPlans = useMemo(() => {
    const bestMxn = pickBestPlan(plans, "mxn");
    const bestUsd = pickBestPlan(plans, "usd");

    return {
      mxn: bestMxn ? toPricingPlan(bestMxn, "mxn") : null,
      usd: bestUsd ? toPricingPlan(bestUsd, "usd") : null,
    } as { mxn: PricingPlan | null; usd: PricingPlan | null };
  }, [plans]);

  const downloadQuotaGb = useMemo(() => {
    const fromPlans = pricingPlans.mxn?.gigas ?? pricingPlans.usd?.gigas;
    return Number.isFinite(fromPlans) && (fromPlans ?? 0) > 0 ? Number(fromPlans) : 500;
  }, [pricingPlans.mxn?.gigas, pricingPlans.usd?.gigas]);

  const downloadQuotaLabel = `${formatInt(downloadQuotaGb)} GB/mes`;

  const hasLiveCatalog = Boolean(
    catalogSummary &&
      !catalogSummary.error &&
      Number(catalogSummary.totalFiles ?? 0) > 0 &&
      Number(catalogSummary.totalGB ?? 0) > 0,
  );

  const effectiveTotalFiles = hasLiveCatalog
    ? Number(catalogSummary?.totalFiles ?? 0)
    : FALLBACK_TOTAL_FILES;
  const effectiveTotalGB = hasLiveCatalog ? Number(catalogSummary?.totalGB ?? 0) : FALLBACK_TOTAL_GB;
  const effectiveTotalTB = effectiveTotalGB / 1000;

  const totalTBLabel = formatTB(effectiveTotalTB);
  const totalFilesLabel = formatInt(effectiveTotalFiles);

  const catalogGenres = useMemo<CatalogGenre[]>(() => {
    const source =
      hasLiveCatalog && catalogSummary && Array.isArray(catalogSummary.genresDetail) && catalogSummary.genresDetail.length > 0
        ? catalogSummary.genresDetail
        : FALLBACK_GENRES;

    return source.map((g) => ({
      id: g.name,
      name: normalizeGenreDisplayName(g.name),
      searchKey: normalizeSearchKey(normalizeGenreDisplayName(g.name)),
      files: Number(g.files ?? 0),
      gb: Number(g.gb ?? 0),
    }));
  }, [catalogSummary, hasLiveCatalog]);

  const socialAudio = useMemo(() => {
    const items = topDownloads?.audio ?? [];
    return items
      .filter((item) => item && typeof item.name === "string")
      .slice(0, 20)
      .map((item) => ({
        name: prettyMediaName(item.name) || item.name,
        downloads: Number(item.downloads ?? 0),
      }));
  }, [topDownloads]);

  const socialVideo = useMemo(() => {
    const items = topDownloads?.video ?? [];
    return items
      .filter((item) => item && typeof item.name === "string")
      .slice(0, 20)
      .map((item) => ({
        name: prettyMediaName(item.name) || item.name,
        downloads: Number(item.downloads ?? 0),
      }));
  }, [topDownloads]);

  const socialKaraoke = useMemo(() => {
    const items = topDownloads?.karaoke ?? [];
    return items
      .filter((item) => item && typeof item.name === "string")
      .slice(0, 20)
      .map((item) => ({
        name: prettyMediaName(item.name) || item.name,
        downloads: Number(item.downloads ?? 0),
      }));
  }, [topDownloads]);

  const onPrimaryCtaClick = useCallback(
    (location: "hero" | "mid" | "pricing" | "footer" | "sticky") => {
      trackGrowthMetric(GROWTH_METRICS.CTA_PRIMARY_CLICK, { location });
      trackGrowthMetric(GROWTH_METRICS.CTA_CLICK, { id: "home_primary", location });
      trackManyChatConversion(MC_EVENTS.CLICK_CTA_REGISTER);
    },
    [],
  );

  const onSecondaryCtaClick = useCallback(
    (location: "demo" | "top_downloads" | "modal_demo") => {
      trackGrowthMetric(GROWTH_METRICS.CTA_SECONDARY_CLICK, { location });
      trackGrowthMetric(GROWTH_METRICS.CTA_CLICK, { id: `home_secondary_${location}`, location });
    },
    [],
  );

  const onDemoClick = useCallback(() => {
    trackGrowthMetric(GROWTH_METRICS.VIEW_DEMO_CLICK, { location: "hero_block" });
    setShowDemo(true);
  }, []);

  useEffect(() => {
    if (!showDemo) return;
    // Track that the user actually viewed the demo modal (separate from the click source).
    trackGrowthMetric(GROWTH_METRICS.VIEW_DEMO_CLICK, { location: "modal" });
  }, [showDemo]);

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
        trackGrowthMetric(GROWTH_METRICS.PRICING_VIEW, { currencyDefault: preferredCurrency });
        observer.disconnect();
      },
      { threshold: 0.25 },
    );

    observer.observe(el);

    return () => observer.disconnect();
  }, [preferredCurrency]);

  return (
    <div className="public-home">
      <header className="home-topnav" aria-label="Navegación">
        <div className="ph__container home-topnav__inner">
          <Link to="/" className="home-topnav__brand" aria-label="Bear Beat">
            <img src={Logo} alt="Bear Beat" />
          </Link>
          <nav className="home-topnav__nav" aria-label="Links">
            <Link to="/planes" className="home-topnav__link">
              Planes
            </Link>
            <Link to="/legal" className="home-topnav__link">
              FAQ
            </Link>
            <Link to="/auth" className="home-topnav__link">
              Iniciar sesión
            </Link>
          </nav>
        </div>
      </header>

      <div className="home-main" aria-label="Landing">
        <HomeHero
          totalTBLabel={totalTBLabel}
          downloadQuotaLabel={downloadQuotaLabel}
          trial={trialSummary}
          ctaLabel={ctaPrimaryLabel}
          onPrimaryCtaClick={() => onPrimaryCtaClick("hero")}
          onDemoClick={onDemoClick}
        />

        <TrustBar
          totalFilesLabel={totalFilesLabel}
          totalTBLabel={totalTBLabel}
          downloadQuotaLabel={downloadQuotaLabel}
        />

        <UseCases />

        <CatalogDemo
          genres={catalogGenres}
          isFallback={!hasLiveCatalog}
          onSecondaryCtaClick={() => onSecondaryCtaClick("demo")}
        />

        <HumanSocialProof />

        <SocialProof
          audio={socialAudio}
          video={socialVideo}
          karaoke={socialKaraoke}
          onMoreClick={() => onSecondaryCtaClick("top_downloads")}
        />

        <Compatibility />

        <ActivationSteps ctaLabel={ctaPrimaryLabel} onPrimaryCtaClick={() => onPrimaryCtaClick("mid")} />

        <div ref={pricingRef}>
          <Pricing
            plans={pricingPlans}
            defaultCurrency={preferredCurrency}
            numberLocale={HOME_NUMBER_LOCALE}
            catalogTBLabel={totalTBLabel}
            downloadQuotaGb={downloadQuotaGb}
            trial={trialSummary}
            ctaLabel={ctaPrimaryLabel}
            onPrimaryCtaClick={() => onPrimaryCtaClick("pricing")}
          />
        </div>

        <HomeFaq onFaqExpand={onFaqExpand} />
      </div>

      <footer className="home-footer" aria-label="Footer">
        <div className="ph__container home-footer__inner">
          <div className="home-footer__brand">
            <img src={Logo} alt="Bear Beat" />
            <p>Catálogo grande, descargas mensuales claras y activación guiada.</p>
          </div>

          <div className="home-footer__links" aria-label="Enlaces">
            <Link to="/planes">Planes</Link>
            <Link to="/legal">FAQ y Políticas</Link>
            <Link to="/auth">Iniciar sesión</Link>
          </div>

          <div className="home-footer__cta" aria-label="Activar">
            <Link
              to="/auth/registro"
              state={{ from: "/planes" }}
              className="home-cta home-cta--primary"
              onClick={() => onPrimaryCtaClick("footer")}
            >
              {ctaPrimaryLabel}
            </Link>
            <p className="home-footer__micro">{footerMicrocopy}</p>
          </div>

          <p className="home-footer__copy">© Bear Beat. Todos los derechos reservados.</p>
        </div>
      </footer>

      <HomeDemoModal
        show={showDemo}
        onHide={() => setShowDemo(false)}
        ctaLabel={ctaPrimaryLabel}
        onModalCtaClick={() => onSecondaryCtaClick("modal_demo")}
      />

      <StickyMobileCta
        ctaLabel={ctaPrimaryLabel}
        onPrimaryCtaClick={() => onPrimaryCtaClick("sticky")}
      />
    </div>
  );
}
