import "./Checkout.scss";
import { useUserContext } from "../../contexts/UserContext";
import { useLocation, useNavigate, Link } from "react-router-dom";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import trpc from "../../api";
import { IPlans, IOxxoData, ISpeiData } from "interfaces/Plans";
import { trackManyChatConversion, MC_EVENTS } from "../../utils/manychatPixel";
import { manychatApi } from "../../api/manychat";
import {
  Banknote,
  Building2,
  Check,
  CreditCard,
  Landmark,
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
import PublicTopNav from "../../components/PublicTopNav/PublicTopNav";
import { toErrorMessage } from "../../utils/errorMessage";

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

const METHOD_SWITCH_LABEL: Record<CheckoutMethod, string> = {
  card: "Tarjeta",
  paypal: "PayPal",
  spei: "SPEI",
  bbva: "BBVA",
  oxxo: "Efectivo",
};

function formatSpanishDisjunction(values: string[]): string {
  const list = values.map((v) => v.trim()).filter(Boolean);
  if (list.length === 0) return "";
  if (list.length === 1) return list[0]!;
  if (list.length === 2) return `${list[0]} o ${list[1]}`;
  return `${list.slice(0, -1).join(", ")} o ${list[list.length - 1]}`;
}

function buildAltMethodHint(method: CheckoutMethod, available: CheckoutMethod[]): string {
  const others = (Array.isArray(available) ? available : []).filter((m) => m !== method);
  const labels = others.map((m) => METHOD_SWITCH_LABEL[m] ?? m);
  const copy = formatSpanishDisjunction(labels);
  if (!copy) return "";
  return `Intenta con ${copy}.`;
}

function normalizeCheckoutError(opts: {
  method: CheckoutMethod;
  error: unknown;
  availableMethods: CheckoutMethod[];
}): {
  userMessage: string;
  reason: string;
  errorCode: string;
} {
  const raw = toErrorMessage(opts.error);
  const msg = raw.toLowerCase();
  const alt = buildAltMethodHint(opts.method, opts.availableMethods);
  const altSuffix = alt ? ` ${alt}` : "";

  const isNetwork =
    /failed to fetch|networkerror|network error|timeout|timed out|load resource|err_/i.test(raw);

  const isStripeProcedureMissing =
    opts.method === "card" &&
    /mutation.*procedure|createStripeCheckoutSession/i.test(raw);

  const isDecline =
    opts.method === "card" &&
    /card_declined|declined|insufficient funds|insufficient_funds|incorrect cvc|incorrect_cvc|expired card|expired_card|do not honor|stolen|lost/i.test(
      msg,
    );

  if (isStripeProcedureMissing) {
    return {
      userMessage: `El pago con tarjeta no está disponible en este momento.${altSuffix}`,
      reason: "stripe_procedure_missing",
      errorCode: "method_unavailable",
    };
  }

  if (isNetwork) {
    return {
      userMessage: `No pudimos conectar para procesar tu pago. Revisa tu internet e intenta de nuevo.${altSuffix}`,
      reason: "network_error",
      errorCode: "network_error",
    };
  }

  if (isDecline) {
    return {
      userMessage: `Tu banco rechazó el cobro. Intenta con otra tarjeta o con otro método.${altSuffix}`,
      reason: "card_declined",
      errorCode: "card_declined",
    };
  }

  switch (opts.method) {
    case "paypal":
      return {
        userMessage: `No se pudo completar el pago con PayPal. Intenta de nuevo.${altSuffix}`,
        reason: "paypal_failed",
        errorCode: "provider_error",
      };
    case "spei":
      return {
        userMessage: `No pudimos generar la referencia SPEI. Intenta de nuevo.${altSuffix}`,
        reason: "spei_failed",
        errorCode: "provider_error",
      };
    case "oxxo":
      return {
        userMessage: `No pudimos generar la referencia de pago en efectivo. Intenta de nuevo.${altSuffix}`,
        reason: "oxxo_failed",
        errorCode: "provider_error",
      };
    case "bbva":
      return {
        userMessage: `No pudimos abrir el pago BBVA. Intenta de nuevo.${altSuffix}`,
        reason: "bbva_failed",
        errorCode: "provider_error",
      };
    case "card":
    default:
      return {
        userMessage: `No pudimos preparar el pago con tarjeta. Intenta de nuevo.${altSuffix}`,
        reason: "card_failed",
        errorCode: "provider_error",
      };
  }
}

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
  const [acceptRecurring, setAcceptRecurring] = useState(true);
  const [showSpeiModal, setShowSpeiModal] = useState(false);
  const [speiData, setSpeiData] = useState<ISpeiData | null>(null);
  const [showOxxoModal, setShowOxxoModal] = useState(false);
  const [oxxoData, setOxxoData] = useState<IOxxoData | null>(null);
  const [redirectingProvider, setRedirectingProvider] = useState<"stripe" | "bbva">("stripe");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showError, setShowError] = useState(false);
  const [paypalPlan, setPaypalPlan] = useState<IPlans | null>(null);
  const [planStatus, setPlanStatus] = useState<"idle" | "loading" | "loaded" | "not_found" | "error">("idle");
  const checkoutStartedRef = useRef(false);
  const checkoutHandedOffRef = useRef(false);
  const abandonTrackedRef = useRef(false);
  const interactedRef = useRef(false);
  const skipPlanReloadRef = useRef(false);
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
    try {
      const id_plan = Number(id);
      if (!Number.isFinite(id_plan) || id_plan <= 0) {
        setPlan(null);
        setPaypalPlan(null);
        setPlanStatus("not_found");
        return;
      }

      setPlanStatus("loading");
      const resolved = await trpc.plans.resolveCheckoutPlan.query({ planId: id_plan } as any);
      const p: IPlans | null = (resolved as any)?.plan ?? null;
      const pPaypal: IPlans | null = (resolved as any)?.paypalPlan ?? null;
      const resolvedPlanId = (resolved as any)?.resolvedPlanId;

      if (p && typeof resolvedPlanId === "number" && resolvedPlanId !== id_plan) {
        skipPlanReloadRef.current = true;
        const nextParams = new URLSearchParams(location.search);
        nextParams.set("priceId", String(resolvedPlanId));
        navigate(
          { pathname: location.pathname, search: `?${nextParams.toString()}` },
          { replace: true },
        );
      }

      setPlan(p);
      setPaypalPlan(pPaypal);
      setPlanStatus(p ? "loaded" : "not_found");
      if (p) checkManyChat(p);
    } catch {
      setPlan(null);
      setPaypalPlan(null);
      setPlanStatus("error");
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
    if (skipPlanReloadRef.current) {
      skipPlanReloadRef.current = false;
      return;
    }
    checkoutStartedRef.current = false;
    checkoutHandedOffRef.current = false;
    abandonTrackedRef.current = false;
    interactedRef.current = false;
    setRedirecting(false);
    setShowRedirectHelp(false);
    setInlineError(null);
    setAcceptRecurring(true);
    setSelectedMethod("card");
    setSpeiData(null);
    setShowSpeiModal(false);
    setPlan(null);
    setPaypalPlan(null);
    setPlanStatus(priceId ? "loading" : "idle");
    if (priceId) getPlans(priceId);
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
    if (!acceptRecurring) {
      setInlineError("Para continuar debes aceptar el cobro recurrente (renovación automática).");
      return;
    }
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
        acceptRecurring,
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
      const alt = buildAltMethodHint("card", availableMethods);
      const suffix = alt ? ` ${alt}` : "";
      setErrorMessage(`No se pudo abrir la página de pago. Intenta de nuevo.${suffix}`);
      trackGrowthMetric(GROWTH_METRICS.CHECKOUT_ERROR, {
        method: "card",
        planId: plan.id,
        currency,
        amount: value,
        reason: "missing_redirect_url",
        errorCode: "missing_redirect_url",
      });
      setShowError(true);
      setRedirecting(false);
      setProcessingMethod(null);
    } catch (err: any) {
      const normalized = normalizeCheckoutError({
        method: "card",
        error: err,
        availableMethods,
      });
      setErrorMessage(normalized.userMessage);
      trackGrowthMetric(GROWTH_METRICS.CHECKOUT_ERROR, {
        method: "card",
        planId: plan.id,
        currency,
        amount: value,
        reason: normalized.reason,
        errorCode: normalized.errorCode,
      });
      setShowError(true);
      setRedirecting(false);
      setProcessingMethod(null);
    }
  }, [acceptRecurring, cookies._fbc, cookies._fbp, location.pathname, location.search, plan?.id, plan?.moneda, plan?.price, priceId, availableMethods.join("|")]);

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
        const normalized = normalizeCheckoutError({
          method: "spei",
          error,
          availableMethods,
        });
        trackGrowthMetric(GROWTH_METRICS.CHECKOUT_ERROR, {
          method: "spei",
          planId: plan.id,
          currency: (plan.moneda?.toUpperCase() || "USD").toUpperCase(),
          amount: Number(plan.price) || null,
          reason: normalized.reason,
          errorCode: normalized.errorCode,
        });
        setErrorMessage(normalized.userMessage);
        setShowError(true);
      } finally {
        setProcessingMethod(null);
      }
    },
    [plan?.id, plan?.moneda, plan?.price, availableMethods.join("|")]
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
      const normalized = normalizeCheckoutError({
        method: "oxxo",
        error,
        availableMethods,
      });
      trackGrowthMetric(GROWTH_METRICS.CHECKOUT_ERROR, {
        method: "oxxo",
        planId: plan.id,
        currency: (plan.moneda?.toUpperCase() || "USD").toUpperCase(),
        amount: Number(plan.price) || null,
        reason: normalized.reason,
        errorCode: normalized.errorCode,
      });
      setErrorMessage(normalized.userMessage);
      setShowError(true);
    } finally {
      setProcessingMethod(null);
    }
  }, [plan?.id, plan?.moneda, plan?.price, availableMethods.join("|")]);

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
      const alt = buildAltMethodHint("bbva", availableMethods);
      const suffix = alt ? ` ${alt}` : "";
      setErrorMessage(`No se pudo abrir el pago BBVA. Intenta de nuevo.${suffix}`);
      trackGrowthMetric(GROWTH_METRICS.CHECKOUT_ERROR, {
        method: "bbva",
        planId: plan.id,
        currency,
        amount: value,
        reason: "missing_redirect_url",
        errorCode: "missing_redirect_url",
      });
      setShowError(true);
      setRedirecting(false);
      setProcessingMethod(null);
    } catch (error: any) {
      const normalized = normalizeCheckoutError({
        method: "bbva",
        error,
        availableMethods,
      });
      trackGrowthMetric(GROWTH_METRICS.CHECKOUT_ERROR, {
        method: "bbva",
        planId: plan.id,
        currency,
        amount: value,
        reason: normalized.reason,
        errorCode: normalized.errorCode,
      });
      setErrorMessage(normalized.userMessage);
      setShowError(true);
      setRedirecting(false);
      setProcessingMethod(null);
    }
  }, [plan?.id, plan?.moneda, plan?.price, availableMethods.join("|")]);

  const startPaypalCheckout = useCallback(
    async (data: any) => {
      if (!paypalPlan?.id || !plan?.id) return;
      const subscriptionId =
        typeof data?.subscriptionID === "string" && data.subscriptionID.trim()
          ? data.subscriptionID.trim()
          : null;
      if (!subscriptionId) {
        const alt = buildAltMethodHint("paypal", availableMethods);
        const suffix = alt ? ` ${alt}` : "";
        setErrorMessage(`No recibimos la referencia de PayPal. Intenta de nuevo.${suffix}`);
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
          acceptRecurring,
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
        const normalized = normalizeCheckoutError({
          method: "paypal",
          error,
          availableMethods,
        });
        trackGrowthMetric(GROWTH_METRICS.CHECKOUT_ERROR, {
          method: "paypal",
          planId: plan.id,
          currency,
          amount: value,
          reason: normalized.reason,
          errorCode: normalized.errorCode,
        });
        setErrorMessage(normalized.userMessage);
        setShowError(true);
      } finally {
        setProcessingMethod(null);
      }
    },
    [acceptRecurring, paypalPlan?.id, plan?.id, plan?.price, plan?.moneda, cookies._fbp, cookies._fbc, navigate, availableMethods.join("|")],
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
      if (!acceptRecurring) {
        setInlineError("Para continuar debes aceptar el cobro recurrente (renovación automática).");
        return;
      }
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
  const benefitList = [
    `Cuota mensual: ${formatInt(quotaGb)} GB/mes de descargas rápidas.`,
    "Catálogo completo (eliges qué descargar).",
    "Catálogo pensado para cabina en vivo.",
    "Búsqueda rápida por género y temporada.",
    "Carpetas listas por género y temporada.",
    "Soporte por chat para activar.",
  ];

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

  const TopNav = (
    <PublicTopNav
      className="checkout2026__topnav"
      brandTo="/planes"
      plansTo="/planes"
      loginFrom={priceId ? `/comprar?priceId=${priceId}` : "/planes"}
    />
  );

  if (!priceId) {
    return (
      <div className="checkout-main-container checkout2026">
        {TopNav}
        <section className="checkout2026__main" aria-label="Checkout">
          <div className="checkout2026__container checkout2026__center">
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
        </section>
      </div>
    );
  }

  // Estado único: redirigiendo a Stripe → pantalla clara, sin grid
  if (redirecting) {
    const providerName =
      redirectingProvider === "stripe" ? "Stripe" : "BBVA (Conekta)";
    return (
      <div className="checkout-main-container checkout2026">
        {TopNav}
        <section className="checkout2026__main" aria-label="Checkout">
          <div className="checkout2026__container checkout2026__center">
            <div className="checkout-one-state" role="status" aria-live="polite" aria-busy="true">
              <span className="checkout2026__sk checkout2026__sk--redirectBar" aria-hidden />
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
        </section>
      </div>
    );
  }

  // Plan aún cargando → una sola pantalla de carga
  if (!plan) {
    if (planStatus === "error" || planStatus === "not_found") {
      const title =
        planStatus === "not_found"
          ? "Este plan ya no está disponible."
          : "No pudimos cargar el plan.";
      const text =
        planStatus === "not_found"
          ? "El enlace puede estar desactualizado. Selecciona un plan para continuar."
          : "Ocurrió un error al cargar tu plan. Intenta de nuevo o selecciona un plan.";

      return (
        <div className="checkout-main-container checkout2026">
          {TopNav}
          <section className="checkout2026__main" aria-label="Checkout">
            <div className="checkout2026__container checkout2026__center">
              <div className="checkout-one-state" role="status" aria-live="polite">
                <h1 className="checkout-one-state__title">{title}</h1>
                <p className="checkout-one-state__text">{text}</p>
                <div className="checkout-one-state__help">
                  <button
                    type="button"
                    className="checkout-cta-btn checkout-cta-btn--primary"
                    onClick={() => getPlans(priceId)}
                  >
                    Reintentar
                  </button>
                  <Link to="/planes" className="checkout-cta-btn checkout-cta-btn--ghost">
                    Ver planes
                  </Link>
                </div>
              </div>
            </div>
          </section>
        </div>
      );
    }

    return (
      <div className="checkout-main-container checkout2026">
        {TopNav}
        <section className="checkout2026__main" aria-label="Checkout">
          <div className="checkout2026__container">
            <header className="checkout2026__hero">
              <h1>Completa tu pago.</h1>
              <p className="checkout2026__heroSubtitle">Checkout seguro. Activa tu acceso en 1 minuto.</p>
            </header>

            <section
              className="checkout-card checkout2026__card checkout2026__card--skeleton"
              aria-label="Cargando plan"
              role="status"
              aria-live="polite"
              aria-busy="true"
            >
              <p className="checkout2026__skeletonStatus">Cargando plan…</p>

              <div className="checkout2026__cardHead" aria-hidden>
                <span className="checkout2026__sk checkout2026__sk--pill" />
                <span className="checkout2026__sk checkout2026__sk--pill checkout2026__sk--pillSmall" />
              </div>

              <div className="checkout2026__price" aria-hidden>
                <span className="checkout2026__sk checkout2026__sk--price" />
                <span className="checkout2026__sk checkout2026__sk--suffix" />
              </div>

              <ul className="checkout2026__skeletonBenefits" aria-hidden>
                {Array.from({ length: 6 }).map((_, i) => (
                  <li key={i} className="checkout2026__benefit">
                    <span className="checkout2026__sk checkout2026__sk--benefitIcon" />
                    <span className="checkout2026__sk checkout2026__sk--benefitLine" />
                  </li>
                ))}
              </ul>

              <div className="checkout2026__divider" aria-hidden />

              <section className="checkout2026__methodSection" aria-hidden>
                <span className="checkout2026__sk checkout2026__sk--sectionLabel" />
                <div className="checkout2026__skeletonMethodSwitch">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <span key={i} className="checkout2026__sk checkout2026__sk--methodBtn" />
                  ))}
                </div>
                <div className="checkout2026__skeletonBlurb">
                  <span className="checkout2026__sk checkout2026__sk--blurbLine" />
                  <span className="checkout2026__sk checkout2026__sk--blurbLine checkout2026__sk--blurbLineShort" />
                </div>
              </section>

              <div className="checkout2026__actions" aria-hidden>
                <span className="checkout2026__sk checkout2026__sk--cta" />
              </div>
            </section>
          </div>
        </section>
      </div>
    );
  }

  // Show every available payment method (CRO: users need to see OXXO when enabled).
  const methodOrder: CheckoutMethod[] = ["card", "paypal", "spei", "oxxo", "bbva"];
  const methodsForUi: CheckoutMethod[] = methodOrder.filter((method) => availableMethods.includes(method));

  const summaryMonthlyLabel = `$${totalPrice} ${currencyCode}/mes`;
  const trialPill = selectedMethod === "card" && isTrialEligible ? `Prueba ${trialDays} días` : null;

  const shouldShowPaypalInline =
    selectedMethod === "paypal" &&
    processingMethod === null &&
    hasPaypalPlan &&
    Boolean(currentUser?.email) &&
    Boolean(paypalPlan);

  const methodBlurb = (() => {
    const monthly = summaryMonthlyLabel;
    switch (selectedMethod) {
      case "card":
        return isCardTrial
          ? `Hoy $0: empiezas tu prueba de ${trialDays} días (${formatInt(trialGb)} GB). Después ${monthly}.`
          : `Pago inmediato. Activación en 1 minuto. Renovación automática: ${monthly}.`;
      case "paypal":
        return `Autoriza el pago en PayPal. Activación inmediata. Renovación automática: ${monthly}.`;
      case "spei":
        return "Generamos CLABE/referencia para transferir. Activación automática al confirmar tu transferencia (depende del banco).";
      case "bbva":
        return "Te redirigimos a BBVA para autorizar el pago. Activación automática al confirmar (sin comprobantes).";
      case "oxxo":
        return "Generamos una referencia para pagar en tienda. Activación automática al confirmar (puede tardar hasta 48 hrs).";
      default:
        return "";
    }
  })();

  const trialHint =
    isTrialEligible && selectedMethod !== "card"
      ? `Tip: con tarjeta puedes iniciar una prueba de ${trialDays} días (hoy $0).`
      : null;

  const paymentMethods =
    currencyCode === "MXN"
      ? (["visa", "mastercard", "paypal", "spei"] as const)
      : (["visa", "mastercard", "paypal"] as const);

  return (
    <div className="checkout-main-container checkout2026">
      {TopNav}
      <section className="checkout2026__main" aria-label="Checkout">
        <div className="checkout2026__container">
          <header className="checkout2026__hero">
            <h1>Completa tu pago.</h1>
            <p className="checkout2026__heroSubtitle">
              Checkout seguro. Activa tu acceso en 1 minuto.
            </p>
          </header>

          <section className="checkout-card checkout2026__card" aria-label="Completa tu pago">
            <div className="checkout2026__cardHead">
              <p className="checkout2026__planPill">{planName}</p>
              {trialPill && <p className="checkout2026__trialPill">{trialPill}</p>}
            </div>

            <div className="checkout2026__price" aria-label={`Precio ${currencyCode}`}>
              <span className="checkout2026__priceAmount">{`$${totalPrice}`}</span>
              <span className="checkout2026__priceSuffix">
                {currencyCode} <span aria-hidden>/</span> mes
              </span>
            </div>

            <ul className="checkout2026__benefits" aria-label="Beneficios">
              {benefitList.map((benefit) => (
                <li key={benefit} className="checkout2026__benefit">
                  <span className="checkout2026__benefitIcon" aria-hidden>
                    <Check size={16} />
                  </span>
                  <span className="checkout2026__benefitText">{benefit}</span>
                </li>
              ))}
            </ul>

            <p className="checkout2026__limitsNote">
              La cuota mensual es lo que puedes descargar cada ciclo. El catálogo total es lo disponible para elegir.
            </p>

            <div className="checkout2026__divider" aria-hidden />

            <section className="checkout2026__methodSection" aria-label="Método de pago">
              <p className="checkout2026__sectionLabel">Método de pago</p>
              <div className="checkout2026__methodSwitch" role="radiogroup" aria-label="Elige cómo pagar">
                {methodsForUi.map((method) => {
                  const { Icon } = METHOD_META[method];
                  const isActive = selectedMethod === method;
                  const label = METHOD_SWITCH_LABEL[method] ?? method;

                  return (
                    <button
                      key={method}
                      type="button"
                      role="radio"
                      aria-checked={isActive}
                      className={`checkout2026__methodBtn ${isActive ? "is-active" : ""}`}
                      onClick={() => handleSelectMethod(method)}
                      disabled={processingMethod !== null}
                      data-testid={`checkout-method-${method}`}
                    >
                      <span className="checkout2026__methodBtnIcon" aria-hidden>
                        <Icon size={16} />
                      </span>
                      <span className="checkout2026__methodBtnLabel">{label}</span>
                    </button>
                  );
                })}
              </div>
              <p className="checkout2026__methodBlurb">{methodBlurb}</p>
              {trialHint && <p className="checkout2026__methodHint">{trialHint}</p>}
            </section>

            {(selectedMethod === "card" || selectedMethod === "paypal") && (
              <section
                className={`checkout2026__consent ${!acceptRecurring ? "is-error" : ""}`}
                aria-label="Consentimiento de cobro recurrente"
              >
                <label className="checkout2026__consentRow">
                  <input
                    type="checkbox"
                    checked={acceptRecurring}
                    onChange={(e) => {
                      interactedRef.current = true;
                      setAcceptRecurring(e.target.checked);
                      setInlineError(null);
                    }}
                    disabled={processingMethod !== null}
                  />
                  <span className="checkout2026__consentCopy">
                    <strong>Acepto renovación automática</strong>
                    <span>
                      {isCardTrial
                        ? `Hoy $0. Después ${summaryMonthlyLabel} hasta que cancele.`
                        : `${summaryMonthlyLabel} hasta que cancele.`}
                    </span>
                  </span>
                </label>
                <p className="checkout2026__consentFineprint">
                  Puedes cancelar cuando quieras desde <Link to="/micuenta">Mi cuenta</Link>. Al continuar aceptas{" "}
                  <Link to="/legal#terminos">Términos</Link>, <Link to="/legal#privacidad">Privacidad</Link> y{" "}
                  <Link to="/legal#reembolsos">Reembolsos</Link>.
                </p>
              </section>
            )}

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
                    canProceed={acceptRecurring}
                    onBlocked={() => {
                      setInlineError("Para continuar debes aceptar el cobro recurrente (renovación automática).");
                    }}
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

            <div className="checkout2026__trust" aria-label="Confianza">
              <PaymentMethodLogos
                methods={[...paymentMethods]}
                className="checkout2026__paymentLogos"
                ariaLabel="Métodos de pago disponibles"
              />
              <p className="checkout2026__trustCopy">Esta cuenta activa al pagar. Cancela cuando quieras.</p>
              <p className="checkout2026__links" aria-label="Ayuda">
                <Link to="/instrucciones" className="checkout2026__link">
                  Ver cómo descargar
                </Link>
                <span className="checkout2026__linkSep" aria-hidden>
                  ·
                </span>
                <Link to="/legal" className="checkout2026__link">
                  FAQ y políticas
                </Link>
              </p>
            </div>
          </section>
        </div>
      </section>

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
