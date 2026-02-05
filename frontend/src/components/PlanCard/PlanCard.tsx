import { IOxxoData, IPlans, ISpeiData } from "../../interfaces/Plans";
import "./PlanCard.scss";
import { useLocation, useNavigate } from "react-router-dom";

const CheckIconCyan = () => (
  <svg className="plan-card-check-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
    <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
  </svg>
);
import { plans } from "../../utils/Constants";
import { useCallback, useEffect, useState } from "react";
import trpc from "../../api";
import { manychatApi } from "../../api/manychat";
import {
  ChangeSubscriptionModal,
  ConditionModal,
  ErrorModal,
  OxxoModal,
  SpeiModal,
  SuccessModal
} from "../../components/Modals";
import PayPalComponent from "../../components/PayPal/PayPalComponent";
import { useCookies } from "react-cookie";
import { trackPurchase, trackViewPlans } from "../../utils/facebookPixel";
import { trackManyChatConversion, trackManyChatPurchase, MC_EVENTS } from "../../utils/manychatPixel";


interface PlanCardPropsI {
  plan: IPlans;
  currentPlan?: boolean;
  getCurrentPlan: () => void;
  selectMethod?: (planId: number) => void;
  selectedPlan?: number;
  userEmail?: string;
  userPhone?: string;
}
function PlanCard(props: PlanCardPropsI) {
  const { plan, currentPlan, getCurrentPlan, selectMethod, selectedPlan, userEmail, userPhone } = props;
  const [showOxxoModal, setShowOxxoModal] = useState<boolean>(false);
  const [oxxoData, setOxxoData] = useState({} as IOxxoData);
  const [showSpeiModal, setShowSpeiModal] = useState<boolean>(false);
  const [speiData, setSpeiData] = useState({} as ISpeiData);
  const [showSuccess, setShowSuccess] = useState<boolean>(false);
  const [showCancelModal, setShowCancelModal] = useState<boolean>(false);
  const [showChangeModal, setShowChangeModal] = useState<boolean>(false);
  const [showError, setShowError] = useState<boolean>(false);
  const [ppPlan, setppPlan] = useState<null | any>(null);
  const [errorMSG, setErrorMSG] = useState<string>("");
  const [successTitle, setSuccessTitle] = useState<string>("");
  const [successMessage, setSuccessMessage] = useState<string>("");
  const [changeMessage, setChangeMessage] = useState("");
  const [changeTitle, setChangeTitle] = useState("");
  const navigate = useNavigate();
  const location = useLocation();
  const [cookies] = useCookies(['_fbp']);
  const { pathname } = location;
  // const ManyChatPixel = require('manychat-pixel-js');
  // const manyChatPixel = new ManyChatPixel('YOUR_PIXEL_ID');
  const handleManyChat = async () => {
    try {
      await manychatApi("USER_CHECKED_PLANS");
    } catch (error) {
      console.log(error);
    }
  };

  const handleUserClickOnPlan = async () => {
    trackViewPlans(userEmail && userPhone ? { email: userEmail, phone: userPhone } : undefined);
    trackManyChatConversion(MC_EVENTS.SELECT_PLAN);
    try { await manychatApi('USER_CHECKED_PLANS'); } catch { /* API fallback en backend */ }
  }

  const handleUserSuccessfulPayment = async (amount?: number, currency?: string) => {
    trackPurchase({ email: userEmail, phone: userPhone });
    trackManyChatConversion(MC_EVENTS.PAYMENT_SUCCESS);
    if (amount != null) trackManyChatPurchase(MC_EVENTS.PAYMENT_SUCCESS, amount, currency ?? plan.moneda?.toUpperCase() ?? 'USD');
    try { await manychatApi('SUCCESSFUL_PAYMENT'); } catch { /* webhook ya lo agrega */ }
  }

  const handleCancelModal = () => {
    setShowCancelModal(!showCancelModal);
  };
  const handleChangeModal = () => {
    setChangeMessage(`¿Estás seguro que quieres cambiar al plan de: "${plan.name}" de $${plan.price} ${plan.moneda}? Deberás pagar la diferencia de precio.`);
    setChangeTitle("Cambio de plan");
    setShowChangeModal(!showChangeModal);
  };
  const handleErrorModal = () => {
    setShowError(!showError);
  };
  const handleOxxoModal = async () => {
    let tempOxxo = !showOxxoModal;
    setShowOxxoModal(tempOxxo);
    if (tempOxxo) {
      handleManyChat();
    }
  };
  const openSuccess = () => {
    setShowSuccess(true);
  };
  const closeSuccess = () => {
    setShowSuccess(false);
    if (pathname === "/actualizar-planes") {
      getCurrentPlan();
    } else {
      navigate("/");
      window.location.reload();
    }
  };
  const changePlan = async () => {
    trackManyChatConversion(MC_EVENTS.CHANGE_PLAN);
    try {
      let body = {
        newPlanId: plan.id,
      };
      if (plan.paypal_plan_id || plan.paypal_plan_id_test) {
        const changeplan: any =
          await trpc.subscriptions.changeSubscriptionPlan.mutate(body);
        const url = changeplan.data.links[0].href;
        window.open(url, "_blank");
      } else {
        const changeplan =
          await trpc.subscriptions.changeSubscriptionPlan.mutate(body);
        console.log(changeplan);
        openSuccess();
        setSuccessMessage("Tú cambio de plan está siendo procesado, esto puede tomar varios minutos.");
        setSuccessTitle("Cambio de suscripción");
      }
    } catch (error: any) {
      console.log(error.message);
      setErrorMSG(error.message);
      handleErrorModal();
    }
  };
  const finishSubscription = async () => {
    trackManyChatConversion(MC_EVENTS.CANCEL_SUBSCRIPTION);
    try {
      await trpc.subscriptions.requestSubscriptionCancellation.mutate();
      openSuccess();
      setSuccessMessage("Su suscripción se ha cancelado con éxito.");
      setSuccessTitle("Suscripción Cancelada");
    } catch (error: any) {
      setErrorMSG(error.message);
      handleErrorModal();
    }
  };

  const retreivePaypalPlan = useCallback(async () => {
    let body = {
      where: {
        activated: 1,
        stripe_prod_id: null,
        stripe_prod_id_test: '',
        moneda: plan.moneda.toUpperCase(),
        price: +plan.price,
      },
    };
    try {
      const plans: any = await trpc.plans.findManyPlans.query(body);
      if (plans.length > 0) {
        setppPlan(plans[0]);
      }
    } catch (error) {
      console.log(error);
    }
  }, [plan]
  )

  const handleButtonClick = () => {
    // fbq('track', 'CarritoAbandonado');
    // manyChatPixel.track('PageView');
  };
  const payWithOxxo = async () => {
    handleUserClickOnPlan();
    trpc.checkoutLogs.registerCheckoutLog.mutate();
    try {
      let body = {
        planId: plan.id,
        paymentMethod: "cash" as const,
      };
      const oxxoPay =
        await trpc.subscriptions.subscribeWithCashConekta.mutate(body);
      handleOxxoModal();
      setOxxoData(oxxoPay);
      handleButtonClick();
    } catch (error: any) {
      setErrorMSG(error.message);
      handleErrorModal();
    }
  };
  const payWithSpei = async () => {
    trackManyChatConversion(MC_EVENTS.CLICK_SPEI);
    handleUserClickOnPlan();
    trpc.checkoutLogs.registerCheckoutLog.mutate();
    try {
      let body = {
        planId: plan.id,
        paymentMethod: "spei" as const,
      };
      const speiPay =
        await trpc.subscriptions.subscribeWithCashConekta.mutate(body);
      setShowSpeiModal(true);
      setSpeiData(speiPay);
      handleButtonClick();
    } catch (error: any) {
      setErrorMSG(error.message);
      handleErrorModal();
    }
  };
  const handleCheckout = async (planId: number) => {
    trackManyChatConversion(MC_EVENTS.CLICK_BUY);
    handleUserClickOnPlan();
    trpc.checkoutLogs.registerCheckoutLog.mutate();
    navigate(`/comprar?priceId=${planId}`);
  };

  const successSubscription = async (data: any) => {
    await trpc.subscriptions.subscribeWithPaypal.mutate({
      planId: ppPlan.id,
      subscriptionId: data.subscriptionID,
      fbp: cookies._fbp,
      url: window.location.href,
    });
    setSuccessMessage("Gracias por tu pago, ya puedes empezar a descargar!");
    setSuccessTitle("Compra Exitosa");
    handleUserSuccessfulPayment(Number(plan.price) || 0, plan.moneda?.toUpperCase());
    openSuccess();
    return data;
  }

  useEffect(() => { retreivePaypalPlan() }, [retreivePaypalPlan]);

  return (
    <div className={"plan-card-wrapper " + (plan.moneda === "usd" ? "resp-plan " : "")}>
      <div className="plan-card-glow" aria-hidden />
      <div
        className={
          "plan-card-main-card " +
          (plan.moneda === "usd" ? "resp-plan " : "") +
          (currentPlan ? "plan-white-card" : "")
        }
      >
        {currentPlan && <p className="announce">Actual</p>}
        <div className="c-row">
          <h2 className="plan-card-title">{plan.name}</h2>
        </div>
        <div className="c-row plan-card-price-row">
          <span className="plan-card-price-amount">${plan.price}.00</span>
          <span className="plan-card-price-currency">{plan.moneda}</span>
        </div>
        <div className="plan-card-gb-highlight">
          <span className="plan-card-gb-value">{plan.gigas.toString()} GB</span>
          <span className="plan-card-gb-label">de descarga al mes</span>
        </div>
        <div className="c-row">
          <p className="plan-card-subtitle">{plan.description}</p>
        </div>
        <div className="c-row">
          <p className="plan-card-subtitle">Duración: {plan.duration} días</p>
        </div>
        <ul className="plan-card-benefits">
          {plans[0].included.map((ad) => (
            <li key={ad} className="plan-card-benefit-item">
              <CheckIconCyan />
              <span>{ad}</span>
            </li>
          ))}
        </ul>
        <div className="plan-card-payment-section">
          <p className="plan-card-payment-label">Elige cómo pagar</p>
          <p className="plan-card-payment-sublabel">Pagos seguros · Tarjeta, PayPal, SPEI u OXXO (México)</p>
        </div>
        <div className="button-contain" id="abandonedCartBtn">
        {currentPlan ? (
          <button className="silver-bg" onClick={handleCancelModal}>
            Cancelar plan
          </button>
        ) : (
          <>
            {pathname === "/actualizar-planes" ? (
              <button className="plan-card-btn-primary" onClick={handleChangeModal}>Cambiar plan</button>
            ) : (
              <>
                {(plan.moneda === "mxn" || plan.moneda === "MXN") && (
                  <>
                    <button
                      id="pixelButton"
                      className="plan-card-btn-secondary silver-bg"
                      onClick={payWithOxxo}
                    >
                      Pagar con OXXO
                    </button>
                    <button className="plan-card-btn-secondary silver-bg" onClick={payWithSpei}>
                      Pagar con SPEI
                    </button>
                  </>
                )}
                <button className="plan-card-btn-primary" onClick={() => handleCheckout(plan.id)}>
                  Comprar con tarjeta
                </button>
                {ppPlan !== null &&
                  (ppPlan.paypal_plan_id || ppPlan.paypal_plan_id_test) && (
                  <PayPalComponent
                    plan={ppPlan}
                    type={'subscription'}
                    onApprove={successSubscription}
                    onClick={() => { trackManyChatConversion(MC_EVENTS.CLICK_PAYPAL); handleUserClickOnPlan(); }}
                    key={`paypal-button-component-${plan.id}`}
                  />
                )}
              </>
            )}
          </>
        )}
      </div>
      <ConditionModal
        title={"Cancelación de suscripción"}
        message={"¿Estás seguro que quieres cancelar tu suscripción?"}
        show={showCancelModal}
        onHide={handleCancelModal}
        action={finishSubscription}
      />
      <ConditionModal
        title={"Cambio de plan"}
        message={`¿Estás seguro que quieres cambiar al plan de: "${plan.name}" de $${plan.price} ${plan.moneda}?`}
        show={false}
        onHide={handleChangeModal}
        action={changePlan}
      />
      <ChangeSubscriptionModal
        title={changeTitle}
        message={changeMessage}
        show={showChangeModal}
        onHide={handleChangeModal}
        action={changePlan}
        plan={plan}
      />
      <OxxoModal
        show={showOxxoModal}
        onHide={handleOxxoModal}
        price={plan.price}
        oxxoData={oxxoData}
      />
      <SpeiModal
        show={showSpeiModal}
        onHide={() => {
          setShowSpeiModal(false);
        }}
        price={plan.price}
        speiData={speiData}
      />
      <SuccessModal
        show={showSuccess}
        onHide={closeSuccess}
        message={successMessage}
        title={successTitle}
      />
      <ErrorModal
        show={showError}
        onHide={handleErrorModal}
        message={errorMSG}
      />
    </div>
    </div>
  );
}
export default PlanCard;
