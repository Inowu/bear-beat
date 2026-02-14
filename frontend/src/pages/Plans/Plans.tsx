import "./Plans.scss";
import type { IPlans } from "../../interfaces/Plans";
import { Spinner } from "../../components/Spinner/Spinner";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import trpc from "../../api";
import { Link, useNavigate } from "react-router-dom";
import { trackManyChatConversion, MC_EVENTS } from "../../utils/manychatPixel";
import { AlertTriangle, Check, Layers3, RefreshCw } from "src/icons";
import { formatInt, formatTB } from "../../utils/format";
import PublicTopNav from "../../components/PublicTopNav/PublicTopNav";
import PaymentMethodLogos from "../../components/PaymentMethodLogos/PaymentMethodLogos";
import { GROWTH_METRICS, trackGrowthMetric } from "../../utils/growthMetrics";
import { useUserContext } from "../../contexts/UserContext";

type CurrencyKey = "mxn" | "usd";

function normalizeCurrency(value: unknown): CurrencyKey | "" {
  const raw = `${value ?? ""}`.trim().toLowerCase();
  if (raw === "mxn") return "mxn";
  if (raw === "usd") return "usd";
  return "";
}

function toNumber(value: unknown): number {
  if (typeof value === "bigint") return Number(value);
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function hasStripePrice(plan: IPlans): boolean {
  const stripeId = (plan as any)?.stripe_prod_id;
  return typeof stripeId === "string" && stripeId.startsWith("price_");
}

function hasPaypal(plan: IPlans): boolean {
  return Boolean((plan as any)?.paypal_plan_id || (plan as any)?.paypal_plan_id_test);
}

function pickBestPlanCandidate(candidates: IPlans[]): IPlans | null {
  if (!Array.isArray(candidates) || candidates.length === 0) return null;

  let best: IPlans | null = null;
  let bestScore = -1;
  for (const candidate of candidates) {
    if (!candidate) continue;
    let score = 0;
    if (hasStripePrice(candidate)) score += 10;
    if (hasPaypal(candidate)) score += 2;
    // Prefer lower ids as a deterministic tie-breaker (legacy plans often have lower ids).
    score += typeof candidate.id === "number" ? -candidate.id / 10_000 : 0;

    if (score > bestScore) {
      bestScore = score;
      best = candidate;
    }
  }
  return best;
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

  const [plans, setPlans] = useState<IPlans[]>([]);
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
    const body = { where: { activated: 1 } };
    try {
      const result: any = await trpc.plans.findManyPlans.query(body);
      setPlans(Array.isArray(result) ? (result as IPlans[]) : []);
    } catch {
      setLoadError("No pudimos cargar los planes en este momento. Intenta nuevamente.");
      setPlans([]);
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

  const validPlans = useMemo(() => {
    return plans.filter((plan) => {
      if (!plan) return false;
      if (plan.id === 41) return false;
      const price = toNumber(plan.price);
      const gigas = toNumber(plan.gigas);
      if (price <= 0 || gigas <= 0) return false;
      const currency = normalizeCurrency(plan.moneda);
      if (!currency) return false;
      return true;
    });
  }, [plans]);

  const plansByCurrency = useMemo(() => {
    const mxn = pickBestPlanCandidate(validPlans.filter((plan) => normalizeCurrency(plan.moneda) === "mxn"));
    const usd = pickBestPlanCandidate(validPlans.filter((plan) => normalizeCurrency(plan.moneda) === "usd"));
    return { mxn, usd };
  }, [validPlans]);

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
    if (validPlans.length === 0) return;
    viewTrackedRef.current = true;
    trackManyChatConversion(MC_EVENTS.VIEW_PLANS);
    trackGrowthMetric(GROWTH_METRICS.PRICING_VIEW, { currencyDefault: "mxn" });
  }, [validPlans.length]);

  const selectedPlan = useMemo(() => {
    return selectedCurrency === "mxn" ? plansByCurrency.mxn : plansByCurrency.usd;
  }, [plansByCurrency.mxn, plansByCurrency.usd, selectedCurrency]);

  const stats = useMemo(() => {
    const hasLive =
      Boolean(catalogSummary) &&
      !catalogSummary?.error &&
      toNumber(catalogSummary?.totalFiles) > 0 &&
      toNumber(catalogSummary?.totalGB) > 0;

    const totalFiles = hasLive ? toNumber(catalogSummary?.totalFiles) : 248_321;
    const totalGB = hasLive ? toNumber(catalogSummary?.totalGB) : 14_140;
    const totalTB = totalGB / 1000;

    const planGigasCandidates = [
      toNumber(plansByCurrency.mxn?.gigas),
      toNumber(plansByCurrency.usd?.gigas),
    ].filter((v) => Number.isFinite(v) && v > 0);
    const quotaGb = planGigasCandidates.length ? Math.max(...planGigasCandidates) : 500;

    return {
      totalFiles,
      totalTB,
      quotaGb,
    };
  }, [catalogSummary, plansByCurrency.mxn?.gigas, plansByCurrency.usd?.gigas]);

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
    if (selectedCurrency === "mxn") return ["visa", "mastercard", "paypal", "spei"] as const;
    return ["visa", "mastercard", "paypal"] as const;
  }, [selectedCurrency]);

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
      planId: selectedPlan.id,
      currency: selectedCurrency.toUpperCase(),
      amount: toNumber(selectedPlan.price) || null,
    });

    navigate(`/comprar?priceId=${selectedPlan.id}`);
  }, [navigate, selectedCurrency, selectedPlan]);

  if (loader) {
    return (
      <div className="global-loader plans-loader">
        <div className="app-state-panel is-loading" role="status" aria-live="polite">
          <span className="app-state-icon" aria-hidden>
            <Spinner size={2.8} width={0.25} color="var(--app-accent)" />
          </span>
          <h2 className="app-state-title">Preparando planes</h2>
          <p className="app-state-copy">Estamos cargando tu mejor opción para activar hoy.</p>
        </div>
      </div>
    );
  }

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

          {loadError ? (
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
          ) : validPlans.length === 0 || (!plansByCurrency.mxn && !plansByCurrency.usd) ? (
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
                  <p className="plans2026__bento-label">Descargas rápidas</p>
                </article>
                <article className="plans2026__bento-card">
                  <p className="plans2026__bento-value">{formatInt(stats.totalFiles)}</p>
                  <p className="plans2026__bento-label">Archivos listos</p>
                </article>
              </section>

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
