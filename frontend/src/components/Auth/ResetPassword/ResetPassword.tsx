import { useNavigate, useLocation } from "react-router-dom";
import { HiOutlineLockClosed } from "react-icons/hi";
import trpc from "../../../api";
import { PasswordInput } from "../../PasswordInput/PasswordInput";
import { useFormik } from "formik";
import * as Yup from "yup";
import { useState } from "react";
import { ErrorModal } from "../../../components/Modals/ErrorModal/ErrorModal";
import { SuccessModal } from "../../../components/Modals/SuccessModal/SuccessModal";
import { Spinner } from "../../../components/Spinner/Spinner";
import { useUserContext } from "../../../contexts/UserContext";
import "./ResetPassword.scss";

function ResetPassword() {
  const navigate = useNavigate();
  const { handleLogin, startUser } = useUserContext();
  const [loader, setLoader] = useState<boolean>(false);
  const [show, setShow] = useState<boolean>(false);
  const [showSuccess, setShowSuccess] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<any>("");
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const closeError = () => {
    setShow(false);
  };
  const closeSuccess = () => {
    setShowSuccess(false);
    navigate("/");
  };
  const validationSchema = Yup.object().shape({
    password: Yup.string()
      .required("La contraseña es requerida")
      .min(6, "La contraseña debe contener por lo menos 6 caracteres"),
    passwordConfirmation: Yup.string()
      .required("Debe confirmar la contraseña")
      .oneOf([Yup.ref("password")], "Ambas contraseñas deben ser iguales"),
  });
  const initialValues = {
    password: "",
    passwordConfirmation: "",
  };
  const formik = useFormik({
    initialValues: initialValues,
    validationSchema: validationSchema,
    onSubmit: async (values) => {
      setLoader(true);
      let id: any = searchParams.get("userId");
      const body = {
        password: values.password,
        userId: +id,
        token: searchParams.get("token"),
      };
      try {
        const data = await trpc.auth.changePassword.mutate(body);
        setLoader(false);
        if (data?.token && data?.refreshToken) {
          handleLogin(data.token, data.refreshToken);
          await startUser();
          setShowSuccess(true);
        } else {
          setShowSuccess(true);
        }
      } catch (error) {
        setShow(true);
        setErrorMessage(error);
        setLoader(false);
      }
    },
  });
  return (
    <form className="auth-form auth-reset-form" onSubmit={formik.handleSubmit} autoComplete="on">
      <h2 className="auth-reset-title">ESCRIBA UNA NUEVA CONTRASEÑA</h2>
      <div className="c-row">
        <div className="auth-password-with-icon-wrap">
          <HiOutlineLockClosed className="auth-password-icon" aria-hidden />
          <PasswordInput
            placeholder="Nueva contraseña (mín. 6 caracteres)"
            id="password"
            name="password"
            autoComplete="new-password"
            value={formik.values.password}
            onChange={formik.handleChange}
            onBlur={formik.handleBlur}
            aria-invalid={Boolean((formik.touched.password || formik.submitCount > 0) && formik.errors.password)}
          />
        </div>
        {(formik.touched.password || formik.submitCount > 0) && formik.errors.password && (
          <div className="error-formik">{formik.errors.password}</div>
        )}
      </div>
      <div className="c-row">
        <div className="auth-password-with-icon-wrap">
          <HiOutlineLockClosed className="auth-password-icon" aria-hidden />
          <PasswordInput
            placeholder="Repetir contraseña"
            id="passwordConfirmation"
            name="passwordConfirmation"
            autoComplete="new-password"
            value={formik.values.passwordConfirmation}
            onChange={formik.handleChange}
            onBlur={formik.handleBlur}
            aria-invalid={Boolean(
              (formik.touched.passwordConfirmation || formik.submitCount > 0) && formik.errors.passwordConfirmation,
            )}
          />
        </div>
        {(formik.touched.passwordConfirmation || formik.submitCount > 0) && formik.errors.passwordConfirmation && (
          <div className="error-formik">
            {formik.errors.passwordConfirmation}
          </div>
        )}
      </div>
      {!loader ? (
        <button className="btn auth-reset-submit" type="submit">
          Guardar
        </button>
      ) : (
        <Spinner size={3} width={0.3} color="var(--app-accent)" />
      )}
      <ErrorModal show={show} onHide={closeError} message={errorMessage} />
      <SuccessModal
        show={showSuccess}
        onHide={closeSuccess}
        message="Contraseña actualizada correctamente. Has iniciado sesión."
        title="Cambio exitoso"
      />
    </form>
  );
}

export default ResetPassword;
