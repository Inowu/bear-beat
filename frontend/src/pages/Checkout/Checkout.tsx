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
import { ErrorModal, ErrorModalAction } from "../../components/Modals/ErrorModal/ErrorModal";
import { SpeiModal } from "../../components/Modals/SpeiModal/SpeiModal";
import { OxxoModal } from "../../components/Modals/OxxoModal/OxxoModal";
import PayPalComponent from "../../components/PayPal/PayPalComponent";
import { GROWTH_METRICS, trackGrowthMetric } from "../../utils/growthMetrics";
import PaymentMethodLogos, { PaymentMethodId } from "../../components/PaymentMethodLogos/PaymentMethodLogos";
import { useCookies } from "react-cookie";
import { trackInitiateCheckout } from "../../utils/facebookPixel";
import { generateEventId } from "../../utils/marketingIds";
import { getConektaFingerprint } from "../../utils/conektaCollect";
import { formatInt } from "../../utils/format";
import PublicTopNav from "../../components/PublicTopNav/PublicTopNav";
import { toErrorMessage } from "../../utils/errorMessage";

type CheckoutMethod = "card" | "spei" | "oxxo" | "bbva" | "paypal";

const CHECKOUT_METHOD_ORDER: CheckoutMethod[] = ["card", "paypal", "spei", "oxxo", "bbva"];

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

function pickCheckoutAlternateMethod(
  method: CheckoutMethod,
  availableMethods: CheckoutMethod[],
): CheckoutMethod | null {
  const available = new Set(Array.isArray(availableMethods) ? availableMethods : []);
  for (const candidate of CHECKOUT_METHOD_ORDER) {
    if (candidate === method) continue;
    if (available.has(candidate)) return candidate;
  }
  return null;
}

function checkoutSwitchActionLabel(method: CheckoutMethod): string {
  switch (method) {
    case "paypal":
      return "Pagar con PayPal";
    case "spei":
      return "Pagar con SPEI";
    case "oxxo":
      return "Pagar en efectivo";
    case "bbva":
      return "Pagar con BBVA";
    case "card":
    default:
      return "Pagar con tarjeta";
  }
}

function checkoutRetryActionLabel(method: CheckoutMethod): string {
  switch (method) {
    case "paypal":
      return "Reintentar PayPal";
    case "spei":
      return "Reintentar SPEI";
    case "oxxo":
      return "Reintentar efectivo";
    case "bbva":
      return "Reintentar BBVA";
    case "card":
    default:
      return "Reintentar tarjeta";
  }
}

function checkoutErrorTitle(method: CheckoutMethod, reason?: string): string {
  switch (reason) {
    case "card_declined":
      return "Tu banco rechazó la transacción";
    case "invalid_coupon":
      return "Cupón no válido";
    case "unauthorized":
      return "Tu sesión expiró";
    case "network_error":
      return "Problema de conexión";
    case "stripe_procedure_missing":
      return "Tarjeta no disponible";
    case "missing_redirect_url":
      return "No se abrió la página de pago";
    case "missing_subscription_id":
      return "No se completó PayPal";
    default:
      break;
  }

  switch (method) {
    case "paypal":
      return "No se pudo completar con PayPal";
    case "spei":
      return "No se pudo generar SPEI";
    case "oxxo":
      return "No se pudo generar la referencia";
    case "bbva":
      return "No se pudo abrir BBVA";
    case "card":
    default:
      return "No se pudo procesar con tarjeta";
  }
}

