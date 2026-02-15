import "./Plans.scss";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import trpc from "../../api";
import { Link, useNavigate } from "react-router-dom";
import { trackManyChatConversion, MC_EVENTS } from "../../utils/manychatPixel";
import { AlertTriangle, Check, Layers3, RefreshCw } from "src/icons";
import { formatInt, formatTB } from "../../utils/format";
import { FALLBACK_CATALOG_TOTAL_FILES, FALLBACK_CATALOG_TOTAL_GB } from "../../utils/catalogFallback";
import PublicTopNav from "../../components/PublicTopNav/PublicTopNav";
import PaymentMethodLogos, { type PaymentMethodId } from "../../components/PaymentMethodLogos/PaymentMethodLogos";
import { GROWTH_METRICS, trackGrowthMetric } from "../../utils/growthMetrics";
import { useUserContext } from "../../contexts/UserContext";

type CurrencyKey = "mxn" | "usd";

type PublicBestPlan = {
  planId: number;
  currency: CurrencyKey;
  name: string;
  price: number;
  gigas: number;
  hasPaypal: boolean;
};

function toNumber(value: unknown): number {
  if (typeof value === "bigint") return Number(value);
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function formatMoneyFixed(value: unknown, locale: string): string {
  const amount = toNumber(value);
  if (!Number.isFinite(amount) || amount <= 0) return "—";
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

function Plans() {
  const { currentUser } = useUserContext();
  const navigate = useNavigate();
  const checkoutPrefetchedRef = useRef(false);

  const [plansByCurrency, setPlansByCurrency] = useState<{ mxn: PublicBestPlan | null; usd: PublicBestPlan | null }>({
    mxn: null,
    usd: null,
  });
  const [catalogSummary, setCatalogSummary] = useState<{
    totalFiles: number;
    totalGB: number;
    error?: string;
  } | null>(null);

  const [loader, setLoader] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<string>("");
  const [selectedCurrency, setSelectedCurrency] = useState<CurrencyKey>("mxn");
  const viewTrackedRef = useRef(false);

  const getPlans = useCallback(async () => {
    setLoadError("");
    setLoader(true);
    try {
      const result: any = await trpc.plans.getPublicBestPlans.query();
      setPlansByCurrency({
        mxn: (result?.mxn as PublicBestPlan | null) ?? null,
        usd: (result?.usd as PublicBestPlan | null) ?? null,
      });
    } catch {
      setLoadError("No pudimos cargar los planes en este momento. Intenta nuevamente.");
      setPlansByCurrency({ mxn: null, usd: null });
    } finally {
      setLoader(false);
    }
  }, []);

  useEffect(() => {
    void getPlans();
  }, [getPlans]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const summary: any = await trpc.catalog.getPublicCatalogSummary.query();
        if (!cancelled) setCatalogSummary(summary);
      } catch {
        if (!cancelled) setCatalogSummary(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    // Evitar doble membresía: si ya tiene acceso activo (aunque haya cancelado la renovación),
    // empujar a /micuenta para recargar GB extra desde ahí.
    if (currentUser?.hasActiveSubscription) {
      navigate("/micuenta", { replace: true });
    }
  }, [currentUser, navigate]);

  useEffect(() => {
    if (selectedCurrency === "mxn" && !plansByCurrency.mxn && plansByCurrency.usd) {
      setSelectedCurrency("usd");
      return;
    }
    if (selectedCurrency === "usd" && !plansByCurrency.usd && plansByCurrency.mxn) {
      setSelectedCurrency("mxn");
    }
  }, [plansByCurrency.mxn, plansByCurrency.usd, selectedCurrency]);

  useEffect(() => {
    if (viewTrackedRef.current) return;
    if (!plansByCurrency.mxn && !plansByCurrency.usd) return;
    viewTrackedRef.current = true;
    trackManyChatConversion(MC_EVENTS.VIEW_PLANS);
    trackGrowthMetric(GROWTH_METRICS.PRICING_VIEW, { currencyDefault: "mxn" });
  }, [plansByCurrency.mxn, plansByCurrency.usd]);

  const selectedPlan = useMemo(() => {
    return selectedCurrency === "mxn" ? plansByCurrency.mxn : plansByCurrency.usd;
  }, [plansByCurrency.mxn, plansByCurrency.usd, selectedCurrency]);

  const stats = useMemo(() => {
    const hasLive =
      Boolean(catalogSummary) &&
      !catalogSummary?.error &&
      toNumber(catalogSummary?.totalFiles) > 0 &&
      toNumber(catalogSummary?.totalGB) > 0;

    const totalFiles = hasLive ? toNumber(catalogSummary?.totalFiles) : FALLBACK_CATALOG_TOTAL_FILES;
    const totalGB = hasLive ? toNumber(catalogSummary?.totalGB) : FALLBACK_CATALOG_TOTAL_GB;
    const totalTB = totalGB / 1000;

    const selectedCandidate =
      selectedCurrency === "mxn" ? toNumber(plansByCurrency.mxn?.gigas) : toNumber(plansByCurrency.usd?.gigas);
    const fallbackCandidate =
      selectedCurrency === "mxn" ? toNumber(plansByCurrency.usd?.gigas) : toNumber(plansByCurrency.mxn?.gigas);

    const quotaGb = selectedCandidate > 0 ? selectedCandidate : fallbackCandidate > 0 ? fallbackCandidate : 500;

    return {
      totalFiles,
      totalTB,
      quotaGb,
    };
  }, [catalogSummary, plansByCurrency.mxn?.gigas, plansByCurrency.usd?.gigas, selectedCurrency]);

  const price = useMemo(() => {
    if (!selectedPlan) return { amount: "—", currencyLabel: selectedCurrency.toUpperCase() };
    const currencyLabel = selectedCurrency.toUpperCase();
    const locale = selectedCurrency === "usd" ? "en-US" : "es-MX";
    return {
      amount: `$${formatMoneyFixed(selectedPlan.price, locale)}`,
      currencyLabel,
    };
  }, [selectedCurrency, selectedPlan]);

  const paymentMethods = useMemo(() => {
    const methods: PaymentMethodId[] = ["visa", "mastercard"];
    if (selectedPlan?.hasPaypal) methods.push("paypal");
    if (selectedCurrency === "mxn") methods.push("spei");
    return methods;
  }, [selectedCurrency, selectedPlan?.hasPaypal]);

  const selectCurrency = (next: CurrencyKey) => {
    if (next === selectedCurrency) return;
    setSelectedCurrency(next);
    trackGrowthMetric(GROWTH_METRICS.SEGMENT_SELECTED, { id: "plans_currency", value: next });
  };

  const handleActivate = useCallback(() => {
    if (!selectedPlan) return;

    trackManyChatConversion(MC_EVENTS.SELECT_PLAN);
    trackManyChatConversion(MC_EVENTS.CLICK_BUY);
    void trpc.checkoutLogs.registerCheckoutLog.mutate().catch(() => {});

    trackGrowthMetric(GROWTH_METRICS.CTA_CLICK, {
      id: "plans_primary_checkout",
      location: "plans",
      planId: selectedPlan.planId,
      currency: selectedCurrency.toUpperCase(),
      amount: toNumber(selectedPlan.price) || null,
    });

    navigate(`/comprar?priceId=${selectedPlan.planId}`);
  }, [navigate, selectedCurrency, selectedPlan]);

  const prefetchCheckout = useCallback(() => {
    if (checkoutPrefetchedRef.current) return;
    checkoutPrefetchedRef.current = true;

    try {
      const connection = (navigator as any)?.connection;
      if (connection?.saveData) return;
      const effectiveType = typeof connection?.effectiveType === "string" ? connection.effectiveType : "";
      if (/2g/i.test(effectiveType)) return;
    } catch {
      // noop
    }

    void import("../Checkout/Checkout");
  }, []);

  return (
    <div className="plans2026">
      <PublicTopNav loginFrom="/planes" />

      <main className="plans2026__main" aria-label="Planes y precios">
        <div className="plans2026__container">
          <header className="plans2026__hero">
            <h1>Precio simple, catálogo gigante.</h1>
            <p className="plans2026__subtitle">
              Activa hoy y llega a tu evento con el repertorio listo.
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
                  <article key={i} className="plans2026__bento-card" aria-hidden>
                    <span className="plans2026__sk plans2026__sk--bentoValue" />
                    <span className="plans2026__sk plans2026__sk--bentoLabel" />
                  </article>
                ))}
              </section>

              <section
                className="plans2026__card plans2026__card--skeleton"
                aria-label="Cargando plan"
                role="status"
                aria-live="polite"
                aria-busy="true"
              >
                <p className="plans2026__skeletonStatus">Cargando tu mejor opción…</p>

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
                <h2 className="app-state-title">No pudimos mostrar los planes</h2>
                <p className="app-state-copy">{loadError}</p>
                <div className="app-state-actions">
                  <button type="button" onClick={getPlans}>
                    <RefreshCw size={16} />
                    Reintentar
                  </button>
                </div>
              </div>
            </section>
          ) : (!plansByCurrency.mxn && !plansByCurrency.usd) ? (
            <section className="plans2026__state">
              <div className="app-state-panel is-empty">
                <span className="app-state-icon" aria-hidden>
                  <Layers3 />
                </span>
                <h2 className="app-state-title">No hay planes disponibles</h2>
                <p className="app-state-copy">Actualiza la página en unos minutos para volver a intentarlo.</p>
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
                <article className="plans2026__bento-card">
                  <p className="plans2026__bento-value">{formatTB(stats.totalTB)}</p>
                  <p className="plans2026__bento-label">Catálogo total</p>
                </article>
                <article className="plans2026__bento-card">
                  <p className="plans2026__bento-value">{formatInt(stats.quotaGb)} GB/mes</p>
                  <p className="plans2026__bento-label">Cuota mensual</p>
                </article>
                <article className="plans2026__bento-card">
                  <p className="plans2026__bento-value">{formatInt(stats.totalFiles)}</p>
                  <p className="plans2026__bento-label">Archivos listos</p>
                </article>
              </section>

              <p className="plans2026__limitsNote">
                La cuota mensual es lo que puedes descargar cada ciclo. El catálogo total es lo disponible para elegir.
              </p>

              <section className="plans2026__card" aria-label="Plan Oro">
                <div className="plans2026__card-head">
                  <p className="plans2026__plan-name">Plan Oro</p>
                </div>

                <div
                  className={`plans2026__currency-switch is-${selectedCurrency}`}
                  role="radiogroup"
                  aria-label="Moneda"
                >
                  <button
                    type="button"
                    role="radio"
                    aria-checked={selectedCurrency === "mxn"}
                    className="plans2026__currency-btn"
                    onClick={() => selectCurrency("mxn")}
                    disabled={!plansByCurrency.mxn}
                  >
                    MXN
                  </button>
                  <button
                    type="button"
                    role="radio"
                    aria-checked={selectedCurrency === "usd"}
                    className="plans2026__currency-btn"
                    onClick={() => selectCurrency("usd")}
                    disabled={!plansByCurrency.usd}
                  >
                    USD
                  </button>
                </div>

                <div className="plans2026__price" aria-label={`Precio ${price.currencyLabel}`}>
                  <span className="plans2026__price-amount">{price.amount}</span>
                  <span className="plans2026__price-suffix">
                    {price.currencyLabel} <span aria-hidden>/</span> mes
                  </span>
                </div>

                <ul className="plans2026__benefits" aria-label="Beneficios">
                  {[
                    "Catálogo completo (eliges qué descargar).",
                    "Catálogo pensado para cabina en vivo.",
                    "Búsqueda rápida por género y temporada.",
                    "Carpetas listas por género y temporada.",
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

                <button
                  type="button"
                  className="plans2026__cta"
                  onClick={handleActivate}
                  onMouseEnter={prefetchCheckout}
                  onFocus={prefetchCheckout}
                  onTouchStart={prefetchCheckout}
                  disabled={!selectedPlan}
                  data-testid="plans-activate"
                >
                  Activar Ahora
                </button>

                <div className="plans2026__trust" aria-label="Confianza">
                  <PaymentMethodLogos
                    methods={[...paymentMethods]}
                    className="plans2026__payment-logos"
                    ariaLabel="Métodos de pago disponibles"
                  />
                  <p className="plans2026__trust-copy">
                    Esta cuenta activa al pagar. Cancela cuando quieras.
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
      </main>
    </div>
  );
}

export default Plans;
