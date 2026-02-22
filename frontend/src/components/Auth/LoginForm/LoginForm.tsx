import { Link, useLocation, useNavigate } from "react-router-dom";
import { Lock, Mail } from "src/icons";
import { PasswordInput } from "../../PasswordInput/PasswordInput";
import { useUserContext } from "../../../contexts/UserContext";
import trpc from "../../../api";
import { useFormik } from "formik";
import * as Yup from "yup";
import { useEffect, useMemo, useRef, useState } from "react";
import { Spinner } from "../../../components/Spinner/Spinner";
import { useTheme } from "../../../contexts/ThemeContext";
import brandLockupBlack from "../../../assets/brand/bearbeat-lockup-black.png";
import brandLockupCyan from "../../../assets/brand/bearbeat-lockup-cyan.png";
import { trackManyChatConversion, MC_EVENTS } from "../../../utils/manychatPixel";
import { GROWTH_METRICS, trackGrowthMetric } from "../../../utils/growthMetrics";
import { toErrorMessage } from "../../../utils/errorMessage";
import { Button, Input } from "src/components/ui";
import {
  clearAuthReturnUrl,
  normalizeAuthReturnUrl,
  readAuthReturnUrl,
} from "../../../utils/authReturnUrl";
import {
  getPrecheckMessage,
  isPrecheckIneligibleReason,
  isPrecheckMessageKey,
  type PrecheckIneligibleReason,
  type PrecheckMessageKey,
} from "../precheckCopy";
import { parseCheckoutIntent } from "../checkoutIntent";
import "./LoginForm.scss";

const SIMPLE_EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function inferErrorCode(message: string): string {
  const m = `${message ?? ""}`.toLowerCase();
  if (!m) return "unknown";
  if (m.includes("requerid")) return "required";
  if (m.includes("formato") || m.includes("email") || m.includes("correo")) return "invalid_format";
  if (m.includes("min") || m.includes("caracter")) return "too_short";
  if (m.includes("inválid") || m.includes("invalid")) return "invalid";
  return "error";
}