function normalizeCheckoutError(opts: {
  method: CheckoutMethod;
  error: unknown;
  availableMethods: CheckoutMethod[];
  couponCode?: string | null;
}): {
  userMessage: string;
  hint?: string;
  reason: string;
  errorCode: string;
} {
  const extractTrpcCode = (err: unknown): string | null => {
    const anyErr = err as any;
    const code =
      typeof anyErr?.data?.code === "string"
        ? anyErr.data.code
        : typeof anyErr?.shape?.data?.code === "string"
          ? anyErr.shape.data.code
          : null;
    return code ? String(code).trim().toUpperCase() : null;
  };

  const raw = toErrorMessage(opts.error);
  const msg = raw.toLowerCase();
  const alt = buildAltMethodHint(opts.method, opts.availableMethods);
  const altSuffix = alt ? ` ${alt}` : "";

  const trpcCode = extractTrpcCode(opts.error);
  const mentionsCoupon = /cup[oó]n|coupon|promotion code|promo code/i.test(raw);
  const isUnauthorized =
    trpcCode === "UNAUTHORIZED" ||
    (trpcCode === "FORBIDDEN" && !mentionsCoupon) ||
    /unauthorized|forbidden|not authorized|no autorizado|sesion expirada|session expired|jwt expired/i.test(raw);

  if (isUnauthorized) {
    return {
      userMessage: "Tu sesión expiró. Vuelve a iniciar sesión para continuar.",
      hint: "Al iniciar sesión regresaremos a tu checkout para que puedas completar el pago.",
      reason: "unauthorized",
      errorCode: "unauthorized",
    };
  }

  const isInvalidCoupon = (() => {
    if (opts.method !== "card") return false;
    if (!opts.couponCode) return false;

    const mentionsCoupon = /cup[oó]n|coupon|promotion code|promo code/i.test(raw);
    if (!mentionsCoupon) return false;

    const trpcCouponCodes = new Set(["NOT_FOUND", "BAD_REQUEST", "FORBIDDEN"]);
    const isTrpcCouponError = trpcCode ? trpcCouponCodes.has(trpcCode) : false;

    const msgLooksLikeCouponFailure =
      /no such|invalid|expired|expir|no existe|no encontrado|ya fue usado|ya usado|no est[aá] disponible|not available|already used|redeemed/i.test(
        msg,
      );

    return isTrpcCouponError || msgLooksLikeCouponFailure;
  })();

  if (isInvalidCoupon) {
    const usedCopy = /ya fue usado|ya usado|already used|redeemed/i.test(msg);
    const forbiddenCopy = /no est[aá] disponible|not available/i.test(msg) || trpcCode === "FORBIDDEN";
    const userMessage = forbiddenCopy
      ? "Este cupón no está disponible para tu cuenta. Puedes continuar sin cupón."
      : usedCopy
        ? "Este cupón ya fue usado. Puedes continuar sin cupón."
        : "El cupón no es válido o ya expiró. Puedes continuar sin cupón.";
    return {
      userMessage,
      hint: "Si el cupón venía en el enlace, quítalo e intenta de nuevo.",
      reason: "invalid_coupon",
      errorCode: "invalid_coupon",
    };
  }

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
      hint: "Puedes continuar con otro método de pago.",
      reason: "stripe_procedure_missing",
      errorCode: "method_unavailable",
    };
  }

  if (isNetwork) {
    return {
      userMessage: `No pudimos conectar para procesar tu pago. Revisa tu internet e intenta de nuevo.${altSuffix}`,
      hint: "Si estás en datos móviles, prueba con WiFi o cambia de método.",
      reason: "network_error",
      errorCode: "network_error",
    };
  }

  if (isDecline) {
    return {
      userMessage: `Tu banco rechazó la transacción. No se hizo ningún cobro.${altSuffix}`,
      hint: "Prueba con PayPal, SPEI o con otra tarjeta.",
      reason: "card_declined",
      errorCode: "card_declined",
    };
  }

  switch (opts.method) {
    case "paypal":
      return {
        userMessage: `No se pudo completar el pago con PayPal.${altSuffix}`,
        hint: "Si PayPal falla, prueba con tarjeta o SPEI.",
        reason: "paypal_failed",
        errorCode: "provider_error",
      };
    case "spei":
      return {
        userMessage: `No pudimos generar la referencia SPEI.${altSuffix}`,
        hint: "A veces se resuelve reintentando en unos segundos.",
        reason: "spei_failed",
        errorCode: "provider_error",
      };
    case "oxxo":
      return {
        userMessage: `No pudimos generar la referencia de pago en efectivo.${altSuffix}`,
        hint: "Si sigue fallando, usa tarjeta o SPEI para activar al instante.",
        reason: "oxxo_failed",
        errorCode: "provider_error",
      };
    case "bbva":
      return {
        userMessage: `No pudimos abrir el pago BBVA.${altSuffix}`,
        hint: "Puedes intentar otra opción o reintentar.",
        reason: "bbva_failed",
        errorCode: "provider_error",
      };
    case "card":
    default:
      return {
        userMessage: `No pudimos preparar el pago con tarjeta.${altSuffix}`,
        hint: "Puedes reintentar o elegir otro método de pago.",
        reason: "card_failed",
        errorCode: "provider_error",
      };
  }
}

