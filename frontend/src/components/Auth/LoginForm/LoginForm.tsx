import { Link, useLocation, useNavigate } from "react-router-dom";
import { HiOutlineMail, HiOutlineLockClosed } from "react-icons/hi";
import { PasswordInput } from "../../PasswordInput/PasswordInput";
import { useUserContext } from "../../../contexts/UserContext";
import trpc from "../../../api";
import { useFormik } from "formik";
import * as Yup from "yup";
import { useState } from "react";
import { ErrorModal, VerifyUpdatePhoneModal } from "../../../components/Modals";
import { Spinner } from "../../../components/Spinner/Spinner";
import { ChatButton } from "../../../components/ChatButton/ChatButton";
import Logo from "../../../assets/images/osonuevo.png";
import { trackManyChatConversion, MC_EVENTS } from "../../../utils/manychatPixel";
import "./LoginForm.scss";

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
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? "/";
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
        console.log('login Response', login);
        if (login) {
          if (login.user) {
            if (login.user.verified) {
              trackManyChatConversion(MC_EVENTS.LOGIN_SUCCESS);
              handleLogin(login.token, login.refreshToken);
              navigate(from, { replace: true });
            } else {
              setLoginInfo(login);
              setNewUserId(login.user.id);
              setNewUserPhone(login.user.phone!);
              setShowVerify(true);
            }
          } else {
            trackManyChatConversion(MC_EVENTS.LOGIN_SUCCESS);
            handleLogin(login.token, login.refreshToken);
            navigate(from, { replace: true });
          }
        }

        setLoader(false);
      } catch (error: any) {
        let errorMessage = error.message;

        if (error.message.includes('"validation"')) {
          errorMessage = JSON.parse(error.message)[0].message;
        }

        setLoader(false);
        setShow(true);
        setErrorMessage(errorMessage);
      }
    },
  });

  const handleSuccessVerify = () => {
    handleLogin(loginInfo.token, loginInfo.refreshToken);
    setShowVerify(false);
    navigate(from, { replace: true });
  };

  return (
    <div className="w-full max-w-md mx-auto">
      <div className="auth-login-atmosphere">
      <div className="auth-login-glow" aria-hidden />
      <div className="auth-login-card">
        <img src={Logo} alt="Bear Beat" className="auth-login-logo" />
        <h1 className="auth-login-title">Bienvenido, DJ.</h1>
        <p className="auth-login-sub">Tu cabina está lista. Ingresa para descargar.</p>
        <ChatButton />
        <form className="auth-form auth-login-form" onSubmit={formik.handleSubmit}>
          <div className="c-row">
            <div className="auth-login-input-wrap">
              <HiOutlineMail className="auth-login-input-icon" aria-hidden />
              <input
                placeholder="Correo electrónico"
                type="text"
                id="username"
                name="username"
                value={formik.values.username}
                onChange={formik.handleChange}
                className="auth-login-input auth-login-input-with-icon"
              />
            </div>
            {formik.errors.username && (
              <div className="error-formik">{formik.errors.username}</div>
            )}
          </div>
          <div className="c-row">
            <div className="auth-login-input-wrap">
              <HiOutlineLockClosed className="auth-login-input-icon" aria-hidden />
              <PasswordInput
                placeholder="Contraseña"
                id="password"
                name="password"
                value={formik.values.password}
                onChange={formik.handleChange}
                inputClassName="auth-login-input auth-login-input-with-icon"
                wrapperClassName="auth-login-password-wrap"
              />
            </div>
            {formik.errors.password && (
              <div className="error-formik">{formik.errors.password}</div>
            )}
          </div>
          <div className="c-row auth-login-forgot-wrap">
            <Link to="/auth/recuperar" className="auth-login-forgot">
              ¿Olvidaste tu contraseña?
            </Link>
          </div>
          {!loader ? (
            <button className="auth-login-submit-btn" type="submit">
              INGRESAR
            </button>
          ) : (
            <Spinner size={3} width={0.3} color="var(--app-accent)" />
          )}
          <div className="c-row auth-login-register-wrap">
            <Link to="/auth/registro" state={{ from }} className="auth-login-register">
              Registrarme
            </Link>
          </div>
        </form>
      </div>
      <ErrorModal show={show} onHide={closeModal} message={errorMessage} />
      <VerifyUpdatePhoneModal
        showModal={showVerify}
        newUserId={newUserId}
        newUserPhone={newUserPhone}
        onHideModal={handleSuccessVerify}
      />
    </div>
    </div>
  );
}

export default LoginForm;
