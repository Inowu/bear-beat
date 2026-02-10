import { Link, useLocation, useNavigate } from "react-router-dom";
import { Lock, Mail } from "lucide-react";
import { PasswordInput } from "../../PasswordInput/PasswordInput";
import { useUserContext } from "../../../contexts/UserContext";
import trpc from "../../../api";
import { useFormik } from "formik";
import * as Yup from "yup";
import { useEffect, useRef, useState } from "react";
import { Spinner } from "../../../components/Spinner/Spinner";
import Logo from "../../../assets/images/osonuevo.png";
import { trackManyChatConversion, MC_EVENTS } from "../../../utils/manychatPixel";
import { GROWTH_METRICS, trackGrowthMetric } from "../../../utils/growthMetrics";
import { toErrorMessage } from "../../../utils/errorMessage";
import "./LoginForm.scss";

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
  const { handleLogin } = useUserContext();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? "/";
  const validationSchema = Yup.object().shape({
    username: Yup.string()
      .required("El correo es requerido")
      .email("El formato del correo no es correcto"),
    password: Yup.string()
      .required("La contraseña es requerida")
      .min(3, "La contraseña debe contener al menos 3 caracteres"),
  });
  const initialValues = {
    username: "",
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
        username: values.username,
        password: values.password,
      };
      try {
        const login = await trpc.auth.login.query(body);
        if (login) {
          trackManyChatConversion(MC_EVENTS.LOGIN_SUCCESS);
          trackGrowthMetric(GROWTH_METRICS.LOGIN_SUCCESS, { from });
          trackGrowthMetric(GROWTH_METRICS.AUTH_SUCCESS, { flow: "login", from });
          handleLogin(login.token, login.refreshToken);
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

  return (
    <>
      <div className="auth-login-atmosphere">
        <div className="auth-login-card">
          <img src={Logo} alt="Bear Beat" className="auth-login-logo" />
          <h1 className="auth-login-title text-text-main">Bienvenido, DJ.</h1>
          <p className="auth-login-sub text-text-muted">
            Tu cabina está lista. Ingresa para descargar.
          </p>
          <form className="auth-form auth-login-form" onSubmit={formik.handleSubmit} autoComplete="on">
            <div className={`c-row ${showUsernameError ? "is-invalid" : ""}`}>
              <label htmlFor="username" className="auth-field-label">
                Correo electrónico
              </label>
              <div className="auth-login-input-wrap">
                <Mail className="auth-login-input-icon" aria-hidden />
                <input
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
              <button type="submit" className="auth-login-submit-btn" data-testid="login-submit">
                INGRESAR
              </button>
            ) : (
              <div className="flex justify-center py-2">
                <Spinner size={3} width={0.3} color="var(--app-accent)" />
              </div>
            )}
            <div className="c-row auth-login-register-wrap">
              <span className="auth-login-register-copy">
                ¿No tienes cuenta?{" "}
                <Link to="/auth/registro" state={{ from }} className="auth-login-register">
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
