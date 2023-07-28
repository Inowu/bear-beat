import { PlanI } from "../../interfaces/Plans";
import "./PlanCard.scss";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCheck } from "@fortawesome/free-solid-svg-icons";

interface PlanCardPropsI {
  plan: PlanI;
}

function PlanCard(props: PlanCardPropsI) {
  const { plan } = props;

  return (
    <div className="plan-card-main-card">
      <div className="c-row">
        <h2>{plan.title}</h2>
      </div>
      <div className="c-row">
        <h3>{plan.price}</h3>
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
      {plan.included.map((ad) => {
        return (
          <div className="c-row" key={ad}>
            <p>
              <FontAwesomeIcon icon={faCheck} /> {ad}
            </p>
          </div>
        );
      })}
      <div className="c-row">
        <p>Contenido en gigas disponibles: {plan.space}</p>
      </div>
      <button>COMPRAR CON TARJETA</button>
      <button>COMPRAR CON PAYPAL</button>
    </div>
  );
}

export default PlanCard;
