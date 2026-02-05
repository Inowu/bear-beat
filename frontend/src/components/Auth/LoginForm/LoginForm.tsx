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
    <>
      <div className="w-full max-w-md bg-slate-900 p-8 rounded-2xl border border-slate-800 shadow-2xl">
        <img src={Logo} alt="Bear Beat" className="h-12 w-auto mx-auto block mb-4" />
        <h1 className="text-2xl md:text-3xl font-bold text-white text-center mb-1">Bienvenido, DJ.</h1>
        <p className="text-slate-400 text-sm text-center mb-6">Tu cabina está lista. Ingresa para descargar.</p>
        <ChatButton />
        <form className="flex flex-col gap-4" onSubmit={formik.handleSubmit}>
          <div>
            <div className="relative">
              <HiOutlineMail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" aria-hidden />
              <input
                placeholder="Correo electrónico"
                type="text"
                id="username"
                name="username"
                value={formik.values.username}
                onChange={formik.handleChange}
                className="bg-slate-950 border border-slate-700 text-white text-sm font-medium rounded-lg h-11 px-4 pl-10 w-full focus:ring-2 focus:ring-cyan-500 focus:border-transparent outline-none transition-shadow"
              />
            </div>
            {formik.errors.username && (
              <p className="text-red-400 text-sm mt-1">{formik.errors.username}</p>
            )}
          </div>
          <div>
            <PasswordInput
              placeholder="Contraseña"
              id="password"
              name="password"
              value={formik.values.password}
              onChange={formik.handleChange}
              inputClassName="bg-slate-950 border border-slate-700 text-white text-sm font-medium rounded-lg h-11 px-4 w-full focus:ring-2 focus:ring-cyan-500 focus:border-transparent outline-none transition-shadow"
              wrapperClassName="w-full"
            />
            {formik.errors.password && (
              <p className="text-red-400 text-sm mt-1">{formik.errors.password}</p>
            )}
          </div>
          <div className="text-right">
            <Link to="/auth/recuperar" className="text-sm font-medium text-cyan-400 hover:text-cyan-300">
              ¿Olvidaste tu contraseña?
            </Link>
          </div>
          {!loader ? (
            <button
              type="submit"
              className="w-full h-11 bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-medium rounded-lg transition-all"
            >
              INGRESAR
            </button>
          ) : (
            <div className="flex justify-center py-2">
              <Spinner size={3} width={0.3} color="var(--app-accent)" />
            </div>
          )}
          <div className="text-center">
            <Link to="/auth/registro" state={{ from }} className="text-sm font-medium text-cyan-400 hover:text-cyan-300">
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
