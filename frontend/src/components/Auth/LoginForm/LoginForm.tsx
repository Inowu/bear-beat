import { Link, useNavigate } from "react-router-dom";
import { useUserContext } from "../../../contexts/UserContext";
import trpc from "../../../api";
import { useFormik } from "formik";
import * as Yup from "yup";
import { useState } from "react";
import { ErrorModal, VerifyUpdatePhoneModal } from "../../../components/Modals";
import { Spinner } from "../../../components/Spinner/Spinner";

function LoginForm() {
  const [loader, setLoader] = useState<boolean>(false);
  const [show, setShow] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<any>("");
  const [showVerify, setShowVerify] = useState<boolean>(false);
  const [newUserId, setNewUserId] = useState<number>(0);
  const [newUserPhone, setNewUserPhone] = useState<string>("");
  const [loginInfo, setLoginInfo] = useState<any>({})
  const { handleLogin } = useUserContext();
  const navigate = useNavigate();
  const closeModal = () => {
    setShow(false);
  };
  const validationSchema = Yup.object().shape({
    username: Yup.string()
      .required("El correo es requerido")
      .email("El formato del correo no es correcto"),
    password: Yup.string()
      .required("La contraseña es requerida")
      .min(3, "La contraseña debe contenter 3 caracteres"),
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
      let body = {
        username: values.username,
        password: values.password,
      };
      try {
        const login = await trpc.auth.login.query(body);
        if (login.user.verified) {
          handleLogin(login.token, login.refreshToken);
          navigate("/");
        } else {
          setLoginInfo(login);
          setNewUserId(login.user.id);
          setNewUserPhone(login.user.phone!);
          setShowVerify(true);
        }
        
        setLoader(false);
      } catch (error: any) {
        setLoader(false);
        setShow(true);
        setErrorMessage(error);
      }
    },
  });

  const handleSuccessVerify = () => {
    handleLogin(loginInfo.token, loginInfo.refreshToken);
    setShowVerify(false);
  }

  return (
    <form onSubmit={formik.handleSubmit}>
      <h2>INICIAR SESIÓN</h2>
      <div className="c-row">
        <input
          placeholder="Correo electrónico"
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
          placeholder="Contraseña"
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
        <Link to={"recuperar"}>¿Olvidaste tu contraseña?</Link>
      </div>
      {!loader ? (
        <button className="btn" type="submit">
          INGRESAR
        </button>
      ) : (
        <Spinner size={3} width={0.3} color="#00e2f7" />
      )}
      <div className="c-row">
        <Link to={"registro"}>Registrarme</Link>
      </div>
      <ErrorModal show={show} onHide={closeModal} message={errorMessage} />
      <VerifyUpdatePhoneModal 
        showModal={showVerify}
        newUserId={newUserId}
        newUserPhone={newUserPhone}
        onHideModal={handleSuccessVerify}
      />
    </form>
  );
}

export default LoginForm;
