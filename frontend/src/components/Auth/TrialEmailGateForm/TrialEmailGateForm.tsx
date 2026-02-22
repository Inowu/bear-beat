import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Mail } from "src/icons";
import { useFormik } from "formik";
import * as Yup from "yup";
import trpc from "../../../api";
import { useTheme } from "../../../contexts/ThemeContext";
import brandLockupBlack from "../../../assets/brand/bearbeat-lockup-black.png";
import brandLockupCyan from "../../../assets/brand/bearbeat-lockup-cyan.png";
import { toErrorMessage } from "../../../utils/errorMessage";
import {
  clearAuthReturnUrl,
  normalizeAuthReturnUrl,
  readAuthReturnUrl,
} from "../../../utils/authReturnUrl";
import Turnstile, { type TurnstileRef } from "../../Turnstile/Turnstile";
import {
  shouldBypassTurnstile,
  TURNSTILE_BYPASS_TOKEN,
} from "../../../utils/turnstile";
import { Button, Input } from "src/components/ui";
import {
  getPrecheckMessage,
  type PrecheckMessageKey,
} from "../precheckCopy";
import {
  resolveTrialEmailGateDecision,
  type TrialEmailGateApiResult,
} from "./trialEmailGateDecision";
import { parseCheckoutIntent } from "../checkoutIntent";
import "./TrialEmailGateForm.scss";

const TURNSTILE_VERIFY_TIMEOUT_MS = 18_000;
const WHATSAPP_SUPPORT_NUMBER = "+15132828507";
const WHATSAPP_SUPPORT_URL = `https://wa.me/${WHATSAPP_SUPPORT_NUMBER.replace(/\D/g, "")}`;

