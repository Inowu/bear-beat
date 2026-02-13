import { IPlans } from "../../interfaces/Plans";
import "./PlanCard.scss";
import { useLocation, useNavigate } from "react-router-dom";
import React, { useCallback, useEffect, useState } from "react";
import trpc from "../../api";
import { manychatApi } from "../../api/manychat";
import {
  CancellationReasonModal,
  type CancellationReasonCode,
  ChangeSubscriptionModal,
  ErrorModal,
  SuccessModal
} from "../../components/Modals";
import PayPalComponent from "../../components/PayPal/PayPalComponent";
import PaymentMethodLogos, { type PaymentMethodId } from "../../components/PaymentMethodLogos/PaymentMethodLogos";
import { useCookies } from "react-cookie";
import { trackPurchase, trackViewPlans } from "../../utils/facebookPixel";
import { trackManyChatConversion, trackManyChatPurchase, MC_EVENTS } from "../../utils/manychatPixel";
import { generateEventId } from "../../utils/marketingIds";
import { GROWTH_METRICS, getGrowthAttribution, trackGrowthMetric } from "../../utils/growthMetrics";
import { Download, FolderOpen, HeartCrack, Music, Unlock, Zap } from "lucide-react";
import { formatInt } from "../../utils/format";

// Copy persuasivo CRO: texto aburrido → gancho emocional
const BENEFIT_COPY: Record<string, string> = {
  "Contenido exclusivo para DJs": "Catálogo pensado para cabina en vivo",
  "Todo organizado por géneros": "Búsqueda rápida por género y temporada",
  "Nueva música cada semana": "Nuevos contenidos cada semana",
  "Descargas con 1 click": "Descarga directa por FTP",
  "Renovación automática": "Cancela cuando quieras",
};

const BENEFIT_ICONS: Record<string, React.ReactNode> = {
  "Contenido exclusivo para DJs": <Music className="plan-card-benefit-icon" aria-hidden />,
  "Todo organizado por géneros": <FolderOpen className="plan-card-benefit-icon" aria-hidden />,
  "Nueva música cada semana": <Zap className="plan-card-benefit-icon" aria-hidden />,
  "Descargas con 1 click": <Download className="plan-card-benefit-icon" aria-hidden />,
  "Renovación automática": <HeartCrack className="plan-card-benefit-icon" aria-hidden />,
};

const DEFAULT_BENEFITS = [
  "Contenido exclusivo para DJs",
  "Todo organizado por géneros",
  "Nueva música cada semana",
  "Descargas con 1 click",
  "Renovación automática",
];

function formatPlanCurrency(amount: number, currency: string): string {
  const locale = currency.toUpperCase() === "USD" ? "en-US" : "es-MX";
  const fractionDigits = 2;
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency: currency.toUpperCase(),
      minimumFractionDigits: fractionDigits,
      maximumFractionDigits: fractionDigits,
    }).format(amount);
  } catch {
    return `${amount.toFixed(fractionDigits)} ${currency.toUpperCase()}`;
  }
}


