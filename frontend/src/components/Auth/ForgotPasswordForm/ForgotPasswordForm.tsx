import { Link } from "react-router-dom";
import { Mail } from "lucide-react";
import trpc from "../../../api";
import { useFormik } from "formik";
import * as Yup from "yup";
import { useCallback, useState } from "react";
import { ErrorModal } from "../../../components/Modals/ErrorModal/ErrorModal";
import { SuccessModal } from "../../../components/Modals/SuccessModal/SuccessModal";
import { Spinner } from "../../../components/Spinner/Spinner";
import Turnstile from "../../../components/Turnstile/Turnstile";
import Logo from "../../../assets/images/osonuevo.png";
import {
  shouldBypassTurnstile,
  TURNSTILE_BYPASS_TOKEN,
} from "../../../utils/turnstile";
import { GROWTH_METRICS, trackGrowthMetric } from "../../../utils/growthMetrics";
import "./ForgotPasswordForm.scss";

function ForgotPasswordForm() {
  const [loader, setLoader] = useState<boolean>(false);
  const [show, setShow] = useState<boolean>(false);
  const [showSuccess, setShowSuccess] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<any>("");
  const [turnstileToken, setTurnstileToken] = useState<string>("");
  const [turnstileError, setTurnstileError] = useState<string>("");
  const [turnstileReset, setTurnstileReset] = useState<number>(0);
  const turnstileBypassed = shouldBypassTurnstile();

  const closeError = () => setShow(false);
  const closeSuccess = () => setShowSuccess(false);

  const validationSchema = Yup.object().shape({
    email: Yup.string()
      .required("El correo es requerido")
      .email("El formato del correo no es correcto"),
  });

  const formik = useFormik({
    initialValues: { email: "" },
    validationSchema,
    onSubmit: async (values) => {
      if (!turnstileToken && !turnstileBypassed) return;
      setLoader(true);
      try {
        await trpc.auth.forgotPassword.mutate({
          email: values.email,
          turnstileToken: turnstileToken || (turnstileBypassed ? TURNSTILE_BYPASS_TOKEN : ""),
        });
        trackGrowthMetric(GROWTH_METRICS.PASSWORD_RECOVERY_REQUESTED, {
          source: "forgot_password_form",
        });
        setShowSuccess(true);
      } catch (error) {
        trackGrowthMetric(GROWTH_METRICS.PASSWORD_RECOVERY_FAILED, {
          source: "forgot_password_form",
        });
        setShow(true);
        setErrorMessage(error);
      } finally {
        setLoader(false);
        setTurnstileToken("");
        setTurnstileReset((prev) => prev + 1);
      }
    },
  });

  const handleTurnstileSuccess = useCallback((token: string) => {
    setTurnstileToken(token);
    setTurnstileError("");
  }, []);

  const handleTurnstileExpire = useCallback(() => {
    setTurnstileToken("");
    setTurnstileError("La verificación expiró, intenta de nuevo.");
  }, []);

  const handleTurnstileError = useCallback(() => {
    setTurnstileToken("");
    setTurnstileError("No se pudo verificar la seguridad.");
  }, []);

  return (
    <div className="auth-login-atmosphere">
      <div className="auth-login-card">
        <img src={Logo} alt="Bear Beat" className="auth-login-logo" />
        <h1 className="auth-login-title">Recuperar Acceso</h1>
        <p className="auth-login-sub auth-recover-sub">
          Ingresa tu correo asociado y te enviamos un enlace seguro.
        </p>
        <form
          className="auth-form auth-login-form auth-recover-form"
          onSubmit={(e) => {
            e.preventDefault();
            if (!turnstileToken && !turnstileBypassed) {
              setTurnstileError("Completa la verificación antes de continuar.");
              return;
            }
            formik.handleSubmit(e);
          }}
        >
          <div className="c-row auth-recover-email-wrap">
            <Mail className="auth-recover-email-icon" aria-hidden />
            <input
              placeholder="Correo electrónico"
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              value={formik.values.email}
              onChange={formik.handleChange}
              className="auth-login-input auth-recover-email-input"
            />
            {formik.errors.email && (
              <div className="error-formik">{formik.errors.email}</div>
            )}
          </div>
          <Turnstile
            onVerify={handleTurnstileSuccess}
            onExpire={handleTurnstileExpire}
            onError={handleTurnstileError}
            resetSignal={turnstileReset}
          />
          {turnstileError && <div className="error-formik">{turnstileError}</div>}
          {!loader ? (
            <button className="auth-login-submit-btn" type="submit">
              ENVIAR ENLACE DE RECUPERACIÓN
            </button>
          ) : (
            <Spinner size={3} width={0.3} color="var(--app-accent)" />
          )}
          <div className="c-row auth-login-register-wrap auth-recover-back-wrap">
            <Link to="/auth" className="auth-recover-back">
              ← Regresar a Iniciar Sesión
            </Link>
          </div>
        </form>
      </div>
      <ErrorModal show={show} onHide={closeError} message={errorMessage} />
      <SuccessModal
        show={showSuccess}
        onHide={closeSuccess}
        message="Revisa las instrucciones en tu correo para restablecer la contraseña."
        title="Correo enviado"
      />
    </div>
  );
}

export default ForgotPasswordForm;