function normalizeEmailCandidate(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function TrialEmailGateForm() {
  const navigate = useNavigate();
  const location = useLocation();
  const { theme } = useTheme();
  const brandLockup = theme === "light" ? brandLockupBlack : brandLockupCyan;

  const state = location.state as
    | {
        from?: string;
        prefillEmail?: string;
      }
    | null;

  const stateFromRaw = state?.from;
  const stateFrom =
    typeof stateFromRaw === "string" ? normalizeAuthReturnUrl(stateFromRaw) : null;
  const statePrefillEmail = normalizeEmailCandidate(state?.prefillEmail);
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
  const from = stateFrom ?? storedFrom ?? "/planes";
  const checkoutIntent = useMemo(() => parseCheckoutIntent(from), [from]);

  const [loader, setLoader] = useState<boolean>(false);
  const [inlineError, setInlineError] = useState<string>("");
  const [supportMessageKey, setSupportMessageKey] =
    useState<PrecheckMessageKey | null>(null);
  const [turnstileToken, setTurnstileToken] = useState<string>("");
  const [turnstileError, setTurnstileError] = useState<string>("");
  const [turnstileReset, setTurnstileReset] = useState<number>(0);
  const [turnstilePendingSubmit, setTurnstilePendingSubmit] = useState(false);
  const turnstileRef = useRef<TurnstileRef | null>(null);
  const turnstileTimeoutRef = useRef<number | null>(null);
  const turnstileBypassed = shouldBypassTurnstile();

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
    if (allowStoredFrom) return;
    if (!storedFromRaw) return;
    clearAuthReturnUrl();
  }, [allowStoredFrom, storedFromRaw]);

  const formik = useFormik({
    initialValues: {
      email: statePrefillEmail,
    },
    validationSchema: Yup.object().shape({
      email: Yup.string()
        .required("El correo es requerido")
        .email("El formato del correo no es correcto"),
    }),
    onSubmit: async (values) => {
      setInlineError("");
      setSupportMessageKey(null);

      if (!turnstileToken && !turnstileBypassed) {
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

      setLoader(true);
      try {
        const body = {
          email: values.email.trim(),
          turnstileToken:
            turnstileToken ||
            (turnstileBypassed ? TURNSTILE_BYPASS_TOKEN : ""),
        };
        const result = (await trpc.auth.startTrialByEmail.mutate(
          body,
        )) as TrialEmailGateApiResult;

        const decision = resolveTrialEmailGateDecision({
          result,
          from,
          email: body.email,
        });

        if (decision.mode === "support") {
          setSupportMessageKey(decision.messageKey);
          return;
        }

        navigate(decision.to, {
          replace: true,
          state: decision.state,
        });
      } catch (error: unknown) {
        setInlineError(toErrorMessage(error) || "No pudimos validar tu correo.");
      } finally {
        clearTurnstileTimeout();
        setLoader(false);
        setTurnstilePendingSubmit(false);
        setTurnstileToken("");
        setTurnstileReset((prev) => prev + 1);
      }
    },
  });

  useEffect(() => {
    if (!turnstilePendingSubmit) return;
    if (!turnstileToken) return;
    setTurnstilePendingSubmit(false);
    formik.submitForm();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [turnstilePendingSubmit, turnstileToken]);

  useEffect(() => {
    if (!inlineError) return;
    setInlineError("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formik.values.email]);

  const handleTurnstileSuccess = useCallback(
    (token: string) => {
      clearTurnstileTimeout();
      setTurnstileToken(token);
      setTurnstileError("");
    },
    [clearTurnstileTimeout],
  );

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

  const supportMessage = supportMessageKey
    ? getPrecheckMessage(supportMessageKey, checkoutIntent)
    : null;
  const showEmailError = Boolean(
    (formik.touched.email || formik.submitCount > 0) && formik.errors.email,
  );
  const emailErrorId = "trial-email-gate-email-error";

  return (
    <div className="auth-login-atmosphere">
      <div className="auth-login-card auth-login-card--trial-gate">
        <img src={brandLockup} alt="Bear Beat" className="auth-login-logo" />
        <h1 className="auth-login-title">Inicia tu prueba sin fricción</h1>
        <p className="auth-login-sub">
          Primero valida tu correo y te enviamos directo al siguiente paso.
        </p>

        <form
          className="auth-form auth-login-form auth-trial-gate-form"
          onSubmit={formik.handleSubmit}
          autoComplete="on"
          noValidate
        >
          <div className={`c-row ${showEmailError ? "is-invalid" : ""}`}>
            <label htmlFor="trial-email-gate-email" className="auth-field-label">
              Correo electrónico
            </label>
            <div className="auth-login-input-wrap">
              <Mail className="auth-login-input-icon" aria-hidden />
              <Input
                id="trial-email-gate-email"
                name="email"
                type="email"
                placeholder="correo@ejemplo.com"
                inputMode="email"
                autoComplete="email"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                value={formik.values.email}
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
                className="auth-login-input auth-login-input-with-icon"
                aria-invalid={showEmailError}
                aria-describedby={emailErrorId}
              />
            </div>
            {showEmailError && (
              <div className="error-formik" id={emailErrorId} role="alert">
                {formik.errors.email}
              </div>
            )}
          </div>

          <Turnstile
            ref={turnstileRef}
            onVerify={handleTurnstileSuccess}
            onExpire={handleTurnstileExpire}
            onError={handleTurnstileError}
            resetSignal={turnstileReset}
            invisible
          />
          {turnstileError && <div className="error-formik">{turnstileError}</div>}
          <div className="auth-login-inline-error" role="alert" aria-live="polite">
            {inlineError}
          </div>

          <Button
            unstyled
            type="submit"
            className="auth-login-submit-btn"
            disabled={loader}
            aria-busy={loader || undefined}
          >
            {loader ? "Validando..." : "Continuar"}
          </Button>

          {supportMessage && (
            <div className="trial-email-gate__support bb-market-surface" role="status">
              <p>{supportMessage}</p>
              <a
                href={WHATSAPP_SUPPORT_URL}
                target="_blank"
                rel="noreferrer noopener"
                className="home-cta home-cta--primary trial-email-gate__support-cta"
              >
                Hablar con soporte por WhatsApp
              </a>
            </div>
          )}

          <div className="c-row auth-login-register-wrap">
            <span className="auth-login-register-copy">
              ¿Ya tienes cuenta?{" "}
              <Link
                to="/auth"
                state={{
                  from,
                  prefillEmail: formik.values.email.trim(),
                }}
                className="auth-login-register"
              >
                Iniciar sesión
              </Link>
            </span>
          </div>
          <div className="c-row auth-login-register-wrap">
            <span className="auth-login-register-copy">
              ¿Aún no tienes cuenta?{" "}
              <Link
                to="/auth/registro"
                state={{
                  from,
                  prefillEmail: formik.values.email.trim(),
                }}
                className="auth-login-register"
              >
                Crear cuenta
              </Link>
            </span>
          </div>
        </form>
      </div>
    </div>
  );
}

export default TrialEmailGateForm;
