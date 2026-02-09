import './Plans.scss';
import { IPlans } from '../../interfaces/Plans';
import { Spinner } from '../../components/Spinner/Spinner';
import { useEffect, useMemo, useState } from 'react';
import { useUserContext } from '../../contexts/UserContext';
import PlanCard from '../../components/PlanCard/PlanCard';
import trpc from '../../api';
import { useNavigate } from 'react-router-dom';
import { trackManyChatConversion, MC_EVENTS } from '../../utils/manychatPixel';
import { AlertTriangle, RefreshCw, Layers3, ShieldCheck, Zap, MessageCircle } from 'lucide-react';
import PaymentMethodLogos, { type PaymentMethodId } from '../../components/PaymentMethodLogos/PaymentMethodLogos';
import { formatInt, formatTB } from '../../utils/format';

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
  const conversionPath = [
    "Elige plan",
    "Paga seguro",
    "Activa y descarga",
  ];
  const heroPaymentMethods = useMemo<PaymentMethodId[]>(() => {
    const methods = new Set<PaymentMethodId>(["visa", "mastercard", "amex"]);
    const hasMxn = sortedPlans.some((plan) => (plan.moneda ?? "").toLowerCase() === "mxn");
    const hasPaypal = sortedPlans.some((plan) => Boolean(plan.paypal_plan_id || plan.paypal_plan_id_test));

    if (hasMxn) {
      methods.add("spei");
    }
    if (hasPaypal) {
      methods.add("paypal");
    }

    return Array.from(methods);
  }, [sortedPlans]);
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
  const riskAnchor =
    preferredCurrency === "mxn"
      ? "Un solo evento perdiendo pedidos suele costar más que tu membresía mensual."
      : "Perder una sola noche por no tener música puede costar más que tu acceso del mes.";

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
  const isSinglePlan = sortedPlans.length === 1;

  return (
    <div className="plans-main-container">
      <section className="plans-hero">
        <div className="plans-hero-main">
          <h1 className="plans-page-title">Nunca vuelvas a decir: “no la tengo”</h1>
          <p className="plans-hero-subtitle">Activa tu membresía en minutos y responde peticiones al instante con un catálogo masivo por género.</p>
          <p className="plans-hero-anchor">{riskAnchor}</p>
          <p className="plans-value-equation">Más repertorio, menos fricción y activación rápida en una sola membresía.</p>
          {trialConfig?.enabled && trialConfig.eligible !== false && (
            <p className="plans-trial-pill" role="note">
              <strong>{formatInt(trialConfig.days)} días gratis</strong>
              <span>con tarjeta (Stripe)</span>
              <span aria-hidden>•</span>
              <span>{formatInt(trialConfig.gb)} GB incluidos</span>
              <span aria-hidden>•</span>
              <span>Solo primera vez</span>
            </p>
          )}
          <div className="plans-proof-grid" aria-label="Indicadores de valor">
            {proofItems.map((item) => (
              <article key={item.value} className="plans-proof-item">
                <strong>{item.value}</strong>
                <span>{item.label}</span>
              </article>
            ))}
          </div>
          <div className="plans-trust-strip" aria-label="Beneficios clave">
            <span>
              <Zap size={16} aria-hidden />
              <strong>Acceso inmediato</strong>
            </span>
            <span>
              <ShieldCheck size={16} aria-hidden />
              <strong>Pagos seguros</strong>
            </span>
            <span>
              <MessageCircle size={16} aria-hidden />
              <strong>Soporte por chat</strong>
            </span>
          </div>
        </div>
        <div className="plans-hero-side">
          <h2 className="plans-hero-side-title">Activación en 3 pasos</h2>
          <ol className="plans-flow-strip" aria-label="Ruta de activación rápida">
            {conversionPath.map((step, index) => (
              <li key={step}>
                <span aria-hidden>{index + 1}</span>
                <strong>{step}</strong>
              </li>
            ))}
          </ol>
          <p className="plans-hero-guarantee">
            Si te atoras, soporte por chat te acompaña hasta que quedes activo.
          </p>
          <PaymentMethodLogos
            methods={heroPaymentMethods}
            className="plans-payment-logos"
            ariaLabel="Métodos de pago disponibles en Bear Beat"
          />
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
          <section className="plans-grid-heading">
            <h2>Elige y activa hoy</h2>
            <p>{isSinglePlan ? 'Este plan ya incluye catálogo completo, descarga mensual y soporte por chat.' : 'Compara tu moneda y activa el plan que mejor te convenga hoy.'}</p>
          </section>
          <div
            className={`plans-grid ${isSinglePlan ? 'is-single' : ''}`}
          >
            {sortedPlans.map((plan: IPlans) => (
              <PlanCard
                plan={plan}
                key={'plan_' + plan.id}
                getCurrentPlan={() => {}}
                userEmail={currentUser?.email}
                userPhone={currentUser?.phone}
                showRecommendedBadge={sortedPlans.length > 1}
                trialConfig={trialConfig}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export default Plans;
