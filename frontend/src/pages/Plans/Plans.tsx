import "./Plans.scss";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import trpc from "../../api";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { trackManyChatConversion, MC_EVENTS } from "../../utils/manychatPixel";
import { AlertTriangle, Check, Layers3, RefreshCw } from "src/icons";
import { formatInt } from "../../utils/format";
import PaymentMethodLogos, {
  type PaymentMethodId,
} from "../../components/PaymentMethodLogos/PaymentMethodLogos";
import { GROWTH_METRICS, trackGrowthMetric } from "../../utils/growthMetrics";
import { useUserContext } from "../../contexts/UserContext";
import { useTheme } from "../../contexts/ThemeContext";
import PlansStickyCta from "./PlansStickyCta";
import { Button } from "src/components/ui";
import { buildMarketingVariables } from "../../utils/marketingSnapshot";

type CurrencyKey = "mxn" | "usd";
type PlansEntry = "fastlane" | "compare";
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
const DAYS_PER_MONTH_FOR_DAILY_PRICE = 30;

type PublicBestPlan = {
  planId: number;
  currency: CurrencyKey;
  name: string;
  price: number;
  gigas: number;
  hasPaypal: boolean;
  paymentMethods: PaymentMethodId[];
};

type PublicPricingUi = {
  defaultCurrency: CurrencyKey;
  limitsNote: string;
  stats: {
    totalFiles: number;
    totalGenres: number;
    karaokes: number;
    totalTB: number;
    quotaGb: {
      mxn: number;
      usd: number;
    };
    quotaGbDefault: number;
  };
};

type PublicTrialConfig = {
  enabled: boolean;
  days: number;
  gb: number;
  eligible?: boolean | null;
};

