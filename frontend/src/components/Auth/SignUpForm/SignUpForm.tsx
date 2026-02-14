import "./SignUpForm.scss";
import { detectUserCountry, findDialCode, allowedCountryOptions } from "../../../utils/country_codes";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Lock, Mail, Phone, User } from "src/icons";
import { PasswordInput } from "../../PasswordInput/PasswordInput";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { clearAuthReturnUrl, readAuthReturnUrl } from "../../../utils/authReturnUrl";
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
  const navigate = useNavigate();
  const location = useLocation();
  const { theme } = useTheme();
  const brandLockup = theme === "light" ? brandLockupBlack : brandLockupCyan;
  const brandLockupOnDark = brandLockupCyan;
  // Default conversion path after signup is /planes (unless the user came from a protected route / checkout).
  const fromCandidate =
    (location.state as { from?: string } | null)?.from ?? readAuthReturnUrl() ?? "/planes";
  const from =
    typeof fromCandidate === "string" && fromCandidate.startsWith("/") ? fromCandidate : "/planes";
  const isCheckoutIntent = from.startsWith("/comprar") || from.startsWith("/checkout");
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

  const validationSchema = Yup.object().shape({
    email: Yup.string().required("El correo es requerido").email("El formato del correo no es correcto"),
    // Nombre de usuario es opcional (conversion-first). Si lo ingresan, validarlo.
    username: Yup.string()
      .matches(/^[a-zA-Z0-9 ]*$/, { message: "No uses caracteres especiales", excludeEmptyString: true })
      .matches(/[a-zA-Z]/, { message: "Incluye al menos una letra", excludeEmptyString: true })
      .test(
        "min-if-present",
        "Usa al menos 3 caracteres",
        (value) => !value || value.trim().length >= 3,
      )
      .notRequired(),
    password: Yup.string()
      .required("La contraseña es requerida")
      .min(6, "La contraseña debe contener al menos 6 caracteres"),
    // WhatsApp is optional (conversion-first). If present, validate format.
    phone: Yup.string()
      .matches(/^[0-9]{7,14}$/, { message: "El teléfono no es válido", excludeEmptyString: true })
      .notRequired(),
    passwordConfirmation: Yup.string()
      .required("Debe confirmar la contraseña")
      .oneOf([Yup.ref("password")], "Ambas contraseñas deben ser iguales"),
  });
  const initialValues = {
    username: "",
    password: "",
    email: "",
    phone: "",
    passwordConfirmation: "",
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
        // Invisible Turnstile: execute only on submit to avoid showing the widget by default.
        setTurnstileError("Verificando seguridad...");
        setTurnstilePendingSubmit(true);
        setLoader(true);
        turnstileRef.current?.execute();
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
        setLoader(false);
        setTurnstileToken("");
        setTurnstileReset((prev) => prev + 1);
      }
    },
  });

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
    } catch (error) {
      console.error("There was an error while trying to get user's location.", error);
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
      } catch (error) {
        console.error("No se pudieron cargar los dominios bloqueados.", error);
      }
    };

    fetchBlockedDomains();
  }, []);

  useEffect(() => {
    const fetchBlockedPhones = async () => {
      try {
        const numbers = await trpc.blockedPhoneNumbers.listBlockedPhoneNumbers.query();
        setBlockedPhoneNumbers(numbers);
      } catch (error) {
        console.error("No se pudieron cargar los telefonos bloqueados.", error);
      }
    };

    fetchBlockedPhones();
  }, []);

  const handleTurnstileSuccess = useCallback((token: string) => {
    setTurnstileToken(token);
    setTurnstileError("");
  }, []);

  const handleTurnstileExpire = useCallback(() => {
    setTurnstileToken("");
    setTurnstileError("La verificación expiró, intenta de nuevo.");
    setTurnstilePendingSubmit(false);
    setLoader(false);
  }, []);

  const handleTurnstileError = useCallback(() => {
    setTurnstileToken("");
    setTurnstileError("No se pudo verificar la seguridad.");
    setTurnstilePendingSubmit(false);
    setLoader(false);
  }, []);

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
    if (isCheckoutIntent) return "Crear cuenta y continuar al pago";
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

  const checkoutPlanQuotaGb = useMemo(() => {
    const quota = Number((checkoutPlan as any)?.gigas ?? 0);
    return Number.isFinite(quota) && quota > 0 ? quota : null;
  }, [checkoutPlan]);

  const checkoutLeftBullets = useMemo(() => {
    const items: string[] = [];
    if (checkoutPlanQuotaGb) items.push(`${formatInt(checkoutPlanQuotaGb)} GB de descargas al mes`);
    items.push("Acceso inmediato al catálogo para cabina");
    items.push("Renovación automática. Cancela cuando quieras.");
    if (showCheckoutTrial) items.unshift(`Prueba de ${trialConfig!.days} días (${formatInt(trialConfig!.gb)} GB)`);
    return items;
  }, [checkoutPlanQuotaGb, showCheckoutTrial, trialConfig?.days, trialConfig?.gb]);

  const optionalHasValue = Boolean(formik.values.username.trim() || formik.values.phone.trim());
  const optionalHasError = Boolean(
    (formik.submitCount > 0 || formik.touched.username || formik.touched.phone) &&
      (formik.errors.username || formik.errors.phone),
  );
  const [optionalOpen, setOptionalOpen] = useState<boolean>(() =>
    isCheckoutIntent ? optionalHasValue || optionalHasError : true,
  );
  useEffect(() => {
    if (!isCheckoutIntent) return;
    if (optionalHasValue || optionalHasError) setOptionalOpen(true);
  }, [isCheckoutIntent, optionalHasError, optionalHasValue]);

  const OptionalFields = (
    <div className="auth-signup-optional-grid">
      <div className={`c-row ${showUsernameError ? "is-invalid" : ""}`}>
        <label htmlFor="username" className="auth-field-label">
          Nombre (opcional)
        </label>
        <div className="auth-login-input-wrap">
          <User className="auth-login-input-icon" aria-hidden />
          <input
            placeholder="DJ Kubo"
            type="text"
            id="username"
            name="username"
            autoComplete="name"
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
      <div className={`c-row c-row--phone ${showPhoneError ? "is-invalid" : ""}`}>
        <label htmlFor="phone" className="auth-field-label">
          WhatsApp (opcional)
        </label>
        <div className="signup-phone-wrap">
          <div className="signup-phone-flag-wrap">
            <span className={`signup-phone-flag ${countryFlagClass}`} aria-hidden title={selectedCountry?.name} />
            <select
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
            </select>
          </div>
          <span className="signup-phone-icon-wrap">
            <Phone className="signup-input-icon" aria-hidden />
          </span>
          <input
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
      <div className={`c-row ${showEmailError ? "is-invalid" : ""}`}>
        <label htmlFor="email" className="auth-field-label">
          Correo electrónico
        </label>
        <div className="auth-login-input-wrap">
          <Mail className="auth-login-input-icon" aria-hidden />
          <input
            placeholder="correo@ejemplo.com"
            id="email"
            name="email"
            autoComplete="email"
            autoFocus={isCheckoutIntent}
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
      {isCheckoutIntent ? (
        <details
          className="auth-signup-optional"
          open={optionalOpen}
          onToggle={(e) => setOptionalOpen((e.target as HTMLDetailsElement).open)}
        >
          <summary className="auth-signup-optional__summary">Agregar nombre y WhatsApp (opcional)</summary>
          {OptionalFields}
        </details>
      ) : (
        OptionalFields
      )}
      <Turnstile
        ref={turnstileRef}
        invisible
        onVerify={handleTurnstileSuccess}
        onExpire={handleTurnstileExpire}
        onError={handleTurnstileError}
        resetSignal={turnstileReset}
      />
      {turnstileError && <div className="error-formik">{turnstileError}</div>}
      <div className="auth-login-inline-error" role="alert" aria-live="polite">
        {inlineError}
      </div>
      <button
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
      </button>
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
      <div className="c-row auth-login-register-wrap">
        <span className="auth-login-register-copy">
          ¿Ya tienes cuenta?{" "}
          <Link to="/auth" state={{ from }} className="auth-login-register">
            Inicia sesión
          </Link>
        </span>
      </div>
    </form>
  );

  return (
    <>
      {isCheckoutIntent ? (
        <div className="auth-split auth-split--checkout" aria-label="Registro para continuar al pago">
          <section className="auth-split-panel auth-split-left" aria-label="Resumen">
            <div className="auth-split-left-bg" aria-hidden />
            <img src={brandLockupOnDark} alt="Bear Beat" className="auth-split-logo" />
            <div className="auth-split-kicker">Paso 1 de 2</div>
            <h1 className="auth-split-title">Crea tu cuenta y continúa al pago seguro</h1>

            {checkoutPlanId !== null && (
              <div className="auth-checkout-summary auth-checkout-summary--split" role="note" aria-label="Plan seleccionado">
                <span className="auth-checkout-summary__label">Plan seleccionado</span>
                <div className="auth-checkout-summary__row">
                  <strong className="auth-checkout-summary__name">
                    {checkoutPlan?.name ?? (checkoutPlanLoading ? "Cargando…" : "Plan seleccionado")}
                  </strong>
                  {checkoutPlanPriceLabel && (
                    <span className="auth-checkout-summary__price">
                      {checkoutPlanPriceLabel}
                      <span className="auth-checkout-summary__price-suffix">/mes</span>
                    </span>
                  )}
                </div>
                <p className="auth-checkout-summary__hint">
                  El pago se realiza en el siguiente paso, dentro del checkout seguro.
                </p>
              </div>
            )}

            <ul className="auth-split-list" aria-label="Beneficios">
              {checkoutLeftBullets.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>

            <p className="auth-split-testimonial">
              Tip: ¿Ya tienes cuenta? Inicia sesión y termina tu compra en menos de 1 minuto.
            </p>
          </section>

          <section className="auth-split-panel auth-split-right" aria-label="Formulario">
            <div className="auth-split-form">
              <div className="auth-checkout-mobile" aria-label="Resumen de compra (móvil)">
                <img src={brandLockup} alt="Bear Beat" className="auth-checkout-mobile__logo" />
                <div className="auth-checkout-mobile__top">
                  <span className="auth-checkout-mobile__kicker">Paso 1 de 2</span>
                  {showCheckoutTrial && (
                    <span className="auth-checkout-mobile__trial">
                      Prueba {trialConfig!.days} días
                    </span>
                  )}
                </div>
                {checkoutPlanId !== null && (
                  <div
                    className="auth-checkout-summary auth-checkout-summary--mobile"
                    role="note"
                    aria-label="Plan seleccionado"
                  >
                    <span className="auth-checkout-summary__label">Plan seleccionado</span>
                    <div className="auth-checkout-summary__row">
                      <strong className="auth-checkout-summary__name">
                        {checkoutPlan?.name ?? (checkoutPlanLoading ? "Cargando…" : "Plan seleccionado")}
                      </strong>
                      {checkoutPlanPriceLabel && (
                        <span className="auth-checkout-summary__price">
                          {checkoutPlanPriceLabel}
                          <span className="auth-checkout-summary__price-suffix">/mes</span>
                        </span>
                      )}
                    </div>
                    <p className="auth-checkout-summary__hint">
                      El pago se realiza en el siguiente paso, dentro del checkout seguro.
                    </p>
                  </div>
                )}
                <details className="auth-checkout-mobile__details">
                  <summary className="auth-checkout-mobile__detailsSummary">Ver lo que incluye</summary>
                  <ul className="auth-checkout-mobile__bullets" aria-label="Beneficios">
                    {checkoutLeftBullets.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </details>
              </div>
              <h2 className="auth-split-form-title">Crea tu cuenta</h2>
              <p className="auth-split-form-sub">
                Después te llevamos al checkout para elegir método de pago.
              </p>
              {FormContent}
            </div>
          </section>
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
