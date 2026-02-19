import "./SignUpForm.scss";
import { detectUserCountry, findDialCode, allowedCountryOptions } from "../../../utils/country_codes";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Lock, Mail, User } from "src/icons";
import { PasswordInput } from "../../PasswordInput/PasswordInput";
import { Button, Input, Select, SkeletonRow } from "src/components/ui";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
} from "react";
import { useFormik } from "formik";
import { useUserContext } from "../../../contexts/UserContext";
import { useTheme } from "../../../contexts/ThemeContext";
import * as Yup from "yup";
import trpc from "../../../api";
import { useCookies } from "react-cookie";
import Turnstile, { type TurnstileRef } from "../../../components/Turnstile/Turnstile";
import { trackLead } from "../../../utils/facebookPixel";
import { trackManyChatConversion, MC_EVENTS } from "../../../utils/manychatPixel";
import { GROWTH_METRICS, trackGrowthMetric } from "../../../utils/growthMetrics";
import { generateEventId } from "../../../utils/marketingIds";
import {
  clearAuthReturnUrl,
  normalizeAuthReturnUrl,
  readAuthReturnUrl,
} from "../../../utils/authReturnUrl";
import {
  shouldBypassTurnstile,
  TURNSTILE_BYPASS_TOKEN,
} from "../../../utils/turnstile";
import { toErrorMessage } from "../../../utils/errorMessage";
import type { IPlans } from "../../../interfaces/Plans";
import { formatInt } from "../../../utils/format";
import brandLockupBlack from "../../../assets/brand/bearbeat-lockup-black.png";
import brandLockupCyan from "../../../assets/brand/bearbeat-lockup-cyan.png";

function FieldError(props: { id: string; show: boolean; message?: string }) {
  const { id, show, message } = props;
  return (
    <div
      className="error-formik"
      id={id}
      role={show ? "alert" : undefined}
      aria-hidden={!show}
    >
      {show ? message : ""}
    </div>
  );
}

function inferErrorCode(message: string): string {
  const m = `${message ?? ""}`.toLowerCase();
  if (!m) return "unknown";
  if (m.includes("requerid")) return "required";
  if (m.includes("formato") || m.includes("email") || m.includes("correo")) return "invalid_format";
  if (m.includes("válid") || m.includes("invalid")) return "invalid";
  if (m.includes("min") || m.includes("caracter")) return "too_short";
  if (m.includes("igual")) return "mismatch";
  if (m.includes("robot") || m.includes("verific")) return "verification";
  if (m.includes("permit")) return "blocked";
  return "error";
}

