import { useEffect, useState } from "react";
import PlanCard from "../../components/PlanCard/PlanCard";
import "./Plans.scss";
import trpc from "../../api";
import { IPlans } from "../../interfaces/Plans";
import { useUserContext } from "../../contexts/UserContext";

function Plans() {
  const { currentUser } = useUserContext();
  const [plans, setPlans] = useState<IPlans[]>([]);
  const getPlans = async () => {
    let body = {
      where: {
        activated: 1,
      }
    }
    try {
      const plans: any = await trpc.plans.findManyPlans.query(body);
      setPlans(plans);
    }
    catch (error) {
      console.log(error);
    }
  }
  useEffect(() => {
    getPlans();
  }, [])

  return (
    <div className="plans-main-container">
      {plans.map((plan: IPlans, index) => {
        return <PlanCard plan={plan} key={"plan_" + index} />;
      })}
    </div>
  );
}

export default Plans;
