import { useEffect, useState } from "react";
import PlanCard from "../../components/PlanCard/PlanCard";
import "./Plans.scss";
import trpc from "../../api";
import { IPlans } from "../../interfaces/Plans";
import { Spinner } from "../../components/Spinner/Spinner";

function Plans() {
  const [plans, setPlans] = useState<IPlans[]>([]);
  const [loader, setLoader] = useState<boolean>(true);
  const [selectedPlan, setSelectedPlan] = useState<number>(0)
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
      setLoader(false);
    } catch (error) {
      console.log(error);
    }
  };

  // Function to indicate PlanCard to let customer choose which Payment Method wants to use.
  const selectMethod = (planId: number) => {
    setSelectedPlan(planId)
  }

  useEffect(() => {
    getPlans();
  }, []);
  if (loader) {
    return (
      <div
        className="global-loader"
        style={{ height: "60vh", display: "flex", justifyContent: "center" }}
      >
        <Spinner size={5} width={0.5} color="#00e2f7" />
      </div>
    );
  }
  return (
    <div className="plans-main-container">
      {plans.map((plan: IPlans, index) => {
        return (
          <PlanCard
            plan={plan}
            key={"plan_" + index}
            getCurrentPlan={() => { }}
            selectMethod={selectMethod}
            selectedPlan={selectedPlan}
          />
        );
      })}
    </div>
  );
}

export default Plans;
