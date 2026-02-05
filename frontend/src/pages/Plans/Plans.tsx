import './Plans.scss';
import { IPlans } from '../../interfaces/Plans';
import { Spinner } from '../../components/Spinner/Spinner';
import { useEffect, useState } from 'react';
import { useUserContext } from '../../contexts/UserContext';
import PlanCard from '../../components/PlanCard/PlanCard';
import trpc from '../../api';
import { useNavigate } from 'react-router-dom';
import { trackManyChatConversion, MC_EVENTS } from '../../utils/manychatPixel';

function Plans() {
  const { currentUser } = useUserContext();
  const [plans, setPlans] = useState<IPlans[]>([]);
  const [loader, setLoader] = useState<boolean>(true);
  const [selectedPlan, setSelectedPlan] = useState<number>(0);
  const navigate = useNavigate();

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
  const filteredPlans = plans.filter((plan) => plan.id !== 41);
  const isSinglePlan = filteredPlans.length === 1;

  return (
    <div className="plans-main-container">
      <h1 className="plans-page-title text-2xl md:text-3xl font-bold">Elige tu plan</h1>
      <div
        className={`grid grid-cols-1 md:grid-cols-3 gap-8 ${isSinglePlan ? 'max-w-md mx-auto' : ''}`}
      >
        {filteredPlans.map((plan: IPlans, index) => (
          <PlanCard
            plan={plan}
            key={'plan_' + index}
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
