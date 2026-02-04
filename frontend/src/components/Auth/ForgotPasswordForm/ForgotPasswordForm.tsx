import { Link } from "react-router-dom";
import { HiOutlineMail } from "react-icons/hi";
import trpc from "../../../api";
import { useFormik } from "formik";
import * as Yup from "yup";
import { useCallback, useRef, useState } from "react";
import { ErrorModal } from "../../../components/Modals/ErrorModal/ErrorModal";
import { SuccessModal } from "../../../components/Modals/SuccessModal/SuccessModal";
import { Spinner } from "../../../components/Spinner/Spinner";
import Turnstile, { type TurnstileRef } from "../../../components/Turnstile/Turnstile";
import Logo from "../../../assets/images/osonuevo.png";
import "./ForgotPasswordForm.scss";

function ForgotPasswordForm() {
  const turnstileRef = useRef<TurnstileRef>(null);
  const [loader, setLoader] = useState<boolean>(false);
  const [show, setShow] = useState<boolean>(false);
  const [showSuccess, setShowSuccess] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<any>("");
  const [turnstileToken, setTurnstileToken] = useState<string>("");
  const [turnstileError, setTurnstileError] = useState<string>("");
  const [turnstileReset, setTurnstileReset] = useState<number>(0);

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
      if (!turnstileToken) return;
      setLoader(true);
      try {
        await trpc.auth.forgotPassword.mutate({
          email: values.email,
          turnstileToken,
        });
        setShowSuccess(true);
      } catch (error) {
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
    formik.submitForm();
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
            if (!turnstileToken) {
              setTurnstileError("Verificando seguridad…");
              turnstileRef.current?.execute();
              return;
            }
            formik.handleSubmit(e);
          }}
        >
          <div className="c-row auth-recover-email-wrap">
            <HiOutlineMail className="auth-recover-email-icon" aria-hidden />
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
          {/* Turnstile invisible: se ejecuta al enviar el form, no se muestra ningún cuadro */}
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
            <button className="auth-login-submit-btn" type="submit">
              ENVIAR ENLACE DE RECUPERACIÓN
            </button>
          ) : (
            <Spinner size={3} width={0.3} color="#00e2f7" />
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
