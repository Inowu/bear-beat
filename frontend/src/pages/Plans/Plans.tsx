import './Plans.scss';
import { IPlans } from '../../interfaces/Plans';
import { Spinner } from '../../components/Spinner/Spinner';
import { useEffect, useMemo, useState } from 'react';
import { useUserContext } from '../../contexts/UserContext';
import PlanCard from '../../components/PlanCard/PlanCard';
import trpc from '../../api';
import { useNavigate } from 'react-router-dom';
import { trackManyChatConversion, MC_EVENTS } from '../../utils/manychatPixel';
import { AlertTriangle, RefreshCw, Layers3 } from 'lucide-react';
import { formatInt, formatTB } from '../../utils/format';
import PlansStickyCta from './PlansStickyCta';

function normalizeCurrency(value: unknown): "mxn" | "usd" | "" {
  const raw = `${value ?? ""}`.trim().toLowerCase();
  if (raw === "mxn") return "mxn";
  if (raw === "usd") return "usd";
  return "";
}

function detectPreferredCurrency(): "mxn" | "usd" {
  if (typeof window === "undefined") return "usd";
  const lang = navigator.language?.toLowerCase() ?? "";
  return lang.includes("mx") || lang.startsWith("es") ? "mxn" : "usd";
}

function Plans() {
  const { currentUser } = useUserContext();
  const [plans, setPlans] = useState<IPlans[]>([]);
  const [catalogSummary, setCatalogSummary] = useState<{
    totalFiles: number;
    totalGB: number;
    totalGenres: number;
    error?: string;
  } | null>(null);
  const [trialConfig, setTrialConfig] = useState<{
    enabled: boolean;
    days: number;
    gb: number;
    eligible?: boolean | null;
  } | null>(null);
  const [loader, setLoader] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<string>('');
  const navigate = useNavigate();
  const preferredCurrency = useMemo(() => detectPreferredCurrency(), []);
  const [selectedCurrency, setSelectedCurrency] = useState<"mxn" | "usd">(preferredCurrency);
  const [isCompareWidth, setIsCompareWidth] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(min-width: 920px)");
    const update = () => setIsCompareWidth(mq.matches);
    update();
    if (typeof mq.addEventListener === "function") {
      mq.addEventListener("change", update);
      return () => mq.removeEventListener("change", update);
    }
    // Safari fallback.
    mq.addListener(update);
    return () => mq.removeListener(update);
  }, []);

  const getPlans = async () => {
    setLoadError('');
    setLoader(true);
    const body = { where: { activated: 1 } };
    try {
      const plans: any = await trpc.plans.findManyPlans.query(body);
      setPlans(plans);
    } catch {
      setLoadError('No pudimos cargar los planes en este momento. Intenta nuevamente.');
    } finally {
      setLoader(false);
    }
  };

  useEffect(() => {
    // Cargar planes también para usuarios no autenticados (evita "spinner infinito" y mejora conversión).
    getPlans();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    // Usuarios con plan activo no deben ver /planes (evitar doble membresía) → home
    if (currentUser?.hasActiveSubscription && !currentUser.isSubscriptionCancelled) {
      navigate('/', { replace: true });
    }
  }, [currentUser, navigate]);

  useEffect(() => {
    if (plans.length > 0) trackManyChatConversion(MC_EVENTS.VIEW_PLANS);
  }, [plans.length]);

  const sortedPlans = useMemo(() => {
    const activePlans = plans.filter((plan) => {
      if (plan.id === 41) return false;
      const price = Number(plan.price ?? 0);
      const gigas = Number(plan.gigas ?? 0);
      if (price <= 0 || gigas <= 0) return false;
      return true;
    });
    const parsePrice = (value: string | null | undefined) => Number(value ?? "0") || 0;
    const hasPaypal = (plan: IPlans) => Boolean(plan.paypal_plan_id || plan.paypal_plan_id_test);

    const dedupedByCurrency = Array.from(
      activePlans.reduce((map, plan) => {
        const currencyKey = normalizeCurrency(plan.moneda) || "unknown";
        const current = map.get(currencyKey);
        if (!current) {
          map.set(currencyKey, plan);
          return map;
        }
        const currentPrice = parsePrice(current.price);
        const candidatePrice = parsePrice(plan.price);
        const currentPaypal = hasPaypal(current) ? 1 : 0;
        const candidatePaypal = hasPaypal(plan) ? 1 : 0;

        if (
          candidatePrice < currentPrice ||
          (candidatePrice === currentPrice && candidatePaypal > currentPaypal) ||
          (candidatePrice === currentPrice && candidatePaypal === currentPaypal && plan.id < current.id)
        ) {
          map.set(currencyKey, plan);
        }
        return map;
      }, new Map<string, IPlans>())
    ).map(([, plan]) => plan);

    return [...dedupedByCurrency].sort((a, b) => {
      const aCurrency = normalizeCurrency(a.moneda);
      const bCurrency = normalizeCurrency(b.moneda);
      const aPriority = aCurrency === preferredCurrency ? 0 : 1;
      const bPriority = bCurrency === preferredCurrency ? 0 : 1;
      if (aPriority !== bPriority) return aPriority - bPriority;

      const byPrice = parsePrice(a.price) - parsePrice(b.price);
      if (byPrice !== 0) return byPrice;

      return (a.name ?? "").localeCompare(b.name ?? "", "es");
    });
  }, [plans, preferredCurrency]);
  const proofItems = useMemo(() => {
    const hasLive =
      Boolean(catalogSummary) &&
      !catalogSummary?.error &&
      Number(catalogSummary?.totalFiles ?? 0) > 0 &&
      Number(catalogSummary?.totalGB ?? 0) > 0;

    const totalFiles = hasLive ? Number(catalogSummary?.totalFiles ?? 0) : 195_727;
    const totalGB = hasLive ? Number(catalogSummary?.totalGB ?? 0) : 12_350.1;
    const totalGenres = hasLive ? Number(catalogSummary?.totalGenres ?? 0) : 209;
    const totalTB = totalGB / 1000;

    return [
      { value: formatInt(totalFiles), label: "archivos disponibles" },
      { value: formatTB(totalTB), label: "catálogo total" },
      { value: `${formatInt(totalGenres)} géneros`, label: "para responder pedidos" },
    ];
  }, [catalogSummary]);
  const plansByCurrency = useMemo(() => {
    const mxn = sortedPlans.find((plan) => normalizeCurrency(plan.moneda) === "mxn") ?? null;
    const usd = sortedPlans.find((plan) => normalizeCurrency(plan.moneda) === "usd") ?? null;
    return { mxn, usd };
  }, [sortedPlans]);
  const downloadQuotaGb = useMemo(() => {
    const values = sortedPlans.map((plan) => Number(plan.gigas ?? 0)).filter((v) => Number.isFinite(v) && v > 0);
    if (values.length === 0) return 0;
    return Math.max(...values);
  }, [sortedPlans]);
  const heroMicrocopy = "Pago mensual. Cancela cuando quieras.";
  const hasTrial = useMemo(() => {
    if (!trialConfig?.enabled) return false;
    if (trialConfig.eligible === false) return false;
    return Number.isFinite(trialConfig.days) && (trialConfig.days ?? 0) > 0;
  }, [trialConfig?.days, trialConfig?.eligible, trialConfig?.enabled]);
  const heroTrialCopy = useMemo(() => {
    if (!trialConfig?.enabled) return null;
    if (!Number.isFinite(trialConfig.days) || !Number.isFinite(trialConfig.gb)) return null;
    if ((trialConfig.days ?? 0) <= 0 || (trialConfig.gb ?? 0) <= 0) return null;
    return `Prueba con tarjeta (Stripe): ${formatInt(trialConfig.days)} días + ${formatInt(trialConfig.gb)} GB.`;
  }, [trialConfig?.days, trialConfig?.enabled, trialConfig?.gb]);

  useEffect(() => {
    const hasSelected = selectedCurrency === "mxn" ? Boolean(plansByCurrency.mxn) : Boolean(plansByCurrency.usd);
    if (hasSelected) return;
    if (plansByCurrency.mxn) setSelectedCurrency("mxn");
    else if (plansByCurrency.usd) setSelectedCurrency("usd");
  }, [plansByCurrency.mxn, plansByCurrency.usd, selectedCurrency]);

  const primaryPlan = useMemo(() => {
    if (selectedCurrency === "mxn") return plansByCurrency.mxn ?? plansByCurrency.usd;
    return plansByCurrency.usd ?? plansByCurrency.mxn;
  }, [plansByCurrency.mxn, plansByCurrency.usd, selectedCurrency]);

  const handlePrimaryCta = () => {
    if (!primaryPlan) return;
    const target = `/comprar?priceId=${primaryPlan.id}`;
    if (!currentUser?.email) {
      navigate("/auth/registro", { state: { from: target } });
      return;
    }
    navigate(target);
  };

  const isCompareLayout = Boolean(isCompareWidth && plansByCurrency.mxn && plansByCurrency.usd);
  const plansToRender = useMemo(() => {
    if (!plansByCurrency.mxn && !plansByCurrency.usd) return [];
    if (isCompareLayout) {
      return preferredCurrency === "mxn"
        ? ([plansByCurrency.mxn, plansByCurrency.usd].filter(Boolean) as IPlans[])
        : ([plansByCurrency.usd, plansByCurrency.mxn].filter(Boolean) as IPlans[]);
    }
    return primaryPlan ? [primaryPlan] : [];
  }, [isCompareLayout, plansByCurrency.mxn, plansByCurrency.usd, preferredCurrency, primaryPlan]);

  // Loader: mientras estemos cargando planes
  if (loader) {
    return (
      <div
        className="global-loader"
        style={{ minHeight: '60vh', padding: '16px' }}
      >
        <div className="app-state-panel is-loading" role="status" aria-live="polite">
          <span className="app-state-icon" aria-hidden>
            <Spinner size={2.8} width={0.25} color="var(--app-accent)" />
          </span>
          <h2 className="app-state-title">Cargando planes</h2>
          <p className="app-state-copy">Estamos preparando la mejor opción para tu membresía.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="plans-page">
      <div className="plans-main-container">
        <section className="plans-hero" aria-label="Planes" data-testid="plans-hero">
          <h1 className="plans-page-title">Planes y precios</h1>
          <p className="plans-hero-subtitle">Activa en minutos y llega con repertorio listo.</p>
          <div className="plans-hero-grid">
            <div className="plans-hero-copy" aria-label="Qué incluye">
              <ul className="plans-hero-chips" aria-label="Incluye">
                <li className="plans-hero-chip bb-stat-pill">
                  <span className="bb-stat-pill__value">{proofItems[1]?.value ?? "—"}</span>
                  <span className="bb-stat-pill__label">catálogo</span>
                </li>
                <li className="plans-hero-chip bb-stat-pill">
                  <span className="bb-stat-pill__value">
                    {downloadQuotaGb ? `${formatInt(downloadQuotaGb)} GB/mes` : "—"}
                  </span>
                  <span className="bb-stat-pill__label">de descargas</span>
                </li>
                <li className="plans-hero-chip bb-stat-pill">
                  <span className="bb-stat-pill__value">FTP + web</span>
                  <span className="bb-stat-pill__label">(tú eliges)</span>
                </li>
              </ul>
              <p className="plans-hero-micro">{heroMicrocopy}</p>
            </div>
            <div className="plans-hero-choice" aria-label="Moneda">
              <h2 className="plans-hero-choice-title">Elige tu moneda</h2>
              <div className="plans-currency-toggle bb-segmented" role="tablist" aria-label="Moneda">
                <button
                  type="button"
                  role="tab"
                  aria-selected={selectedCurrency === "mxn"}
                  className={["bb-segmented__btn", selectedCurrency === "mxn" ? "is-active" : ""].filter(Boolean).join(" ")}
                  onClick={() => setSelectedCurrency("mxn")}
                  disabled={!plansByCurrency.mxn}
                >
                  MXN
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={selectedCurrency === "usd"}
                  className={["bb-segmented__btn", selectedCurrency === "usd" ? "is-active" : ""].filter(Boolean).join(" ")}
                  onClick={() => setSelectedCurrency("usd")}
                  disabled={!plansByCurrency.usd}
                >
                  USD
                </button>
              </div>
              <p className="plans-currency-micro">MXN: México (pago local). USD: internacional.</p>
              {heroTrialCopy && <p className="plans-trial-note">{heroTrialCopy}</p>}
            </div>
          </div>
        </section>
      {loadError ? (
        <section className="plans-state-wrap">
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
      ) : sortedPlans.length === 0 ? (
        <section className="plans-state-wrap">
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
          <ul
            className={["plans-plan-grid", isCompareLayout ? "plans-plan-grid--compare" : ""].filter(Boolean).join(" ")}
            aria-label="Planes disponibles"
          >
            {plansToRender.map((plan) => (
              <li
                key={`plan_${plan.id}`}
                className={[
                  "plans-plan-item",
                  isCompareLayout && normalizeCurrency(plan.moneda) === selectedCurrency ? "is-selected" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                <PlanCard
                  plan={plan}
                  getCurrentPlan={() => {}}
                  userEmail={currentUser?.email}
                  showRecommendedBadge={normalizeCurrency(plan.moneda) === preferredCurrency}
                  variant="marketing"
                  trialConfig={trialConfig}
                />
              </li>
            ))}
          </ul>
        </>
      )}
      </div>

      <PlansStickyCta
        planId={primaryPlan?.id ?? null}
        ctaLabel={!currentUser?.email ? (hasTrial ? "Crear cuenta y empezar prueba" : "Crear cuenta y activar") : "Activar ahora"}
        trial={trialConfig?.enabled ? { enabled: trialConfig.enabled, days: trialConfig.days, gb: trialConfig.gb } : null}
        onClick={handlePrimaryCta}
      />
    </div>
  );
}

export default Plans;
