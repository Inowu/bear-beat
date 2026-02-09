import { Link, useLocation, useNavigate } from "react-router-dom";
import { Lock, Mail } from "lucide-react";
import { PasswordInput } from "../../PasswordInput/PasswordInput";
import { useUserContext } from "../../../contexts/UserContext";
import trpc from "../../../api";
import { useFormik } from "formik";
import * as Yup from "yup";
import { useEffect, useRef, useState } from "react";
import { ErrorModal } from "../../../components/Modals";
import { Spinner } from "../../../components/Spinner/Spinner";
import { ChatButton } from "../../../components/ChatButton/ChatButton";
import Logo from "../../../assets/images/osonuevo.png";
import { trackManyChatConversion, MC_EVENTS } from "../../../utils/manychatPixel";
import { GROWTH_METRICS, trackGrowthMetric } from "../../../utils/growthMetrics";
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
  const [show, setShow] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<any>("");
  const { handleLogin } = useUserContext();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? "/";
  const closeModal = () => {
    setShow(false);
  };
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
        let errorMessage = error.message;

        if (error.message.includes('"validation"')) {
          errorMessage = JSON.parse(error.message)[0].message;
        }

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
        setShow(true);
        setErrorMessage(errorMessage);
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

  return (
    <>
      <div className="auth-login-atmosphere">
        <div className="auth-login-card">
          <img src={Logo} alt="Bear Beat" className="auth-login-logo" />
          <h1 className="auth-login-title text-text-main">Bienvenido, DJ.</h1>
          <p className="auth-login-sub text-text-muted">
            Tu cabina está lista. Ingresa para descargar.
          </p>
          <ChatButton />
          <form className="auth-form auth-login-form" onSubmit={formik.handleSubmit} autoComplete="on">
            <div className={`c-row ${showUsernameError ? "is-invalid" : ""}`}>
              <div className="auth-login-input-wrap">
                <Mail className="auth-login-input-icon" aria-hidden />
                <input
                  placeholder="Correo electrónico"
                  type="email"
                  id="username"
                  name="username"
                  autoComplete="email"
                  value={formik.values.username}
                  onChange={formik.handleChange}
                  onBlur={formik.handleBlur}
                  className="auth-login-input auth-login-input-with-icon"
                />
              </div>
              {showUsernameError && (
                <div className="error-formik">{formik.errors.username}</div>
              )}
            </div>
            <div className={`c-row ${showPasswordError ? "is-invalid" : ""}`}>
              <div className="auth-login-input-wrap">
                <Lock className="auth-login-input-icon" aria-hidden />
                <PasswordInput
                  placeholder="Contraseña"
                  id="password"
                  name="password"
                  autoComplete="current-password"
                  value={formik.values.password}
                  onChange={formik.handleChange}
                  onBlur={formik.handleBlur}
                  inputClassName="auth-login-input auth-login-input-with-icon"
                  wrapperClassName="auth-login-password-wrap"
                />
              </div>
              {showPasswordError && (
                <div className="error-formik">{formik.errors.password}</div>
              )}
            </div>
            <div className="c-row auth-login-forgot-wrap">
              <Link to="/auth/recuperar" className="auth-login-forgot">
                ¿Olvidaste tu contraseña?
              </Link>
            </div>
            {!loader ? (
              <button type="submit" className="auth-login-submit-btn">
                INGRESAR
              </button>
            ) : (
              <div className="flex justify-center py-2">
                <Spinner size={3} width={0.3} color="var(--app-accent)" />
              </div>
            )}
            <div className="c-row auth-login-register-wrap">
              <Link to="/auth/registro" state={{ from }} className="auth-login-register">
                Registrarme
              </Link>
            </div>
          </form>
        </div>
      </div>
      <ErrorModal show={show} onHide={closeModal} message={errorMessage} />
    </>
  );
}

export default LoginForm;