function SignUpForm() {
  const TURNSTILE_VERIFY_TIMEOUT_MS = 18_000;
  const navigate = useNavigate();
  const location = useLocation();
  const { theme } = useTheme();
  const brandLockup = theme === "light" ? brandLockupBlack : brandLockupCyan;
  const brandLockupOnDark = brandLockupCyan;
  const stateFromRaw = (location.state as { from?: string } | null)?.from;
  const stateFrom =
    typeof stateFromRaw === "string" ? normalizeAuthReturnUrl(stateFromRaw) : null;
  const storedFromRaw = readAuthReturnUrl();
  const allowStoredFrom = useMemo(() => {
    if (stateFrom) return true;
    if (typeof window === "undefined" || typeof document === "undefined")
      return true;
    if (!document.referrer) return false;
    try {
      return new URL(document.referrer).origin === window.location.origin;
    } catch {
      return false;
    }
  }, [stateFrom]);
  const storedFrom = allowStoredFrom ? storedFromRaw : null;
  const fromSource: "state" | "storage" | "default" = stateFrom
    ? "state"
    : storedFrom
      ? "storage"
      : "default";
  // Default conversion path after signup is /planes (unless the user came from a protected route / checkout).
  const from = stateFrom ?? storedFrom ?? "/planes";
  const isCheckoutIntent = from.startsWith("/comprar") || from.startsWith("/checkout");
  const authStorageEventTrackedRef = useRef(false);
  const checkoutPlanId = useMemo(() => {
    if (typeof window === "undefined") return null;
    if (!isCheckoutIntent) return null;
    try {
      const url = new URL(from, window.location.origin);
      const raw = url.searchParams.get("priceId");
      const parsed = raw ? Number(raw) : NaN;
      return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
    } catch {
      return null;
    }
  }, [from]);
  const [checkoutPlan, setCheckoutPlan] = useState<IPlans | null>(null);
  const [checkoutPlanLoading, setCheckoutPlanLoading] = useState(false);
  const [loader, setLoader] = useState<boolean>(false);
  const { handleLogin } = useUserContext();
  const [dialCode, setDialCode] = useState<string>("52");
  const [inlineError, setInlineError] = useState<string>("");
  const [cookies] = useCookies(["_fbp", "_fbc"]);
  const [blockedDomains, setBlockedDomains] = useState<string[]>([]);
  const [blockedPhoneNumbers, setBlockedPhoneNumbers] = useState<string[]>([]);
  const [turnstileToken, setTurnstileToken] = useState<string>("");
  const [turnstileError, setTurnstileError] = useState<string>("");
  const [turnstileReset, setTurnstileReset] = useState<number>(0);
  const [turnstilePendingSubmit, setTurnstilePendingSubmit] = useState(false);
  const turnstileRef = useRef<TurnstileRef | null>(null);
  const turnstileTimeoutRef = useRef<number | null>(null);
  const turnstileBypassed = shouldBypassTurnstile();
  const registrationStartedRef = useRef(false);
  const registrationCompletedRef = useRef(false);
  const registrationAbandonTrackedRef = useRef(false);
  const [trialConfig, setTrialConfig] = useState<{
    enabled: boolean;
    days: number;
    gb: number;
    eligible: boolean | null;
  } | null>(null);

  const clearTurnstileTimeout = useCallback(() => {
    if (turnstileTimeoutRef.current !== null) {
      window.clearTimeout(turnstileTimeoutRef.current);
      turnstileTimeoutRef.current = null;
    }
  }, []);

  const scheduleTurnstileTimeout = useCallback(() => {
    clearTurnstileTimeout();
    turnstileTimeoutRef.current = window.setTimeout(() => {
      setTurnstileToken("");
      setTurnstilePendingSubmit(false);
      setLoader(false);
      setTurnstileError("La verificación de seguridad tardó demasiado. Reintenta.");
      setTurnstileReset((prev) => prev + 1);
    }, TURNSTILE_VERIFY_TIMEOUT_MS);
  }, [clearTurnstileTimeout]);

  useEffect(
    () => () => {
      clearTurnstileTimeout();
    },
    [clearTurnstileTimeout],
  );

  useEffect(() => {
    let cancelled = false;
    if (!checkoutPlanId) {
      setCheckoutPlan(null);
      setCheckoutPlanLoading(false);
      return;
    }
    setCheckoutPlanLoading(true);
    (async () => {
      try {
        const plans: IPlans[] = await trpc.plans.findManyPlans.query({
          where: { activated: 1, id: checkoutPlanId },
        } as any);
        if (!cancelled) setCheckoutPlan(plans?.[0] ?? null);
      } catch {
        if (!cancelled) setCheckoutPlan(null);
      } finally {
        if (!cancelled) setCheckoutPlanLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [checkoutPlanId]);

  const checkoutPlanPriceLabel = useMemo(() => {
    if (!checkoutPlan) return null;
    const currency = (checkoutPlan.moneda ?? "MXN").toUpperCase();
    const amount = Number(checkoutPlan.price ?? 0);
    if (!Number.isFinite(amount) || amount <= 0) return null;
    const locale = currency === "USD" ? "en-US" : "es-MX";
    try {
      return new Intl.NumberFormat(locale, {
        style: "currency",
        currency,
        minimumFractionDigits: amount % 1 === 0 ? 0 : 2,
        maximumFractionDigits: 2,
      }).format(amount);
    } catch {
      return `${currency} $${amount}`;
    }
  }, [checkoutPlan]);

  const validationSchema = useMemo(
    () =>
      Yup.object().shape({
        email: Yup.string()
          .required("El correo es requerido")
          .email("El formato del correo no es correcto"),
        // Nombre de usuario es opcional (conversion-first). Si lo ingresan, validarlo.
        username: Yup.string()
          .matches(/^[a-zA-Z0-9 ]*$/, {
            message: "No uses caracteres especiales",
            excludeEmptyString: true,
          })
          .matches(/[a-zA-Z]/, {
            message: "Incluye al menos una letra",
            excludeEmptyString: true,
          })
          .test(
            "min-if-present",
            "Usa al menos 3 caracteres",
            (value) => !value || value.trim().length >= 3,
          )
          .notRequired(),
        password: Yup.string()
          .required("La contraseña es requerida")
          .min(6, "La contraseña debe contener al menos 6 caracteres"),
        phone: Yup.string()
          .test(
            "phone-if-present",
            "El teléfono no es válido",
            (value) => !value || /^[0-9]{7,14}$/.test(value.trim()),
          )
          .notRequired(),
        passwordConfirmation: Yup.string()
          .required("Debe confirmar la contraseña")
          .oneOf([Yup.ref("password")], "Ambas contraseñas deben ser iguales"),
        acceptSupportComms: Yup.bool()
          .oneOf([true], "Debes aceptar recibir mensajes transaccionales y de soporte")
          .required("Debes aceptar recibir mensajes transaccionales y de soporte"),
        marketingOptInEmail: Yup.bool().notRequired(),
        marketingOptInWhatsApp: Yup.bool().notRequired(),
      }),
    [isCheckoutIntent],
  );
  const initialValues = {
    username: "",
    password: "",
    email: "",
    phone: "",
    passwordConfirmation: "",
    acceptSupportComms: true,
    marketingOptInEmail: true,
    marketingOptInWhatsApp: true,
  };

  const getEmailDomain = (email: string) => {
    const trimmed = email.trim().toLowerCase();
    const atIndex = trimmed.lastIndexOf("@");
    return atIndex === -1 ? "" : trimmed.slice(atIndex + 1);
  };

  const phoneRegex = /^\+\d{1,4}\s\d{4,14}$/;

  const normalizePhoneNumber = (phone: string) => {
    const normalized = phone.trim().replace(/\s+/g, " ");
    return phoneRegex.test(normalized) ? normalized : "";
  };

  const formik = useFormik({
    initialValues: initialValues,
    validationSchema: validationSchema,
    onSubmit: async (values) => {
      setInlineError("");
      if (!turnstileToken && !turnstileBypassed) {
        // If token is still missing, trigger Turnstile execution and wait for callback.
        setTurnstileError("Verificando seguridad...");
        setTurnstilePendingSubmit(true);
        setLoader(true);
        const executed = turnstileRef.current?.execute() ?? false;
        scheduleTurnstileTimeout();
        if (!executed) {
          setTurnstileError("Inicializando verificación de seguridad...");
        }
        return;
      }

      const marketingEventId = generateEventId("reg");
      setLoader(true);
      trackGrowthMetric(GROWTH_METRICS.FORM_SUBMIT, { formId: "signup" });
      trackGrowthMetric(GROWTH_METRICS.AUTH_START, { flow: "signup", from });
      const emailDomain = getEmailDomain(values.email);
      if (emailDomain && blockedDomains.includes(emailDomain)) {
        formik.setFieldError("email", "El dominio del correo no está permitido");
        trackGrowthMetric(GROWTH_METRICS.FORM_ERROR, {
          formId: "signup",
          field: "email",
          errorCode: "blocked",
        });
        setLoader(false);
        return;
      }
      const rawPhone = `${values.phone ?? ""}`.trim();
      const formattedPhone = rawPhone ? `+${dialCode} ${rawPhone}` : "";
      const normalizedPhone = normalizePhoneNumber(formattedPhone);
      if (normalizedPhone && blockedPhoneNumbers.includes(normalizedPhone)) {
        formik.setFieldError("phone", "El teléfono no está permitido");
        trackGrowthMetric(GROWTH_METRICS.FORM_ERROR, {
          formId: "signup",
          field: "phone",
          errorCode: "blocked",
        });
        setLoader(false);
        return;
      }
      let body = {
        username: values.username,
        password: values.password,
        email: values.email,
        phone: formattedPhone,
        acceptSupportComms: values.acceptSupportComms,
        marketingOptInEmail: values.marketingOptInEmail,
        marketingOptInWhatsApp:
          values.marketingOptInWhatsApp && Boolean(formattedPhone),
        fbp: cookies._fbp,
        fbc: cookies._fbc,
        url: window.location.href,
        eventId: marketingEventId,
        turnstileToken: turnstileToken || (turnstileBypassed ? TURNSTILE_BYPASS_TOKEN : ""),
      };
      try {
        const register = await trpc.auth.register.mutate(body);
        registrationCompletedRef.current = true;

        trackGrowthMetric(GROWTH_METRICS.REGISTRATION_COMPLETED, {
          source: "register_submit",
          from,
        });

        trackLead({ eventId: marketingEventId });
        trackManyChatConversion(MC_EVENTS.REGISTRATION);

        trackGrowthMetric(GROWTH_METRICS.AUTH_SUCCESS, { flow: "signup", from });
        handleLogin(register.token, register.refreshToken);
        clearAuthReturnUrl();
        navigate(from, { replace: true });
      } catch (error: any) {
        const errorMessage = toErrorMessage(error);

        trackGrowthMetric(GROWTH_METRICS.REGISTRATION_FAILED, {
          source: "register_submit",
          from,
          reason: errorMessage,
        });
        trackGrowthMetric(GROWTH_METRICS.AUTH_ERROR, {
          flow: "signup",
          from,
          errorCode: "registration_failed",
          reason: errorMessage,
        });
        trackGrowthMetric(GROWTH_METRICS.FORM_ERROR, {
          formId: "signup",
          field: "form",
          errorCode: "server_error",
        });

        setInlineError(errorMessage);
      } finally {
        clearTurnstileTimeout();
        setLoader(false);
        setTurnstileToken("");
        setTurnstileReset((prev) => prev + 1);
      }
    },
  });

  const handlePrimaryConsentChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const { checked } = event.target;
      formik.setFieldValue("acceptSupportComms", checked, true);
      // Single-consent UX: marketing preferences follow the main consent toggle.
      formik.setFieldValue("marketingOptInEmail", checked, false);
      formik.setFieldValue("marketingOptInWhatsApp", checked, false);
    },
    [formik],
  );

  useEffect(() => {
    if (fromSource !== "storage" || authStorageEventTrackedRef.current) return;
    authStorageEventTrackedRef.current = true;
    trackGrowthMetric(GROWTH_METRICS.AUTH_CONTEXT_FROM_STORAGE_USED, {
      flow: "signup",
      from,
      path: location.pathname,
    });
  }, [from, fromSource, location.pathname]);

  useEffect(() => {
    if (allowStoredFrom) return;
    if (!storedFromRaw) return;
    clearAuthReturnUrl();
  }, [allowStoredFrom, storedFromRaw]);

  useEffect(() => {
    if (!inlineError) return;
    // If the user edits any field, clear the form-level error to reduce noise.
    setInlineError("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    formik.values.username,
    formik.values.email,
    formik.values.phone,
    formik.values.password,
    formik.values.passwordConfirmation,
  ]);

  useEffect(() => {
    if (!turnstilePendingSubmit) return;
    if (!turnstileToken) return;
    setTurnstilePendingSubmit(false);
    // Retry the submission now that we have a token.
    formik.submitForm();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [turnstilePendingSubmit, turnstileToken]);

  const trackRegistrationAbandon = useCallback(
    (reason: string) => {
      if (
        !registrationStartedRef.current ||
        registrationCompletedRef.current ||
        registrationAbandonTrackedRef.current
      ) {
        return;
      }
      registrationAbandonTrackedRef.current = true;
      trackManyChatConversion(MC_EVENTS.ABANDON_REGISTRATION);
      trackGrowthMetric(GROWTH_METRICS.REGISTRATION_ABANDONED, {
        reason,
        from,
      });
    },
    [from]
  );

  const getUserLocation = useCallback(() => {
    try {
      const country = detectUserCountry();
      if (country) {
        const code = findDialCode(country.code.toUpperCase());
        setDialCode(code);
      }
    } catch {
      if (import.meta.env.DEV) {
        console.warn("[SIGNUP] Failed to detect user country.");
      }
    }
  }, []);

  useEffect(() => {
    getUserLocation();
  }, [getUserLocation]);

  useEffect(() => {
    const fetchTrialConfig = async () => {
      try {
        const cfg = (await trpc.plans.getTrialConfig.query()) as any;
        setTrialConfig({
          enabled: Boolean(cfg?.enabled),
          days: Number(cfg?.days ?? 0),
          gb: Number(cfg?.gb ?? 0),
          eligible: typeof cfg?.eligible === "boolean" ? cfg.eligible : null,
        });
      } catch {
        // ignore
      }
    };
    void fetchTrialConfig();
  }, []);

  useEffect(() => {
    const hasAnyFieldValue = Object.values(formik.values).some(
      (value) => typeof value === "string" && value.trim().length > 0
    );
    if (hasAnyFieldValue && !registrationStartedRef.current) {
      trackGrowthMetric(GROWTH_METRICS.REGISTRATION_STARTED, {
        source: "register_form_input",
        from,
      });
      registrationStartedRef.current = true;
    }
  }, [formik.values, from]);

  const lastSubmitTrackedRef = useRef(0);
  useEffect(() => {
    if (formik.submitCount <= lastSubmitTrackedRef.current) return;
    lastSubmitTrackedRef.current = formik.submitCount;
    const errors = formik.errors as Record<string, string>;
    for (const [field, message] of Object.entries(errors)) {
      if (!message) continue;
      trackGrowthMetric(GROWTH_METRICS.FORM_ERROR, {
        formId: "signup",
        field,
        errorCode: inferErrorCode(message),
      });
    }
    if (turnstileError) {
      trackGrowthMetric(GROWTH_METRICS.FORM_ERROR, {
        formId: "signup",
        field: "turnstile",
        errorCode: inferErrorCode(turnstileError),
      });
    }
  }, [formik.submitCount, formik.errors, turnstileError]);

  useEffect(() => {
    const handleBeforeUnload = () => {
      trackRegistrationAbandon("beforeunload");
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      trackRegistrationAbandon("route_change");
    };
  }, [trackRegistrationAbandon]);

  useEffect(() => {
    const fetchBlockedDomains = async () => {
      try {
        const domains = await trpc.blockedEmailDomains.listBlockedEmailDomains.query();
        setBlockedDomains(domains);
      } catch {
        if (import.meta.env.DEV) {
          console.warn("[SIGNUP] Failed to load blocked email domains.");
        }
      }
    };

    fetchBlockedDomains();
  }, []);

  useEffect(() => {
    const fetchBlockedPhones = async () => {
      try {
        const numbers = await trpc.blockedPhoneNumbers.listBlockedPhoneNumbers.query();
        setBlockedPhoneNumbers(numbers);
      } catch {
        if (import.meta.env.DEV) {
          console.warn("[SIGNUP] Failed to load blocked phone numbers.");
        }
      }
    };

    fetchBlockedPhones();
  }, []);

  const handleTurnstileSuccess = useCallback((token: string) => {
    clearTurnstileTimeout();
    setTurnstileToken(token);
    setTurnstileError("");
  }, [clearTurnstileTimeout]);

  const handleTurnstileExpire = useCallback(() => {
    clearTurnstileTimeout();
    setTurnstileToken("");
    setTurnstileError("La verificación expiró, intenta de nuevo.");
    setTurnstilePendingSubmit(false);
    setLoader(false);
  }, [clearTurnstileTimeout]);

  const handleTurnstileError = useCallback(() => {
    clearTurnstileTimeout();
    setTurnstileToken("");
    setTurnstileError("No se pudo verificar la seguridad.");
    setTurnstilePendingSubmit(false);
    setLoader(false);
  }, [clearTurnstileTimeout]);

  const selectedCountry = allowedCountryOptions.find((c) => c.dial_code.slice(1) === dialCode);
  const countryFlagClass = selectedCountry ? `fi fi-${selectedCountry.code.toLowerCase()}` : "fi";
  const showUsernameError = Boolean(
    (formik.touched.username || formik.submitCount > 0) && formik.errors.username,
  );
  const showEmailError = Boolean(
    (formik.touched.email || formik.submitCount > 0) && formik.errors.email,
  );
  const showPhoneError = Boolean(
    (formik.touched.phone || formik.submitCount > 0) && formik.errors.phone,
  );
  const showPasswordError = Boolean(
    (formik.touched.password || formik.submitCount > 0) && formik.errors.password,
  );
  const showPasswordConfirmationError = Boolean(
    (formik.touched.passwordConfirmation || formik.submitCount > 0) && formik.errors.passwordConfirmation,
  );
  const usernameErrorId = "signup-username-error";
  const emailErrorId = "signup-email-error";
  const phoneErrorId = "signup-phone-error";
  const passwordErrorId = "signup-password-error";
  const passwordConfirmationErrorId = "signup-password-confirmation-error";
  const describedByUsername = usernameErrorId;
  const describedByPhone = phoneErrorId;
  const describedByPassword = passwordErrorId;
  const describedByPasswordConfirmation = passwordConfirmationErrorId;
  const submitLabel = useMemo(() => {
    if (isCheckoutIntent) return "Continuar al pago";
    const hasTrial =
      Boolean(trialConfig?.enabled) &&
      trialConfig?.eligible !== false &&
      Number.isFinite(trialConfig?.days) &&
      (trialConfig?.days ?? 0) > 0;
    return hasTrial ? "Crear cuenta y empezar prueba" : "Crear cuenta y activar";
  }, [isCheckoutIntent, trialConfig?.days, trialConfig?.eligible, trialConfig?.enabled]);

  const showCheckoutTrial =
    Boolean(trialConfig?.enabled) &&
    trialConfig?.eligible !== false &&
    Number.isFinite(trialConfig?.days) &&
    (trialConfig?.days ?? 0) > 0 &&
    Number.isFinite(trialConfig?.gb) &&
    (trialConfig?.gb ?? 0) > 0;

  const checkoutSubtitle = useMemo(() => {
    if (!isCheckoutIntent) return "";
    if (showCheckoutTrial) {
      return "En el siguiente paso eliges tu método de pago y activas tu prueba. Hoy no se cobra nada (solo validamos tu tarjeta).";
    }
    return "En el siguiente paso eliges tu método de pago y activas tu acceso.";
  }, [isCheckoutIntent, showCheckoutTrial]);

  const checkoutPlanQuotaGb = useMemo(() => {
    const quota = Number((checkoutPlan as any)?.gigas ?? 0);
    return Number.isFinite(quota) && quota > 0 ? quota : null;
  }, [checkoutPlan]);

  const checkoutLeftBullets = useMemo(() => {
    const items: string[] = [];
    if (checkoutPlanQuotaGb) items.push(`${formatInt(checkoutPlanQuotaGb)} GB de descargas al mes`);
    items.push("Acceso inmediato al catálogo para cabina");
    items.push("Renovación automática. Cancela cuando quieras.");
    if (showCheckoutTrial) {
      items.unshift(`Prueba de ${trialConfig!.days} días con tarjeta (${formatInt(trialConfig!.gb)} GB)`);
    }
    return items;
  }, [checkoutPlanQuotaGb, showCheckoutTrial, trialConfig?.days, trialConfig?.gb]);

  const checkoutPlanNameText = (checkoutPlan?.name ?? "Plan seleccionado").trim();
  const checkoutPlanNameNode = checkoutPlanLoading ? (
    <SkeletonRow width="132px" height="12px" />
  ) : (
    checkoutPlanNameText
  );

  const NameField = (
    <div className={`c-row ${showUsernameError ? "is-invalid" : ""}`}>
      <label htmlFor="username" className="auth-field-label">
        Nombre <span className="auth-field-optional">(opcional)</span>
      </label>
      <div className="auth-login-input-wrap">
        <User className="auth-login-input-icon" aria-hidden />
        <Input
          placeholder="DJ Kubo"
          type="text"
          id="username"
          name="username"
          autoComplete="name"
          autoFocus={isCheckoutIntent}
          value={formik.values.username}
          onChange={formik.handleChange}
          onBlur={formik.handleBlur}
          className="auth-login-input auth-login-input-with-icon"
          aria-invalid={showUsernameError}
          aria-describedby={describedByUsername}
        />
      </div>
      <FieldError id={usernameErrorId} show={showUsernameError} message={formik.errors.username} />
    </div>
  );

  const WhatsAppField = (
    <div className={`c-row c-row--phone ${showPhoneError ? "is-invalid" : ""}`}>
      <label htmlFor="phone" className="auth-field-label">
        WhatsApp <span className="auth-field-optional">(opcional)</span>
      </label>
      <div className="signup-phone-wrap">
        <div className="signup-phone-flag-wrap">
          <span className={`signup-phone-flag ${countryFlagClass}`} aria-hidden title={selectedCountry?.name} />
          <Select
            className="signup-phone-select-overlay"
            value={dialCode}
            onChange={(e) => setDialCode(e.target.value)}
            aria-label="País (solo bandera visible)"
            title={selectedCountry?.name}
          >
            {allowedCountryOptions.map((c) => (
              <option key={c.code} value={c.dial_code.slice(1)}>
                {c.dial_code} {c.name}
              </option>
            ))}
          </Select>
        </div>
        <Input
          className="signup-phone-input"
          placeholder="5512345678"
          id="phone"
          name="phone"
          value={formik.values.phone}
          onChange={formik.handleChange}
          onBlur={formik.handleBlur}
          type="tel"
          inputMode="numeric"
          autoComplete="tel-national"
          maxLength={15}
          aria-invalid={showPhoneError}
          aria-describedby={describedByPhone}
        />
      </div>
      <FieldError id={phoneErrorId} show={showPhoneError} message={formik.errors.phone} />
    </div>
  );

  const FormContent = (
    <form
      className="sign-up-form auth-form auth-login-form auth-signup-form"
      autoComplete="on"
      onSubmit={(e) => {
        e.preventDefault();
        formik.handleSubmit(e);
      }}
    >
      {NameField}
      <div className={`c-row ${showEmailError ? "is-invalid" : ""}`}>
        <label htmlFor="email" className="auth-field-label">
          Correo electrónico
        </label>
        <div className="auth-login-input-wrap">
          <Mail className="auth-login-input-icon" aria-hidden />
          <Input
            placeholder="correo@ejemplo.com"
            id="email"
            name="email"
            autoComplete="email"
            value={formik.values.email}
            onChange={formik.handleChange}
            onBlur={formik.handleBlur}
            type="email"
            inputMode="email"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            className="auth-login-input auth-login-input-with-icon"
            aria-invalid={showEmailError}
            aria-describedby={emailErrorId}
          />
        </div>
        <FieldError id={emailErrorId} show={showEmailError} message={formik.errors.email} />
      </div>
        <div className={`c-row ${showPasswordError ? "is-invalid" : ""}`}>
          <label htmlFor="password" className="auth-field-label">
            Contraseña
          </label>
        <div className="auth-login-input-wrap">
          <Lock className="auth-login-input-icon" aria-hidden />
          <PasswordInput
            placeholder="Mínimo 6 caracteres"
            id="password"
            name="password"
            autoComplete="new-password"
            value={formik.values.password}
            onChange={formik.handleChange}
            onBlur={formik.handleBlur}
            aria-invalid={showPasswordError}
            aria-describedby={describedByPassword}
            inputClassName="auth-login-input auth-login-input-with-icon"
            wrapperClassName="auth-login-password-wrap"
          />
        </div>
        <FieldError id={passwordErrorId} show={showPasswordError} message={formik.errors.password} />
      </div>
      <div className={`c-row ${showPasswordConfirmationError ? "is-invalid" : ""}`}>
        <label htmlFor="passwordConfirmation" className="auth-field-label">
          Repetir contraseña
        </label>
        <div className="auth-login-input-wrap">
          <Lock className="auth-login-input-icon" aria-hidden />
          <PasswordInput
            placeholder="Repite tu contraseña"
            id="passwordConfirmation"
            name="passwordConfirmation"
            autoComplete="new-password"
            value={formik.values.passwordConfirmation}
            onChange={formik.handleChange}
            onBlur={formik.handleBlur}
            aria-invalid={showPasswordConfirmationError}
            aria-describedby={describedByPasswordConfirmation}
            inputClassName="auth-login-input auth-login-input-with-icon"
            wrapperClassName="auth-login-password-wrap"
          />
        </div>
        <FieldError
          id={passwordConfirmationErrorId}
          show={showPasswordConfirmationError}
          message={formik.errors.passwordConfirmation}
        />
      </div>
      {WhatsAppField}
      <Turnstile
        ref={turnstileRef}
        onVerify={handleTurnstileSuccess}
        onExpire={handleTurnstileExpire}
        onError={handleTurnstileError}
        resetSignal={turnstileReset}
      />
      {turnstileError && <div className="error-formik">{turnstileError}</div>}
      <div className="auth-login-inline-error" role="alert" aria-live="polite">
        {inlineError}
      </div>
      <Button unstyled
        type="submit"
        className="signup-submit-btn"
        data-testid="signup-submit"
        disabled={loader}
        aria-busy={loader || undefined}
      >
        <span className="signup-submit-content">
          {loader && <span className="signup-submit-spinner" aria-hidden />}
          {loader ? "Creando..." : submitLabel}
        </span>
      </Button>
      <div className="auth-signup-consents" aria-label="Preferencias de comunicación">
        <label className="auth-consent-item auth-consent-item--primary">
          <Input
            type="checkbox"
            name="acceptSupportComms"
            checked={formik.values.acceptSupportComms}
            onChange={handlePrimaryConsentChange}
            onBlur={formik.handleBlur}
            className="auth-consent-checkbox"
          />
          <span className="auth-consent-copy">
            <strong>
              Acepto mensajes transaccionales, de soporte y promociones por email y, si lo proporciono, WhatsApp.
            </strong>
            <small>
              Solo para accesos, pagos, soporte y novedades de Bear Beat. Cero spam. Puedes desuscribirte de
              promociones en cualquier momento.
            </small>
          </span>
        </label>
        {formik.touched.acceptSupportComms && formik.errors.acceptSupportComms && (
          <div className="error-formik" role="alert">
            {formik.errors.acceptSupportComms}
          </div>
        )}
      </div>
      <p className="auth-signup-legal">
        Al crear tu cuenta aceptas{" "}
        <Link to="/legal#terminos" className="auth-signup-legal-link">
          Términos
        </Link>{" "}
        y{" "}
        <Link to="/legal#privacidad" className="auth-signup-legal-link">
          Privacidad
        </Link>
        .
      </p>
      {!isCheckoutIntent && (
        <div className="c-row auth-login-register-wrap">
          <span className="auth-login-register-copy">
            ¿Ya tienes cuenta?{" "}
            <Link to="/auth" state={{ from }} className="auth-login-register">
              Inicia sesión
            </Link>
          </span>
        </div>
      )}
    </form>
  );

  return (
    <>
      {isCheckoutIntent ? (
        <div className="checkout-intent-shell" aria-label="Registro para continuar al pago">
          <div className="checkout-intent-shell__inner">
            <header className="checkout-intent-shell__top" aria-label="Bear Beat">
              <img src={brandLockupOnDark} alt="Bear Beat" className="checkout-intent-shell__logo" />
              <div className="checkout-intent-shell__topRight">
                <span className="checkout-intent-shell__step" aria-label="Progreso">
                  Paso 1 de 2
                </span>
                <Link to="/auth" state={{ from }} className="checkout-intent-shell__login">
                  Ya tengo cuenta
                </Link>
              </div>
            </header>

            <div className="checkout-intent-shell__grid" aria-label="Crear cuenta">
              <section className="checkout-intent-card checkout-intent-card--flow" aria-label="Crea tu cuenta">
                <div className="checkout-intent-shell__head">
                  <h1 className="checkout-intent-shell__title">Crea tu cuenta</h1>
                  <p className="checkout-intent-shell__subtitle">
                    {checkoutSubtitle}
                  </p>
                  <div className="checkout-intent-shell__trust" aria-label="Checkout seguro">
                    <span className="checkout-intent-shell__trustItem">
                      <Lock aria-hidden />
                      <span>Checkout seguro</span>
                    </span>
                    <span className="checkout-intent-shell__trustDot" aria-hidden>
                      ·
                    </span>
                    <span className="checkout-intent-shell__trustItem">
                      <span>Cancela cuando quieras</span>
                    </span>
                  </div>
                </div>
                {FormContent}
              </section>

              {/* Avoid <aside>: some third-party widgets ship global `aside { position: fixed; opacity: 0 }` rules on mobile. */}
              <section
                className="checkout-intent-card checkout-intent-card--summary"
                aria-label="Resumen de compra"
              >
                <details className="checkout-intent-summary__accordion">
                  <summary className="checkout-intent-summary__summary">
                    <span className="checkout-intent-summary__summaryLeft">
                      <span>Resumen de compra</span>
                      <small>
                        {checkoutPlanLoading ? (
                          <SkeletonRow width="132px" height="12px" />
                        ) : (
                          `${checkoutPlanNameText}${checkoutPlanPriceLabel ? ` · ${checkoutPlanPriceLabel}/mes` : ""}`
                        )}
                      </small>
                    </span>
                    {showCheckoutTrial ? (
                      <strong>Prueba con tarjeta</strong>
                    ) : (
                      <strong>{checkoutPlanPriceLabel ? `${checkoutPlanPriceLabel}/mes` : "—"}</strong>
                    )}
                  </summary>
                  <div className="checkout-intent-summary__body">
                    <div className="checkout-intent-summary__labelRow">
                      <span className="checkout-intent-summary__label">Plan seleccionado</span>
                      {showCheckoutTrial && (
                        <span className="checkout-intent-summary__badge">
                          Prueba {trialConfig!.days} días (tarjeta)
                        </span>
                      )}
                    </div>
                    <div className="checkout-intent-summary__row">
                      <strong className="checkout-intent-summary__name">
                        {checkoutPlanNameNode}
                      </strong>
                      {checkoutPlanPriceLabel && (
                        <span className="checkout-intent-summary__price">
                          {checkoutPlanPriceLabel}
                          <span className="checkout-intent-summary__suffix">/mes</span>
                        </span>
                      )}
                    </div>
                    <p className="checkout-intent-summary__hint">
                      El pago se realiza en el siguiente paso, dentro del checkout seguro.
                    </p>
                    <ul className="checkout-intent-summary__bullets" aria-label="Beneficios">
                      {checkoutLeftBullets.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                    <p className="checkout-intent-summary__fineprint">
                      Pagos procesados de forma segura. Cancela cuando quieras.
                    </p>
                  </div>
                </details>

                <div className="checkout-intent-summary__static">
                  <h2 className="checkout-intent-summary__title">Resumen de compra</h2>
                  <div className="checkout-intent-summary__labelRow">
                    <span className="checkout-intent-summary__label">Plan seleccionado</span>
                    {showCheckoutTrial && (
                      <span className="checkout-intent-summary__badge">
                        Prueba {trialConfig!.days} días (tarjeta)
                      </span>
                    )}
                  </div>
                  <div className="checkout-intent-summary__row">
                    <strong className="checkout-intent-summary__name">
                      {checkoutPlanNameNode}
                    </strong>
                    {checkoutPlanPriceLabel && (
                      <span className="checkout-intent-summary__price">
                        {checkoutPlanPriceLabel}
                        <span className="checkout-intent-summary__suffix">/mes</span>
                      </span>
                    )}
                  </div>
                  <p className="checkout-intent-summary__hint">
                    El pago se realiza en el siguiente paso, dentro del checkout seguro.
                  </p>
                  <ul className="checkout-intent-summary__bullets" aria-label="Beneficios">
                    {checkoutLeftBullets.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                  <p className="checkout-intent-summary__fineprint">
                    Pagos procesados de forma segura. Cancela cuando quieras.
                  </p>
                </div>
              </section>
            </div>
          </div>
        </div>
      ) : (
        <div className="auth-login-atmosphere">
          <div className="auth-login-card auth-login-card--signup">
            <img src={brandLockup} alt="Bear Beat" className="auth-login-logo" />
            <h1 className="auth-login-title">Crea tu cuenta</h1>
            <p className="auth-login-sub auth-login-sub--signup">
              Activa tu cuenta en minutos y empieza a descargar.
            </p>
            {FormContent}
          </div>
        </div>
      )}
    </>
  );
}

export default SignUpForm;
