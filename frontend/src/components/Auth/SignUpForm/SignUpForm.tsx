import "./SignUpForm.scss";
import { detectUserCountry, findDialCode, allowedCountryOptions } from "../../../utils/country_codes";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Lock, Mail, Phone, User } from "lucide-react";
import { PasswordInput } from "../../PasswordInput/PasswordInput";
import { ReactComponent as Arrow } from "../../../assets/icons/arrow-down.svg";
import { Spinner } from "../../../components/Spinner/Spinner";
import { useCallback, useEffect, useRef, useState } from "react";
import { useFormik } from "formik";
import { useUserContext } from "../../../contexts/UserContext";
import * as Yup from "yup";
import trpc from "../../../api";
import { ErrorModal } from "../../../components/Modals";
import { useCookies } from "react-cookie";
import { ChatButton } from "../../../components/ChatButton/ChatButton";
import Turnstile, { type TurnstileRef } from "../../../components/Turnstile/Turnstile";
import { trackLead } from "../../../utils/facebookPixel";
import { trackManyChatConversion, MC_EVENTS } from "../../../utils/manychatPixel";
import { GROWTH_METRICS, trackGrowthMetric } from "../../../utils/growthMetrics";
import { generateEventId } from "../../../utils/marketingIds";
import {
  shouldBypassTurnstile,
  TURNSTILE_BYPASS_TOKEN,
} from "../../../utils/turnstile";

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
  const from = (location.state as { from?: string } | null)?.from ?? "/";
  const [loader, setLoader] = useState<boolean>(false);
  const { handleLogin } = useUserContext();
  const [show, setShow] = useState<boolean>(false);
  const [dialCode, setDialCode] = useState<string>("52");
  const [errorMessage, setErrorMessage] = useState<any>("");
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

  const closeModal = () => {
    setShow(false);
  };

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
        navigate(from, { replace: true });
      } catch (error: any) {
        let errorMessage = error.message;

        if (error.message.includes('"validation"')) {
          errorMessage = JSON.parse(error.message)[0].message;
        }

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

        setShow(true);
        setErrorMessage(errorMessage);
      } finally {
        setLoader(false);
        setTurnstileToken("");
        setTurnstileReset((prev) => prev + 1);
      }
    },
  });

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

  return (
    <div className="auth-split">
      <div className="auth-split-panel auth-split-left">
        <div className="auth-split-left-bg" aria-hidden />
        <h2 className="auth-split-title">Tu próxima cabina sin “No la tengo” empieza aquí.</h2>
        <ul className="auth-split-list">
          <li><strong>Catálogo gigante</strong> de música y video</li>
          <li><strong>Descarga por FTP</strong> (rápido y ordenado)</li>
          <li>Cancela cuando quieras</li>
        </ul>
        <p className="auth-split-testimonial">Activación guiada por chat hasta tu primera descarga.</p>
      </div>
	      <div className="auth-split-panel auth-split-right">
	        <div className="auth-split-form">
	          <h1 className="auth-split-form-title">Crea tu cuenta y activa hoy</h1>
	          <div className="auth-split-help">
	            <ChatButton variant="inline" />
	          </div>
          <form
            className="sign-up-form auth-form"
            autoComplete="on"
            onSubmit={(e) => {
              e.preventDefault();
              formik.handleSubmit(e);
            }}
          >
            <div className={`c-row ${showUsernameError ? "is-invalid" : ""}`}>
              <label htmlFor="username" className="signup-label">Nombre (opcional)</label>
              <div className="signup-input-wrap">
                <User className="signup-input-icon" aria-hidden />
                <input
                  placeholder="Tu nombre o DJ name (opcional)"
                  type="text"
                  id="username"
                  name="username"
                  autoComplete="name"
                  value={formik.values.username}
                  onChange={formik.handleChange}
                  onBlur={formik.handleBlur}
                  className="signup-input-with-icon"
                  aria-invalid={showUsernameError}
                />
              </div>
              {showUsernameError && <div className="error-formik">{formik.errors.username}</div>}
            </div>
            <div className={`c-row ${showEmailError ? "is-invalid" : ""}`}>
              <label htmlFor="email" className="signup-label">Correo electrónico</label>
              <div className="signup-input-wrap">
                <Mail className="signup-input-icon" aria-hidden />
                <input
                  placeholder="correo@ejemplo.com"
                  id="email"
                  name="email"
                  autoComplete="email"
                  value={formik.values.email}
                  onChange={formik.handleChange}
                  onBlur={formik.handleBlur}
                  type="text"
                  className="signup-input-with-icon"
                  aria-invalid={showEmailError}
                />
              </div>
              {showEmailError && <div className="error-formik">{formik.errors.email}</div>}
            </div>
            <div className={`c-row c-row--phone ${showPhoneError ? "is-invalid" : ""}`}>
              <label htmlFor="phone" className="signup-label">WhatsApp (opcional)</label>
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
                  placeholder="Si quieres, te guiamos por chat más rápido"
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
                />
              </div>
              {showPhoneError && <div className="error-formik">{formik.errors.phone}</div>}
            </div>
            <div className={`c-row ${showPasswordError ? "is-invalid" : ""}`}>
              <label htmlFor="password" className="signup-label">Contraseña</label>
              <div className="signup-input-wrap">
                <Lock className="signup-input-icon" aria-hidden />
                <PasswordInput
                  placeholder="Mínimo 6 caracteres"
                  id="password"
                  name="password"
                  autoComplete="new-password"
                  value={formik.values.password}
                  onChange={formik.handleChange}
                  onBlur={formik.handleBlur}
                  inputClassName="signup-input-with-icon"
                  wrapperClassName="signup-password-wrap"
                />
              </div>
              {showPasswordError && <div className="error-formik">{formik.errors.password}</div>}
            </div>
            <div className={`c-row ${showPasswordConfirmationError ? "is-invalid" : ""}`}>
              <label htmlFor="passwordConfirmation" className="signup-label">Repetir contraseña</label>
              <div className="signup-input-wrap">
                <Lock className="signup-input-icon" aria-hidden />
                <PasswordInput
                  placeholder="Repite tu contraseña"
                  id="passwordConfirmation"
                  name="passwordConfirmation"
                  autoComplete="new-password"
                  value={formik.values.passwordConfirmation}
                  onChange={formik.handleChange}
                  onBlur={formik.handleBlur}
                  inputClassName="signup-input-with-icon"
                  wrapperClassName="signup-password-wrap"
                />
              </div>
              {showPasswordConfirmationError && (
                <div className="error-formik">{formik.errors.passwordConfirmation}</div>
              )}
            </div>
            <Turnstile
              ref={turnstileRef}
              invisible
              onVerify={handleTurnstileSuccess}
              onExpire={handleTurnstileExpire}
              onError={handleTurnstileError}
              resetSignal={turnstileReset}
            />
            {turnstileError && <div className="error-formik">{turnstileError}</div>}
            {!loader ? (
              <button
                type="submit"
                className="signup-submit-btn"
                data-testid="signup-submit"
              >
                CREAR MI CUENTA PRO
              </button>
            ) : (
              <Spinner size={3} width={0.3} color="var(--app-accent)" />
            )}
            <div className="c-row">
              <Link to="/auth" state={{ from }} className="signup-link-back">
                <Arrow className="arrow" />
                Ya tengo cuenta
              </Link>
            </div>
          </form>
        </div>
      </div>
      <ErrorModal show={show} onHide={closeModal} message={errorMessage} />
    </div>
  );
}

export default SignUpForm;