function LoginForm() {
  const [loader, setLoader] = useState<boolean>(false);
  const [inlineError, setInlineError] = useState<string>("");
  const { theme } = useTheme();
  const brandLockup = theme === "light" ? brandLockupBlack : brandLockupCyan;
  const { handleLogin } = useUserContext();
  const navigate = useNavigate();
  const location = useLocation();
  const locationState = location.state as
    | {
        from?: string;
        prefillEmail?: unknown;
        precheckMessageKey?: unknown;
        precheckTrial?: unknown;
        precheckIneligibleReason?: unknown;
      }
    | null;
  const stateFromRaw = locationState?.from;
  const statePrefillEmail =
    typeof locationState?.prefillEmail === "string"
      ? locationState.prefillEmail.trim()
      : "";
  const statePrecheckMessageKey: PrecheckMessageKey | null = isPrecheckMessageKey(
    locationState?.precheckMessageKey,
  )
    ? locationState.precheckMessageKey
    : null;
  const statePrecheckIneligibleReason: PrecheckIneligibleReason | null =
    isPrecheckIneligibleReason(locationState?.precheckIneligibleReason)
      ? locationState.precheckIneligibleReason
      : null;
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
  const from = stateFrom ?? storedFrom ?? "/";
  const checkoutIntent = useMemo(() => parseCheckoutIntent(from), [from]);
  const precheckMessage = statePrecheckMessageKey
    ? getPrecheckMessage(statePrecheckMessageKey, {
        ...checkoutIntent,
        ineligibleReason: statePrecheckIneligibleReason,
      })
    : "";
  const authStorageEventTrackedRef = useRef(false);
  const validationSchema = Yup.object().shape({
    username: Yup.string()
      .transform((value) => (typeof value === "string" ? value.trim() : value))
      .required("El correo es requerido")
      .test("valid-email", "Ingresa un correo válido", (value) => {
        if (!value) return true;
        return SIMPLE_EMAIL_REGEX.test(value);
      }),
    password: Yup.string()
      .required("La contraseña es requerida")
      .min(3, "La contraseña debe contener al menos 3 caracteres"),
  });
  const initialValues = {
    username: statePrefillEmail,
    password: "",
  };
  const formik = useFormik({
    initialValues: initialValues,
    validationSchema: validationSchema,
    onSubmit: async (values) => {
      setLoader(true);
      setInlineError("");
      trackGrowthMetric(GROWTH_METRICS.FORM_SUBMIT, { formId: "login" });
      trackGrowthMetric(GROWTH_METRICS.AUTH_START, { flow: "login", from });
      let body = {
        username: values.username.trim(),
        password: values.password,
      };
      try {
        const login = await trpc.auth.login.query(body);
        if (login) {
          trackManyChatConversion(MC_EVENTS.LOGIN_SUCCESS);
          trackGrowthMetric(GROWTH_METRICS.LOGIN_SUCCESS, { from });
          trackGrowthMetric(GROWTH_METRICS.AUTH_SUCCESS, { flow: "login", from });
          handleLogin(login.token, login.refreshToken);
          clearAuthReturnUrl();
          navigate(from, { replace: true });
        }

        setLoader(false);
      } catch (error: any) {
        const errorMessage = toErrorMessage(error);

        trackGrowthMetric(GROWTH_METRICS.LOGIN_FAILED, {
          from,
          reason: errorMessage,
        });
        trackGrowthMetric(GROWTH_METRICS.AUTH_ERROR, {
          flow: "login",
          from,
          errorCode: "login_failed",
          reason: errorMessage,
        });
        trackGrowthMetric(GROWTH_METRICS.FORM_ERROR, {
          formId: "login",
          field: "form",
          errorCode: "auth_failed",
        });

        setLoader(false);
        setInlineError(errorMessage);
      }
    },
  });

  const lastSubmitTrackedRef = useRef(0);
  useEffect(() => {
    if (formik.submitCount <= lastSubmitTrackedRef.current) return;
    lastSubmitTrackedRef.current = formik.submitCount;
    const errors = formik.errors as Partial<Record<"username" | "password", string>>;
    for (const [field, message] of Object.entries(errors)) {
      if (!message) continue;
      trackGrowthMetric(GROWTH_METRICS.FORM_ERROR, {
        formId: "login",
        field,
        errorCode: inferErrorCode(message),
      });
    }
  }, [formik.submitCount, formik.errors]);

  const showUsernameError = Boolean(
    (formik.touched.username || formik.submitCount > 0) && formik.errors.username,
  );
  const showPasswordError = Boolean(
    (formik.touched.password || formik.submitCount > 0) && formik.errors.password,
  );
  const usernameErrorId = showUsernameError ? "login-username-error" : undefined;
  const passwordErrorId = showPasswordError ? "login-password-error" : undefined;

  useEffect(() => {
    if (!inlineError) return;
    // If the user edits the credentials, clear the form-level error to reduce noise.
    setInlineError("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formik.values.username, formik.values.password]);

  useEffect(() => {
    if (fromSource !== "storage" || authStorageEventTrackedRef.current) return;
    authStorageEventTrackedRef.current = true;
    trackGrowthMetric(GROWTH_METRICS.AUTH_CONTEXT_FROM_STORAGE_USED, {
      flow: "login",
      from,
      path: location.pathname,
    });
  }, [from, fromSource, location.pathname]);

  useEffect(() => {
    if (allowStoredFrom) return;
    if (!storedFromRaw) return;
    clearAuthReturnUrl();
  }, [allowStoredFrom, storedFromRaw]);

  return (
    <>
      <div className="auth-login-atmosphere">
        <div className="auth-login-card">
          <img src={brandLockup} alt="Bear Beat" className="auth-login-logo" />
          <h1 className="auth-login-title">Bienvenido, DJ.</h1>
          <p className="auth-login-sub">
            Tu cabina está lista. Ingresa para descargar.
          </p>
          {precheckMessage && (
            <div className="auth-login-inline-info" role="status">
              {precheckMessage}
            </div>
          )}
          <form
            className="auth-form auth-login-form"
            onSubmit={formik.handleSubmit}
            autoComplete="on"
            noValidate
          >
            <div className={`c-row ${showUsernameError ? "is-invalid" : ""}`}>
              <label htmlFor="username" className="auth-field-label">
                Correo electrónico
              </label>
              <div className="auth-login-input-wrap">
                <Mail className="auth-login-input-icon" aria-hidden />
                <Input
                  placeholder="correo@ejemplo.com"
                  type="email"
                  id="username"
                  name="username"
                  inputMode="email"
                  autoComplete="email"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  value={formik.values.username}
                  onChange={formik.handleChange}
                  onBlur={formik.handleBlur}
                  aria-invalid={showUsernameError}
                  aria-describedby={usernameErrorId}
                  className="auth-login-input auth-login-input-with-icon"
                />
              </div>
              {showUsernameError && (
                <div className="error-formik" id={usernameErrorId} role="alert">
                  {formik.errors.username}
                </div>
              )}
            </div>
            <div className={`c-row ${showPasswordError ? "is-invalid" : ""}`}>
              <label htmlFor="password" className="auth-field-label">
                Contraseña
              </label>
              <div className="auth-login-input-wrap">
                <Lock className="auth-login-input-icon" aria-hidden />
                <PasswordInput
                  placeholder="Tu contraseña"
                  id="password"
                  name="password"
                  autoComplete="current-password"
                  value={formik.values.password}
                  onChange={formik.handleChange}
                  onBlur={formik.handleBlur}
                  aria-invalid={showPasswordError}
                  aria-describedby={passwordErrorId}
                  inputClassName="auth-login-input auth-login-input-with-icon"
                  wrapperClassName="auth-login-password-wrap"
                />
              </div>
              {showPasswordError && (
                <div className="error-formik" id={passwordErrorId} role="alert">
                  {formik.errors.password}
                </div>
              )}
            </div>
            <div className="c-row auth-login-forgot-wrap">
              <Link to="/auth/recuperar" className="auth-login-forgot">
                ¿Olvidaste tu contraseña?
              </Link>
            </div>
            <div className="auth-login-inline-error" role="alert" aria-live="polite">
              {inlineError}
            </div>
            {!loader ? (
              <Button unstyled type="submit" className="auth-login-submit-btn" data-testid="login-submit">
                INGRESAR
              </Button>
            ) : (
              <div className="auth-login-spinner">
                <Spinner size={3} width={0.3} color="var(--app-accent)" />
              </div>
            )}
            <div className="c-row auth-login-register-wrap">
              <span className="auth-login-register-copy">
                ¿No tienes cuenta?{" "}
                <Link
                  to="/auth/registro"
                  state={{ from, prefillEmail: formik.values.username.trim() }}
                  className="auth-login-register"
                >
                  Crear cuenta
                </Link>
              </span>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}

export default LoginForm;
