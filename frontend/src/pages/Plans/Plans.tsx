import './Plans.scss';
import { IPlans } from '../../interfaces/Plans';
import { Spinner } from '../../components/Spinner/Spinner';
import { useEffect, useMemo, useState } from 'react';
import { useUserContext } from '../../contexts/UserContext';
import PlanCard from '../../components/PlanCard/PlanCard';
import trpc from '../../api';
import { Link, useNavigate } from 'react-router-dom';
import { trackManyChatConversion, MC_EVENTS } from '../../utils/manychatPixel';
import { AlertTriangle, RefreshCw, Layers3 } from 'lucide-react';
import { formatInt, formatTB } from '../../utils/format';
import Logo from '../../assets/images/osonuevo.png';

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

function formatAmountCompact(value: unknown, locale: string): string {
  const amount = Number(value ?? 0);
  if (!Number.isFinite(amount) || amount <= 0) return "—";
  const hasDecimals = Math.abs(amount % 1) > 0;
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: hasDecimals ? 2 : 0,
    maximumFractionDigits: 2,
  }).format(amount);
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
  const heroPriceLabels = useMemo(() => {
    const mxnAmount = plansByCurrency.mxn ? formatAmountCompact(plansByCurrency.mxn.price, "es-MX") : null;
    const usdAmount = plansByCurrency.usd ? formatAmountCompact(plansByCurrency.usd.price, "en-US") : null;
    return {
      mxn: mxnAmount ? `MXN $${mxnAmount}/mes` : null,
      usd: usdAmount ? `USD $${usdAmount}/mes` : null,
    };
  }, [plansByCurrency.mxn, plansByCurrency.usd]);
  const downloadQuotaGb = useMemo(() => {
    const values = sortedPlans.map((plan) => Number(plan.gigas ?? 0)).filter((v) => Number.isFinite(v) && v > 0);
    if (values.length === 0) return 0;
    return Math.max(...values);
  }, [sortedPlans]);
  const hasTrial = useMemo(() => {
    if (!trialConfig?.enabled) return false;
    if (trialConfig.eligible === false) return false;
    return Number.isFinite(trialConfig.days) && (trialConfig.days ?? 0) > 0;
  }, [trialConfig?.days, trialConfig?.eligible, trialConfig?.enabled]);
  const offerSupportCopy = useMemo(() => {
    const trialDays = Number(trialConfig?.days ?? 0);
    const trialGb = Number(trialConfig?.gb ?? 0);
    if (
      hasTrial &&
      Number.isFinite(trialDays) &&
      Number.isFinite(trialGb) &&
      trialDays > 0 &&
      trialGb > 0
    ) {
      return `Prueba ${formatInt(trialDays)} días + ${formatInt(trialGb)} GB (solo tarjeta).`;
    }
    if (trialConfig?.enabled && trialConfig?.eligible === false) {
      return "Esta cuenta activa al pagar. Cancela cuando quieras.";
    }
    return "Pago mensual. Cancela cuando quieras.";
  }, [hasTrial, trialConfig?.days, trialConfig?.eligible, trialConfig?.enabled, trialConfig?.gb]);
  const primaryCtaLabel = useMemo(() => {
    if (!currentUser?.email) {
      return hasTrial ? "Crear cuenta y empezar prueba" : "Crear cuenta y activar";
    }
    return "Activar ahora";
  }, [currentUser?.email, hasTrial]);

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
  const selectedPriceLabel = useMemo(() => {
    if (!primaryPlan) return null;
    const currency = normalizeCurrency(primaryPlan.moneda) === "usd" ? "USD" : "MXN";
    const locale = currency === "USD" ? "en-US" : "es-MX";
    const amount = formatAmountCompact(primaryPlan.price, locale);
    return `${currency} $${amount}/mes`;
  }, [primaryPlan]);

  const handlePrimaryCta = () => {
    if (!primaryPlan) return;
    const target = `/comprar?priceId=${primaryPlan.id}`;
    if (!currentUser?.email) {
      navigate("/auth/registro", { state: { from: target } });
      return;
    }
    navigate(target);
  };

  const plansToRender = useMemo(() => (primaryPlan ? [primaryPlan] : []), [primaryPlan]);

  // Loader: mientras estemos cargando planes
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
    <div className="plans-page">
      <header className="plans-topnav" aria-label="Navegación pública">
        <div className="plans-main-container plans-topnav__inner">
          <Link to="/" className="plans-topnav__brand" aria-label="Bear Beat">
            <img src={Logo} alt="Bear Beat" />
          </Link>
          <nav className="plans-topnav__nav" aria-label="Enlaces">
            <Link to="/planes" className="plans-topnav__link is-active" aria-current="page">
              Planes
            </Link>
            <Link to="/auth" className="plans-topnav__link">
              Iniciar sesión
            </Link>
          </nav>
          <button
            type="button"
            className="plans-topnav__cta"
            onClick={handlePrimaryCta}
            disabled={!primaryPlan}
          >
            {primaryCtaLabel}
          </button>
        </div>
      </header>
      <div className="plans-main-container">
        <section className="plans-hero" aria-label="Planes" data-testid="plans-hero">
          <h1 className="plans-page-title">Precio simple, catálogo gigante</h1>
          <p className="plans-hero-subtitle">
            Activa hoy y llega con repertorio listo.
          </p>
          <ul className="plans-hero-chips" aria-label="Incluye">
            <li className="plans-hero-chip bb-stat-pill">
              <span className="bb-stat-pill__value">{proofItems[1]?.value ?? "—"}</span>
              <span className="bb-stat-pill__label">catálogo total</span>
            </li>
            <li className="plans-hero-chip bb-stat-pill">
              <span className="bb-stat-pill__value">
                {downloadQuotaGb ? `${formatInt(downloadQuotaGb)} GB/mes` : "—"}
              </span>
              <span className="bb-stat-pill__label">de descargas</span>
            </li>
            <li className="plans-hero-chip bb-stat-pill">
              <span className="bb-stat-pill__value">{proofItems[0]?.value ?? "—"}</span>
              <span className="bb-stat-pill__label">archivos disponibles</span>
            </li>
          </ul>
          {(heroPriceLabels.mxn || heroPriceLabels.usd) && (
            <p className="plans-hero-price-hint" aria-label="Referencia rápida de precios">
              {heroPriceLabels.mxn && <span className="plans-hero-price-tag">{heroPriceLabels.mxn}</span>}
              {heroPriceLabels.mxn && heroPriceLabels.usd && (
                <span className="plans-hero-price-sep" aria-hidden>
                  •
                </span>
              )}
              {heroPriceLabels.usd && <span className="plans-hero-price-tag">{heroPriceLabels.usd}</span>}
            </p>
          )}
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
        <section className="plans-offer" aria-label="Selección de plan">
          <div className="plans-offer__head">
            <div className="plans-offer__title-block">
              <h2>Elige tu moneda</h2>
              <p>Mismo plan, elige MXN o USD.</p>
            </div>
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
          </div>
          <div className="plans-offer__meta">
            <p className="plans-offer__price">{selectedPriceLabel ?? "—"}</p>
            <p className="plans-currency-micro">{offerSupportCopy}</p>
          </div>
          <ul className="plans-plan-grid" aria-label="Planes disponibles">
            {plansToRender.map((plan) => (
              <li key={`plan_${plan.id}`} className="plans-plan-item is-selected">
                <PlanCard
                  plan={plan}
                  getCurrentPlan={() => {}}
                  userEmail={currentUser?.email}
                  showRecommendedBadge={false}
                  variant="marketing"
                  compactMarketingCopy={true}
                  trialConfig={trialConfig}
                />
              </li>
            ))}
          </ul>
        </section>
      )}
      </div>
    </div>
  );
}

export default Plans;
