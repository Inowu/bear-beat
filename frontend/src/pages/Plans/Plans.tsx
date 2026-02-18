import "./Plans.scss";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import trpc from "../../api";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { trackManyChatConversion, MC_EVENTS } from "../../utils/manychatPixel";
import { AlertTriangle, Check, Layers3, RefreshCw } from "src/icons";
import { formatCatalogSizeMarketing, formatInt } from "../../utils/format";
import PublicTopNav from "../../components/PublicTopNav/PublicTopNav";
import PaymentMethodLogos, {
  type PaymentMethodId,
} from "../../components/PaymentMethodLogos/PaymentMethodLogos";
import { GROWTH_METRICS, trackGrowthMetric } from "../../utils/growthMetrics";
import { useUserContext } from "../../contexts/UserContext";
import PlansStickyCta from "./PlansStickyCta";

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

function formatPayNowMethodsLabel(methods: PaymentMethodId[]): string {
  const labels: string[] = [];
  if (methods.includes("paypal")) labels.push("PayPal");
  if (methods.includes("spei")) labels.push("SPEI");
  if (methods.includes("oxxo")) labels.push("Efectivo");
  if (methods.includes("transfer")) labels.push("Transferencia");
  return labels.length > 0 ? labels.join(" / ") : "Otros métodos";
}

function parsePlansEntry(value: string | null): PlansEntry | null {
  if (!value) return null;
  const normalized = value.trim().toLowerCase();
  if (normalized === "fastlane" || normalized === "compare") return normalized;
  return null;
}

