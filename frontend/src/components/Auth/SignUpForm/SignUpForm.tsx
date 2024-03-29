import { Link, useNavigate } from "react-router-dom";
import PhoneInput from "react-phone-input-2";
import "react-phone-input-2/lib/material.css";
import "./SignUpForm.scss";
import es from "react-phone-input-2/lang/es.json";
import { ReactComponent as Arrow } from "../../../assets/icons/arrow-down.svg";
import { useUserContext } from "../../../contexts/UserContext";
import { ErrorModal } from "../../../components/Modals/ErrorModal/ErrorModal";
import trpc from "../../../api";
import { useFormik } from "formik";
import * as Yup from "yup";
import { useState } from "react";
import { SuccessModal } from "../../../components/Modals/SuccessModal/SuccessModal";
import { Spinner } from "../../../components/Spinner/Spinner";

function SignUpForm() {
  const navigate = useNavigate();
  const [loader, setLoader] = useState<boolean>(false);
  const { handleLogin } = useUserContext();
  const [show, setShow] = useState<boolean>(false);
  const [code, setCode] = useState<string>("52");
  const [showSuccess, setShowSuccess] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<any>("");
  const closeModal = () => {
    setShow(false);
  };
  const handleSuccessfulRegister = () => {
    fbq("track", "RegistroExitoso");
  };
  const closeSuccess = () => {
    setShowSuccess(false);
    navigate("/");
  };
  const validationSchema = Yup.object().shape({
    email: Yup.string()
      .required("El correo es requerido")
      .email("El formato del correo no es correcto"),
    username: Yup.string()
      .required("El nombre de usuario es requerido")
      .min(5, "El nombre de usuario debe contener por lo menos 5 caracteres")
      .matches(
        /[a-zA-Z]/,
        "El nombre de usuario debe contener al menos una letra"
      ),
    password: Yup.string()
      .required("La contraseña es requerida")
      .min(6, "La contraseña debe contenter 6 caracteres"),
    phone: Yup.string()
      .required("El teléfono es requerido")
      .matches(/^[0-9]{10}$/, "El teléfono no es válido"),
    passwordConfirmation: Yup.string()
      .required("Debe confirmar la contraseña")
      .oneOf([Yup.ref("password")], "Ambas contraseñas deben ser iguales"),
  });
  const initialValues = {
    username: "",
    password: "",
    email: "",
    phone: "",
    passwordConfirmation: "",
  };
  const handlePhoneNumberChange = (value: any, country: any) => {
    setCode(country.dialCode);
  };
  const formik = useFormik({
    initialValues: initialValues,
    validationSchema: validationSchema,
    onSubmit: async (values) => {
      setLoader(true);
      let body = {
        username: values.username,
        password: values.password,
        email: values.email,
        phone: `+${code} ${values.phone}`,
      };
      try {
        const register = await trpc.auth.register.mutate(body);
        handleLogin(register.token, register.refreshToken);
        setShowSuccess(true);
        handleSuccessfulRegister();
        setLoader(false);
      } catch (error: any) {
        setShow(true);
        setErrorMessage(error.message);
        setLoader(false);
      }
    },
  });

  return (
    <form className="sign-up-form" onSubmit={formik.handleSubmit}>
      <h2>REGISTRARSE</h2>
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
      <div className="c-row">
        <PhoneInput
          containerClass="dial-container"
          buttonClass="dial-code"
          country={"mx"}
          placeholder="Phone"
          localization={es}
          onChange={handlePhoneNumberChange}
        />
        <p className="code">+{code}</p>
        <input
          className="phone"
          placeholder="phone"
          id="phone"
          name="phone"
          value={formik.values.phone}
          onChange={formik.handleChange}
          type="text"
        />
        {formik.errors.phone && (
          <div className="error-formik">{formik.errors.phone}</div>
        )}
      </div>
      <div className="c-row">
        <input
          placeholder="Username"
          type="text"
          id="username"
          name="username"
          value={formik.values.username}
          onChange={formik.handleChange}
        />
        {formik.errors.username && (
          <div className="error-formik">{formik.errors.username}</div>
        )}
      </div>
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
          REGISTRARSE
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
      <ErrorModal show={show} onHide={closeModal} message={errorMessage} />
      <SuccessModal
        show={showSuccess}
        onHide={closeSuccess}
        message="Se ha creado su usuario con éxito!"
        title="Registro Exitoso"
      />
    </form>
  );
}

export default SignUpForm;
