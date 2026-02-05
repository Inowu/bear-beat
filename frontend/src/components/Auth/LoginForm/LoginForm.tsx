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
    <>
      <div className="w-full max-w-md bg-bear-light-100 dark:bg-bear-dark-500 p-8 rounded-2xl border border-gray-200 dark:border-bear-dark-100 shadow-2xl font-poppins">
        <img src={Logo} alt="Bear Beat" className="h-12 w-auto mx-auto block mb-4" />
        <h1 className="text-2xl md:text-3xl font-bold font-bear text-bear-dark-900 dark:text-white text-center mb-1">Bienvenido, DJ.</h1>
        <p className="text-gray-600 dark:text-gray-400 text-sm text-center mb-6">Tu cabina está lista. Ingresa para descargar.</p>
        <ChatButton />
        <form className="flex flex-col gap-4" onSubmit={formik.handleSubmit}>
          <div>
            <div className="relative">
              <HiOutlineMail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-bear-cyan pointer-events-none" aria-hidden />
              <input
                placeholder="Correo electrónico"
                type="text"
                id="username"
                name="username"
                value={formik.values.username}
                onChange={formik.handleChange}
                className="bg-white dark:bg-bear-dark-300 border border-gray-300 dark:border-bear-dark-100 text-gray-900 dark:text-white text-sm font-medium rounded-xl h-11 px-4 pl-10 w-full focus:ring-2 focus:ring-bear-cyan focus:border-transparent outline-none transition-shadow"
              />
            </div>
            {formik.errors.username && (
              <p className="text-bear-status-error text-sm mt-1">{formik.errors.username}</p>
            )}
          </div>
          <div>
            <PasswordInput
              placeholder="Contraseña"
              id="password"
              name="password"
              value={formik.values.password}
              onChange={formik.handleChange}
              inputClassName="bg-white dark:bg-bear-dark-300 border border-gray-300 dark:border-bear-dark-100 text-gray-900 dark:text-white text-sm font-medium rounded-xl h-11 px-4 w-full focus:ring-2 focus:ring-bear-cyan focus:border-transparent outline-none transition-shadow"
              wrapperClassName="w-full"
            />
            {formik.errors.password && (
              <p className="text-bear-status-error text-sm mt-1">{formik.errors.password}</p>
            )}
          </div>
          <div className="text-right">
            <Link to="/auth/recuperar" className="text-sm font-medium text-bear-cyan hover:opacity-90">
              ¿Olvidaste tu contraseña?
            </Link>
          </div>
          {!loader ? (
            <button
              type="submit"
              className="w-full h-11 bg-bear-gradient text-bear-dark-500 text-sm font-bold font-poppins rounded-pill transition-all hover:opacity-95"
            >
              INGRESAR
            </button>
          ) : (
            <div className="flex justify-center py-2">
              <Spinner size={3} width={0.3} color="var(--app-accent)" />
            </div>
          )}
          <div className="text-center">
            <Link to="/auth/registro" state={{ from }} className="text-sm font-medium text-bear-cyan hover:opacity-90">
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
    </>
  );
}

export default LoginForm;
