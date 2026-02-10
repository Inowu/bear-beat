import { Link } from "react-router-dom";
import { Mail } from "lucide-react";
import trpc from "../../../api";
import { useFormik } from "formik";
import * as Yup from "yup";
import { useCallback, useEffect, useRef, useState } from "react";
import { ErrorModal } from "../../../components/Modals/ErrorModal/ErrorModal";
import { SuccessModal } from "../../../components/Modals/SuccessModal/SuccessModal";
import { Spinner } from "../../../components/Spinner/Spinner";
import Turnstile, { type TurnstileRef } from "../../../components/Turnstile/Turnstile";
import Logo from "../../../assets/images/osonuevo.png";
import {
  shouldBypassTurnstile,
  TURNSTILE_BYPASS_TOKEN,
} from "../../../utils/turnstile";
import { GROWTH_METRICS, trackGrowthMetric } from "../../../utils/growthMetrics";
import { toErrorMessage } from "../../../utils/errorMessage";
import "./ForgotPasswordForm.scss";

function inferErrorCode(message: string): string {
  const m = `${message ?? ""}`.toLowerCase();
  if (!m) return "unknown";
  if (m.includes("requerid")) return "required";
  if (m.includes("formato") || m.includes("email") || m.includes("correo")) return "invalid_format";
  if (m.includes("robot") || m.includes("verific")) return "verification";
  return "error";
}

function ForgotPasswordForm() {
  const [loader, setLoader] = useState<boolean>(false);
  const [show, setShow] = useState<boolean>(false);
  const [showSuccess, setShowSuccess] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [turnstileToken, setTurnstileToken] = useState<string>("");
  const [turnstileError, setTurnstileError] = useState<string>("");
  const [turnstileReset, setTurnstileReset] = useState<number>(0);
  const [turnstilePendingSubmit, setTurnstilePendingSubmit] = useState(false);
  const turnstileRef = useRef<TurnstileRef | null>(null);
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
      if (!turnstileToken && !turnstileBypassed) {
        // Invisible Turnstile: execute only on submit to avoid showing the widget by default.
        setTurnstileError("Verificando seguridad...");
        setTurnstilePendingSubmit(true);
        setLoader(true);
        turnstileRef.current?.execute();
        return;
      }
      setLoader(true);
      trackGrowthMetric(GROWTH_METRICS.FORM_SUBMIT, { formId: "forgot_password" });
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
        trackGrowthMetric(GROWTH_METRICS.FORM_ERROR, {
          formId: "forgot_password",
          field: "form",
          errorCode: "server_error",
        });
        trackGrowthMetric(GROWTH_METRICS.PASSWORD_RECOVERY_FAILED, {
          source: "forgot_password_form",
        });
        setShow(true);
        setErrorMessage(toErrorMessage(error));
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

  const lastSubmitTrackedRef = useRef(0);
  useEffect(() => {
    if (formik.submitCount <= lastSubmitTrackedRef.current) return;
    lastSubmitTrackedRef.current = formik.submitCount;
    const errors = formik.errors as Record<string, string>;
    for (const [field, message] of Object.entries(errors)) {
      if (!message) continue;
      trackGrowthMetric(GROWTH_METRICS.FORM_ERROR, {
        formId: "forgot_password",
        field,
        errorCode: inferErrorCode(message),
      });
    }
    if (turnstileError) {
      trackGrowthMetric(GROWTH_METRICS.FORM_ERROR, {
        formId: "forgot_password",
        field: "turnstile",
        errorCode: inferErrorCode(turnstileError),
      });
    }
  }, [formik.submitCount, formik.errors, turnstileError]);

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

  const showEmailError = Boolean((formik.touched.email || formik.submitCount > 0) && formik.errors.email);
  const emailErrorId = showEmailError ? "forgot-email-error" : undefined;

  return (
    <div className="auth-login-atmosphere">
      <div className="auth-login-card">
        <img src={Logo} alt="Bear Beat" className="auth-login-logo" />
        <h1 className="auth-login-title">Recuperar Acceso</h1>
        <p className="auth-login-sub auth-recover-sub">
          Ingresa tu correo asociado y te enviamos un enlace seguro.
        </p>
        <form className="auth-form auth-login-form auth-recover-form" onSubmit={formik.handleSubmit} autoComplete="on">
          <div className="c-row">
            <label htmlFor="email" className="auth-field-label">
              Correo electrónico
            </label>
            <div className="auth-recover-email-wrap">
              <Mail className="auth-recover-email-icon" aria-hidden />
              <input
                placeholder="Correo electrónico"
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                value={formik.values.email}
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
                aria-invalid={showEmailError}
                aria-describedby={emailErrorId}
                className="auth-login-input auth-recover-email-input"
              />
              {showEmailError && (
                <div className="error-formik" id={emailErrorId} role="alert">
                  {formik.errors.email}
                </div>
              )}
            </div>
          </div>
          <Turnstile
            ref={turnstileRef}
            invisible
            onVerify={handleTurnstileSuccess}
            onExpire={handleTurnstileExpire}
            onError={handleTurnstileError}
            resetSignal={turnstileReset}
          />
          {turnstileError && (
            <div className="error-formik" role="status" aria-live="polite">
              {turnstileError}
            </div>
          )}
          {!loader ? (
            <button className="auth-login-submit-btn" type="submit" data-testid="forgot-submit">
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