function Plans() {
  const { currentUser } = useUserContext();
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
      const trialRaw =
        result?.trialConfig && typeof result.trialConfig === "object"
          ? result.trialConfig
          : null;
      const nextTrialConfig: PublicTrialConfig | null = trialRaw
        ? {
            enabled: Boolean(trialRaw.enabled),
            days: Math.max(0, Math.trunc(toNumber(trialRaw.days))),
            gb: Math.max(0, Math.trunc(toNumber(trialRaw.gb))),
            eligible:
              typeof trialRaw.eligible === "boolean" || trialRaw.eligible === null
                ? trialRaw.eligible
                : null,
          }
        : null;

      const defaultCurrencyRaw = String(
        result?.ui?.defaultCurrency ?? result?.currencyDefault ?? "mxn",
      )
        .trim()
        .toLowerCase();
      const defaultCurrency: CurrencyKey =
        defaultCurrencyRaw === "usd" ? "usd" : "mxn";
      const totalFiles = Math.max(
        0,
        Math.trunc(toNumber(result?.ui?.stats?.totalFiles)),
      );
      const totalTB = Math.max(0, toNumber(result?.ui?.stats?.totalTB));
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
        Math.trunc(toNumber(result?.ui?.stats?.quotaGbDefault)),
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
    const totalTB = pricingUi.stats.totalTB;
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
      totalTB,
      quotaGb,
    };
  }, [pricingUi.stats, selectedCurrency, selectedPlan?.gigas]);

  const price = useMemo(() => {
    if (!selectedPlan)
      return { amount: "—", currencyLabel: selectedCurrency.toUpperCase() };
    const currencyLabel = selectedCurrency.toUpperCase();
    const locale = selectedCurrency === "usd" ? "en-US" : "es-MX";
    return {
      amount: `$${formatMoneyFixed(selectedPlan.price, locale)}`,
      currencyLabel,
    };
  }, [selectedCurrency, selectedPlan]);

  const paymentMethods = useMemo(() => {
    if (selectedPlan?.paymentMethods?.length)
      return selectedPlan.paymentMethods;
    return selectedCurrency === "mxn"
      ? (["visa", "mastercard", "spei"] as PaymentMethodId[])
      : (["visa", "mastercard"] as PaymentMethodId[]);
  }, [selectedCurrency, selectedPlan?.paymentMethods]);

  const trialPreview = useMemo(() => {
    const trialEnabled =
      Boolean(trialConfig?.enabled) && trialConfig?.eligible !== false;
    const trialDays = Math.max(0, Math.trunc(toNumber(trialConfig?.days)));
    const trialGb = Math.max(0, Math.trunc(toNumber(trialConfig?.gb)));
    const applies = trialEnabled && trialDays > 0 && trialGb > 0;
    const monthlyLabel = `${price.amount} ${price.currencyLabel}/mes`;
    const payNowMethodsLabel = formatPayNowMethodsLabel(paymentMethods);

    return {
      applies,
      trialDays,
      trialGb,
      monthlyLabel,
      payNowMethodsLabel,
    };
  }, [paymentMethods, price.amount, price.currencyLabel, trialConfig]);

  const primaryCtaLabel = trialPreview.applies
    ? "Iniciar prueba"
    : "Continuar al pago seguro";

  const trustCopy = trialPreview.applies
    ? "Tu prueba se activa con tarjeta. Cancela cuando quieras."
    : "Tu cuenta se activa al pagar. Cancela cuando quieras.";

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
  const handleStickyDemo = useCallback(() => {
    trackGrowthMetric(GROWTH_METRICS.CTA_SECONDARY_CLICK, {
      location: "plans_sticky_demo",
    });
    trackGrowthMetric(GROWTH_METRICS.CTA_CLICK, {
      id: "plans_sticky_demo",
      location: "plans_sticky",
      currency: selectedCurrency.toUpperCase(),
    });
    navigate("/#demo");
  }, [navigate, selectedCurrency]);

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

  const plansTopCta = (
    <div className="plans2026__topCta" aria-label="Progreso de compra">
      <span className="plans2026__step">
        {isFastlaneEntry ? "Comparación rápida" : "Paso 1 de 2"}
      </span>
    </div>
  );

  return (
    <div className="plans2026 bb-marketing-page bb-marketing-page--flat-cards">
      <PublicTopNav
        loginFrom={`${location.pathname}${location.search}`}
        cta={plansTopCta}
      />

      <section className="plans2026__main" aria-label="Planes y precios">
        <div className="plans2026__container bb-marketing-container--narrow">
          <header className="plans2026__hero" data-testid="plans-hero">
            <p className="plans2026__kicker">
              {isFastlaneEntry ? "Compara y sigue" : "Paso 1 de 2"}
            </p>
            <h1>Elige tu plan.</h1>
            <p className="plans2026__subtitle">
              {isFastlaneEntry
                ? "Si quieres comparar antes de pagar, aquí eliges moneda y plan sin perder tu avance."
                : "Primero eliges moneda y plan. En el siguiente paso completas el pago seguro."}
            </p>
          </header>

          {loader ? (
            <>
              <section
                className="plans2026__bento plans2026__bento--skeleton"
                aria-label="Cargando valor incluido"
                role="status"
                aria-live="polite"
                aria-busy="true"
              >
                {Array.from({ length: 3 }).map((_, i) => (
                  <article
                    key={i}
                    className="plans2026__bento-card bb-bento-card"
                    aria-hidden
                  >
                    <span className="plans2026__sk plans2026__sk--bentoValue" />
                    <span className="plans2026__sk plans2026__sk--bentoLabel" />
                  </article>
                ))}
              </section>

              <section
                className="plans2026__card bb-hero-card plans2026__card--skeleton"
                aria-label="Cargando plan"
                role="status"
                aria-live="polite"
                aria-busy="true"
              >
                <p className="plans2026__skeletonStatus">
                  Cargando tu mejor opción…
                </p>

                <div className="plans2026__card-head" aria-hidden>
                  <span className="plans2026__sk plans2026__sk--pill" />
                </div>

                <div className="plans2026__currency-skeleton" aria-hidden>
                  <span className="plans2026__sk plans2026__sk--currencyBtn" />
                  <span className="plans2026__sk plans2026__sk--currencyBtn" />
                </div>

                <div className="plans2026__price" aria-hidden>
                  <span className="plans2026__sk plans2026__sk--price" />
                  <span className="plans2026__sk plans2026__sk--suffix" />
                </div>

                <ul className="plans2026__benefits" aria-hidden>
                  {Array.from({ length: 5 }).map((_, i) => (
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
            </>
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
                  <button type="button" onClick={getPlans}>
                    <RefreshCw size={16} />
                    Reintentar
                  </button>
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
                  <button type="button" onClick={getPlans}>
                    <RefreshCw size={16} />
                    Actualizar
                  </button>
                </div>
              </div>
            </section>
          ) : (
            <>
              <section className="plans2026__bento" aria-label="Valor incluido">
                <article className="plans2026__bento-card bb-bento-card">
                  <p className="plans2026__bento-value">
                    {formatCatalogSizeMarketing(stats.totalTB)}
                  </p>
                  <p className="plans2026__bento-label">Catálogo total</p>
                </article>
                <article className="plans2026__bento-card bb-bento-card">
                  <p className="plans2026__bento-value">
                    {formatInt(stats.quotaGb)} GB/mes
                  </p>
                  <p className="plans2026__bento-label">Cuota de descarga</p>
                </article>
                <article className="plans2026__bento-card bb-bento-card">
                  <p className="plans2026__bento-value">
                    {formatInt(stats.totalFiles)}
                  </p>
                  <p className="plans2026__bento-label">Archivos listos</p>
                </article>
              </section>

              <p className="plans2026__limitsNote">{pricingUi.limitsNote}</p>

              <section
                className="plans2026__card bb-hero-card"
                aria-label="Plan Oro"
              >
                <div className="plans2026__card-head">
                  <p className="plans2026__plan-name bb-pill bb-pill--soft">
                    Plan Oro
                  </p>
                </div>

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
                  <button
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
                  </button>
                  <button
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
                  </button>
                </div>

                <div
                  className="plans2026__price"
                  aria-label={`Precio ${price.currencyLabel}`}
                >
                  <span className="plans2026__price-amount">
                    {price.amount}
                  </span>
                  <span className="plans2026__price-suffix">
                    {price.currencyLabel} <span aria-hidden>/</span> mes
                  </span>
                </div>

                <ul className="plans2026__benefits" aria-label="Beneficios">
                  {[
                    `Cuota de descarga: ${formatInt(stats.quotaGb)} GB/mes.`,
                    "Catálogo completo (eliges qué descargar).",
                    "Actualizaciones: semanales (nuevos packs).",
                    "Carpetas listas para cabina por género y temporada.",
                    "Soporte por chat para activar.",
                  ].map((benefit) => (
                    <li key={benefit} className="plans2026__benefit">
                      <span className="plans2026__benefit-icon" aria-hidden>
                        <Check size={16} />
                      </span>
                      <span className="plans2026__benefit-text">{benefit}</span>
                    </li>
                  ))}
                </ul>

                <section className="plans2026__billingPreview" aria-label="Resumen de cobro">
                  {trialPreview.applies ? (
                    <>
                      <p className="plans2026__billingLine">
                        <span>Con tarjeta</span>
                        <strong>
                          {`Hoy: $0 (prueba ${formatInt(trialPreview.trialDays)} días + ${formatInt(trialPreview.trialGb)} GB)`}
                        </strong>
                      </p>
                      <p className="plans2026__billingLine">
                        <span>Después</span>
                        <strong>{`${trialPreview.monthlyLabel} (si no cancelas)`}</strong>
                      </p>
                      <p className="plans2026__billingHint">
                        {trialPreview.payNowMethodsLabel}: pago hoy
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="plans2026__billingLine">
                        <span>Pago hoy</span>
                        <strong>{`${price.amount} ${price.currencyLabel}`}</strong>
                      </p>
                      <p className="plans2026__billingHint">Acceso inmediato</p>
                    </>
                  )}
                </section>

                <button
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
                </button>

                <div className="plans2026__trust" aria-label="Confianza">
                  <PaymentMethodLogos
                    methods={[...paymentMethods]}
                    className="plans2026__payment-logos"
                    ariaLabel="Métodos de pago disponibles"
                  />
                  <p className="plans2026__trust-copy">
                    {trustCopy}
                  </p>
                  <p className="plans2026__links" aria-label="Ayuda">
                    <Link to="/instrucciones" className="plans2026__link">
                      Ver cómo descargar
                    </Link>
                    <span className="plans2026__link-sep" aria-hidden>
                      ·
                    </span>
                    <Link to="/legal" className="plans2026__link">
                      FAQ y políticas
                    </Link>
                  </p>
                </div>
              </section>
            </>
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
        onDemoClick={handleStickyDemo}
      />
    </div>
  );
}

export default Plans;
