import PlanCard from "../../components/PlanCard/PlanCard";
import { plans } from "../../utils/Constants";
import "./Plans.scss";

function Plans() {
  return (
    <div className="plans-main-container">
      {plans.map((plan, index) => {
        return <PlanCard plan={plan}  key={"plan_" + index}/>;
      })}
    </div>
  );
}

export default Plans;
