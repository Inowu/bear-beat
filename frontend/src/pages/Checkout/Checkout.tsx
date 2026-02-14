import "./Checkout.scss";
import { useUserContext } from "../../contexts/UserContext";
import { useLocation, useNavigate, Link } from "react-router-dom";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTheme } from "../../contexts/ThemeContext";
import brandMarkBlack from "../../assets/brand/bearbeat-mark-black.png";
import brandMarkCyan from "../../assets/brand/bearbeat-mark-cyan.png";
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
  Wallet,
} from "src/icons";
import { ErrorModal } from "../../components/Modals/ErrorModal/ErrorModal";
import { SpeiModal } from "../../components/Modals/SpeiModal/SpeiModal";
import { OxxoModal } from "../../components/Modals/OxxoModal/OxxoModal";
import PayPalComponent from "../../components/PayPal/PayPalComponent";
import { GROWTH_METRICS, trackGrowthMetric } from "../../utils/growthMetrics";
import PaymentMethodLogos from "../../components/PaymentMethodLogos/PaymentMethodLogos";
import { useCookies } from "react-cookie";
import { trackInitiateCheckout } from "../../utils/facebookPixel";
import { generateEventId } from "../../utils/marketingIds";
import { getConektaFingerprint } from "../../utils/conektaCollect";
import { formatInt } from "../../utils/format";

type CheckoutMethod = "card" | "spei" | "oxxo" | "bbva" | "paypal";

const METHOD_META: Record<
  CheckoutMethod,
  { label: string; description: string; Icon: typeof CreditCard }
