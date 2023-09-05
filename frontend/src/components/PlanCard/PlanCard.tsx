import { IPlans } from "../../interfaces/Plans";
import "./PlanCard.scss";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCheck } from "@fortawesome/free-solid-svg-icons";
import { useNavigate } from "react-router-dom";
import { plans } from "../../utils/Constants";

interface PlanCardPropsI {
  plan: IPlans;
}

function PlanCard(props: PlanCardPropsI) {
  const { plan } = props;
  const navigate = useNavigate();

  const handleCheckout = async (planId: number) => {
    navigate(`/comprar?priceId=${planId}`);
  };
  return (
    <div className="plan-card-main-card">
      <div className="c-row">
        <h2>{plan.name}</h2>
      </div>
      <div className="c-row">
        <h3>${plan.price}.00 {plan.moneda}</h3>
      </div>
      <div className="c-row">
        <p>{plan.description}</p>
      </div>
      <div className="c-row">
        <p>Duración (En días): {plan.duration}</p>
      </div>
      <div className="c-row">
        <p>Acceso a la carpeta</p>
      </div>
      {plans[0].included.map((ad) => {
        return (
          <div className="c-row" key={ad}>
            <p>
              <FontAwesomeIcon icon={faCheck} /> {ad}
            </p>
          </div>
        );
      })}
      <div className="c-row">
        <p>Contenido en gigas disponibles: {plan.gigas.toString()}</p>
      </div>
      <button onClick={() => handleCheckout(plan.id)}>
        COMPRAR CON TARJETA
      </button>
      {/* <button>COMPRAR CON PAYPAL</button> */}
    </div>
  );
}

export default PlanCard;
