import PlanCard from "../../components/PlanCard/PlanCard";
import { plans } from "../../utils/Constants";
import "./Plans.scss";

function Plans() {
  return (
    <div className="plans-main-container">
      {plans.map((plan) => {
        return <PlanCard plan={plan} />;
      })}
    </div>
  );
}

export default Plans;
