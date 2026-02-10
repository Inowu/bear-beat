import { IPlans, IOxxoData, ISpeiData } from "../../interfaces/Plans";
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
  SpeiModal,
  SuccessModal
} from "../../components/Modals";
import { OxxoModal } from "../../components/Modals/OxxoModal/OxxoModal";
import PayPalComponent from "../../components/PayPal/PayPalComponent";
import PaymentMethodLogos, { type PaymentMethodId } from "../../components/PaymentMethodLogos/PaymentMethodLogos";
import { useCookies } from "react-cookie";
import { trackPurchase, trackViewPlans } from "../../utils/facebookPixel";
import { trackManyChatConversion, trackManyChatPurchase, MC_EVENTS } from "../../utils/manychatPixel";
import { generateEventId } from "../../utils/marketingIds";
import { GROWTH_METRICS, getGrowthAttribution, trackGrowthMetric } from "../../utils/growthMetrics";
import { Download, FolderOpen, HeartCrack, Music, Unlock, Zap } from "lucide-react";
import { getConektaFingerprint } from "../../utils/conektaCollect";
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
  trialConfig?: {
    enabled: boolean;
    days: number;
    gb: number;
    eligible?: boolean | null;
  } | null;
}
function PlanCard(props: PlanCardPropsI) {
  const { plan, currentPlan, getCurrentPlan, userEmail, showRecommendedBadge = true } = props;
	  const [showSpeiModal, setShowSpeiModal] = useState<boolean>(false);
	  const [speiData, setSpeiData] = useState({} as ISpeiData);
    const [showOxxoModal, setShowOxxoModal] = useState<boolean>(false);
    const [oxxoData, setOxxoData] = useState({} as IOxxoData);
	  const [showSuccess, setShowSuccess] = useState<boolean>(false);
	  const [showCancelModal, setShowCancelModal] = useState<boolean>(false);
  const [showChangeModal, setShowChangeModal] = useState<boolean>(false);
  const [showError, setShowError] = useState<boolean>(false);
  const [showAltPayments, setShowAltPayments] = useState<boolean>(false);
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
	          { paypal_plan_id_test: { not: null } },
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

	  const handleButtonClick = () => {
	    // fbq('track', 'CarritoAbandonado');
	    // manyChatPixel.track('PageView');
	  };
	  const payWithSpei = async () => {
	    trackManyChatConversion(MC_EVENTS.CLICK_SPEI);
      trackGrowthMetric(GROWTH_METRICS.CTA_CLICK, {
        id: "plans_pay_spei",
        location: pathname === "/actualizar-planes" ? "plan_upgrade" : "plans",
        planId: plan.id,
        method: "spei",
      });
	    handleUserClickOnPlan();
	    void trpc.checkoutLogs.registerCheckoutLog.mutate().catch(() => {});
    try {
      let body = {
        planId: plan.id,
        paymentMethod: "spei" as const,
        fingerprint: await getConektaFingerprint(),
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

  const payWithOxxo = async () => {
    trackManyChatConversion(MC_EVENTS.CLICK_OXXO);
    trackGrowthMetric(GROWTH_METRICS.CTA_CLICK, {
      id: "plans_pay_cash",
      location: pathname === "/actualizar-planes" ? "plan_upgrade" : "plans",
      planId: plan.id,
      method: "oxxo",
    });
    handleUserClickOnPlan();
    void trpc.checkoutLogs.registerCheckoutLog.mutate().catch(() => {});
    try {
      const body = {
        planId: plan.id,
        paymentMethod: "cash" as const,
        fingerprint: await getConektaFingerprint(),
      };
      const oxxoPay = await trpc.subscriptions.subscribeWithCashConekta.mutate(body);
      setShowOxxoModal(true);
      setOxxoData(oxxoPay);
      handleButtonClick();
    } catch (error: any) {
      const msg =
        error?.data?.message ??
        error?.message ??
        "No se pudo generar la referencia de pago en efectivo. Intenta más tarde o usa tarjeta/SPEI.";
      setErrorMSG(msg);
      handleErrorModal();
    }
  };

  const payWithBbva = async () => {
    trackGrowthMetric(GROWTH_METRICS.CTA_CLICK, {
      id: "plans_pay_bbva",
      location: pathname === "/actualizar-planes" ? "plan_upgrade" : "plans",
      planId: plan.id,
      method: "bbva",
    });
    handleUserClickOnPlan();
    void trpc.checkoutLogs.registerCheckoutLog.mutate().catch(() => {});
    try {
      const value = Number(plan.price) || 0;
      const currency = (plan.moneda || "MXN").toUpperCase();
      try {
        window.sessionStorage.setItem(
          "bb.checkout.pendingPurchase",
          JSON.stringify({
            planId: plan.id,
            value,
            currency,
            at: new Date().toISOString(),
          }),
        );
      } catch {
        // noop
      }

      const result = await trpc.subscriptions.subscribeWithPayByBankConekta.mutate({
        planId: plan.id,
        fingerprint: await getConektaFingerprint(),
      });
      if (result?.url) {
        window.location.href = result.url;
        return;
      }
      setErrorMSG("No se pudo abrir el pago BBVA. Intenta con SPEI/Efectivo o tarjeta.");
      handleErrorModal();
    } catch (error: any) {
      const msg =
        error?.data?.message ??
        error?.message ??
        "No se pudo abrir el pago BBVA. Intenta con SPEI/Efectivo o tarjeta.";
      setErrorMSG(msg);
      handleErrorModal();
    }
  };
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
      planId: ppPlan.id,
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
  const hasPaypalPlan = ppPlan !== null && Boolean(ppPlan.paypal_plan_id || ppPlan.paypal_plan_id_test);
  const showPaypalOption = hasPaypalPlan;
  const planCurrency = (plan.moneda ?? "MXN").toUpperCase();
  const planPriceValue = Number(plan.price ?? 0) || 0;
  const planGigasValue = Number(plan.gigas ?? 0) || 0;
  const unitPricePerGb = planGigasValue > 0 ? planPriceValue / planGigasValue : null;
  const unitPriceLabel = unitPricePerGb !== null ? formatPlanCurrency(unitPricePerGb, planCurrency) : null;
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
  const targetAudience = isMxn ? "Pago local en MXN" : "Pago internacional en USD";
  const displayDescription = isMxn
    ? "Ideal para DJs en México que quieren activar rápido y cobrar sin fricción."
    : "Ideal para DJs fuera de México que prefieren pago en USD.";
	  const primaryCtaLabel = !userEmail ? "Crear cuenta y activar" : (isMxn ? "Activar plan MXN" : "Activar plan USD");
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
        {showBadge && <span className="plan-card-badge plan-card-badge--value">MÁS ELEGIDO</span>}
        <header className="c-row plan-card-head">
          <p className="plan-card-kicker">{isMxn ? "Pago local" : "Pago internacional"}</p>
          <h2 className="plan-card-title">{plan.name}</h2>
          <p className="plan-card-target">{targetAudience}</p>
          <div className="plan-card-price-row">
            <span className="plan-card-price-amount">{formattedPlanPrice}</span>
            <span className="plan-card-price-currency">{planCurrency} / mes</span>
          </div>
          {unitPriceLabel && (
            <p className="plan-card-unit-price">Equivale a {unitPriceLabel} por GB descargable</p>
          )}
        </header>
        <ul className="plan-card-highlights" aria-label={`Incluye en ${plan.name}`}>
          <li className="plan-card-highlight-item">
            <strong>{formatInt(Number(plan.gigas ?? 0))} GB/mes</strong> de descarga
          </li>
          <li className="plan-card-highlight-item">Catálogo completo (eliges qué descargar)</li>
          <li className="plan-card-highlight-item">Métodos: {paymentSummary}</li>
        </ul>
        <p className="plan-card-description">{displayDescription || plan.description}</p>
        <ul className="plan-card-benefits">
          {includedBenefits.map((ad) => (
            <li key={ad} className="plan-card-benefit-item">
              {BENEFIT_ICONS[ad] ?? <Zap className="plan-card-benefit-icon" aria-hidden />}
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
                    {isMxn && (
                      <div className="plan-card-alt-payments">
                        <button
                          type="button"
                          className="plan-card-alt-toggle"
                          aria-expanded={showAltPayments}
                          aria-controls={`plan-alt-payments-${plan.id}`}
                          onClick={() => setShowAltPayments((prev) => !prev)}
                        >
                          {showAltPayments ? "Ocultar opciones de pago" : "Otras formas de pago"}
                        </button>
                        {showAltPayments && (
                          <div
                            id={`plan-alt-payments-${plan.id}`}
                            className="plan-card-alt-panel"
                          >
                            <span className="plan-card-secondary-label">
                              {userEmail ? "Paga con:" : "Inicia sesión para pagar con:"}
                            </span>
                            <div className="plan-card-secondary-buttons">
                              <button
                                type="button"
                                className="plan-card-btn-outline"
                                onClick={() => (userEmail ? payWithSpei() : handleCheckoutWithMethod(plan.id, "spei"))}
                              >
                                SPEI (recurrente)
                              </button>
                              {conektaAvailability?.payByBankEnabled && (
                                <button
                                  type="button"
                                  className="plan-card-btn-outline"
                                  onClick={() => (userEmail ? payWithBbva() : handleCheckoutWithMethod(plan.id, "bbva"))}
                                >
                                  BBVA (Pago directo)
                                </button>
                              )}
                              {conektaAvailability?.oxxoEnabled && (
                                <button
                                  type="button"
                                  className="plan-card-btn-outline"
                                  onClick={() => (userEmail ? payWithOxxo() : handleCheckoutWithMethod(plan.id, "oxxo"))}
                                >
                                  Efectivo
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
                                    PayPal
                                  </button>
                                ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                    {!isMxn && showPaypalOption && (
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
		          <p className="plan-card-confidence">Activación guiada por chat después del pago.</p>
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
      <SpeiModal
        show={showSpeiModal}
        onHide={() => {
          setShowSpeiModal(false);
        }}
        price={plan.price}
        speiData={speiData}
      />
      <OxxoModal
        show={showOxxoModal}
        onHide={() => {
          setShowOxxoModal(false);
        }}
        price={plan.price}
        oxxoData={oxxoData}
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
