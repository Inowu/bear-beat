import { Link, useLocation } from "react-router-dom";
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
import HowItWorks from "./sections/HowItWorks";
import InsidePreview from "./sections/InsidePreview";
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
  audio: Array<{ path: string; name: string; downloads: number }>;
  video: Array<{ path: string; name: string; downloads: number }>;
  karaoke: Array<{ path: string; name: string; downloads: number }>;
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

function formatMonthlyCurrencyHint(amount: number | null | undefined, currency: "mxn" | "usd"): string {
  const fallback = currency === "mxn" ? 350 : 18;
  const code = currency === "mxn" ? "MXN" : "USD";
  const value = Number(amount ?? 0);
  const effective = Number.isFinite(value) && value > 0 ? value : fallback;
  const hasDecimals = Math.round(effective) !== effective;
  const formatted = hasDecimals ? effective.toFixed(2) : `${effective}`;
  return `${code} $${formatted}`;
}

function formatMonthlyDualHint(mxnAmount: number | null | undefined, usdAmount: number | null | undefined): string {
  const mxn = formatMonthlyCurrencyHint(mxnAmount, "mxn");
  const usd = formatMonthlyCurrencyHint(usdAmount, "usd");
  return `${mxn}/mes (${usd})`;
}

export default function PublicHome() {
  const location = useLocation();
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
    if (trialSummary?.enabled) {
      // Mantén el detalle de la prueba arriba (hero/pricing) y deja el footer en modo "micro".
      return `Pago seguro (Stripe) • ${HOME_HERO_MICROCOPY_TRIAL}`;
    }
    return HOME_HERO_MICROCOPY_BASE;
  }, [trialSummary?.enabled]);

  const pricingPlans = useMemo(() => {
    const bestMxn = pickBestPlan(plans, "mxn");
    const bestUsd = pickBestPlan(plans, "usd");

    return {
      mxn: bestMxn ? toPricingPlan(bestMxn, "mxn") : null,
      usd: bestUsd ? toPricingPlan(bestUsd, "usd") : null,
    } as { mxn: PricingPlan | null; usd: PricingPlan | null };
  }, [plans]);

  const afterPriceLabel = useMemo(() => {
    return formatMonthlyDualHint(pricingPlans.mxn?.price, pricingPlans.usd?.price);
  }, [pricingPlans.mxn?.price, pricingPlans.usd?.price]);

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
      .filter((item) => item && typeof item.name === "string" && typeof item.path === "string")
      .map((item) => ({
        path: item.path,
        name: prettyMediaName(item.name) || item.name,
        downloads: Number(item.downloads ?? 0),
      }));
  }, [topDownloads]);

  const socialVideo = useMemo(() => {
    const items = topDownloads?.video ?? [];
    return items
      .filter((item) => item && typeof item.name === "string" && typeof item.path === "string")
      .map((item) => ({
        path: item.path,
        name: prettyMediaName(item.name) || item.name,
        downloads: Number(item.downloads ?? 0),
      }));
  }, [topDownloads]);

  const socialKaraoke = useMemo(() => {
    const items = topDownloads?.karaoke ?? [];
    return items
      .filter((item) => item && typeof item.name === "string" && typeof item.path === "string")
      .map((item) => ({
        path: item.path,
        name: prettyMediaName(item.name) || item.name,
        downloads: Number(item.downloads ?? 0),
      }));
  }, [topDownloads]);

  const onPrimaryCtaClick = useCallback(
    (location: "hero" | "mid" | "pricing" | "footer" | "sticky" | "nav") => {
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
    (getTarget: () => HTMLElement | null, options: ScrollAlignmentOptions = {}) => {
      if (typeof window === "undefined") return;

      const token = (scrollAlignmentTokenRef.current += 1);
      const maxDurationMs = Math.max(250, options.maxDurationMs ?? 5200);
      const thresholdPx = Math.max(0, options.thresholdPx ?? 22);
      const start = window.performance?.now ? window.performance.now() : Date.now();

      let lastY = window.scrollY;
      let lastDelta = Number.NaN;
      let stableScroll = 0;
      let stableDelta = 0;

      const tick = () => {
        if (scrollAlignmentTokenRef.current !== token) return;

        const now = window.performance?.now ? window.performance.now() : Date.now();
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

        if (Number.isFinite(lastDelta) && Math.abs(delta - lastDelta) < 1) stableDelta += 1;
        else stableDelta = 0;
        lastDelta = delta;

        // We're stable and aligned.
        if (stableScroll >= 10 && stableDelta >= 10 && Math.abs(delta) <= thresholdPx) {
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
            window.scrollTo({ top: Math.max(0, window.scrollY + delta), behavior: "auto" });
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

      const scrollToTarget = (element: HTMLElement | null, behavior: ScrollBehavior = "smooth") => {
        if (!element) return;
        const top = Math.max(0, window.scrollY + element.getBoundingClientRect().top - getHomeStickyTopOffset());
        window.scrollTo({
          top,
          behavior,
        });
      };

      const fallbackDemoSection = document.getElementById("demo");
      const section =
        findSectionByIds([
          "top100",
          "top-audios",
          "top-videos",
          "top-karaokes",
          "catalogo",
          "demo",
        ]) ?? fallbackDemoSection;

      const getFinalTarget = () => (document.getElementById("top100") as HTMLElement | null) ?? section;

      if (section) {
        scrollToTarget(section, options.behavior ?? "smooth");
        alignScrollToTarget(getFinalTarget, {
          // Mobile: content-visibility and images can change section height while/after we scroll.
          // Keep correcting until the anchor is actually aligned (or we time out).
          maxDurationMs: options.behavior === "auto" ? 4200 : 5600,
        });
      }
      window.history.replaceState(null, "", "#top100");
      if (options.focusSearch) {
        // Avoid opening the keyboard; focus the first demo play button when the user explicitly clicks "Ver demo".
        window.setTimeout(() => {
          const play = document.querySelector("[data-testid='home-topdemo-play']") as HTMLButtonElement | null;
          if (play) {
            play.focus({ preventScroll: true });
            return;
          }
          const jump = document.querySelector(".social-proof__jump-link") as HTMLAnchorElement | null;
          jump?.focus({ preventScroll: true });
        }, 0);
      }
    },
    [alignScrollToTarget, findSectionByIds, getHomeStickyTopOffset],
  );

  const scrollToFaq = useCallback(
    (options: { behavior?: ScrollBehavior } = {}) => {
      if (typeof window === "undefined") return;

      const getFaqTarget = () => document.getElementById("faq") as HTMLElement | null;

      const target = getFaqTarget();
      if (!target) return;

      const top = Math.max(0, window.scrollY + target.getBoundingClientRect().top - getHomeStickyTopOffset());
      window.scrollTo({ top, behavior: options.behavior ?? "smooth" });
      window.history.replaceState(null, "", "#faq");

      alignScrollToTarget(getFaqTarget, {
        maxDurationMs: options.behavior === "auto" ? 4200 : 5600,
        onDone: () => {
          const finalTarget = getFaqTarget();
          if (!finalTarget) return;

          const first = finalTarget.querySelector<HTMLElement>(".home-faq__summary");
          const title = finalTarget.querySelector<HTMLElement>("h2");
          if (first && first.getAttribute("aria-expanded") === "false") {
            first.click();
          }
          title?.focus({ preventScroll: true });

          // Expanding can shift the heading slightly; do a short realign pass.
          alignScrollToTarget(getFaqTarget, { maxDurationMs: 1100 });
        },
      });
    },
    [alignScrollToTarget, getHomeStickyTopOffset],
  );

  const onDemoScroll = useCallback(() => {
    trackGrowthMetric(GROWTH_METRICS.VIEW_DEMO_CLICK, { location: "hero_block" });
    scrollToDemo({ behavior: "smooth", focusSearch: true });
  }, [scrollToDemo]);

  const onTourClick = useCallback(() => {
    trackGrowthMetric(GROWTH_METRICS.VIEW_DEMO_CLICK, { location: "hero_modal" });
    setShowDemo(true);
  }, []);

  useEffect(() => {
    if (!showDemo) return;
    // Track that the user actually viewed the demo modal (separate from the click source).
    trackGrowthMetric(GROWTH_METRICS.VIEW_DEMO_CLICK, { location: "modal" });
  }, [showDemo]);

  useEffect(() => {
    if (
      location.hash === "#demo" ||
      location.hash === "#top100" ||
      location.hash === "#top-audios" ||
      location.hash === "#top-videos" ||
      location.hash === "#top-karaokes"
    ) {
      scrollToDemo({ behavior: "auto", focusSearch: false });
      return;
    }
    if (location.hash === "#faq") {
      scrollToFaq({ behavior: "auto" });
    }
  }, [location.hash, scrollToDemo, scrollToFaq]);

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

  useEffect(() => {
    if (typeof document === "undefined") return;

    const offers: Array<{ "@type": "Offer"; priceCurrency: string; price: number; url: string; availability: string }> =
      [];

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

    const existing = document.querySelector("script[data-schema='bb-product']") as HTMLScriptElement | null;
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
    <div className="public-home">
      <a className="home-skip" href="#home-main">
        Saltar al contenido
      </a>
      <header className="home-topnav" aria-label="Navegación">
        <div className="ph__container home-topnav__inner">
          <Link to="/" className="home-topnav__brand" aria-label="Bear Beat" aria-current="page">
            <img src={Logo} alt="Bear Beat" width={40} height={40} />
          </Link>
          <div className="home-topnav__right" aria-label="Acciones">
            <nav className="home-topnav__nav" aria-label="Links">
              <Link to="/planes" className="home-topnav__link">
                Planes
              </Link>
              <Link to="/auth" className="home-topnav__link">
                Iniciar sesión
              </Link>
            </nav>
            <Link
              to="/auth/registro"
              state={{ from: "/planes" }}
              className="home-cta home-cta--primary home-topnav__cta"
              data-testid="home-nav-primary-cta"
              onClick={() => onPrimaryCtaClick("nav")}
            >
              {ctaPrimaryLabel}
            </Link>
          </div>
        </div>
      </header>

      <div id="home-main" className="home-main">
        <HomeHero
          totalTBLabel={totalTBLabel}
          downloadQuotaLabel={downloadQuotaLabel}
          afterPriceLabel={afterPriceLabel}
          trial={trialSummary}
          ctaLabel={ctaPrimaryLabel}
          onPrimaryCtaClick={() => onPrimaryCtaClick("hero")}
          onDemoScroll={onDemoScroll}
        />

        <HowItWorks trial={trialSummary} />

        <InsidePreview onDemoScroll={onDemoScroll} onTourClick={onTourClick} />

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

        <Compatibility onFaqScroll={scrollToFaq} />

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
            <img src={Logo} alt="Bear Beat" width={46} height={46} />
            <p>Catálogo grande, descargas mensuales claras y activación guiada.</p>
          </div>

          <div className="home-footer__links" aria-label="Enlaces">
            <Link to="/planes">Planes</Link>
            <Link to="/auth">Iniciar sesión</Link>
          </div>

          <div className="home-footer__cta" aria-label="Activar">
            <Link
              to="/auth/registro"
              state={{ from: "/planes" }}
              className="home-cta home-cta--primary"
              data-testid="home-footer-primary-cta"
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
        trial={trialSummary}
        onPrimaryCtaClick={() => onPrimaryCtaClick("sticky")}
      />
    </div>
  );
}