function toNumber(value: unknown): number {
  if (typeof value === "bigint") return Number(value);
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
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

function resolvePreferredCurrency(
  preferred: CurrencyKey,
  plans: { mxn: PublicBestPlan | null; usd: PublicBestPlan | null },
): CurrencyKey {
  if (preferred === "mxn" && plans.mxn) return "mxn";
  if (preferred === "usd" && plans.usd) return "usd";
  return plans.mxn ? "mxn" : "usd";
}

function formatMoneyFixed(value: unknown, locale: string): string {
  const amount = toNumber(value);
  if (!Number.isFinite(amount) || amount <= 0) return "—";
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

function formatMonthlyPriceWithCode(
  amount: number,
  currency: CurrencyKey,
  locale: string,
): string {
  const safeAmount = toNumber(amount);
  const code = currency.toUpperCase();
  if (!Number.isFinite(safeAmount) || safeAmount <= 0) return `${code} $0/mes`;
  const hasDecimals = !Number.isInteger(safeAmount);
  const formatted = new Intl.NumberFormat(locale, {
    minimumFractionDigits: hasDecimals ? 2 : 0,
    maximumFractionDigits: 2,
  }).format(safeAmount);
  return `${code} $${formatted}/mes`;
}

function getDailyPrice(monthlyPrice: number): number {
  const safe = toNumber(monthlyPrice);
  if (!Number.isFinite(safe) || safe <= 0) return 0;
  const rawDaily = safe / DAYS_PER_MONTH_FOR_DAILY_PRICE;
  return Math.floor(rawDaily * 10) / 10;
}

function parsePlansEntry(value: string | null): PlansEntry | null {
  if (!value) return null;
  const normalized = value.trim().toLowerCase();
  if (normalized === "fastlane" || normalized === "compare") return normalized;
  return null;
}

function Plans() {
  const { currentUser, userToken } = useUserContext();
  const { theme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const checkoutPrefetchedRef = useRef(false);
  const compareTrackedRef = useRef(false);
  const entry = useMemo(
    () => parsePlansEntry(new URLSearchParams(location.search).get("entry")),
    [location.search],
  );
  const isFastlaneEntry = entry === "fastlane";

  const [plansByCurrency, setPlansByCurrency] = useState<{
    mxn: PublicBestPlan | null;
    usd: PublicBestPlan | null;
  }>({
    mxn: null,
    usd: null,
  });
  const [pricingUi, setPricingUi] = useState<PublicPricingUi>({
    defaultCurrency: "mxn",
    limitsNote: DEFAULT_LIMITS_NOTE,
    stats: {
      totalFiles: 0,
      totalGenres: 0,
      karaokes: 0,
      totalTB: 0,
      quotaGb: { mxn: 500, usd: 500 },
      quotaGbDefault: 500,
    },
  });
  const [trialConfig, setTrialConfig] = useState<PublicTrialConfig | null>(
    null,
  );

  const [loader, setLoader] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<string>("");
  const [selectedCurrency, setSelectedCurrency] = useState<CurrencyKey>("mxn");
  const viewTrackedRef = useRef(false);

  const getPlans = useCallback(async () => {
    setLoadError("");
    setLoader(true);
    try {
      const result: any = await trpc.plans.getPublicPricingConfig.query();
      const toPlan = (
        raw: any,
        currency: CurrencyKey,
      ): PublicBestPlan | null => {
        if (!raw || typeof raw !== "object") return null;
        const planId = Math.trunc(toNumber(raw.planId));
        if (!Number.isFinite(planId) || planId <= 0) return null;
        const paymentFallback: PaymentMethodId[] =
          currency === "mxn"
            ? ["visa", "mastercard", "spei"]
            : ["visa", "mastercard"];

        return {
          planId,
          currency,
          name: String(raw.name ?? "").trim() || "Membresía Bear Beat",
          price: toNumber(raw.price),
          gigas: toNumber(raw.gigas),
          hasPaypal: Boolean(raw.hasPaypal),
          paymentMethods: parsePaymentMethods(
            raw.paymentMethods,
            paymentFallback,
          ),
        };
      };

      const nextPlans = {
        mxn: toPlan(result?.plans?.mxn, "mxn"),
        usd: toPlan(result?.plans?.usd, "usd"),
      };
      const marketingVariables = buildMarketingVariables({
        pricingConfig: result,
      });
      const trialRaw =
        result?.trialConfig && typeof result.trialConfig === "object"
          ? result.trialConfig
          : null;
      const nextTrialConfig: PublicTrialConfig | null = trialRaw
        ? {
            enabled: Boolean(trialRaw.enabled),
            days: Math.max(0, Math.trunc(marketingVariables.TRIAL_DAYS)),
            gb: Math.max(0, Math.trunc(marketingVariables.TRIAL_GB)),
            eligible: marketingVariables.TRIAL_ELIGIBLE,
          }
        : null;

      const defaultCurrencyRaw = String(
        result?.ui?.defaultCurrency ?? result?.currencyDefault ?? "mxn",
      )
        .trim()
        .toLowerCase();
      const defaultCurrency: CurrencyKey =
        defaultCurrencyRaw === "usd" ? "usd" : "mxn";
      const totalFiles = Math.max(0, Math.trunc(marketingVariables.TOTAL_FILES));
      const totalGenres = Math.max(
        0,
        Math.trunc(marketingVariables.TOTAL_GENRES),
      );
      const karaokes = Math.max(0, Math.trunc(marketingVariables.TOTAL_KARAOKE));
      const totalTB = Math.max(0, toNumber(marketingVariables.TOTAL_TB));
      const quotaMxn = Math.max(
        0,
        Math.trunc(
          toNumber(result?.ui?.stats?.quotaGb?.mxn ?? result?.quotaGb?.mxn),
        ),
      );
      const quotaUsd = Math.max(
        0,
        Math.trunc(
          toNumber(result?.ui?.stats?.quotaGb?.usd ?? result?.quotaGb?.usd),
        ),
      );
      const quotaDefaultRaw = Math.max(
        0,
        Math.trunc(
          toNumber(
            result?.ui?.stats?.quotaGbDefault ?? marketingVariables.MONTHLY_GB,
          ),
        ),
      );
      const quotaDefaultFromPlans =
        defaultCurrency === "mxn"
          ? Math.trunc(toNumber(nextPlans.mxn?.gigas))
          : Math.trunc(toNumber(nextPlans.usd?.gigas));
      const quotaGbDefault =
        quotaDefaultRaw > 0
          ? quotaDefaultRaw
          : quotaDefaultFromPlans > 0
            ? quotaDefaultFromPlans
            : 500;
      const limitsNoteRaw =
        typeof result?.ui?.limitsNote === "string"
          ? result.ui.limitsNote.trim()
          : "";
      const limitsNote = limitsNoteRaw
        ? limitsNoteRaw.replace(/cuota mensual/gi, "cuota de descarga")
        : DEFAULT_LIMITS_NOTE;

      setPlansByCurrency(nextPlans);
      setPricingUi({
        defaultCurrency,
        limitsNote,
        stats: {
          totalFiles,
          totalGenres,
          karaokes,
          totalTB,
          quotaGb: {
            mxn:
              quotaMxn > 0
                ? quotaMxn
                : Math.max(500, Math.trunc(toNumber(nextPlans.mxn?.gigas))),
            usd:
              quotaUsd > 0
                ? quotaUsd
                : Math.max(500, Math.trunc(toNumber(nextPlans.usd?.gigas))),
          },
          quotaGbDefault,
        },
      });
      setTrialConfig(nextTrialConfig);
      setSelectedCurrency(resolvePreferredCurrency(defaultCurrency, nextPlans));
    } catch {
      setLoadError(
        "No pudimos cargar los planes en este momento. Intenta nuevamente.",
      );
      setPlansByCurrency({ mxn: null, usd: null });
      setTrialConfig(null);
    } finally {
      setLoader(false);
    }
  }, []);

  useEffect(() => {
    void getPlans();
  }, [getPlans]);

  useEffect(() => {
    // Evitar doble membresía: si ya tiene acceso activo (aunque haya cancelado la renovación),
    // empujar a /micuenta para recargar GB extra desde ahí.
    if (currentUser?.hasActiveSubscription) {
      navigate("/micuenta", { replace: true });
    }
  }, [currentUser, navigate]);

  useEffect(() => {
    if (
      selectedCurrency === "mxn" &&
      !plansByCurrency.mxn &&
      plansByCurrency.usd
    ) {
      setSelectedCurrency("usd");
      return;
    }
    if (
      selectedCurrency === "usd" &&
      !plansByCurrency.usd &&
      plansByCurrency.mxn
    ) {
      setSelectedCurrency("mxn");
    }
  }, [plansByCurrency.mxn, plansByCurrency.usd, selectedCurrency]);

  useEffect(() => {
    if (viewTrackedRef.current) return;
    if (!plansByCurrency.mxn && !plansByCurrency.usd) return;
    viewTrackedRef.current = true;
    trackManyChatConversion(MC_EVENTS.VIEW_PLANS);
    trackGrowthMetric(GROWTH_METRICS.PRICING_VIEW, {
      currencyDefault: pricingUi.defaultCurrency,
    });
  }, [plansByCurrency.mxn, plansByCurrency.usd, pricingUi.defaultCurrency]);

  useEffect(() => {
    if (entry !== "compare" || compareTrackedRef.current) return;
    compareTrackedRef.current = true;
    trackGrowthMetric(GROWTH_METRICS.PLANS_COMPARE_CLICK, {
      source: "plans_view",
      entry,
    });
  }, [entry]);

  const selectedPlan = useMemo(() => {
    return selectedCurrency === "mxn"
      ? plansByCurrency.mxn
      : plansByCurrency.usd;
  }, [plansByCurrency.mxn, plansByCurrency.usd, selectedCurrency]);

  const stats = useMemo(() => {
    const totalFiles = pricingUi.stats.totalFiles;
    const totalGenres = pricingUi.stats.totalGenres;
    const karaokes = pricingUi.stats.karaokes;
    const quotaFromUi =
      selectedCurrency === "mxn"
        ? pricingUi.stats.quotaGb.mxn
        : pricingUi.stats.quotaGb.usd;
    const quotaFromPlan = Math.trunc(toNumber(selectedPlan?.gigas));
    const quotaGb =
      quotaFromUi > 0
        ? quotaFromUi
        : quotaFromPlan > 0
          ? quotaFromPlan
          : pricingUi.stats.quotaGbDefault > 0
            ? pricingUi.stats.quotaGbDefault
            : 500;

    return {
      totalFiles,
      totalGenres,
      karaokes,
      quotaGb,
    };
  }, [pricingUi.stats, selectedCurrency, selectedPlan?.gigas]);

  const selectedMonthlyLabel = useMemo(() => {
    if (!selectedPlan) return `${selectedCurrency.toUpperCase()} $0/mes`;
    const locale = selectedCurrency === "usd" ? "en-US" : "es-MX";
    return formatMonthlyPriceWithCode(selectedPlan.price, selectedCurrency, locale);
  }, [selectedCurrency, selectedPlan]);

  const selectedDailyLabel = useMemo(() => {
    if (!selectedPlan) return null;
    const monthly = toNumber(selectedPlan.price);
    if (!Number.isFinite(monthly) || monthly <= 0) return null;
    const daily = getDailyPrice(monthly);
    if (!Number.isFinite(daily) || daily <= 0) return null;
    const locale = selectedCurrency === "usd" ? "en-US" : "es-MX";
    const code = selectedCurrency.toUpperCase();
    return `$${formatMoneyFixed(daily, locale)} ${code} al día`;
  }, [selectedCurrency, selectedPlan]);

  const paymentMethods = useMemo(() => {
    if (selectedPlan?.paymentMethods?.length)
      return selectedPlan.paymentMethods;
    return selectedCurrency === "mxn"
      ? (["visa", "mastercard", "spei"] as PaymentMethodId[])
      : (["visa", "mastercard"] as PaymentMethodId[]);
  }, [selectedCurrency, selectedPlan?.paymentMethods]);

  const hasBothCurrencies = Boolean(plansByCurrency.mxn && plansByCurrency.usd);

  const trialPreview = useMemo(() => {
    const trialEnabled =
      Boolean(trialConfig?.enabled) && trialConfig?.eligible !== false;
    const trialDays = Math.max(0, Math.trunc(toNumber(trialConfig?.days)));
    const trialGb = Math.max(0, Math.trunc(toNumber(trialConfig?.gb)));
    const applies = trialEnabled && trialDays > 0 && trialGb > 0;

    return {
      applies,
      trialDays,
      trialGb,
    };
  }, [trialConfig]);

  const totalFilesLabel =
    stats.totalFiles > 0 ? formatInt(stats.totalFiles) : "N/D";
  const totalGenresLabel =
    stats.totalGenres > 0 ? `${formatInt(stats.totalGenres)}+` : "N/D";
  const karaokesLabel = stats.karaokes > 0 ? formatInt(stats.karaokes) : "N/D";
  const benefits = useMemo(
    () => [
      `${totalFilesLabel} archivos listos (audios, videos, karaokes)`,
      `${formatInt(stats.quotaGb)} GB de descarga cada mes`,
      `${totalGenresLabel} géneros latinos organizados por carpetas`,
      `${karaokesLabel} karaokes de la A a la Z`,
      "BPM + Key incluidos en cada archivo",
      "Actualizaciones semanales + activación guiada",
    ],
    [karaokesLabel, stats.quotaGb, totalFilesLabel, totalGenresLabel],
  );

  const primaryCtaLabel = trialPreview.applies
    ? "Activar 7 días gratis"
    : "CONTINUAR AL PAGO SEGURO";

  const isAuthenticated = Boolean(userToken || currentUser);
  const trustCopy = "Sin contratos. Puedes cancelar cuando quieras desde tu cuenta.";

  const selectCurrency = (next: CurrencyKey) => {
    if (next === selectedCurrency) return;
    setSelectedCurrency(next);
    trackGrowthMetric(GROWTH_METRICS.SEGMENT_SELECTED, {
      id: "plans_currency",
      value: next,
    });
  };

  const handleActivate = useCallback(() => {
    if (!selectedPlan) return;
    const checkoutEntry: PlansEntry = entry === "fastlane" ? "fastlane" : "compare";

    trackManyChatConversion(MC_EVENTS.SELECT_PLAN);
    trackManyChatConversion(MC_EVENTS.CLICK_BUY);
    void trpc.checkoutLogs.registerCheckoutLog.mutate().catch(() => {});

    trackGrowthMetric(GROWTH_METRICS.CTA_CLICK, {
      id: "plans_primary_checkout",
      location: "plans",
      planId: selectedPlan.planId,
      currency: selectedCurrency.toUpperCase(),
      amount: toNumber(selectedPlan.price) || null,
      entry: checkoutEntry,
    });
    if (checkoutEntry === "compare") {
      trackGrowthMetric(GROWTH_METRICS.PLANS_COMPARE_CLICK, {
        source: "plans_activate",
        planId: selectedPlan.planId,
        currency: selectedCurrency.toUpperCase(),
      });
    }

    navigate(`/comprar?priceId=${selectedPlan.planId}&entry=${checkoutEntry}`);
  }, [entry, navigate, selectedCurrency, selectedPlan]);

  const prefetchCheckout = useCallback(() => {
    if (checkoutPrefetchedRef.current) return;
    checkoutPrefetchedRef.current = true;

    try {
      const connection = (navigator as any)?.connection;
      if (connection?.saveData) return;
      const effectiveType =
        typeof connection?.effectiveType === "string"
          ? connection.effectiveType
          : "";
      if (/2g/i.test(effectiveType)) return;
    } catch {
      // noop
    }

    void import("../Checkout/Checkout");
  }, []);

  return (
    <div
      className={[
        "plans2026",
        `plans2026--${theme}`,
        "bb-marketing-page",
        "bb-marketing-page--flat-cards",
      ].join(" ")}
    >
      <section className="plans2026__main" aria-label="Planes y precios">
        <div className="plans2026__container bb-marketing-container--narrow">
          <header className="plans2026__hero" data-testid="plans-hero">
            <p className="plans2026__kicker">
              Un plan. Todo incluido.
            </p>
            <h1>Activa tu prueba gratis hoy.</h1>
            <p className="plans2026__subtitle">
              {isFastlaneEntry
                ? "Ya estás a un paso: elige moneda y termina tu pago seguro."
                : "Elige moneda, confirma pago seguro y empieza a descargar en minutos."}
            </p>
          </header>

          {loader ? (
            <section
              className="plans2026__card bb-hero-card plans2026__card--skeleton"
              aria-label="Actualizando plan"
              role="status"
              aria-live="polite"
              aria-busy="true"
            >
              <span className="sr-only">Actualizando tu mejor opción</span>

              <div className="plans2026__card-head" aria-hidden>
                <span className="plans2026__sk plans2026__sk--pill" />
              </div>

              <div className="plans2026__price" aria-hidden>
                <span className="plans2026__sk plans2026__sk--price" />
                <span className="plans2026__sk plans2026__sk--suffix" />
              </div>

              <ul className="plans2026__benefits" aria-hidden>
                {Array.from({ length: 7 }).map((_, i) => (
                  <li key={i} className="plans2026__benefit">
                    <span className="plans2026__sk plans2026__sk--benefitIcon" />
                    <span className="plans2026__sk plans2026__sk--benefitLine" />
                  </li>
                ))}
              </ul>

              <div className="plans2026__actions" aria-hidden>
                <span className="plans2026__sk plans2026__sk--cta" />
              </div>
            </section>
          ) : loadError ? (
            <section className="plans2026__state">
              <div className="app-state-panel is-error" role="alert">
                <span className="app-state-icon" aria-hidden>
                  <AlertTriangle />
                </span>
                <h2 className="app-state-title">
                  No pudimos mostrar los planes
                </h2>
                <p className="app-state-copy">{loadError}</p>
                <div className="app-state-actions">
                  <Button unstyled type="button" onClick={getPlans}>
                    <RefreshCw size={16} />
                    Reintentar
                  </Button>
                </div>
              </div>
            </section>
          ) : !plansByCurrency.mxn && !plansByCurrency.usd ? (
            <section className="plans2026__state">
              <div className="app-state-panel is-empty">
                <span className="app-state-icon" aria-hidden>
                  <Layers3 />
                </span>
                <h2 className="app-state-title">No hay planes disponibles</h2>
                <p className="app-state-copy">
                  Actualiza la página en unos minutos para volver a intentarlo.
                </p>
                <div className="app-state-actions">
                  <Button unstyled type="button" onClick={getPlans}>
                    <RefreshCw size={16} />
                    Actualizar
                  </Button>
                </div>
              </div>
            </section>
          ) : (
            <div className="bb-skeleton-fade-in">
              <section
                className="plans2026__card bb-hero-card"
                aria-label="Plan Oro"
              >
                <div className="plans2026__card-head">
                  <p className="plans2026__plan-name bb-pill bb-pill--soft">
                    PLAN ORO
                  </p>
                </div>
                {hasBothCurrencies ? (
                  <>
                    <p className="plans2026__currencyTitle">Selecciona tu moneda</p>
                    <div
                      className={[
                        "bb-segmented",
                        "bb-segmented--switch",
                        selectedCurrency === "usd" ? "is-usd" : "",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                      role="radiogroup"
                      aria-label="Moneda"
                    >
                      <Button unstyled
                        type="button"
                        role="radio"
                        aria-checked={selectedCurrency === "mxn"}
                        className={[
                          "bb-segmented__btn",
                          selectedCurrency === "mxn" ? "is-active" : "",
                        ]
                          .filter(Boolean)
                          .join(" ")}
                        onClick={() => selectCurrency("mxn")}
                        disabled={!plansByCurrency.mxn}
                      >
                        MXN
                      </Button>
                      <Button unstyled
                        type="button"
                        role="radio"
                        aria-checked={selectedCurrency === "usd"}
                        className={[
                          "bb-segmented__btn",
                          selectedCurrency === "usd" ? "is-active" : "",
                        ]
                          .filter(Boolean)
                          .join(" ")}
                        onClick={() => selectCurrency("usd")}
                        disabled={!plansByCurrency.usd}
                      >
                        USD
                      </Button>
                    </div>
                  </>
                ) : (
                  <p className="plans2026__currencySingle">
                    Moneda: {selectedCurrency.toUpperCase()}
                  </p>
                )}

                <div
                  className="plans2026__price"
                  aria-label="Precio mensual"
                >
                  <span className="plans2026__price-line">{selectedMonthlyLabel}</span>
                  {selectedDailyLabel ? (
                    <span className="plans2026__price-daily">
                      ({selectedDailyLabel})
                    </span>
                  ) : null}
                </div>

                <section
                  className="plans2026__billingPreview"
                  aria-label="Resumen de cobro"
                >
                  {trialPreview.applies ? (
                    <>
                      <p className="plans2026__billingLine">
                        <span>HOY PAGAS</span>
                        <strong>
                          {`$0 (prueba ${formatInt(trialPreview.trialDays)} días + ${formatInt(trialPreview.trialGb)} GB)`}
                        </strong>
                      </p>
                      <p className="plans2026__billingLine">
                        <span>DESPUÉS</span>
                        <strong>{`${selectedMonthlyLabel} (si no cancelas)`}</strong>
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="plans2026__billingLine">
                        <span>HOY PAGAS</span>
                        <strong>{selectedMonthlyLabel}</strong>
                      </p>
                      <p className="plans2026__billingLine">
                        <span>ACCESO</span>
                        <strong>Inmediato</strong>
                      </p>
                    </>
                  )}
                </section>

                <Button unstyled
                  type="button"
                  className="home-cta home-cta--primary home-cta--block"
                  onClick={handleActivate}
                  onMouseEnter={prefetchCheckout}
                  onFocus={prefetchCheckout}
                  onTouchStart={prefetchCheckout}
                  disabled={!selectedPlan}
                  data-testid={
                    selectedPlan
                      ? `plan-primary-cta-${selectedPlan.planId}`
                      : "plans-activate"
                  }
                >
                  {primaryCtaLabel}
                </Button>

                {!isAuthenticated && (
                  <div className="plans2026__trust" aria-label="Confianza">
                    <p className="plans2026__trust-copy">
                      {trustCopy}
                    </p>
                    <p className="plans2026__links" aria-label="Acceso">
                      ¿Ya tienes cuenta?{" "}
                      <Link
                        to="/auth"
                        state={{ from: `${location.pathname}${location.search}` }}
                        className="plans2026__link"
                      >
                        Inicia sesión
                      </Link>
                    </p>
                  </div>
                )}

                <p className="plans2026__includesTitle">Lo que incluye:</p>
                <ul className="plans2026__benefits" aria-label="Beneficios">
                  {benefits.map((benefit) => (
                    <li key={benefit} className="plans2026__benefit">
                      <span className="plans2026__benefit-icon" aria-hidden>
                        <Check size={16} />
                      </span>
                      <span className="plans2026__benefit-text">{benefit}</span>
                    </li>
                  ))}
                </ul>

                <p className="plans2026__billingHint">
                  💳 Pago seguro. Activación en minutos.
                </p>
                <PaymentMethodLogos
                  methods={[...paymentMethods]}
                  className="plans2026__payment-logos"
                  ariaLabel="Métodos de pago disponibles"
                />
              </section>
            </div>
          )}
        </div>
      </section>
      <PlansStickyCta
        planId={selectedPlan?.planId ?? null}
        ctaLabel={primaryCtaLabel}
        trial={
          trialPreview.applies
            ? {
                enabled: true,
                days: trialPreview.trialDays,
                gb: trialPreview.trialGb,
              }
            : null
        }
        onClick={handleActivate}
      />
    </div>
  );
}

export default Plans;
