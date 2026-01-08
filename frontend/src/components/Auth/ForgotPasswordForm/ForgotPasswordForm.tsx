import { Link, useNavigate } from "react-router-dom";
import { ReactComponent as Arrow } from "../../../assets/icons/arrow-down.svg";
import trpc from "../../../api";
import { useFormik } from "formik";
import * as Yup from "yup";
import { useCallback, useState } from "react";
import { ErrorModal } from "../../../components/Modals/ErrorModal/ErrorModal";
import { SuccessModal } from "../../../components/Modals/SuccessModal/SuccessModal";
import { Spinner } from "../../../components/Spinner/Spinner";
import Turnstile from "../../../components/Turnstile/Turnstile";

function ForgotPasswordForm() {
  const navigate = useNavigate();
  const [loader, setLoader] = useState<boolean>(false);
  const [show, setShow] = useState<boolean>(false);
  const [showSuccess, setShowSuccess] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<any>("");
  const [turnstileToken, setTurnstileToken] = useState<string>("");
  const [turnstileError, setTurnstileError] = useState<string>("");
  const [turnstileReset, setTurnstileReset] = useState<number>(0);
  const closeError = () => {
    setShow(false);
  };
  const closeSuccess = () => {
    setShowSuccess(false);
  };
  const validationSchema = Yup.object().shape({
    email: Yup.string()
      .required("El correo es requerido")
      .email("El formato del correo no es correcto"),
  });
  const initialValues = {
    email: "",
  };
  const formik = useFormik({
    initialValues: initialValues,
    validationSchema: validationSchema,
    onSubmit: async (values) => {
      if (!turnstileToken) {
        setTurnstileError("Confirma que no eres un robot.");
        return;
      }

      setLoader(true);
      let body = {
        email: values.email,
        turnstileToken,
      };
      try {
        await trpc.auth.forgotPassword.mutate(body);
        setShowSuccess(true);
      } catch (error) {
        console.log(error);
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
    <form onSubmit={formik.handleSubmit}>
      <h2>CAMBIAR CONTRASEÑA</h2>
      <div className="c-row">
        <input
          placeholder="E-mail"
          id="email"
          name="email"
          value={formik.values.email}
          onChange={formik.handleChange}
          type="text"
        />
        {formik.errors.email && (
          <div className="error-formik">{formik.errors.email}</div>
        )}
      </div>
      <div className="c-row turnstile-row">
        <Turnstile
          onVerify={handleTurnstileSuccess}
          onExpire={handleTurnstileExpire}
          onError={handleTurnstileError}
          resetSignal={turnstileReset}
        />
        {turnstileError && <div className="error-formik">{turnstileError}</div>}
      </div>
      {!loader ? (
        <button className="btn" type="submit">
          ENVIAR LINK
        </button>
      ) : (
        <Spinner size={3} width={0.3} color="#00e2f7" />
      )}

      <div className="c-row">
        <Link to={"/auth"}>
          <Arrow className="arrow" />
          Ya tengo cuenta
        </Link>
      </div>
      <ErrorModal show={show} onHide={closeError} message={errorMessage} />
      <SuccessModal
        show={showSuccess}
        onHide={closeSuccess}
        message="Revise las instrucciones en su correo para realizar el cambio de contraseña"
        title="Correo enviado!"
      />
    </form>
  );
}

export default ForgotPasswordForm;
