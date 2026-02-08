import "./Checkout.scss";
import { useUserContext } from "../../contexts/UserContext";
import { useLocation, useNavigate, Link } from "react-router-dom";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import trpc from "../../api";
import { IPlans, IOxxoData, ISpeiData } from "interfaces/Plans";
import { trackManyChatConversion, MC_EVENTS } from "../../utils/manychatPixel";
import { manychatApi } from "../../api/manychat";
import { Spinner } from "../../components/Spinner/Spinner";
import {
  Banknote,
  Building2,
  Check,
  CreditCard,
  Landmark,
  Lock,
  ShieldCheck,
} from "lucide-react";
import { ErrorModal } from "../../components/Modals/ErrorModal/ErrorModal";
import { SpeiModal } from "../../components/Modals/SpeiModal/SpeiModal";
import { OxxoModal } from "../../components/Modals/OxxoModal/OxxoModal";
import { GROWTH_METRICS, trackGrowthMetric } from "../../utils/growthMetrics";
import { SUPPORT_CHAT_URL } from "../../utils/supportChat";
import PaymentMethodLogos from "../../components/PaymentMethodLogos/PaymentMethodLogos";
import { useCookies } from "react-cookie";
import { trackInitiateCheckout } from "../../utils/facebookPixel";
import { generateEventId } from "../../utils/marketingIds";
import { getConektaFingerprint } from "../../utils/conektaCollect";

type CheckoutMethod = "card" | "spei" | "oxxo" | "bbva";

const METHOD_META: Record<
  CheckoutMethod,
  { label: string; description: string; Icon: typeof CreditCard }
> = {
  card: {
    label: "Tarjeta",
    description: "Pago inmediato con Stripe",
    Icon: CreditCard,
  },
  spei: {
    label: "SPEI (recurrente)",
    description: "Transferencia bancaria (CLABE reutilizable)",
    Icon: Landmark,
  },
  bbva: {
    label: "BBVA (Pago Directo)",
    description: "Autoriza desde tu banca BBVA",
    Icon: Building2,
  },
  oxxo: {
    label: "Efectivo",
    description: "Genera referencia para pagar en tienda (puede tardar hasta 48 hrs)",
    Icon: Banknote,
  },
};

const pickBestPlanCandidate = (candidates: IPlans[]): IPlans | null => {
  if (!Array.isArray(candidates) || candidates.length === 0) return null;

  const hasStripePrice = (plan: IPlans) =>
    typeof (plan as any)?.stripe_prod_id === "string" &&
    String((plan as any).stripe_prod_id).startsWith("price_");
  const hasPaypal = (plan: IPlans) =>
    Boolean((plan as any)?.paypal_plan_id || (plan as any)?.paypal_plan_id_test);

  let best: IPlans | null = null;
  let bestScore = -1;
  for (const candidate of candidates) {
    if (!candidate) continue;
    let score = 0;
    if (hasStripePrice(candidate)) score += 10;
    if (hasPaypal(candidate)) score += 2;
    // Prefer lower ids as a deterministic tie-breaker (legacy plans often have lower ids).
    const tieBreaker = typeof candidate.id === "number" ? -candidate.id / 10_000 : 0;
    score += tieBreaker;

    if (score > bestScore) {
      bestScore = score;
      best = candidate;
    }
  }
  return best;
};

