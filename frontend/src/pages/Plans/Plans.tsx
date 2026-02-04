import './Plans.scss';
import { IPlans } from '../../interfaces/Plans';
import { Spinner } from '../../components/Spinner/Spinner';
import { useEffect, useState } from 'react';
import { useUserContext } from '../../contexts/UserContext';
import PlanCard from '../../components/PlanCard/PlanCard';
import trpc from '../../api';
import { useNavigate } from 'react-router-dom';

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

  // Loader: mientras no tengamos currentUser o estemos cargando planes
  if (currentUser == null || loader) {
    return (
      <div
        className="global-loader"
        style={{ height: '60vh', display: 'flex', justifyContent: 'center' }}
      >
        <Spinner size={5} width={0.5} color="#00e2f7" />
      </div>
    );
  }
  return (
    <div className="plans-main-container">
      {/* {plans.map((plan: IPlans, index) => {
        return (
          <PlanCard
            plan={plan}
            key={"plan_" + index}
            getCurrentPlan={() => { }}
            selectMethod={selectMethod}
            selectedPlan={selectedPlan}
            userEmail={currentUser?.email}
            userPhone={currentUser?.phone}
          />
        );
      })} */}
      {plans
        .filter((plan) => plan.id !== 41) // Excluye el plan de migración para que no sea visible en la lista de planes
        .map((plan: IPlans, index) => {
          return (
            <PlanCard
              plan={plan}
              key={'plan_' + index}
              getCurrentPlan={() => {}}
              selectMethod={selectMethod}
              selectedPlan={selectedPlan}
              userEmail={currentUser?.email}
              userPhone={currentUser?.phone}
            />
          );
        })}
    </div>
  );
}

export default Plans;
