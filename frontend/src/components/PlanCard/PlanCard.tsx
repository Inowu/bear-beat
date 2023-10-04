import { IOxxoData, IPlans } from "../../interfaces/Plans";
import "./PlanCard.scss";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCheck } from "@fortawesome/free-solid-svg-icons";
import { useNavigate } from "react-router-dom";
import { plans } from "../../utils/Constants";
import { OxxoModal } from "../../components/Modals/OxxoModal/OxxoModal";
import { useState } from "react";
import trpc from "../../api";
import { ErrorModal } from "../../components/Modals/ErrorModal/ErrorModal";

interface PlanCardPropsI {
  plan: IPlans;
}

function PlanCard(props: PlanCardPropsI) {
  const [showOxxoModal, setShowOxxoModal] = useState<boolean>(false);
  const [oxxoData, setOxxoData] = useState({} as IOxxoData);
  const [show, setShow] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<any>("");
  const { plan } = props;
  const navigate = useNavigate();
  const closeOxxo = () => {
    setShowOxxoModal(false);
  }
  const closeError = () => {
    setShow(false);
  };
  const payWithOxxo = async () => {
    try{
      let body = {
        planId: plan.id,
        paymentMethod: "cash" as const,
      }
      console.log(body);
      const oxxoPay = await trpc.subscriptions.subscribeWithCashConekta.mutate(body);
      setShowOxxoModal(true);
      setOxxoData(oxxoPay);
    }
    catch(error) {
      setErrorMessage(error);
      setShow(true);
    }
  }
  const handleCheckout = async (planId: number) => {
    navigate(`/comprar?priceId=${planId}`);
  };
  return (
    <div className={"plan-card-main-card " + (plan.moneda === "usd" ? "resp-plan": "")}>
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
      <div className="button-contain">
        {
          plan.moneda === "mxn" ?
          <button className="silver-bg" onClick={payWithOxxo}>Pagar vía Oxxo</button>
          : <div className="space"/>
        }
                <button onClick={() => handleCheckout(plan.id)}>
          COMPRAR CON TARJETA
        </button>
      </div>
      <OxxoModal
          show={showOxxoModal}
          onHide={closeOxxo}
          price={plan.price}
          oxxoData={oxxoData}
        />
      <ErrorModal show={show} onHide={closeError} message={errorMessage} />
    </div>
  );
}

export default PlanCard;
