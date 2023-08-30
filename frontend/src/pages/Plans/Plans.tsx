import { useEffect, useState } from "react";
import PlanCard from "../../components/PlanCard/PlanCard";
import { plans } from "../../utils/Constants";
import "./Plans.scss";
import trpc from "../../api";
import { IPlans } from "../../interfaces/Plans";

function Plans() {
// const [plans, setPlans] = useState<IPlans>([]);
  const getPlans = async () => {
    let body = {
      where: {
        activated: 1,
      }
    }
    try{
      const plans: any = await trpc.plans.findManyPlans.query(body);
      console.log(plans);
    }
    catch(error){
      console.log(error);
    }

  }
  useEffect(() => {
    getPlans();
  }, [])
  
  return (
    <div className="plans-main-container">
      {plans.map((plan, index) => {
        return <PlanCard plan={plan}  key={"plan_" + index}/>;
      })}
    </div>
  );
}

export default Plans;