> = {
  card: {
    label: "Tarjeta de Crédito o Débito",
    description: "Pago inmediato con Stripe",
    Icon: CreditCard,
  },
  spei: {
    label: "SPEI",
    description: "Transferencia interbancaria en MXN, CLABE",
    Icon: Landmark,
  },
  bbva: {
    label: "BBVA (Pago Directo)",
    description: "Autoriza desde tu banca BBVA",
    Icon: Building2,
  },
  paypal: {
    label: "PayPal",
    description: "Paga con tu cuenta o tarjetas guardadas",
    Icon: Wallet,
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
  const { theme } = useTheme();
  const [plan, setPlan] = useState<IPlans | null>(null);
  const [trialConfig, setTrialConfig] = useState<{
    enabled: boolean;
    days: number;
    gb: number;
    eligible?: boolean | null;
  } | null>(null);
  const location = useLocation();
  const navigate = useNavigate();
  const brandMark = theme === "light" ? brandMarkBlack : brandMarkCyan;
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
  const [paypalPlan, setPaypalPlan] = useState<IPlans | null>(null);
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
  const hasPaypalPlan = Boolean(paypalPlan?.paypal_plan_id || paypalPlan?.paypal_plan_id_test);

  useEffect(() => {
    // Evitar doble membresía: si ya tiene un plan activo, empujar a recarga de GB extra en /micuenta.
    if (currentUser?.hasActiveSubscription) {
      navigate("/micuenta", { replace: true });
    }
  }, [currentUser?.hasActiveSubscription, navigate]);

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

  useEffect(() => {
    let cancelled = false;
    if (!plan) {
      setPaypalPlan(null);
      return;
    }

    const resolvePaypalPlan = async () => {
      if (plan.paypal_plan_id || plan.paypal_plan_id_test) {
        if (!cancelled) setPaypalPlan(plan);
        return;
      }
      try {
        const siblings = await trpc.plans.findManyPlans.query({
          where: {
            activated: 1,
            moneda: (plan.moneda ?? "").toLowerCase(),
            price: +plan.price,
            OR: [{ paypal_plan_id: { not: null } }, { paypal_plan_id_test: { not: "" } }],
          },
        } as any);
        const match =
          siblings.find((candidate: IPlans) => candidate?.paypal_plan_id || candidate?.paypal_plan_id_test) ??
          null;
        if (!cancelled) setPaypalPlan(match);
      } catch {
        if (!cancelled) setPaypalPlan(null);
      }
    };

    void resolvePaypalPlan();
    return () => {
      cancelled = true;
    };
  }, [plan?.id, plan?.moneda, plan?.price, plan?.paypal_plan_id, plan?.paypal_plan_id_test]);

  const availableMethods = useMemo<CheckoutMethod[]>(() => {
    if (!isMxnPlan) return hasPaypalPlan ? ["card", "paypal"] : ["card"];
    const methods: CheckoutMethod[] = ["card"];
    if (hasPaypalPlan) methods.push("paypal");
    methods.push("spei");
    if (conektaAvailability?.payByBankEnabled) methods.push("bbva");
    if (conektaAvailability?.oxxoEnabled) methods.push("oxxo");
    return methods;
  }, [isMxnPlan, hasPaypalPlan, conektaAvailability?.oxxoEnabled, conektaAvailability?.payByBankEnabled]);

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
    trackGrowthMetric(GROWTH_METRICS.CHECKOUT_START, {
      planId: plan.id,
      currency: plan.moneda?.toUpperCase() ?? null,
      amount: Number(plan.price) || null,
      method: "unknown",
    });
    const requested = typeof requestedMethod === "string" ? requestedMethod.trim().toLowerCase() : "";
    const requestedAsMethod = (["card", "spei", "bbva", "oxxo", "paypal"] as const).includes(
      requested as any,
    )
      ? (requested as CheckoutMethod)
      : null;
    setSelectedMethod(
      requestedAsMethod ?? "card",
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
    // CRO: if the user cancels in Stripe, send them back to the same checkout so they can retry / switch method.
    const cancelUrl = `${origin}${location.pathname}${location.search || ""}`;

    try {
      await trpc.checkoutLogs.registerCheckoutLog.mutate();
    } catch {
      // No bloquear checkout si el log falla.
    }

    trackManyChatConversion(MC_EVENTS.CLICK_BUY);
    const value = Number(plan.price) || 0;
    const currency = (plan.moneda?.toUpperCase() || "USD").toUpperCase();
    const initiateCheckoutEventId = generateEventId("init_checkout");
    const purchaseEventId = generateEventId("purchase");
    trackInitiateCheckout({ value, currency, eventId: initiateCheckoutEventId });

    try {
      window.sessionStorage.setItem(
        pendingPurchaseStorageKey,
        JSON.stringify({
          planId: plan.id,
          value,
          currency,
          at: new Date().toISOString(),
          purchaseEventId,
          method: "card",
          serverSidePurchaseTracking: false,
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
        purchaseEventId,
      });
      if (result?.url) {
        try {
          const raw = window.sessionStorage.getItem(pendingPurchaseStorageKey);
          const pending = raw ? JSON.parse(raw) : null;
          if (pending && typeof pending === "object") {
            pending.serverSidePurchaseTracking = Boolean((result as any)?.serverSidePurchaseTracking);
            window.sessionStorage.setItem(pendingPurchaseStorageKey, JSON.stringify(pending));
          }
        } catch {
          // noop
        }
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
          ? "El pago con tarjeta no está disponible en este momento. Intenta SPEI (recurrente) u otro método disponible."
          : msg || "Error al preparar el pago. Intenta de nuevo."
      );
      trackGrowthMetric(GROWTH_METRICS.CHECKOUT_ERROR, {
        method: "card",
        planId: plan.id,
        currency,
        amount: value,
        reason: msg || "stripe_checkout_failed",
        errorCode: isProcedureMissing ? "procedure_missing" : "provider_error",
      });
      setShowError(true);
      setRedirecting(false);
      setProcessingMethod(null);
    }
  }, [cookies._fbc, cookies._fbp, location.pathname, location.search, plan?.id, plan?.moneda, plan?.price, priceId]);

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
          "No pudimos generar la referencia. Intenta de nuevo o usa otro método disponible.";
        trackGrowthMetric(GROWTH_METRICS.CHECKOUT_ERROR, {
          method: "spei",
          planId: plan.id,
          currency: (plan.moneda?.toUpperCase() || "USD").toUpperCase(),
          amount: Number(plan.price) || null,
          reason: msg,
          errorCode: "provider_error",
        });
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
      const response = await trpc.subscriptions.subscribeWithOxxoStripe.mutate({
        planId: plan.id,
      });
      checkoutHandedOffRef.current = true;
      setOxxoData(response as IOxxoData);
      setShowOxxoModal(true);
    } catch (error: any) {
      const msg =
        error?.data?.message ??
        error?.message ??
        "No pudimos generar la referencia de pago en efectivo. Intenta de nuevo o usa otro método disponible.";
      trackGrowthMetric(GROWTH_METRICS.CHECKOUT_ERROR, {
        method: "oxxo",
        planId: plan.id,
        currency: (plan.moneda?.toUpperCase() || "USD").toUpperCase(),
        amount: Number(plan.price) || null,
        reason: msg,
        errorCode: "provider_error",
      });
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
      trackGrowthMetric(GROWTH_METRICS.CHECKOUT_ERROR, {
        method: "bbva",
        planId: plan.id,
        currency,
        amount: value,
        reason: msg,
        errorCode: "provider_error",
      });
      setErrorMessage(msg);
      setShowError(true);
      setRedirecting(false);
      setProcessingMethod(null);
    }
  }, [plan?.id]);

  const startPaypalCheckout = useCallback(
    async (data: any) => {
      if (!paypalPlan?.id || !plan?.id) return;
      const subscriptionId =
        typeof data?.subscriptionID === "string" && data.subscriptionID.trim()
          ? data.subscriptionID.trim()
          : null;
      if (!subscriptionId) {
        setErrorMessage("No recibimos la referencia de PayPal. Intenta de nuevo.");
        setShowError(true);
        return;
      }

      setProcessingMethod("paypal");
      interactedRef.current = true;
      const value = Number(plan.price) || 0;
      const currency = (plan.moneda?.toUpperCase() || "USD").toUpperCase();
      const purchaseEventId = generateEventId("purchase");

      try {
        await trpc.subscriptions.subscribeWithPaypal.mutate({
          planId: paypalPlan.id,
          subscriptionId,
          fbp: cookies._fbp,
          fbc: cookies._fbc,
          url: window.location.href,
          eventId: purchaseEventId,
        });

        try {
          window.sessionStorage.setItem(
            pendingPurchaseStorageKey,
            JSON.stringify({
              planId: plan.id,
              value,
              currency,
              at: new Date().toISOString(),
              purchaseEventId,
              method: "paypal",
            }),
          );
        } catch {
          // noop
        }

        checkoutHandedOffRef.current = true;
        navigate("/comprar/success", { replace: true });
      } catch (error: any) {
        const msg =
          error?.data?.message ?? error?.message ?? "No se pudo completar el pago con PayPal.";
        trackGrowthMetric(GROWTH_METRICS.CHECKOUT_ERROR, {
          method: "paypal",
          planId: plan.id,
          currency,
          amount: value,
          reason: msg,
          errorCode: "provider_error",
        });
        setErrorMessage(msg);
        setShowError(true);
      } finally {
        setProcessingMethod(null);
      }
    },
    [paypalPlan?.id, plan?.id, plan?.price, plan?.moneda, cookies._fbp, cookies._fbc, navigate],
  );

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
    if (!availableMethods.includes(selectedMethod)) {
      setSelectedMethod(availableMethods[0]);
      setInlineError("Ese método no está disponible en este momento. Elige otra opción.");
      return;
    }
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
    if (selectedMethod === "paypal") return;
  };

  const currencyCode = (plan?.moneda ? String(plan.moneda) : "MXN").toUpperCase();
  const planName = plan?.name?.trim() || "Plan Oro";
  const discount = 0;

  const rawPrice = Number(plan?.price ?? 0);
  const safePrice = Number.isFinite(rawPrice) ? rawPrice : 0;
  const totalPriceNumber = safePrice - safePrice * (discount / 100);
  const moneyLocale = currencyCode === "USD" ? "en-US" : "es-MX";
  const totalPrice = new Intl.NumberFormat(moneyLocale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(totalPriceNumber);

  const trialDays = Number(trialConfig?.days ?? 0);
  const trialGb = Number(trialConfig?.gb ?? 0);
  const isTrialEligible =
    Boolean(trialConfig?.enabled) &&
    trialConfig?.eligible === true &&
    Number.isFinite(trialDays) &&
    trialDays > 0 &&
    Number.isFinite(trialGb) &&
    trialGb > 0;
  const isCardTrial = selectedMethod === "card" && isTrialEligible;

  const quotaGb = Number(plan?.gigas ?? 500);
  const summaryBullets = [
    `${formatInt(quotaGb)} GB de descargas al mes`,
    "Catálogo organizado para cabina",
    "Activación inmediata",
  ];
  if (isCardTrial) {
    summaryBullets.unshift(`Prueba de ${trialDays} días (${formatInt(trialGb)} GB)`);
  }

  let continueLabel = "Continuar";
  if (processingMethod === "card") continueLabel = "Abriendo pasarela segura...";
  if (processingMethod === "spei") continueLabel = "Generando referencia SPEI...";
  if (processingMethod === "bbva") continueLabel = "Abriendo pago BBVA...";
  if (processingMethod === "oxxo") continueLabel = "Generando referencia de pago en efectivo...";
  if (processingMethod === "paypal") continueLabel = "Procesando PayPal...";
  if (processingMethod === null && selectedMethod === "card") {
    continueLabel = isCardTrial
      ? `Empezar prueba (hoy $0)`
      : `Pagar $${totalPrice} ${currencyCode} de forma segura`;
  }
  if (processingMethod === null && selectedMethod === "paypal") continueLabel = "Continuar a PayPal";
  if (processingMethod === null && selectedMethod === "spei") continueLabel = "Generar referencia SPEI";
  if (processingMethod === null && selectedMethod === "bbva") continueLabel = "Continuar con BBVA";
  if (processingMethod === null && selectedMethod === "oxxo") continueLabel = "Generar referencia de pago en efectivo";

  const TopBrand = (
    <header className="checkout2026__top" aria-label="Bear Beat">
      <Link to="/planes" className="checkout2026__brand" aria-label="Bear Beat">
        <img src={brandMark} alt="Bear Beat" width={40} height={40} />
      </Link>
    </header>
  );

  if (!priceId) {
    return (
      <div className="checkout-main-container checkout2026">
        {TopBrand}
        <div className="checkout-inner">
          <div className="checkout-one-state" role="status" aria-live="polite">
            <h1 className="checkout-one-state__title">Completa tu pago</h1>
            <p className="checkout-one-state__text">Selecciona un plan en la página de planes para continuar.</p>
            <Link
              to="/planes"
              className="checkout-cta-btn checkout-cta-btn--primary checkout-empty-link"
            >
              Ver planes
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Estado único: redirigiendo a Stripe → pantalla clara, sin grid
  if (redirecting) {
    const providerName =
      redirectingProvider === "stripe" ? "Stripe" : "BBVA (Conekta)";
    return (
      <div className="checkout-main-container checkout2026">
        {TopBrand}
        <div className="checkout-inner checkout2026__center">
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
      </div>
    );
  }

  // Plan aún cargando → una sola pantalla de carga
  if (!plan) {
    return (
      <div className="checkout-main-container checkout2026">
        {TopBrand}
        <div className="checkout-inner checkout2026__center">
          <div className="checkout-one-state" role="status" aria-live="polite">
            <Spinner size={5} width={0.4} color="var(--app-accent)" />
            <p className="checkout-one-state__text">Cargando plan…</p>
          </div>
        </div>
      </div>
    );
  }

  // Show every available payment method (CRO: users need to see OXXO when enabled).
  const methodOrder: CheckoutMethod[] = ["card", "paypal", "spei", "oxxo", "bbva"];
  const methodsForUi: CheckoutMethod[] = methodOrder.filter((method) => availableMethods.includes(method));

  const summaryMonthlyLabel = `$${totalPrice} ${currencyCode}/mes`;
  const summaryTodayLabel = isCardTrial ? `$0 ${currencyCode}` : `$${totalPrice} ${currencyCode}`;
  const summarySubCopy = isCardTrial
    ? `Hoy $0. Después ${summaryMonthlyLabel}. Renovación automática. Cancela cuando quieras.`
    : "Renovación automática. Cancela cuando quieras.";
  const summaryTotalLabel = isCardTrial ? "Total hoy:" : "Total a pagar hoy:";

  const summaryContent = (
    <>
      <h2 className="checkout2026__summaryTitle">Resumen de compra</h2>
      <div className="checkout2026__summaryRow">
        <span className="checkout2026__summaryPlan">{planName}</span>
        <span className="checkout2026__summaryPrice">{summaryMonthlyLabel}</span>
      </div>
      <p className="checkout2026__summarySub">{summarySubCopy}</p>
      <div className="checkout2026__divider" aria-hidden />
      <ul className="checkout2026__summaryBullets" aria-label="Beneficios incluidos">
        {summaryBullets.map((item) => (
          <li key={item}>
            <span className="checkout2026__miniCheck" aria-hidden>
              <Check size={14} />
            </span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
      <div className="checkout2026__divider" aria-hidden />
      <div className="checkout2026__summaryTotal" aria-label="Total a pagar hoy">
        <span>{summaryTotalLabel}</span>
        <strong>{summaryTodayLabel}</strong>
      </div>
      <div className="checkout2026__summaryFooter">
        <p>Pagos procesados de forma segura con encriptación de 256-bits.</p>
        <span className="checkout2026__stripe" aria-label="Stripe">
          <span>Stripe</span>
        </span>
      </div>
    </>
  );

  const shouldShowPaypalInline =
    selectedMethod === "paypal" &&
    processingMethod === null &&
    hasPaypalPlan &&
    Boolean(currentUser?.email) &&
    Boolean(paypalPlan);

  const methodHelp = (() => {
    const monthly = summaryMonthlyLabel;
    const trialHint =
      isTrialEligible && selectedMethod !== "card"
        ? `Tip: con tarjeta puedes iniciar una prueba de ${trialDays} días (hoy $0).`
        : null;

    switch (selectedMethod) {
      case "card":
        return {
          title: isCardTrial ? "Tarjeta (prueba disponible)" : "Tarjeta",
          items: isCardTrial
            ? [
                `Hoy $0: empiezas tu prueba de ${trialDays} días (${formatInt(trialGb)} GB).`,
                `Después: ${monthly}. Puedes cancelar cuando quieras.`,
                "Activación inmediata al confirmar el checkout.",
              ]
            : [
                "Pago inmediato. Activación en 1 minuto.",
                `Renovación automática: ${monthly}. Cancela cuando quieras.`,
                "No necesitas enviar comprobante.",
              ],
          hint: null,
        };
      case "paypal":
        return {
          title: "PayPal",
          items: [
            "Autoriza el pago en PayPal. Activación inmediata.",
            `Renovación automática: ${monthly}. Cancela cuando quieras.`,
            "No necesitas enviar comprobante.",
          ],
          hint: trialHint,
        };
      case "spei":
        return {
          title: "SPEI",
          items: [
            "Generamos CLABE/referencia para transferir.",
            "Activación automática al confirmar tu transferencia (depende del banco).",
            "No necesitas enviar comprobante.",
          ],
          hint: trialHint,
        };
      case "bbva":
        return {
          title: "BBVA",
          items: [
            "Te redirigimos a BBVA para autorizar el pago.",
            "Activación automática al confirmar (sin comprobantes).",
            "Si no te redirige, reintenta desde esta página.",
          ],
          hint: trialHint,
        };
      case "oxxo":
        return {
          title: "Efectivo (OXXO)",
          items: [
            "Generamos una referencia para pagar en tienda.",
            "Activación automática al confirmar el pago (puede tardar hasta 48 hrs).",
            "No necesitas enviar comprobante.",
          ],
          hint: trialHint,
        };
      default:
        return { title: "Pago", items: [], hint: null };
    }
  })();

  return (
    <div className="checkout-main-container checkout2026">
      {TopBrand}
      <div className="checkout-inner">
        <div className="checkout-grid checkout2026__grid">
          <section className="checkout-card checkout2026__flow" aria-label="Completa tu pago">
            <header className="checkout2026__flowHead">
              <div className="checkout2026__kicker" aria-label="Progreso">
                Paso 2 de 2
              </div>
              <h1 className="checkout2026__title">Completa tu pago</h1>
              <p className="checkout2026__subtitle">
                <span className="checkout2026__subtitleIcon" aria-hidden>
                  <Lock size={16} />
                </span>
                Checkout seguro. Activa tu acceso en 1 minuto.
              </p>
            </header>

            <section className="checkout2026__block" aria-label="Tu cuenta">
              <h2 className="checkout2026__blockTitle">Tu Cuenta</h2>
              <div className="checkout2026__readonly">
                <div className="checkout2026__field">
                  <span className="checkout2026__fieldLabel">Nombre</span>
                  <span className="checkout2026__fieldValue">{currentUser?.username ?? "—"}</span>
                </div>
                <div className="checkout2026__field">
                  <span className="checkout2026__fieldLabel">Correo</span>
                  <span className="checkout2026__fieldValue">{currentUser?.email ?? "—"}</span>
                </div>
              </div>
            </section>

            <section className="checkout2026__block" aria-label="Elige cómo pagar">
              <h2 className="checkout2026__blockTitle">Elige cómo pagar</h2>
              <div className="checkout-methods checkout2026__methods" role="radiogroup" aria-label="Método de pago">
                {methodsForUi.map((method) => {
                  const { Icon, label, description } = METHOD_META[method];
                  const isActive = selectedMethod === method;
                  const methodState =
                    method === "card"
                      ? isTrialEligible
                        ? `Prueba ${trialDays} días`
                        : "Más rápido"
                      : null;
                  const logoMethods =
                    method === "card"
                      ? (["visa", "mastercard"] as const)
                      : method === "paypal"
                        ? (["paypal"] as const)
                        : method === "spei"
                          ? (["spei"] as const)
                          : null;

                  return (
                    <button
                      key={method}
                      type="button"
                      role="radio"
                      aria-checked={isActive}
                      className={`checkout-method ${isActive ? "is-active" : ""}`}
                      onClick={() => handleSelectMethod(method)}
                      disabled={processingMethod !== null}
                      data-testid={`checkout-method-${method}`}
                    >
                      <span className="checkout-method__top">
                        <span className="checkout-method__icon" aria-hidden>
                          <Icon size={18} />
                        </span>
                        <span className="checkout-method__copy">
                          <strong>{label}</strong>
                          <small>{description}</small>
                        </span>
                      </span>
                      <span className="checkout-method__right" aria-hidden>
                        {methodState && <span className="checkout-method__state">{methodState}</span>}
                        {logoMethods && (
                          <PaymentMethodLogos
                            methods={[...logoMethods]}
                            size="sm"
                            className="checkout2026__methodLogos"
                            ariaLabel="Métodos aceptados"
                          />
                        )}
                        <span className="checkout-method__check" aria-hidden>
                          <Check size={18} />
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
              <div className="checkout2026__methodHelp" role="note" aria-label="Qué sucede después">
                <div className="checkout2026__methodHelpHead">
                  <span className="checkout2026__methodHelpTitle">{methodHelp.title}</span>
                  {methodHelp.hint && <span className="checkout2026__methodHelpHint">{methodHelp.hint}</span>}
                </div>
                <ul className="checkout2026__methodHelpList">
                  {methodHelp.items.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            </section>

            {inlineError && <p className="checkout-inline-error">{inlineError}</p>}

            <div className="checkout-payment-actions checkout2026__actions" aria-label="Acción">
              {shouldShowPaypalInline ? (
                <div
                  className={`checkout2026__paypal ${processingMethod !== null ? "is-processing" : ""}`}
                  aria-busy={processingMethod !== null}
                >
                  <PayPalComponent
                    plan={paypalPlan!}
                    type="subscription"
                    onApprove={(data: any) => {
                      void startPaypalCheckout(data);
                    }}
                    onClick={() => {
                      interactedRef.current = true;
                      trackManyChatConversion(MC_EVENTS.CLICK_PAYPAL);
                      setInlineError(null);
                      trackGrowthMetric(GROWTH_METRICS.CHECKOUT_METHOD_SELECTED, {
                        method: "paypal",
                        surface: "paypal_button",
                        planId: plan?.id ?? null,
                        currency: plan?.moneda?.toUpperCase() ?? null,
                        amount: Number(plan?.price) || null,
                      });
                    }}
                  />
                </div>
              ) : (
                <button
                  type="button"
                  className="checkout-cta-btn checkout-cta-btn--primary checkout2026__cta"
                  onClick={handleContinuePayment}
                  disabled={processingMethod !== null}
                  data-testid="checkout-continue"
                >
                  {continueLabel}
                </button>
              )}
            </div>
          </section>

          <aside className="checkout-card checkout-summary checkout2026__summary" aria-label="Resumen de compra">
            <details className="checkout2026__summaryAccordion">
              <summary className="checkout2026__summarySummary">
                <span className="checkout2026__summarySummaryLeft">
                  <span>Resumen de compra</span>
                  <small>
                    {planName} · {summaryMonthlyLabel}
                  </small>
                </span>
                <strong>{summaryTodayLabel}</strong>
              </summary>
              <div className="checkout2026__summaryBody">{summaryContent}</div>
            </details>
            <div className="checkout2026__summaryStatic">{summaryContent}</div>
          </aside>
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