function Checkout() {
  const [plan, setPlan] = useState<IPlans | null>(null);
  const [checkoutSummary, setCheckoutSummary] = useState<{ currency: string | null; price: number | null } | null>(
    null,
  );
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
  const [availableMethods, setAvailableMethods] = useState<CheckoutMethod[]>(["card"]);
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
  const [errorTitle, setErrorTitle] = useState<string | null>(null);
  const [errorHint, setErrorHint] = useState<string | null>(null);
  const [errorActions, setErrorActions] = useState<ErrorModalAction[] | null>(null);
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
  const couponParamRaw = searchParams.get("coupon") ?? searchParams.get("cupon");
  const couponCode = (() => {
    const raw = typeof couponParamRaw === "string" ? couponParamRaw.trim() : "";
    if (!raw) return null;
    // Avoid passing arbitrary/unbounded strings to the backend from the URL.
    if (!/^[a-z0-9_-]{2,32}$/i.test(raw)) return null;
    return raw;
  })();
  const { currentUser, handleLogout } = useUserContext();
  const [cookies] = useCookies(["_fbp", "_fbc"]);

  const closeErrorModal = useCallback(() => {
    setShowError(false);
    setErrorMessage(null);
    setErrorTitle(null);
    setErrorHint(null);
    setErrorActions(null);
  }, []);

  const focusCheckoutMethodButton = useCallback((method: CheckoutMethod) => {
    const el = document.querySelector<HTMLElement>(`[data-testid="checkout-method-${method}"]`);
    if (!el) return;
    el.focus();
    try {
      el.scrollIntoView({ block: "center", behavior: "smooth" });
    } catch {
      el.scrollIntoView();
    }
  }, []);

  const focusRecurringConsent = useCallback(() => {
    const el = document.querySelector<HTMLInputElement>('[data-testid="checkout-recurring-consent"]');
    if (!el) return;
    el.focus();
    try {
      el.scrollIntoView({ block: "center", behavior: "smooth" });
    } catch {
      el.scrollIntoView();
    }
  }, []);

  const selectCheckoutMethod = useCallback(
    (method: CheckoutMethod, surface: "selector" | "error_modal") => {
      interactedRef.current = true;
      setInlineError(null);
      setSelectedMethod(method);
      trackGrowthMetric(GROWTH_METRICS.CHECKOUT_METHOD_SELECTED, {
        method,
        surface,
        planId: plan?.id ?? null,
        currency: plan?.moneda?.toUpperCase() ?? null,
        amount: Number(plan?.price) || null,
      });
    },
    [plan?.id, plan?.moneda, plan?.price],
  );

  const pendingPurchaseStorageKey = "bb.checkout.pendingPurchase";

  const hasPaypalPlan = Boolean(paypalPlan?.paypal_plan_id || paypalPlan?.paypal_plan_id_test);

  const checkoutCurrency = useMemo(() => {
    const raw = checkoutSummary?.currency ?? plan?.moneda;
    const normalized = String(raw ?? "").trim().toUpperCase();
    return normalized || null;
  }, [checkoutSummary?.currency, plan?.moneda]);

  const checkoutAmount = useMemo(() => {
    const raw = checkoutSummary?.price ?? plan?.price;
    const n = Number(raw ?? 0);
    return Number.isFinite(n) ? n : 0;
  }, [checkoutSummary?.price, plan?.price]);

  useEffect(() => {
    // Evitar doble membresía: si ya tiene un plan activo, empujar a recarga de GB extra en /micuenta.
    if (currentUser?.hasActiveSubscription) {
      navigate("/micuenta", { replace: true });
    }
  }, [currentUser?.hasActiveSubscription, navigate]);

  const openCheckoutError = useCallback(
    (opts: {
      method: CheckoutMethod;
      userMessage: string;
      hint?: string;
      reason?: string;
      retry?: (() => void) | null;
    }) => {
      if (opts.reason === "invalid_coupon") {
        const actions: ErrorModalAction[] = [
          {
            label: "Continuar sin cupón",
            variant: "primary",
            onClick: () => {
              const nextParams = new URLSearchParams(location.search);
              nextParams.delete("coupon");
              nextParams.delete("cupon");
              const nextSearch = nextParams.toString();
              closeErrorModal();
              navigate(
                { pathname: location.pathname, search: nextSearch ? `?${nextSearch}` : "" },
                { replace: true },
              );
            },
          },
          {
            label: "Cerrar",
            variant: "secondary",
            onClick: () => closeErrorModal(),
          },
        ];

        setErrorTitle(checkoutErrorTitle(opts.method, opts.reason));
        setErrorHint(opts.hint ?? null);
        setErrorMessage(opts.userMessage);
        setErrorActions(actions);
        setShowError(true);
        return;
      }

      if (opts.reason === "unauthorized") {
        const actions: ErrorModalAction[] = [
          {
            label: "Iniciar sesión",
            variant: "primary",
            onClick: () => {
              closeErrorModal();
              handleLogout(false);
            },
          },
          {
            label: "Volver a planes",
            variant: "secondary",
            onClick: () => {
              closeErrorModal();
              navigate("/planes");
            },
          },
        ];

        setErrorTitle(checkoutErrorTitle(opts.method, opts.reason));
        setErrorHint(opts.hint ?? null);
        setErrorMessage(opts.userMessage);
        setErrorActions(actions);
        setShowError(true);
        return;
      }

      const alt = pickCheckoutAlternateMethod(opts.method, availableMethods);
      const title = checkoutErrorTitle(opts.method, opts.reason);
      const switchAction =
        alt !== null
          ? {
              label: checkoutSwitchActionLabel(alt),
              onClick: () => {
                closeErrorModal();
                selectCheckoutMethod(alt, "error_modal");
                window.setTimeout(() => {
                  focusCheckoutMethodButton(alt);
                }, 0);
              },
            }
          : null;
      const retryAction =
        typeof opts.retry === "function"
          ? {
              label: checkoutRetryActionLabel(opts.method),
              onClick: () => {
                closeErrorModal();
                opts.retry?.();
              },
            }
          : null;

      const preferSwitch =
        Boolean(switchAction) &&
        (opts.reason === "card_declined" ||
          opts.reason === "stripe_procedure_missing" ||
          opts.reason === "missing_subscription_id" ||
          opts.reason === "paypal_failed");

      let primary: ErrorModalAction | null = null;
      let secondary: ErrorModalAction | null = null;
      if (preferSwitch) {
        primary = switchAction;
        secondary = retryAction;
      } else if (retryAction) {
        primary = retryAction;
        secondary = switchAction;
      } else {
        primary = switchAction;
      }

      const actions: ErrorModalAction[] = [];
      if (primary) actions.push({ ...primary, variant: "primary" });
      if (secondary) actions.push({ ...secondary, variant: "secondary" });

      setErrorTitle(title);
      setErrorHint(opts.hint ?? null);
      setErrorMessage(opts.userMessage);
      setErrorActions(actions.length ? actions : null);
      setShowError(true);
    },
    [
      availableMethods.join("|"),
      closeErrorModal,
      focusCheckoutMethodButton,
      handleLogout,
      location.pathname,
      location.search,
      navigate,
      selectCheckoutMethod,
    ],
  );

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
        setCheckoutSummary(null);
        setPlanStatus("not_found");
        return;
      }

      setPlanStatus("loading");
      const resolved = await trpc.plans.resolveCheckoutPlan.query({ planId: id_plan } as any);
      const p: IPlans | null = (resolved as any)?.plan ?? null;
      const pPaypal: IPlans | null = (resolved as any)?.paypalPlan ?? null;
      const resolvedPlanId = (resolved as any)?.resolvedPlanId;
      const checkout = (resolved as any)?.checkout ?? null;

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

      if (!p) {
        // Nothing else to compute for a missing plan.
        setAvailableMethods(["card"]);
        setTrialConfig({ enabled: false, days: 0, gb: 0, eligible: null });
        setCheckoutSummary(null);
        return;
      }

      const backendMethods =
        checkout && typeof checkout === "object" && Array.isArray((checkout as any).availableMethods)
          ? ((checkout as any).availableMethods as CheckoutMethod[])
          : null;
      const backendTrialConfig =
        checkout &&
        typeof checkout === "object" &&
        (checkout as any).trialConfig &&
        typeof (checkout as any).trialConfig === "object"
          ? ((checkout as any).trialConfig as {
              enabled: boolean;
              days: number;
              gb: number;
              eligible?: boolean | null;
            })
          : null;

      const backendCurrency =
        checkout && typeof checkout === "object" && typeof (checkout as any).currency === "string"
          ? String((checkout as any).currency).trim().toUpperCase()
          : null;
      const backendPriceRaw =
        checkout && typeof checkout === "object" ? Number((checkout as any).price ?? Number.NaN) : Number.NaN;
      const backendPrice =
        Number.isFinite(backendPriceRaw) && backendPriceRaw > 0 ? backendPriceRaw : null;

      setCheckoutSummary({ currency: backendCurrency, price: backendPrice });
      setAvailableMethods(backendMethods && backendMethods.length > 0 ? backendMethods : ["card"]);
      setTrialConfig(backendTrialConfig ?? { enabled: false, days: 0, gb: 0, eligible: null });
    } catch {
      setPlan(null);
      setPaypalPlan(null);
      setCheckoutSummary(null);
      setAvailableMethods(["card"]);
      setTrialConfig({ enabled: false, days: 0, gb: 0, eligible: null });
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
    closeErrorModal();
    setRedirecting(false);
    setShowRedirectHelp(false);
    setInlineError(null);
    setAcceptRecurring(true);
    setSelectedMethod("card");
    setSpeiData(null);
    setShowSpeiModal(false);
    setPlan(null);
    setPaypalPlan(null);
    setCheckoutSummary(null);
    setPlanStatus(priceId ? "loading" : "idle");
    if (priceId) getPlans(priceId);
  }, [priceId, getPlans, closeErrorModal]);

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
      focusRecurringConsent();
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
        coupon: couponCode ?? undefined,
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
      openCheckoutError({
        method: "card",
        userMessage: `No se pudo abrir la página de pago. Intenta de nuevo.${suffix}`,
        hint: "Puedes reintentar o elegir otro método de pago.",
        reason: "missing_redirect_url",
        retry: startStripeCheckout,
      });
      trackGrowthMetric(GROWTH_METRICS.CHECKOUT_ERROR, {
        method: "card",
        planId: plan.id,
        currency,
        amount: value,
        reason: "missing_redirect_url",
        errorCode: "missing_redirect_url",
      });
      setRedirecting(false);
      setProcessingMethod(null);
    } catch (err: any) {
      const normalized = normalizeCheckoutError({
        method: "card",
        error: err,
        availableMethods,
        couponCode,
      });
      openCheckoutError({
        method: "card",
        userMessage: normalized.userMessage,
        hint: normalized.hint,
        reason: normalized.reason,
        retry: normalized.reason === "stripe_procedure_missing" ? null : startStripeCheckout,
      });
      trackGrowthMetric(GROWTH_METRICS.CHECKOUT_ERROR, {
        method: "card",
        planId: plan.id,
        currency,
        amount: value,
        reason: normalized.reason,
        errorCode: normalized.errorCode,
      });
      setRedirecting(false);
      setProcessingMethod(null);
    }
  }, [acceptRecurring, cookies._fbc, cookies._fbp, focusRecurringConsent, location.pathname, location.search, plan?.id, plan?.moneda, plan?.price, priceId, availableMethods.join("|"), openCheckoutError]);

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
        openCheckoutError({
          method: "spei",
          userMessage: normalized.userMessage,
          hint: normalized.hint,
          reason: normalized.reason,
          retry: startCashCheckout,
        });
      } finally {
        setProcessingMethod(null);
      }
    },
    [plan?.id, plan?.moneda, plan?.price, availableMethods.join("|"), openCheckoutError]
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
      openCheckoutError({
        method: "oxxo",
        userMessage: normalized.userMessage,
        hint: normalized.hint,
        reason: normalized.reason,
        retry: startOxxoCheckout,
      });
    } finally {
      setProcessingMethod(null);
    }
  }, [plan?.id, plan?.moneda, plan?.price, availableMethods.join("|"), openCheckoutError]);

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
      openCheckoutError({
        method: "bbva",
        userMessage: `No se pudo abrir el pago BBVA. Intenta de nuevo.${suffix}`,
        hint: "Puedes reintentar o elegir otro método de pago.",
        reason: "missing_redirect_url",
        retry: startBbvaCheckout,
      });
      trackGrowthMetric(GROWTH_METRICS.CHECKOUT_ERROR, {
        method: "bbva",
        planId: plan.id,
        currency,
        amount: value,
        reason: "missing_redirect_url",
        errorCode: "missing_redirect_url",
      });
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
      openCheckoutError({
        method: "bbva",
        userMessage: normalized.userMessage,
        hint: normalized.hint,
        reason: normalized.reason,
        retry: startBbvaCheckout,
      });
      setRedirecting(false);
      setProcessingMethod(null);
    }
  }, [plan?.id, plan?.moneda, plan?.price, availableMethods.join("|"), openCheckoutError]);

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
        const value = Number(plan.price) || 0;
        const currency = (plan.moneda?.toUpperCase() || "USD").toUpperCase();
        openCheckoutError({
          method: "paypal",
          userMessage: `No recibimos la referencia de PayPal. Intenta de nuevo.${suffix}`,
          hint: "Si se cerró PayPal o falló la ventana, vuelve a intentarlo o cambia de método.",
          reason: "missing_subscription_id",
          retry: () => focusCheckoutMethodButton("paypal"),
        });
        trackGrowthMetric(GROWTH_METRICS.CHECKOUT_ERROR, {
          method: "paypal",
          planId: plan.id,
          currency,
          amount: value,
          reason: "missing_subscription_id",
          errorCode: "missing_subscription_id",
        });
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
        openCheckoutError({
          method: "paypal",
          userMessage: normalized.userMessage,
          hint: normalized.hint,
          reason: normalized.reason,
          retry: () => focusCheckoutMethodButton("paypal"),
        });
      } finally {
        setProcessingMethod(null);
      }
    },
    [acceptRecurring, paypalPlan?.id, plan?.id, plan?.price, plan?.moneda, cookies._fbp, cookies._fbc, navigate, availableMethods.join("|"), openCheckoutError, focusCheckoutMethodButton],
  );

  useEffect(() => {
    if (!redirecting) return;
    const timeout = window.setTimeout(() => {
      setShowRedirectHelp(true);
    }, 6000);
    return () => window.clearTimeout(timeout);
  }, [redirecting]);

  const handleSelectMethod = (method: CheckoutMethod) => {
    selectCheckoutMethod(method, "selector");
  };

  const handleContinuePayment = () => {
    interactedRef.current = true;
    if (!availableMethods.includes(selectedMethod)) {
      const fallbackMethod = availableMethods[0];
      setSelectedMethod(fallbackMethod);
      setInlineError("Ese método no está disponible en este momento. Elige otra opción.");
      if (fallbackMethod) {
        window.setTimeout(() => focusCheckoutMethodButton(fallbackMethod), 0);
      }
      return;
    }
    if (!selectedMethod) {
      setInlineError("Selecciona un método de pago para continuar.");
      return;
    }
    if (selectedMethod === "card") {
      if (!acceptRecurring) {
        setInlineError("Para continuar debes aceptar el cobro recurrente (renovación automática).");
        focusRecurringConsent();
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

  const currencyCode = (checkoutCurrency ?? (plan?.moneda ? String(plan.moneda) : "MXN")).toUpperCase();
  const planName = plan?.name?.trim() || "Plan Oro";
  const discount = 0;

  const safePrice = checkoutAmount;
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
    const currentMethod = processingMethod ?? selectedMethod;
    const altMethod = pickCheckoutAlternateMethod(currentMethod, availableMethods);
    const retryLabel = checkoutRetryActionLabel(currentMethod);
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
                  <p>Si no te redirige, reintenta o cambia de método.</p>
                  <button
                    type="button"
                    className="checkout-cta-btn checkout-cta-btn--primary"
                    onClick={() => {
                      if (redirectingProvider === "stripe") {
                        void startStripeCheckout();
                      } else {
                        void startBbvaCheckout();
                      }
                    }}
                  >
                    {retryLabel}
                  </button>
                  {altMethod && (
                    <button
                      type="button"
                      className="checkout-cta-btn checkout-cta-btn--ghost"
                      onClick={() => {
                        setRedirecting(false);
                        setProcessingMethod(null);
                        setShowRedirectHelp(false);
                        selectCheckoutMethod(altMethod, "selector");
                        window.setTimeout(() => focusCheckoutMethodButton(altMethod), 0);
                      }}
                    >
                      {checkoutSwitchActionLabel(altMethod)}
                    </button>
                  )}
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

  const paymentMethods: PaymentMethodId[] = ["visa", "mastercard"];
  if (availableMethods.includes("paypal") && hasPaypalPlan) paymentMethods.push("paypal");
  if (availableMethods.includes("spei")) paymentMethods.push("spei");
  if (availableMethods.includes("oxxo")) paymentMethods.push("oxxo");
  if (availableMethods.includes("bbva")) paymentMethods.push("transfer");

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
                      data-testid="checkout-recurring-consent"
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

            {inlineError && (
              <p className="checkout-inline-error" role="alert" aria-live="assertive">
                {inlineError}
              </p>
            )}

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
                      focusRecurringConsent();
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
                methods={paymentMethods}
                className="checkout2026__paymentLogos"
                ariaLabel="Métodos de pago disponibles"
              />
              <p className="checkout2026__trustCopy">Tu cuenta se activa al pagar. Cancela cuando quieras.</p>
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
        onHide={closeErrorModal}
        message={errorMessage ?? ""}
        title={errorTitle ?? undefined}
        hint={errorHint ?? undefined}
        actions={errorActions ?? undefined}
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
