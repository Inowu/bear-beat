import { IOxxoData, IPlans, ISpeiData } from "../../interfaces/Plans";
import "./PlanCard.scss";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCheck } from "@fortawesome/free-solid-svg-icons";
import { useNavigate } from "react-router-dom";
import { plans } from "../../utils/Constants";
import { OxxoModal } from "../../components/Modals/OxxoModal/OxxoModal";
import { useEffect, useState } from "react";
import trpc from "../../api";
import { ErrorModal } from "../../components/Modals/ErrorModal/ErrorModal";
import paypal from "../../assets/images/paypal_logo.png"
import { PayPalButtons, PayPalScriptProvider } from "@paypal/react-paypal-js";
import { SuccessModal } from "../../components/Modals/SuccessModal/SuccessModal";
import { SpeiModal } from "../../components/Modals/SpeiModal/SpeiModal";
interface PlanCardPropsI {
  plan: IPlans;
}

let order: number;

function PlanCard(props: PlanCardPropsI) {
  const [showOxxoModal, setShowOxxoModal] = useState<boolean>(false);
  const [oxxoData, setOxxoData] = useState({} as IOxxoData);
  const [showSpeiModal, setShowSpeiModal] = useState<boolean>(false);
  const [speiData, setSpeiData] = useState({} as ISpeiData);
  const [show, setShow] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<any>("");
  const [showSuccess, setShowSuccess] = useState<boolean>(false);
  const [ppPlan, setppPlan] = useState<null | any>(null);
  const { plan } = props;
  const navigate = useNavigate();
  const retreivePaypalPlan = async () => {
    let body = {
      where: {
        activated: 1,
        stripe_prod_id: null,
        moneda: plan.moneda.toUpperCase(),
        price: +plan.price,
      }
    }
    try {
      const plans: any = await trpc.plans.findManyPlans.query(body);
      if (plans.length > 0) {
        console.log(plans[0])
        setppPlan(plans[0])
      }
    }
    catch (error) {
      console.log(error);
    }
  }
  const closeSuccess = () => {
    setShowSuccess(false);
    navigate("/");
    window.location.reload();
  };
  const closeOxxo = () => {
    setShowOxxoModal(false);
  }
  const closeError = () => {
    setShow(false);
  };
  const payWithOxxo = async () => {
    trpc.checkoutLogs.registerCheckoutLog.mutate();
    try {
      let body = {
        planId: plan.id,
        paymentMethod: "cash" as const,
      }
      const oxxoPay = await trpc.subscriptions.subscribeWithCashConekta.mutate(body);
      setShowOxxoModal(true);
      setOxxoData(oxxoPay);
    }
    catch (error) {
      setErrorMessage(error);
      setShow(true);
    }
  }
  const payWithSpei = async () => {
    trpc.checkoutLogs.registerCheckoutLog.mutate();
    try {
      let body = {
        planId: plan.id,
        paymentMethod: "spei" as const,
      }
      const speiPay = await trpc.subscriptions.subscribeWithCashConekta.mutate(body);
      setShowSpeiModal(true);
      setSpeiData(speiPay);
    }
    catch (error) {
      setErrorMessage(error);
      setShow(true);
    }
  }
  const handleCheckout = async (planId: number) => {
    trpc.checkoutLogs.registerCheckoutLog.mutate();
    navigate(`/comprar?priceId=${planId}`);
  };
  const paypalMethod = () => {
    let data = <PayPalScriptProvider options={{
      clientId: "AYuKvAI09TE9bk9k1TuzodZ2zWQFpWEZesT65IkT4WOws9wq-yfeHLj57kEBH6YR_8NgBUlLShj2HOSr",
      vault: true,
      intent: "subscription",
    }} >
      <PayPalButtons
        style={{ color: "silver", shape: "pill", layout: "horizontal", height: 46, tagline: false }}
        onClick={async (data, actions) => {
          trpc.checkoutLogs.registerCheckoutLog.mutate();
          // Revisar si el usuario tiene una suscripcion activa
          const me = await trpc.auth.me.query();
          if (me.hasActiveSubscription) return actions.reject();
          const existingOrder = await trpc.orders.ownOrders.query({
            where: {
              AND: [
                {
                  status: 0,
                },
                {
                  payment_method: "Paypal",
                },
              ],
            },
          });

          if (existingOrder.length > 0) {
            return actions.reject();
          }
          actions.resolve();
        }}
        createSubscription={async (data, actions) => {
          try {
            const sub = await actions.subscription.create({
              // plan_id: ppPlan.paypal_plan_id,
              plan_id: plan.paypal_plan_id,
            });
            return sub;
          } catch (e: any) {
            console.log(e?.message);
          }
          return "";
        }}
        onApprove={async (data: any, actions) => {
          const result = await trpc.subscriptions.subscribeWithPaypal.mutate({
            // planId: ppPlan.id,
            planId: plan.id,
            subscriptionId: data.subscriptionID
          })
          setShowSuccess(true);
          return data;
        }}
      />
    </PayPalScriptProvider>
    return data
  }
  useEffect(() => {
    // retreivePaypalPlan()
  }, [])

  useEffect(() => {
    // if(ppPlan !== null){
    // paypalMethod();
    // }
  }, [ppPlan])

  return (
    <div className={"plan-card-main-card " + (plan.moneda === "usd" ? "resp-plan" : "")}>
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
      <div className="paypal-data">
        <p className="text">Pagos seguros en línea</p>
      </div>
      <div className="button-contain">
        {
          (plan.moneda === "mxn" || plan.moneda === "MXN") &&
          <button className="silver-bg" onClick={payWithOxxo}>Pagar vía Oxxo</button>
        }
        {
          (plan.moneda === "mxn" || plan.moneda === "MXN") &&
          <button className="silver-bg" onClick={payWithSpei}>Pagar vía Spei</button>
        }
        <button onClick={() => handleCheckout(plan.id)}>
          COMPRAR CON TARJETA
        </button>
        <div>
          {plan.id &&
            paypalMethod()
          }
        </div>
      </div>
      <OxxoModal
        show={showOxxoModal}
        onHide={closeOxxo}
        price={plan.price}
        oxxoData={oxxoData}
      />
      <SpeiModal
        show={showSpeiModal}
        onHide={() => { setShowSpeiModal(false) }}
        price={plan.price}
        speiData={speiData}
      />
      <SuccessModal
        show={showSuccess}
        onHide={closeSuccess}
        message="Gracias por tu pago, ya puedes empezar a descargar!"
        title="Compra Exitosa"
      />
      <ErrorModal show={show} onHide={closeError} message={errorMessage} />
    </div>
  );
}

export default PlanCard;