interface PlanCardPropsI {
  plan: IPlans;
  currentPlan?: boolean;
  getCurrentPlan: () => void;
  userEmail?: string;
  userPhone?: string;
  showRecommendedBadge?: boolean;
  variant?: "default" | "marketing";
  compactMarketingCopy?: boolean;
  trialConfig?: {
    enabled: boolean;
    days: number;
    gb: number;
    eligible?: boolean | null;
  } | null;
}
function PlanCard(props: PlanCardPropsI) {
  const {
    plan,
    currentPlan,
    getCurrentPlan,
    userEmail,
    showRecommendedBadge = true,
    variant = "default",
    compactMarketingCopy = false,
    trialConfig,
  } = props;
  const isMarketing = variant === "marketing";
  const isCompactMarketing = isMarketing && compactMarketingCopy;
	  const [showSuccess, setShowSuccess] = useState<boolean>(false);
	  const [showCancelModal, setShowCancelModal] = useState<boolean>(false);
  const [showChangeModal, setShowChangeModal] = useState<boolean>(false);
  const [showError, setShowError] = useState<boolean>(false);
  const [showAltPayments, setShowAltPayments] = useState<boolean>(false);
  const [showPaypal, setShowPaypal] = useState<boolean>(false);
  const [showAllBenefits, setShowAllBenefits] = useState<boolean>(() => !isMarketing);
  const [ppPlan, setppPlan] = useState<null | any>(null);
  const [conektaAvailability, setConektaAvailability] = useState<{
    oxxoEnabled: boolean;
    payByBankEnabled: boolean;
  } | null>(null);
  const [errorMSG, setErrorMSG] = useState<string>("");
  const [successTitle, setSuccessTitle] = useState<string>("");
  const [successMessage, setSuccessMessage] = useState<string>("");
  const [changeMessage, setChangeMessage] = useState("");
  const [changeTitle, setChangeTitle] = useState("");
  const navigate = useNavigate();
  const location = useLocation();
  const [cookies] = useCookies(['_fbp', '_fbc']);
  const { pathname } = location;

  const handleUserClickOnPlan = async () => {
    trackViewPlans({ currency: plan.moneda ?? undefined });
    trackManyChatConversion(MC_EVENTS.SELECT_PLAN);
    try { await manychatApi('USER_CHECKED_PLANS'); } catch { /* API fallback en backend */ }
  }

  const handleCancelModal = () => {
    const next = !showCancelModal;
    setShowCancelModal(next);
    if (next) {
      trackGrowthMetric(GROWTH_METRICS.SUBSCRIPTION_CANCEL_STARTED, {
        surface: pathname === "/actualizar-planes" ? "plan_upgrade" : "plans",
        planId: plan.id,
        currency: (plan.moneda ?? "USD").toUpperCase(),
        amount: Number(plan.price) || null,
      });
    }
  };
  const handleChangeModal = () => {
    setChangeMessage(`¿Estás seguro que quieres cambiar al plan de: "${plan.name}" de $${plan.price} ${plan.moneda}? Deberás pagar la diferencia de precio.`);
    setChangeTitle("Cambio de plan");
    setShowChangeModal(!showChangeModal);
  };
	  const handleErrorModal = () => {
	    setShowError(!showError);
	  };
	  const openSuccess = () => {
	    setShowSuccess(true);
	  };
	  const closeSuccess = () => {
	    setShowSuccess(false);
    if (pathname === "/actualizar-planes") {
      getCurrentPlan();
    } else {
      navigate("/", { replace: true });
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
        await trpc.subscriptions.changeSubscriptionPlan.mutate(body);
        openSuccess();
        setSuccessMessage("Tú cambio de plan está siendo procesado, esto puede tomar varios minutos.");
        setSuccessTitle("Cambio de suscripción");
      }
    } catch (error: any) {
      setErrorMSG(error.message);
      handleErrorModal();
    }
  };
  const finishSubscription = async (reasonCode: CancellationReasonCode, reasonText: string) => {
    trackManyChatConversion(MC_EVENTS.CANCEL_SUBSCRIPTION);
    try {
      await trpc.subscriptions.requestSubscriptionCancellation.mutate({
        reasonCode,
        reasonText: reasonText?.trim() ? reasonText.trim() : null,
        attribution: getGrowthAttribution(),
      });
      trackGrowthMetric(GROWTH_METRICS.SUBSCRIPTION_CANCEL_CONFIRMED, {
        surface: pathname === "/actualizar-planes" ? "plan_upgrade" : "plans",
        planId: plan.id,
        reasonCode,
      });
      openSuccess();
      setSuccessMessage("Su suscripción se ha cancelado con éxito.");
      setSuccessTitle("Suscripción Cancelada");
    } catch (error: any) {
      trackGrowthMetric(GROWTH_METRICS.SUBSCRIPTION_CANCEL_FAILED, {
        surface: pathname === "/actualizar-planes" ? "plan_upgrade" : "plans",
        planId: plan.id,
        reasonCode,
        reason: error?.message ?? "unknown-error",
      });
      throw error;
    }
  };

	  const retreivePaypalPlan = useCallback(async () => {
	    // If this plan already has PayPal config, use it directly.
	    if (plan.paypal_plan_id || plan.paypal_plan_id_test) {
	      setppPlan(plan);
	      return;
	    }

	    // Otherwise, try to find a sibling plan (same currency/price) that has PayPal IDs.
	    const body = {
	      where: {
	        activated: 1,
	        moneda: (plan.moneda ?? "").toLowerCase(),
	        price: +plan.price,
	        OR: [
	          { paypal_plan_id: { not: null } },
	          { paypal_plan_id_test: { not: "" } },
	        ],
	      },
	    };
	    try {
	      const plans: IPlans[] = await trpc.plans.findManyPlans.query(body as any);
	      const match = plans.find((p) => Boolean(p.paypal_plan_id || p.paypal_plan_id_test)) ?? null;
	      setppPlan(match);
	    } catch {
	      // noop
	    }
	  }, [plan]);

  const handleCheckout = async (planId: number) => {
    trackManyChatConversion(MC_EVENTS.CLICK_BUY);
    handleUserClickOnPlan();
    void trpc.checkoutLogs.registerCheckoutLog.mutate().catch(() => {});
    trackGrowthMetric(GROWTH_METRICS.CTA_CLICK, {
      id: "plans_primary_checkout",
      location: pathname === "/actualizar-planes" ? "plan_upgrade" : "plans",
      planId,
    });
    const target = `/comprar?priceId=${planId}`;
    // /planes es pública; si el usuario no está logueado, mandarlo directo a registro con return URL.
    if (!userEmail) {
      navigate("/auth/registro", { state: { from: target } });
      return;
    }
    navigate(target);
  };

  const handleCheckoutWithMethod = (planId: number, method: string) => {
    const target = `/comprar?priceId=${planId}&method=${encodeURIComponent(method)}`;
    trackGrowthMetric(GROWTH_METRICS.CTA_CLICK, {
      id: `plans_method_${method}`,
      location: pathname === "/actualizar-planes" ? "plan_upgrade" : "plans",
      planId,
      method,
    });
    if (!userEmail) {
      navigate("/auth/registro", { state: { from: target } });
      return;
    }
    navigate(target);
  };

  const successSubscription = async (data: any) => {
    const eventId = generateEventId("purchase");
    await trpc.subscriptions.subscribeWithPaypal.mutate({
      planId: plan.id,
      subscriptionId: data.subscriptionID,
      fbp: cookies._fbp,
      fbc: cookies._fbc,
      url: window.location.href,
      eventId,
    });
    setSuccessMessage("Gracias por tu pago, ya puedes empezar a descargar!");
    setSuccessTitle("Compra Exitosa");
    trackPurchase({
      value: Number(plan.price) || 0,
      currency: (plan.moneda || "USD").toUpperCase(),
      eventId,
    });
    trackGrowthMetric(GROWTH_METRICS.PAYMENT_SUCCESS, {
      planId: ppPlan?.id ?? plan.id,
      amount: Number(plan.price) || 0,
      value: Number(plan.price) || 0,
      currency: (plan.moneda || "USD").toUpperCase(),
      eventId,
    });
    trackManyChatConversion(MC_EVENTS.PAYMENT_SUCCESS);
    if ((Number(plan.price) || 0) > 0) {
      trackManyChatPurchase(
        MC_EVENTS.PAYMENT_SUCCESS,
        Number(plan.price) || 0,
        (plan.moneda || "USD").toUpperCase(),
      );
    }
    try { await manychatApi('SUCCESSFUL_PAYMENT'); } catch { /* webhook ya lo agrega */ }
    openSuccess();
    return data;
  }

  useEffect(() => { retreivePaypalPlan() }, [retreivePaypalPlan]);

  const isMxn = plan.moneda === "mxn" || plan.moneda === "MXN";
  useEffect(() => {
    let cancelled = false;
    if (!isMxn) {
      setConektaAvailability(null);
      return;
    }
    (async () => {
      try {
        const result = await trpc.subscriptions.getConektaAvailability.query();
        if (!cancelled) {
          setConektaAvailability({
            oxxoEnabled: Boolean(result?.oxxoEnabled),
            payByBankEnabled: Boolean(result?.payByBankEnabled),
          });
        }
      } catch {
        if (!cancelled) setConektaAvailability({ oxxoEnabled: false, payByBankEnabled: false });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isMxn]);
  const showBadge = isMxn && !currentPlan && showRecommendedBadge;
  const includedBenefits = DEFAULT_BENEFITS;
  const marketingBenefitLimit = isCompactMarketing ? 2 : 3;
  const visibleBenefits =
    isMarketing && !showAllBenefits ? includedBenefits.slice(0, marketingBenefitLimit) : includedBenefits;
  const showBenefitsToggle = isMarketing && !isCompactMarketing && includedBenefits.length > 3;
  const hasPaypalPlan = ppPlan !== null && Boolean(ppPlan.paypal_plan_id || ppPlan.paypal_plan_id_test);
  const showPaypalOption = hasPaypalPlan;
  const planCurrency = (plan.moneda ?? "MXN").toUpperCase();
  const planPriceValue = Number(plan.price ?? 0) || 0;
  const formattedPlanPrice = formatPlanCurrency(planPriceValue, planCurrency);
	  const mxnPaymentSummary = (() => {
	    const parts = ["Tarjeta", "SPEI"];
	    if (conektaAvailability?.payByBankEnabled) parts.push("BBVA");
	    if (conektaAvailability?.oxxoEnabled) parts.push("Efectivo");
      if (showPaypalOption) parts.push("PayPal");
	    return parts.join(" / ");
	  })();
  const paymentSummary = isMxn
	    ? mxnPaymentSummary
	    : showPaypalOption
	      ? "Tarjeta o PayPal"
	      : "Tarjeta internacional";
	  const primaryCtaLabel = !userEmail
	    ? (trialConfig?.enabled && trialConfig.eligible !== false && Number.isFinite(trialConfig.days) && (trialConfig.days ?? 0) > 0
        ? "Crear cuenta y empezar prueba"
        : "Crear cuenta y activar")
	    : isMarketing
	      ? "Activar ahora"
	      : (isMxn ? "Activar plan MXN" : "Activar plan USD");
	  const paymentLogos: PaymentMethodId[] = isMxn
	    ? (conektaAvailability?.oxxoEnabled
	      ? (showPaypalOption
	        ? ["visa", "mastercard", "amex", "paypal", "spei", "oxxo"]
	        : ["visa", "mastercard", "amex", "spei", "oxxo"])
	      : (showPaypalOption
	        ? ["visa", "mastercard", "amex", "paypal", "spei"]
	        : ["visa", "mastercard", "amex", "spei"]))
	    : showPaypalOption
	      ? ["visa", "mastercard", "amex", "paypal"]
	      : ["visa", "mastercard", "amex"];

  const showTrialMessaging = Boolean(trialConfig?.enabled) && isMarketing;
  const formattedTrial =
    trialConfig?.enabled && trialConfig.eligible !== false
      ? `${formatInt(trialConfig.days)} días + ${formatInt(trialConfig.gb)} GB`
      : null;
	  const trialNearCtaCopy = (() => {
    if (!showTrialMessaging) return null;
    if (trialConfig?.eligible === false) {
      return "Prueba solo 1ª vez con tarjeta. En esta cuenta se activa al pagar.";
    }
    if (!formattedTrial) return null;
    if (isMxn) {
      const alternatives = ["SPEI"];
      if (showPaypalOption) alternatives.unshift("PayPal");
      if (conektaAvailability?.oxxoEnabled) alternatives.push("Efectivo");
      return `Prueba (${formattedTrial}) solo con tarjeta (Stripe). ${alternatives.join("/")} activan sin prueba.`;
    }
    return `Prueba (${formattedTrial}) solo con tarjeta (Stripe). PayPal activa sin prueba.`;
  })();

  return (
    <div
      className={
        "plan-card-wrapper plan-card-monolith " +
        (plan.moneda === "usd" ? "resp-plan " : "") +
        (isMarketing ? "is-marketing " : "") +
        (isCompactMarketing ? "is-marketing-compact " : "")
      }
    >
      <div className="plan-card-glow" aria-hidden />
      <div
        className={
          "plan-card-main-card " +
          (plan.moneda === "usd" ? "resp-plan " : "") +
          (currentPlan ? "plan-white-card" : "")
        }
      >
        {currentPlan && <span className="plan-card-badge plan-card-badge--actual">Actual</span>}
        {showBadge && <span className="plan-card-badge plan-card-badge--value">MÁS ELEGIDO</span>}
        <header className="c-row plan-card-head">
          {!isCompactMarketing && <p className="plan-card-kicker">{isMxn ? "Pago local" : "Pago internacional"}</p>}
          <h2 className="plan-card-title">{plan.name}</h2>
          <div className="plan-card-price-row">
            <span className="plan-card-price-amount">{formattedPlanPrice}</span>
            <span className="plan-card-price-currency">{planCurrency} / mes</span>
          </div>
        </header>
        <ul className="plan-card-highlights" aria-label={`Incluye en ${plan.name}`}>
          <li className="plan-card-highlight-item">
            <strong>{formatInt(Number(plan.gigas ?? 0))} GB/mes</strong> de descarga
          </li>
          <li className="plan-card-highlight-item">Catálogo completo (eliges qué descargar)</li>
          {!isMarketing && <li className="plan-card-highlight-item">Métodos: {paymentSummary}</li>}
        </ul>
        <ul className="plan-card-benefits">
          {visibleBenefits.map((ad) => (
            <li key={ad} className="plan-card-benefit-item">
              {BENEFIT_ICONS[ad] ?? <Zap className="plan-card-benefit-icon" aria-hidden />}
              <span>{BENEFIT_COPY[ad] ?? ad}</span>
            </li>
          ))}
        </ul>
        {showBenefitsToggle && (
          <button
            type="button"
            className="plan-card-benefits-toggle"
            onClick={() => setShowAllBenefits((prev) => !prev)}
            aria-expanded={showAllBenefits}
          >
            {showAllBenefits ? "Ver menos" : "Ver todo lo que incluye"}
          </button>
        )}
        <div className="plan-card-cta-section" id="abandonedCartBtn">
          {currentPlan ? (
            <button className="plan-card-btn-cancel" onClick={handleCancelModal}>
              Cancelar plan
            </button>
          ) : (
            <>
              {pathname === "/actualizar-planes" ? (
                <button className="plan-card-btn-hero" onClick={handleChangeModal}>
                  <Unlock aria-hidden /> Cambiar plan
                </button>
              ) : (
                <>
              <button
                className="plan-card-btn-hero"
                onClick={() => handleCheckout(plan.id)}
                data-testid={`plan-primary-cta-${plan.id}`}
              >
                <Unlock aria-hidden /> {primaryCtaLabel}
              </button>
                    {trialNearCtaCopy && !isCompactMarketing && <p className="plan-card-trial-note">{trialNearCtaCopy}</p>}
                    {isMarketing && !isCompactMarketing && (
                      <ul className="plan-card-trust-row" aria-label="Confianza">
                        <li>Pago seguro</li>
                        <li>Activación guiada 1 a 1</li>
                        <li>Cancela cuando quieras</li>
                      </ul>
                    )}
                    {isMxn && !isMarketing && (
                      <div className="plan-card-alt-payments">
                        <button
                          type="button"
                          className="plan-card-alt-toggle"
                          aria-expanded={showAltPayments}
                          aria-controls={`plan-alt-payments-${plan.id}`}
                          onClick={() => setShowAltPayments((prev) => !prev)}
	                        >
	                          {showAltPayments ? "Cerrar opciones" : "Otras formas de pago"}
	                        </button>
                        {showAltPayments && (
                          <div
                            id={`plan-alt-payments-${plan.id}`}
                            className="plan-card-alt-panel"
                          >
                            <div className="plan-card-alt-head">
                              <span className="plan-card-secondary-label">
                                {userEmail ? "Paga con:" : "Inicia sesión para pagar con:"}
                              </span>
                              {showTrialMessaging && <span className="plan-card-alt-badge">Sin prueba</span>}
                            </div>
                            <div className="plan-card-secondary-buttons">
                              <button
                                type="button"
                                className="plan-card-btn-outline"
                                onClick={() => handleCheckoutWithMethod(plan.id, "spei")}
                              >
                                <span className="plan-card-btn-label">SPEI (recurrente)</span>
                              </button>
                              {conektaAvailability?.payByBankEnabled && (
                                <button
                                  type="button"
                                  className="plan-card-btn-outline"
                                  onClick={() => handleCheckoutWithMethod(plan.id, "bbva")}
                                >
                                  <span className="plan-card-btn-label">BBVA (Pago directo)</span>
                                </button>
                              )}
                              {conektaAvailability?.oxxoEnabled && (
                                <button
                                  type="button"
                                  className="plan-card-btn-outline"
                                  onClick={() => handleCheckoutWithMethod(plan.id, "oxxo")}
                                >
                                  <span className="plan-card-btn-label">Efectivo</span>
                                </button>
                              )}
                              {showPaypalOption &&
                                (userEmail ? (
                                  <PayPalComponent
                                    plan={ppPlan!}
                                    type="subscription"
                                    onApprove={successSubscription}
                                    onClick={() => {
                                      trackGrowthMetric(GROWTH_METRICS.CTA_CLICK, {
                                        id: "plans_pay_paypal",
                                        location: pathname === "/actualizar-planes" ? "plan_upgrade" : "plans",
                                        planId: plan.id,
                                        method: "paypal",
                                      });
                                      trackManyChatConversion(MC_EVENTS.CLICK_PAYPAL);
                                      handleUserClickOnPlan();
                                    }}
                                    key={`paypal-button-component-${plan.id}`}
                                  />
                                ) : (
                                  <button
                                    type="button"
                                    className="plan-card-btn-outline"
                                    onClick={() => {
                                      trackGrowthMetric(GROWTH_METRICS.CTA_CLICK, {
                                        id: "plans_pay_paypal",
                                        location: pathname === "/actualizar-planes" ? "plan_upgrade" : "plans",
                                        planId: plan.id,
                                        method: "paypal",
                                      });
                                      navigate("/auth/registro", { state: { from: "/planes" } });
                                    }}
                                  >
                                    <span className="plan-card-btn-label">PayPal</span>
                                  </button>
                                ))}
                            </div>
                            {showTrialMessaging && (
                              <p className="plan-card-alt-hint">Estas opciones activan sin prueba.</p>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                    {!isMxn && showPaypalOption && (
                      isMarketing ? (
                        <div className="plan-card-secondary-payment">
                          <button
                            type="button"
                            className="plan-card-alt-toggle"
                            aria-expanded={showPaypal}
                            aria-controls={`plan-paypal-${plan.id}`}
                            onClick={() => setShowPaypal((prev) => !prev)}
                          >
                            {showPaypal ? "Ocultar PayPal" : "Pagar con PayPal"}
                          </button>
                          {showPaypal && (
                            <div id={`plan-paypal-${plan.id}`} className="plan-card-alt-panel">
                              <span className="plan-card-secondary-label">
                                {userEmail ? "Continúa con PayPal:" : "Inicia sesión para pagar con PayPal:"}
                              </span>
                              <div className="plan-card-secondary-buttons">
                                {userEmail ? (
                                  <PayPalComponent
                                    plan={ppPlan!}
                                    type="subscription"
                                    onApprove={successSubscription}
                                    onClick={() => {
                                      trackGrowthMetric(GROWTH_METRICS.CTA_CLICK, {
                                        id: "plans_pay_paypal",
                                        location: pathname === "/actualizar-planes" ? "plan_upgrade" : "plans",
                                        planId: plan.id,
                                        method: "paypal",
                                      });
                                      trackManyChatConversion(MC_EVENTS.CLICK_PAYPAL);
                                      handleUserClickOnPlan();
                                    }}
                                    key={`paypal-button-component-${plan.id}`}
                                  />
                                ) : (
                                  <button
                                    type="button"
                                    className="plan-card-btn-outline"
                                    onClick={() => {
                                      trackGrowthMetric(GROWTH_METRICS.CTA_CLICK, {
                                        id: "plans_pay_paypal",
                                        location: pathname === "/actualizar-planes" ? "plan_upgrade" : "plans",
                                        planId: plan.id,
                                        method: "paypal",
                                      });
                                      navigate("/auth/registro", { state: { from: "/planes" } });
                                    }}
                                  >
                                    PayPal
                                  </button>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="plan-card-secondary-payment">
                          <span className="plan-card-secondary-label">
                            {userEmail ? "O paga con PayPal:" : "Inicia sesión para pagar con PayPal:"}
                          </span>
                          <div className="plan-card-secondary-buttons">
                            {userEmail ? (
                              <PayPalComponent
                                plan={ppPlan!}
                                type="subscription"
                                onApprove={successSubscription}
                                onClick={() => {
                                  trackGrowthMetric(GROWTH_METRICS.CTA_CLICK, {
                                    id: "plans_pay_paypal",
                                    location: pathname === "/actualizar-planes" ? "plan_upgrade" : "plans",
                                    planId: plan.id,
                                    method: "paypal",
                                  });
                                  trackManyChatConversion(MC_EVENTS.CLICK_PAYPAL);
                                  handleUserClickOnPlan();
                                }}
                                key={`paypal-button-component-${plan.id}`}
                              />
                            ) : (
                              <button
                                type="button"
                                className="plan-card-btn-outline"
                                onClick={() => {
                                  trackGrowthMetric(GROWTH_METRICS.CTA_CLICK, {
                                    id: "plans_pay_paypal",
                                    location: pathname === "/actualizar-planes" ? "plan_upgrade" : "plans",
                                    planId: plan.id,
                                    method: "paypal",
                                  });
                                  navigate("/auth/registro", { state: { from: "/planes" } });
                                }}
                              >
                                PayPal
                              </button>
                            )}
                          </div>
                        </div>
                      )
                    )}
                </>
              )}
            </>
          )}
	          <PaymentMethodLogos
	            methods={paymentLogos}
	            className="plan-card-payment-logos"
	            ariaLabel={`Métodos de pago disponibles para ${plan.name}`}
	          />
            {!isCompactMarketing && (
		          <p className="plan-card-confidence">
                {isMarketing ? "Activación guiada." : "Activación guiada después del pago."}
              </p>
            )}
		        </div>
		      </div>
      <CancellationReasonModal
        title="Cancelación de suscripción"
        message="Antes de irte, dinos por qué cancelas (nos ayuda a mejorar)."
        show={showCancelModal}
        onHide={handleCancelModal}
        onReasonChange={(reasonCode) => {
          trackGrowthMetric(GROWTH_METRICS.SUBSCRIPTION_CANCEL_REASON_SELECTED, {
            surface: pathname === "/actualizar-planes" ? "plan_upgrade" : "plans",
            planId: plan.id,
            reasonCode,
          });
        }}
        onConfirm={({ reasonCode, reasonText }) => finishSubscription(reasonCode, reasonText)}
      />
	      <ChangeSubscriptionModal
	        title={changeTitle}
	        message={changeMessage}
	        show={showChangeModal}
	        onHide={handleChangeModal}
	        action={changePlan}
	        plan={plan}
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
