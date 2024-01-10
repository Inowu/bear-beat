import { useEffect, useState } from "react";
import PlanCard from "../../components/PlanCard/PlanCard";
import "./Plans.scss";
import trpc from "../../api";
import { IPlans } from "../../interfaces/Plans";
import { useUserContext } from "../../contexts/UserContext";
import { Spinner } from "../../components/Spinner/Spinner";

function Plans() {
  const { currentUser } = useUserContext();
  const [plans, setPlans] = useState<IPlans[]>([]);
  const [loader, setLoader] = useState<boolean>(true);
  const getPlans = async () => {
    let body = {
      where: {
        activated: 1,
        paypal_plan_id: null,
      }
    }
    try {
      const plans: any = await trpc.plans.findManyPlans.query(body);
      console.log(plans);
      setPlans(plans);
      setLoader(false);
    }
    catch (error) {
      console.log(error);
    }
  }
  useEffect(() => {
    getPlans();
  }, [])
  if(loader) {
    return (
      <div className="global-loader" style={{ height: "60vh", display: "flex", justifyContent: "center"}}>
        <Spinner size={5} width={.5} color="#00e2f7"/>
      </div>
    )
  }
  return (
    <div className="plans-main-container">
      {plans.map((plan: IPlans, index) => {
        return <PlanCard plan={plan} key={"plan_" + index} />;
      })}
    </div>
  );
}

export default Plans;
