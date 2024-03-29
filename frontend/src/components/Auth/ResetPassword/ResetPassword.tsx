import { Link, useNavigate } from "react-router-dom";
import { ReactComponent as Arrow } from "../../../assets/icons/arrow-down.svg";
import trpc from "../../../api";
import { useFormik } from "formik";
import * as Yup from "yup";
import { useState } from "react";
import { ErrorModal } from "../../../components/Modals/ErrorModal/ErrorModal";
import { SuccessModal } from "../../../components/Modals/SuccessModal/SuccessModal";
import { Spinner } from "../../../components/Spinner/Spinner";
import { useLocation } from "react-router-dom";

function ResetPassword() {
  const navigate = useNavigate();
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
    navigate("/auth/login");
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
      let body: any = {
        password: values.password,
        userId: +id,
        token: searchParams.get("token"),
      };
      console.log(body);
      try {
        await trpc.auth.changePassword.mutate(body);
        setLoader(false);
        setShowSuccess(true);
      } catch (error) {
        setShow(true);
        setErrorMessage(error);
        setLoader(false);
      }
    },
  });
  return (
    <form onSubmit={formik.handleSubmit}>
      <h2>ESCRIBA UNA NUEVA CONTRASEÑA</h2>
      <div className="c-row">
        <input
          placeholder="Password"
          type="password"
          id="password"
          name="password"
          value={formik.values.password}
          onChange={formik.handleChange}
        />
        {formik.errors.password && (
          <div className="error-formik">{formik.errors.password}</div>
        )}
      </div>
      <div className="c-row">
        <input
          placeholder="Repetir password"
          type="password"
          id="passwordConfirmation"
          name="passwordConfirmation"
          value={formik.values.passwordConfirmation}
          onChange={formik.handleChange}
        />
        {formik.errors.passwordConfirmation && (
          <div className="error-formik">
            {formik.errors.passwordConfirmation}
          </div>
        )}
      </div>
      {!loader ? (
        <button className="btn" type="submit">
          Guardar
        </button>
      ) : (
        <Spinner size={3} width={0.3} color="#00e2f7" />
      )}
      <ErrorModal show={show} onHide={closeError} message={errorMessage} />
      <SuccessModal
        show={showSuccess}
        onHide={closeSuccess}
        message="Contraseña guardada exitosamente!"
        title="Cambio Exitoso"
      />
    </form>
  );
}

export default ResetPassword;