function Checkout() {
  const [plan, setPlan] = useState<IPlans | null>(null);
  const [trialConfig, setTrialConfig] = useState<{
    enabled: boolean;
    days: number;
    gb: number;
    eligible?: boolean | null;
  } | null>(null);
  const location = useLocation();
  const navigate = useNavigate();
  const [redirecting, setRedirecting] = useState(false);
  const [showRedirectHelp, setShowRedirectHelp] = useState(false);
  const [selectedMethod, setSelectedMethod] = useState<CheckoutMethod>("card");
  const [processingMethod, setProcessingMethod] = useState<CheckoutMethod | null>(null);
  const [inlineError, setInlineError] = useState<string | null>(null);
  const [showSpeiModal, setShowSpeiModal] = useState(false);
  const [speiData, setSpeiData] = useState<ISpeiData | null>(null);
  const [showOxxoModal, setShowOxxoModal] = useState(false);
  const [oxxoData, setOxxoData] = useState<IOxxoData | null>(null);
  const [redirectingProvider, setRedirectingProvider] = useState<"stripe" | "bbva">("stripe");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showError, setShowError] = useState(false);
  const checkoutStartedRef = useRef(false);
  const checkoutHandedOffRef = useRef(false);
  const abandonTrackedRef = useRef(false);
  const interactedRef = useRef(false);
  const searchParams = new URLSearchParams(location.search);
  const priceId = searchParams.get("priceId");
  const requestedMethod = searchParams.get("method");
  const { currentUser } = useUserContext();
  const [cookies] = useCookies(["_fbp", "_fbc"]);

  const pendingPurchaseStorageKey = "bb.checkout.pendingPurchase";

  const isMxnPlan = plan?.moneda?.toUpperCase() === "MXN";
  const [conektaAvailability, setConektaAvailability] = useState<{
    oxxoEnabled: boolean;
    payByBankEnabled: boolean;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const cfg = await trpc.plans.getTrialConfig.query();
        if (!cancelled) setTrialConfig(cfg);
      } catch {
        if (!cancelled) setTrialConfig({ enabled: false, days: 0, gb: 0, eligible: null });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    if (!isMxnPlan) {
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
  }, [isMxnPlan]);

  const availableMethods = useMemo<CheckoutMethod[]>(() => {
    if (!isMxnPlan) return ["card"];
    const methods: CheckoutMethod[] = ["card", "spei"];
    if (conektaAvailability?.payByBankEnabled) methods.push("bbva");
    if (conektaAvailability?.oxxoEnabled) methods.push("oxxo");
    return methods;
  }, [isMxnPlan, conektaAvailability?.oxxoEnabled, conektaAvailability?.payByBankEnabled]);

  useEffect(() => {
    if (!availableMethods.includes(selectedMethod)) {
      setSelectedMethod(availableMethods[0]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [availableMethods.join("|")]);

  const checkManyChat = useCallback(async (p: IPlans | undefined) => {
    if (!p) return;
    trackManyChatConversion(MC_EVENTS.START_CHECKOUT);
    if (p.name?.includes("Curioso")) {
      try {
        await manychatApi("CHECKOUT_PLAN_CURIOSO");
      } catch {
        /* fallback */
      }
    } else if (p.name?.includes("Oro")) {
      try {
        await manychatApi("CHECKOUT_PLAN_ORO");
      } catch {
        /* fallback */
      }
    }
  }, []);

  const getPlans = useCallback(async (id: string | null) => {
    if (!id) return;
    const id_plan = +id;
    const body = { where: { activated: 1, id: id_plan } };
    try {
      const plans: IPlans[] = await trpc.plans.findManyPlans.query(body);
      let p = plans?.[0] ?? null;

      // Conversion hardening: old/legacy plan ids may still be linked from ads or bookmarks.
      // If the requested plan lacks a Stripe Price ID (price_*), auto-switch to a sibling plan
      // with the same name/price that has a valid Stripe Price configured.
      if (p) {
        const stripeId = (p as any)?.stripe_prod_id;
        const hasValidStripePrice = typeof stripeId === "string" && stripeId.startsWith("price_");
        if (!hasValidStripePrice) {
          try {
            const siblingBody: any = {
              where: {
                activated: 1,
                name: p.name,
                price: +p.price,
              },
            };
            const siblings: IPlans[] = await trpc.plans.findManyPlans.query(siblingBody);
            const best = pickBestPlanCandidate(siblings);
            if (best && typeof best.id === "number" && best.id !== p.id) {
              const nextParams = new URLSearchParams(location.search);
              nextParams.set("priceId", String(best.id));
              navigate(
                { pathname: location.pathname, search: `?${nextParams.toString()}` },
                { replace: true },
              );
              setPlan(best);
              checkManyChat(best);
              return;
            }
          } catch {
            // fallback to requested plan
          }
        }
      }

      setPlan(p);
      if (p) checkManyChat(p);
    } catch {
      setPlan(null);
    }
  }, [checkManyChat, location.pathname, location.search, navigate]);

  const trackCheckoutAbandon = useCallback(
    (reason: string) => {
      if (!interactedRef.current || checkoutHandedOffRef.current || abandonTrackedRef.current) return;
      abandonTrackedRef.current = true;
      trackManyChatConversion(MC_EVENTS.ABANDON_CHECKOUT);
      trackGrowthMetric(GROWTH_METRICS.CHECKOUT_ABANDONED, {
        reason,
        method: selectedMethod,
        planId: plan?.id ?? null,
        currency: plan?.moneda?.toUpperCase() ?? null,
        amount: Number(plan?.price) || null,
      });
    },
    [plan?.id, plan?.moneda, selectedMethod]
  );

  useEffect(() => {
    checkoutStartedRef.current = false;
    checkoutHandedOffRef.current = false;
    abandonTrackedRef.current = false;
    interactedRef.current = false;
    setRedirecting(false);
    setShowRedirectHelp(false);
    setInlineError(null);
    setSelectedMethod("card");
    setSpeiData(null);
    setShowSpeiModal(false);
    if (priceId) getPlans(priceId);
    else setPlan(null);
  }, [priceId, getPlans]);

  useEffect(() => {
    if (!plan || checkoutStartedRef.current) return;
    checkoutStartedRef.current = true;
    checkManyChat(plan);
    trackGrowthMetric(GROWTH_METRICS.CHECKOUT_STARTED, {
      planId: plan.id,
      currency: plan.moneda?.toUpperCase() ?? null,
      amount: Number(plan.price) || null,
    });
    const requested = typeof requestedMethod === "string" ? requestedMethod.trim().toLowerCase() : "";
    const requestedAsMethod = (["card", "spei", "bbva", "oxxo"] as const).includes(
      requested as any,
    )
      ? (requested as CheckoutMethod)
      : null;
    setSelectedMethod(
      requestedAsMethod ?? (plan.moneda?.toUpperCase() === "MXN" ? "spei" : "card"),
    );
  }, [plan, checkManyChat, requestedMethod]);

  useEffect(() => {
    const handleBeforeUnload = () => {
      trackCheckoutAbandon("beforeunload");
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      trackCheckoutAbandon("route_change");
    };
  }, [trackCheckoutAbandon]);

  const startStripeCheckout = useCallback(async () => {
    if (!priceId || !plan?.id) return;
    setProcessingMethod("card");
    setRedirectingProvider("stripe");
    setRedirecting(true);
    setShowRedirectHelp(false);
    interactedRef.current = true;
    const origin = window.location.origin;
    const successUrl = `${origin}/comprar/success?session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl = `${origin}/planes`;

    try {
      await trpc.checkoutLogs.registerCheckoutLog.mutate();
    } catch {
      // No bloquear checkout si el log falla.
    }

    trackManyChatConversion(MC_EVENTS.CLICK_BUY);
    const value = Number(plan.price) || 0;
    const currency = (plan.moneda?.toUpperCase() || "USD").toUpperCase();
    const initiateCheckoutEventId = generateEventId("init_checkout");
    trackInitiateCheckout({ value, currency, eventId: initiateCheckoutEventId });

    try {
      window.sessionStorage.setItem(
        pendingPurchaseStorageKey,
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
    trackGrowthMetric(GROWTH_METRICS.CHECKOUT_METHOD_SELECTED, {
      method: "card",
      planId: plan.id,
      currency,
      amount: value,
    });

    try {
      const result = await trpc.subscriptions.createStripeCheckoutSession.mutate({
        planId: plan.id,
        successUrl,
        cancelUrl,
        fbp: cookies._fbp,
        fbc: cookies._fbc,
        url: window.location.href,
        eventId: initiateCheckoutEventId,
      });
      if (result?.url) {
        checkoutHandedOffRef.current = true;
        window.location.href = result.url;
        return;
      }
      setErrorMessage("No se pudo abrir la página de pago. Intenta de nuevo.");
      setShowError(true);
      setRedirecting(false);
      setProcessingMethod(null);
    } catch (err: any) {
      const msg = err?.message ?? "";
      const isProcedureMissing =
        /mutation.*procedure|createStripeCheckoutSession/i.test(msg);
      setErrorMessage(
        isProcedureMissing
          ? "El pago con tarjeta no está disponible en este momento. Intenta SPEI (recurrente) o abre soporte por chat."
          : msg || "Error al preparar el pago. Intenta de nuevo."
      );
      setShowError(true);
      setRedirecting(false);
      setProcessingMethod(null);
    }
  }, [priceId, plan?.id]);

  const startCashCheckout = useCallback(
    async () => {
      if (!plan?.id) return;
      interactedRef.current = true;
      setProcessingMethod("spei");
      setInlineError(null);
      trackManyChatConversion(MC_EVENTS.CLICK_SPEI);
      trackManyChatConversion(MC_EVENTS.CLICK_BUY);
      trackGrowthMetric(GROWTH_METRICS.CHECKOUT_METHOD_SELECTED, {
        method: "spei",
      planId: plan.id,
      currency: (plan.moneda?.toUpperCase() || "USD").toUpperCase(),
      amount: Number(plan.price) || null,
    });

      try {
        await trpc.checkoutLogs.registerCheckoutLog.mutate();
      } catch {
        // No bloquear checkout si el log falla.
      }

      try {
        const fingerprint = await getConektaFingerprint();
        const response = await trpc.subscriptions.subscribeWithCashConekta.mutate({
          planId: plan.id,
          paymentMethod: "spei",
          fingerprint,
        });
        checkoutHandedOffRef.current = true;
        setSpeiData(response as ISpeiData);
        setShowSpeiModal(true);
      } catch (error: any) {
        const msg =
          error?.data?.message ??
          error?.message ??
          "No pudimos generar la referencia. Intenta de nuevo o abre soporte por chat.";
        setErrorMessage(msg);
        setShowError(true);
      } finally {
        setProcessingMethod(null);
      }
    },
    [plan?.id]
  );

  const startOxxoCheckout = useCallback(async () => {
    if (!plan?.id) return;
    interactedRef.current = true;
    setProcessingMethod("oxxo");
    setInlineError(null);
    trackManyChatConversion(MC_EVENTS.CLICK_OXXO);
    trackManyChatConversion(MC_EVENTS.CLICK_BUY);
    trackGrowthMetric(GROWTH_METRICS.CHECKOUT_METHOD_SELECTED, {
      method: "oxxo",
      planId: plan.id,
      currency: (plan.moneda?.toUpperCase() || "USD").toUpperCase(),
      amount: Number(plan.price) || null,
    });

    try {
      await trpc.checkoutLogs.registerCheckoutLog.mutate();
    } catch {
      // No bloquear checkout si el log falla.
    }

    try {
      const fingerprint = await getConektaFingerprint();
      const response = await trpc.subscriptions.subscribeWithCashConekta.mutate({
        planId: plan.id,
        paymentMethod: "cash",
        fingerprint,
      });
      checkoutHandedOffRef.current = true;
      setOxxoData(response as IOxxoData);
      setShowOxxoModal(true);
    } catch (error: any) {
      const msg =
        error?.data?.message ??
        error?.message ??
        "No pudimos generar la referencia de pago en efectivo. Intenta de nuevo o abre soporte por chat.";
      setErrorMessage(msg);
      setShowError(true);
    } finally {
      setProcessingMethod(null);
    }
  }, [plan?.id]);

  const startBbvaCheckout = useCallback(async () => {
    if (!plan?.id) return;
    interactedRef.current = true;
    setProcessingMethod("bbva");
    setRedirectingProvider("bbva");
    setRedirecting(true);
    setShowRedirectHelp(false);
    setInlineError(null);
    trackManyChatConversion(MC_EVENTS.CLICK_BUY);

    const value = Number(plan.price) || 0;
    const currency = (plan.moneda?.toUpperCase() || "USD").toUpperCase();
    const initiateCheckoutEventId = generateEventId("init_checkout");
    trackInitiateCheckout({ value, currency, eventId: initiateCheckoutEventId });

    try {
      window.sessionStorage.setItem(
        pendingPurchaseStorageKey,
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

    trackGrowthMetric(GROWTH_METRICS.CHECKOUT_METHOD_SELECTED, {
      method: "bbva",
      planId: plan.id,
      currency,
      amount: value,
    });

    try {
      await trpc.checkoutLogs.registerCheckoutLog.mutate();
    } catch {
      // No bloquear checkout si el log falla.
    }

    try {
      const fingerprint = await getConektaFingerprint();
      const result = await trpc.subscriptions.subscribeWithPayByBankConekta.mutate({
        planId: plan.id,
        fingerprint,
      });
      if (result?.url) {
        checkoutHandedOffRef.current = true;
        window.location.href = result.url;
        return;
      }
      setErrorMessage("No se pudo abrir el pago BBVA. Intenta SPEI/Efectivo o tarjeta.");
      setShowError(true);
      setRedirecting(false);
      setProcessingMethod(null);
    } catch (error: any) {
      const msg =
        error?.data?.message ??
        error?.message ??
        "No pudimos abrir el pago BBVA. Intenta SPEI/Efectivo o tarjeta.";
      setErrorMessage(msg);
      setShowError(true);
      setRedirecting(false);
      setProcessingMethod(null);
    }
  }, [plan?.id]);

  useEffect(() => {
    if (!redirecting) return;
    const timeout = window.setTimeout(() => {
      setShowRedirectHelp(true);
    }, 6000);
    return () => window.clearTimeout(timeout);
  }, [redirecting]);

  const handleSelectMethod = (method: CheckoutMethod) => {
    interactedRef.current = true;
    setInlineError(null);
    setSelectedMethod(method);
    trackGrowthMetric(GROWTH_METRICS.CHECKOUT_METHOD_SELECTED, {
      method,
      surface: "selector",
      planId: plan?.id ?? null,
      currency: plan?.moneda?.toUpperCase() ?? null,
      amount: Number(plan?.price) || null,
    });
  };

  const handleContinuePayment = () => {
    interactedRef.current = true;
    if (!selectedMethod) {
      setInlineError("Selecciona un método de pago para continuar.");
      return;
    }
    if (selectedMethod === "card") {
      startStripeCheckout();
      return;
    }
    if (selectedMethod === "spei") startCashCheckout();
    if (selectedMethod === "oxxo") startOxxoCheckout();
    if (selectedMethod === "bbva") startBbvaCheckout();
  };

  const discount = 0;
  const totalPrice = (
    parseInt(plan?.price || "0", 10) -
    parseInt(plan?.price || "0", 10) * (discount / 100)
  ).toFixed(2);

  const benefits = [
    "Acceso FTP Ilimitado",
    "Sin Límite de Velocidad",
    "Cancela cuando quieras",
  ];
  const checkoutSteps = [
    { step: "1", label: "Confirma tu plan" },
    { step: "2", label: "Elige método de pago" },
    { step: "3", label: "Activa y descarga" },
  ];

  if (!priceId) {
    return (
      <div className="checkout-main-container">
        <div className="checkout-inner">
          <header className="checkout-header">
            <h1 className="checkout-page-title">Activar acceso</h1>
            <p className="checkout-page-subtitle">
              Elige un plan en la página de planes para continuar.
            </p>
          </header>
          <Link
            to="/planes"
            className="checkout-cta-btn checkout-cta-btn--primary"
            style={{ display: "inline-block", textAlign: "center", marginTop: "1rem" }}
          >
            Ver planes
          </Link>
        </div>
      </div>
    );
  }

  // Estado único: redirigiendo a Stripe → pantalla clara, sin grid
  if (redirecting) {
    const providerName =
      redirectingProvider === "stripe" ? "Stripe" : "BBVA (Conekta)";
    return (
      <div className="checkout-main-container checkout-main-container--redirecting">
        <div className="checkout-one-state">
          <Spinner size={5} width={0.4} color="var(--app-accent)" />
          <h2 className="checkout-one-state__title">Preparando tu pago</h2>
          <p className="checkout-one-state__text">
            Serás redirigido a la pasarela segura de {providerName} en un momento…
          </p>
          {showRedirectHelp && (
            <div className="checkout-one-state__help">
              <p>Si no te redirige, vuelve a intentar desde planes.</p>
              <Link to="/planes" className="checkout-cta-btn checkout-cta-btn--ghost">
                Volver a planes
              </Link>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Plan aún cargando → una sola pantalla de carga
  if (!plan) {
    return (
      <div className="checkout-main-container checkout-main-container--redirecting">
        <div className="checkout-one-state">
          <Spinner size={5} width={0.4} color="var(--app-accent)" />
          <p className="checkout-one-state__text">Cargando plan…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="checkout-main-container">
      <div className="checkout-inner">
        <header className="checkout-header">
          <h1 className="checkout-page-title">Activar acceso inmediato</h1>
          <p className="checkout-page-subtitle">
            Elige tu método de pago y completa tu activación en la misma pantalla.
          </p>
          <div className="checkout-steps" role="list" aria-label="Pasos de checkout">
            {checkoutSteps.map((stepData) => (
              <span key={stepData.step} role="listitem">
                <strong>{stepData.step}</strong>
                <span>{stepData.label}</span>
              </span>
            ))}
          </div>
          <div className="checkout-trust-strip" role="list" aria-label="Confianza de pago">
            <span role="listitem"><ShieldCheck size={16} aria-hidden /> Pago seguro</span>
            <span role="listitem"><CreditCard size={16} aria-hidden /> Tarjeta / Stripe</span>
            {isMxnPlan && <span role="listitem"><Landmark size={16} aria-hidden /> SPEI (recurrente)</span>}
            {isMxnPlan && conektaAvailability?.payByBankEnabled && (
              <span role="listitem"><Building2 size={16} aria-hidden /> BBVA</span>
            )}
            {isMxnPlan && conektaAvailability?.oxxoEnabled && (
              <span role="listitem"><Banknote size={16} aria-hidden /> Efectivo</span>
            )}
            <span role="listitem"><Lock size={16} aria-hidden /> Cifrado bancario</span>
          </div>
          <PaymentMethodLogos
            methods={
              isMxnPlan
                ? (conektaAvailability?.oxxoEnabled
                    ? ["visa", "mastercard", "amex", "spei", "oxxo"]
                    : ["visa", "mastercard", "amex", "spei"])
                : ["visa", "mastercard", "amex"]
            }
            className="checkout-payment-logos"
            ariaLabel="Métodos de pago disponibles en checkout"
          />
        </header>

        <div className="checkout-grid">
          <aside className="checkout-card checkout-summary">
            <h2 className="checkout-card__title">Resumen del plan</h2>
            <p className="checkout-summary__plan-name">{plan.name}</p>
            <p className="checkout-summary__price">
              ${totalPrice} <span className="checkout-summary__currency">{plan.moneda ?? "MXN"}</span>
            </p>
            {plan.description && (
              <p className="checkout-summary__desc">{plan.description}</p>
            )}
            <ul className="checkout-summary__benefits">
              {benefits.map((label, i) => (
                <li key={i}>
                  <span className="checkout-summary__check">
                    <Check className="checkout-summary__check-icon" />
                  </span>
                  {label}
                </li>
              ))}
            </ul>
            <p className="checkout-summary__meta">
              Duración: {plan.duration} días · Renovación automática
            </p>
            {trialConfig?.enabled && trialConfig.eligible !== false && (
              <p className="checkout-summary__trial" role="note">
                Incluye {trialConfig.days} días gratis con tarjeta (Stripe) · {trialConfig.gb} GB de descarga incluidos.
              </p>
            )}
          </aside>

          <section className="checkout-card checkout-payment-card">
            <h2 className="checkout-card__title">Tu cuenta y pago</h2>
            <div className="checkout-credentials">
              <div className="checkout-credentials__row">
                <span className="checkout-credentials__label">Nombre</span>
                <span className="checkout-credentials__value">{currentUser?.username ?? "—"}</span>
              </div>
              <div className="checkout-credentials__row">
                <span className="checkout-credentials__label">Correo</span>
                <span className="checkout-credentials__value">{currentUser?.email ?? "—"}</span>
              </div>
            </div>
            <div className="checkout-methods" role="radiogroup" aria-label="Método de pago">
              {availableMethods.map((method) => {
                const { Icon } = METHOD_META[method];
                let { label, description } = METHOD_META[method];
                if (method === "card" && trialConfig?.enabled && trialConfig.eligible !== false) {
                  label = `Tarjeta (${trialConfig.days} días gratis)`;
                  description = `Incluye ${trialConfig.gb} GB de descarga. Luego cobro automático.`;
                }
                return (
                  <button
                    key={method}
                    type="button"
                    className={`checkout-method ${selectedMethod === method ? "is-active" : ""}`}
                    onClick={() => handleSelectMethod(method)}
                    aria-pressed={selectedMethod === method}
                  >
                    <span className="checkout-method__icon" aria-hidden>
                      <Icon size={18} />
                    </span>
                    <span className="checkout-method__copy">
                      <strong>{label}</strong>
                      <small>{description}</small>
                    </span>
                  </button>
                );
              })}
            </div>
            {inlineError && <p className="checkout-inline-error">{inlineError}</p>}
            <button
              type="button"
              className="checkout-cta-btn checkout-cta-btn--primary"
              onClick={handleContinuePayment}
              disabled={processingMethod !== null}
            >
              {processingMethod === "card" && "Abriendo pasarela segura..."}
              {processingMethod === "spei" && "Generando referencia SPEI (recurrente)..."}
              {processingMethod === "bbva" && "Abriendo pago BBVA..."}
              {processingMethod === "oxxo" && "Generando referencia de pago en efectivo..."}
              {processingMethod === null && selectedMethod === "card" && "Continuar con tarjeta segura"}
              {processingMethod === null && selectedMethod === "spei" && "Generar referencia SPEI (recurrente)"}
              {processingMethod === null && selectedMethod === "bbva" && "Continuar con BBVA"}
              {processingMethod === null && selectedMethod === "oxxo" && "Generar referencia de pago en efectivo"}
            </button>
            <p className="checkout-payment-note">
              Si tienes dudas para pagar, te ayudamos por chat en tiempo real:{" "}
              <a href={SUPPORT_CHAT_URL} target="_blank" rel="noopener noreferrer">
                abrir soporte
              </a>
              .
            </p>
          </section>
        </div>
      </div>

      <ErrorModal
        show={showError}
        onHide={() => setShowError(false)}
        message={errorMessage ?? ""}
        user={currentUser ?? undefined}
      />
      {speiData && (
        <SpeiModal
          show={showSpeiModal}
          onHide={() => setShowSpeiModal(false)}
          speiData={speiData}
          price={plan.price}
        />
      )}
      {oxxoData && (
        <OxxoModal
          show={showOxxoModal}
          onHide={() => setShowOxxoModal(false)}
          oxxoData={oxxoData}
          price={plan.price}
        />
      )}
    </div>
  );
}

export default Checkout;
