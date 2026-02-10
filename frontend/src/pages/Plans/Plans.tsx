import './Plans.scss';
import { IPlans } from '../../interfaces/Plans';
import { Spinner } from '../../components/Spinner/Spinner';
import { useEffect, useMemo, useState } from 'react';
import { useUserContext } from '../../contexts/UserContext';
import PlanCard from '../../components/PlanCard/PlanCard';
import trpc from '../../api';
import { useNavigate } from 'react-router-dom';
import { trackManyChatConversion, MC_EVENTS } from '../../utils/manychatPixel';
import { AlertTriangle, RefreshCw, Layers3, Wallet, ListChecks, Zap } from 'lucide-react';
import { formatInt, formatTB } from '../../utils/format';
import PlansStickyCta from './PlansStickyCta';

function detectPreferredCurrency(): "mxn" | "usd" {
  if (typeof window === "undefined") return "usd";
  const lang = navigator.language?.toLowerCase() ?? "";
  return lang.includes("mx") || lang.startsWith("es") ? "mxn" : "usd";
}

function Plans() {
  const { currentUser } = useUserContext();
  const [plans, setPlans] = useState<IPlans[]>([]);
  const [showSinglePlan, setShowSinglePlan] = useState(false);
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
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(max-width: 920px)");
    const update = () => setShowSinglePlan(mq.matches);
    update();
    if (typeof mq.addEventListener === "function") {
      mq.addEventListener("change", update);
      return () => mq.removeEventListener("change", update);
    }
    mq.addListener(update);
    return () => mq.removeListener(update);
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
    const normalizeCurrency = (value: string | null | undefined) => (value ?? "").trim().toLowerCase();
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
    const mxn = sortedPlans.find((plan) => (plan.moneda ?? "").toLowerCase() === "mxn") ?? null;
    const usd = sortedPlans.find((plan) => (plan.moneda ?? "").toLowerCase() === "usd") ?? null;
    return { mxn, usd };
  }, [sortedPlans]);
  const downloadQuotaGb = useMemo(() => {
    const values = sortedPlans.map((plan) => Number(plan.gigas ?? 0)).filter((v) => Number.isFinite(v) && v > 0);
    if (values.length === 0) return 0;
    return Math.max(...values);
  }, [sortedPlans]);
  const heroMicrocopy =
    trialConfig?.enabled && trialConfig.eligible !== false
      ? `Prueba: ${formatInt(trialConfig.days)} días + ${formatInt(trialConfig.gb)} GB (solo tarjeta, 1ª vez). Cancelas antes de que termine y no se cobra.`
      : "Pago mensual. Cancela cuando quieras.";

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

  const plansToRender = useMemo(() => {
    if (!plansByCurrency.mxn && !plansByCurrency.usd) return [];
    if (showSinglePlan) return primaryPlan ? [primaryPlan] : [];

    const list: IPlans[] = [];
    if (selectedCurrency === "mxn") {
      if (plansByCurrency.mxn) list.push(plansByCurrency.mxn);
      if (plansByCurrency.usd) list.push(plansByCurrency.usd);
    } else {
      if (plansByCurrency.usd) list.push(plansByCurrency.usd);
      if (plansByCurrency.mxn) list.push(plansByCurrency.mxn);
    }
    return list;
  }, [plansByCurrency.mxn, plansByCurrency.usd, primaryPlan, selectedCurrency, showSinglePlan]);

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
        <section className="plans-hero" aria-label="Planes">
          <h1 className="plans-page-title">Elige tu moneda y activa</h1>
          <p className="plans-hero-subtitle">Activa tu membresía en minutos y llega con repertorio listo.</p>
          <div className="plans-decision-grid" role="list" aria-label="Qué vas a decidir">
            <article className="plans-decision-card" role="listitem">
              <Zap className="plans-decision-icon" aria-hidden />
              <h2 className="plans-decision-title">Beneficio</h2>
              <p className="plans-decision-copy">Responde pedidos al instante con contenido listo para cabina.</p>
            </article>
            <article className="plans-decision-card" role="listitem">
              <ListChecks className="plans-decision-icon" aria-hidden />
              <h2 className="plans-decision-title">Qué incluye</h2>
              <ul className="plans-decision-stats" aria-label="Incluye">
                <li>
                  <strong>{proofItems[1]?.value ?? "—"}</strong> catálogo (eliges qué bajar)
                </li>
                <li>
                  <strong>{downloadQuotaGb ? `${formatInt(downloadQuotaGb)} GB/mes` : "—"}</strong> de descargas
                </li>
                <li>
                  <strong>FTP + web</strong> (como te acomode)
                </li>
              </ul>
            </article>
            <article className="plans-decision-card" role="listitem">
              <Wallet className="plans-decision-icon" aria-hidden />
              <h2 className="plans-decision-title">Qué plan elegir</h2>
              <div className="plans-currency-toggle" role="tablist" aria-label="Moneda">
                <button
                  type="button"
                  role="tab"
                  aria-selected={selectedCurrency === "mxn"}
                  className={selectedCurrency === "mxn" ? "is-active" : ""}
                  onClick={() => setSelectedCurrency("mxn")}
                  disabled={!plansByCurrency.mxn}
                >
                  MXN
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={selectedCurrency === "usd"}
                  className={selectedCurrency === "usd" ? "is-active" : ""}
                  onClick={() => setSelectedCurrency("usd")}
                  disabled={!plansByCurrency.usd}
                >
                  USD
                </button>
              </div>
              <p className="plans-currency-micro">MXN: México (pago local). USD: internacional.</p>
            </article>
          </div>
          <p className="plans-hero-micro">{heroMicrocopy}</p>
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
          <div className="plans-plan-grid" role="list" aria-label="Planes disponibles">
            {plansToRender.map((plan) => (
              <PlanCard
                plan={plan}
                key={`plan_${plan.id}`}
                getCurrentPlan={() => {}}
                userEmail={currentUser?.email}
                showRecommendedBadge={plan === plansByCurrency.mxn}
                variant="marketing"
                trialConfig={trialConfig}
              />
            ))}
          </div>
        </>
      )}
      </div>

      <PlansStickyCta
        planId={primaryPlan?.id ?? null}
        ctaLabel={!currentUser?.email ? "Crear cuenta y activar" : "Activar ahora"}
        trial={trialConfig?.enabled ? { enabled: trialConfig.enabled, days: trialConfig.days, gb: trialConfig.gb } : null}
        onClick={handlePrimaryCta}
      />
    </div>
  );
}

export default Plans;
