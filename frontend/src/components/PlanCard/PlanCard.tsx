import { IOxxoData, IPlans, ISpeiData } from "../../interfaces/Plans";
import "./PlanCard.scss";
import { useLocation, useNavigate } from "react-router-dom";
import { plans } from "../../utils/Constants";
import React, { useCallback, useEffect, useState } from "react";
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
import { PiLightning, PiFolderOpen, PiMusicNotes, PiDownloadSimple, PiHeartBreak, PiLockOpen } from "react-icons/pi";

// Copy persuasivo CRO: texto aburrido → gancho emocional
const BENEFIT_COPY: Record<string, string> = {
  "Contenido exclusivo para DJs": "Remixes Privados (No en Spotify)",
  "Todo organizado por géneros": "Carpetas Listas para Tocar",
  "Nueva música cada semana": "Nueva música cada semana",
  "Descargas con 1 click": "Descargas con 1 click",
  "Renovación automática": "Cancela cuando quieras (Sin ataduras)",
};

const BENEFIT_ICONS: Record<string, React.ReactNode> = {
  "Contenido exclusivo para DJs": <PiMusicNotes className="plan-card-benefit-icon" aria-hidden />,
  "Todo organizado por géneros": <PiFolderOpen className="plan-card-benefit-icon" aria-hidden />,
  "Nueva música cada semana": <PiLightning className="plan-card-benefit-icon" aria-hidden />,
  "Descargas con 1 click": <PiDownloadSimple className="plan-card-benefit-icon" aria-hidden />,
  "Renovación automática": <PiHeartBreak className="plan-card-benefit-icon" aria-hidden />,
};


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
      const msg =
        error?.data?.message ??
        error?.message ??
        "No se pudo generar la transferencia SPEI. Verifica que el plan sea en pesos (MXN) o intenta más tarde.";
      setErrorMSG(msg);
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

  const isMxn = plan.moneda === "mxn" || plan.moneda === "MXN";
  const showBadge = isMxn; // "MEJOR VALOR" en planes MXN

  return (
    <div className={"plan-card-wrapper plan-card-monolith " + (plan.moneda === "usd" ? "resp-plan " : "")}>
      <div className="plan-card-glow" aria-hidden />
      <div
        className={
          "plan-card-main-card " +
          (plan.moneda === "usd" ? "resp-plan " : "") +
          (currentPlan ? "plan-white-card" : "")
        }
      >
        {currentPlan && <span className="plan-card-badge plan-card-badge--actual">Actual</span>}
        {!currentPlan && showBadge && <span className="plan-card-badge plan-card-badge--value">MEJOR VALOR</span>}
        <div className="c-row">
          <h2 className="plan-card-title">{plan.name}</h2>
        </div>
        <div className="c-row plan-card-price-row">
          <span className="plan-card-price-amount">${plan.price}.00</span>
          <span className="plan-card-price-currency">{plan.moneda}</span>
        </div>
        <div className="plan-card-data-visualizer">
          <div className="plan-card-data-visualizer-header">
            <span className="plan-card-gb-value">{plan.gigas.toString()} GB</span>
            <span className="plan-card-data-visualizer-label">Tu Arsenal Mensual</span>
          </div>
          <div className="plan-card-progress-track">
            <div className="plan-card-progress-fill" style={{ width: "100%" }} />
          </div>
        </div>
        <p className="plan-card-subtitle plan-card-description">{plan.description}</p>
        <p className="plan-card-subtitle plan-card-access">Acceso Ilimitado 24/7</p>
        <ul className="plan-card-benefits">
          {plans[0].included.map((ad) => (
            <li key={ad} className="plan-card-benefit-item">
              {BENEFIT_ICONS[ad] ?? <PiLightning className="plan-card-benefit-icon" aria-hidden />}
              <span>{BENEFIT_COPY[ad] ?? ad}</span>
            </li>
          ))}
        </ul>
        <div className="plan-card-cta-section" id="abandonedCartBtn">
          {currentPlan ? (
            <button className="plan-card-btn-cancel" onClick={handleCancelModal}>
              Cancelar plan
            </button>
          ) : (
            <>
              {pathname === "/actualizar-planes" ? (
                <button className="plan-card-btn-hero" onClick={handleChangeModal}>
                  <PiLockOpen aria-hidden /> Cambiar plan
                </button>
              ) : (
                <>
                  <button
                    className="plan-card-btn-hero"
                    onClick={() => handleCheckout(plan.id)}
                  >
                    <PiLockOpen aria-hidden /> DESBLOQUEAR ACCESO AHORA
                  </button>
                  {(isMxn || (ppPlan !== null && (ppPlan.paypal_plan_id || ppPlan.paypal_plan_id_test))) && (
                    <div className="plan-card-secondary-payment">
                      <span className="plan-card-secondary-label">O paga con:</span>
                      <div className="plan-card-secondary-buttons">
                        {isMxn && (
                          <button type="button" className="plan-card-btn-outline" onClick={payWithSpei}>
                            SPEI
                          </button>
                        )}
                        {ppPlan !== null && (ppPlan.paypal_plan_id || ppPlan.paypal_plan_id_test) && (
                          <PayPalComponent
                            plan={ppPlan}
                            type="subscription"
                            onApprove={successSubscription}
                            onClick={() => { trackManyChatConversion(MC_EVENTS.CLICK_PAYPAL); handleUserClickOnPlan(); }}
                            key={`paypal-button-component-${plan.id}`}
                          />
                        )}
                      </div>
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </div>
        <p className="plan-card-trust">🔒 Pagos encriptados con seguridad bancaria</p>
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
  );
}
export default PlanCard;
