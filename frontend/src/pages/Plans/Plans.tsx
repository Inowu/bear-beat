import './Plans.scss';
import { IPlans } from '../../interfaces/Plans';
import { Spinner } from '../../components/Spinner/Spinner';
import { useEffect, useMemo, useState } from 'react';
import { useUserContext } from '../../contexts/UserContext';
import PlanCard from '../../components/PlanCard/PlanCard';
import trpc from '../../api';
import { useNavigate } from 'react-router-dom';
import { trackManyChatConversion, MC_EVENTS } from '../../utils/manychatPixel';

function detectPreferredCurrency(): "mxn" | "usd" {
  if (typeof window === "undefined") return "usd";
  const lang = navigator.language?.toLowerCase() ?? "";
  return lang.includes("mx") || lang.startsWith("es") ? "mxn" : "usd";
}

function Plans() {
  const { currentUser } = useUserContext();
  const [plans, setPlans] = useState<IPlans[]>([]);
  const [loader, setLoader] = useState<boolean>(true);
  const [selectedPlan, setSelectedPlan] = useState<number>(0);
  const navigate = useNavigate();
  const preferredCurrency = useMemo(() => detectPreferredCurrency(), []);

  const getPlans = async () => {
    let body = {
      where: {
        activated: 1,
        paypal_plan_id: null,
        paypal_plan_id_test: null,
      },
    };
    try {
      const plans: any = await trpc.plans.findManyPlans.query(body);
      setPlans(plans);
    } catch (error) {
      console.log(error);
    } finally {
      setLoader(false);
    }
  };

  // Function to indicate PlanCard to let customer choose which Payment Method wants to use.
  const selectMethod = (planId: number) => {
    setSelectedPlan(planId);
  };

  useEffect(() => {
    // No decidir nada hasta tener currentUser (evita flash de planes para usuarios con plan)
    if (currentUser == null) return;

    // Usuarios con plan activo no ven /planes (evitar doble membresía) → home
    if (currentUser.hasActiveSubscription && !currentUser.isSubscriptionCancelled) {
      navigate('/', { replace: true });
      return;
    }

    getPlans();
  }, [currentUser, navigate]);

  useEffect(() => {
    if (plans.length > 0) trackManyChatConversion(MC_EVENTS.VIEW_PLANS);
  }, [plans.length]);

  const sortedPlans = useMemo(() => {
    const activePlans = plans.filter((plan) => plan.id !== 41);
    const normalizeCurrency = (value: string | null | undefined) => (value ?? "").trim().toLowerCase();
    const parsePrice = (value: string | null | undefined) => Number(value ?? "0") || 0;

    return [...activePlans].sort((a, b) => {
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

  // Loader: mientras no tengamos currentUser o estemos cargando planes
  if (currentUser == null || loader) {
    return (
      <div
        className="global-loader"
        style={{
          height: '60vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Spinner size={5} width={0.5} color="var(--app-accent)" />
      </div>
    );
  }
  const isSinglePlan = sortedPlans.length === 1;

  return (
    <div className="plans-main-container font-poppins">
      <section className="plans-hero">
        <h1 className="plans-page-title font-bear text-2xl md:text-3xl font-bold text-bear-dark-900 dark:text-white">Elige tu plan</h1>
        <p className="plans-hero-subtitle">Activa tu acceso en minutos y empieza a descargar hoy mismo.</p>
        <div className="plans-trust-strip" role="list" aria-label="Beneficios clave">
          <span role="listitem">Acceso inmediato</span>
          <span role="listitem">Cancela cuando quieras</span>
          <span role="listitem">Pagos seguros</span>
        </div>
      </section>
      <div
        className={`plans-grid ${isSinglePlan ? 'max-w-md mx-auto' : ''}`}
      >
        {sortedPlans.map((plan: IPlans) => (
          <PlanCard
            plan={plan}
            key={'plan_' + plan.id}
            getCurrentPlan={() => {}}
            selectMethod={selectMethod}
            selectedPlan={selectedPlan}
            userEmail={currentUser?.email}
            userPhone={currentUser?.phone}
          />
        ))}
      </div>
    </div>
  );
}

export default Plans;
