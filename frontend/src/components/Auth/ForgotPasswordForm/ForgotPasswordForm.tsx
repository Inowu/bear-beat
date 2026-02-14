import { Link } from "react-router-dom";
import { Mail } from "src/icons";
import trpc from "../../../api";
import { useFormik } from "formik";
import * as Yup from "yup";
import { useCallback, useEffect, useRef, useState } from "react";
import { Spinner } from "../../../components/Spinner/Spinner";
import Turnstile, { type TurnstileRef } from "../../../components/Turnstile/Turnstile";
import { useTheme } from "../../../contexts/ThemeContext";
import brandLockupBlack from "../../../assets/brand/bearbeat-lockup-black.png";
import brandLockupCyan from "../../../assets/brand/bearbeat-lockup-cyan.png";
import {
  shouldBypassTurnstile,
  TURNSTILE_BYPASS_TOKEN,
} from "../../../utils/turnstile";
import { GROWTH_METRICS, trackGrowthMetric } from "../../../utils/growthMetrics";
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
  const [requestStatus, setRequestStatus] = useState<"idle" | "sending" | "sent">("idle");
  const [turnstileToken, setTurnstileToken] = useState<string>("");
  const [turnstileError, setTurnstileError] = useState<string>("");
  const { theme } = useTheme();
  const brandLockup = theme === "light" ? brandLockupBlack : brandLockupCyan;
  const [turnstileReset, setTurnstileReset] = useState<number>(0);
  const [turnstilePendingSubmit, setTurnstilePendingSubmit] = useState(false);
  const turnstileRef = useRef<TurnstileRef | null>(null);
  const turnstileBypassed = shouldBypassTurnstile();
  const statusRef = useRef<HTMLDivElement | null>(null);

  const SAFE_COPY =
    "Si el correo está registrado, te enviaremos un enlace. Revisa Spam/Promociones.";

  const validationSchema = Yup.object().shape({
    email: Yup.string()
      .required("El correo es requerido")
      .email("El formato del correo no es correcto"),
  });

  const formik = useFormik({
    initialValues: { email: "" },
    validationSchema,
    onSubmit: async (values) => {
      setRequestStatus("sending");
      setTurnstileError("");
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
      } catch (error) {
        trackGrowthMetric(GROWTH_METRICS.FORM_ERROR, {
          formId: "forgot_password",
          field: "form",
          errorCode: "server_error",
        });
        trackGrowthMetric(GROWTH_METRICS.PASSWORD_RECOVERY_FAILED, {
          source: "forgot_password_form",
        });
        // Security UX: don't reveal whether the email exists. Show the same neutral message.
      } finally {
        setRequestStatus("sent");
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
    setRequestStatus("idle");
    setTurnstilePendingSubmit(false);
    setLoader(false);
  }, []);

  const handleTurnstileError = useCallback(() => {
    setTurnstileToken("");
    setTurnstileError("No se pudo verificar la seguridad.");
    setRequestStatus("idle");
    setTurnstilePendingSubmit(false);
    setLoader(false);
  }, []);

  useEffect(() => {
    if (requestStatus !== "sent") return;
    statusRef.current?.focus();
  }, [requestStatus]);

  useEffect(() => {
    if (requestStatus !== "sent") return;
    // If the user edits the email, clear the status message to avoid confusion.
    setRequestStatus("idle");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formik.values.email]);

  const showEmailError = Boolean((formik.touched.email || formik.submitCount > 0) && formik.errors.email);
  const emailErrorId = showEmailError ? "forgot-email-error" : undefined;
  const emailHelpId = "forgot-email-help";
  const emailDescribedBy = [emailHelpId, emailErrorId].filter(Boolean).join(" ") || undefined;
  const statusMessage =
    requestStatus === "sending" ? "Enviando enlace..." : requestStatus === "sent" ? SAFE_COPY : "";

  return (
    <div className="auth-login-atmosphere">
      <div className="auth-login-card">
        <img src={brandLockup} alt="Bear Beat" className="auth-login-logo" />
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
                placeholder="correo@ejemplo.com"
                id="email"
                name="email"
                type="email"
                inputMode="email"
                autoComplete="email"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                disabled={loader}
                value={formik.values.email}
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
                aria-invalid={showEmailError}
                aria-describedby={emailDescribedBy}
                className="auth-login-input auth-recover-email-input"
              />
              {showEmailError && (
                <div className="error-formik" id={emailErrorId} role="alert">
                  {formik.errors.email}
                </div>
              )}
            </div>
            <p className="auth-recover-helper" id={emailHelpId}>
              {SAFE_COPY}
            </p>
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
          <div
            className={[
              "auth-recover-status",
              requestStatus === "sent" ? "is-sent" : "",
              requestStatus === "sending" ? "is-sending" : "",
            ]
              .filter(Boolean)
              .join(" ")}
            ref={statusRef}
            tabIndex={-1}
            role="status"
            aria-live="polite"
            aria-atomic="true"
          >
            {statusMessage}
          </div>
          <button
            className="auth-login-submit-btn"
            type="submit"
            data-testid="forgot-submit"
            disabled={loader || Boolean(turnstilePendingSubmit)}
          >
            {loader ? (
              <span className="auth-recover-submit-loading">
                <Spinner size={1.5} width={0.22} color="var(--app-btn-text)" />
                ENVIANDO...
              </span>
            ) : (
              "ENVIAR ENLACE"
            )}
          </button>
          <div className="c-row auth-login-register-wrap auth-recover-back-wrap">
            <Link to="/auth" className="auth-recover-back">
              ← Regresar a Iniciar Sesión
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}

export default ForgotPasswordForm;
