import "./SignUpForm.scss";
import "react-phone-input-2/lib/material.css";
import { detectUserCountry, findDialCode, twoDigitsCountryCodes } from "../../../utils/country_codes";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ReactComponent as Arrow } from "../../../assets/icons/arrow-down.svg";
import { Spinner } from "../../../components/Spinner/Spinner";
import { useCallback, useEffect, useState } from "react";
import { useFormik } from "formik";
import { useUserContext } from "../../../contexts/UserContext";
import * as Yup from "yup";
import es from "react-phone-input-2/lang/es.json";
import PhoneInput from "react-phone-input-2";
import trpc from "../../../api";
import { ErrorModal, SuccessModal, VerifyPhoneModal } from "../../../components/Modals";
import { useCookies } from "react-cookie";
import { ChatButton } from "../../../components/ChatButton/ChatButton";
import Turnstile from "../../../components/Turnstile/Turnstile";
import { trackLead } from "../../../utils/facebookPixel";

function SignUpForm() {
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? "/";
  const [loader, setLoader] = useState<boolean>(false);
  const { handleLogin } = useUserContext();
  const [show, setShow] = useState<boolean>(false);
  const [code, setCode] = useState<string>("52");
  const [countryCode, setCountryCode] = useState<string>("mx");
  const [showSuccess, setShowSuccess] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<any>("");
  const [showVerify, setShowVerify] = useState<boolean>(false);
  const [newUserId, setNewUserId] = useState<number>(0);
  const [newUserPhone, setNewUserPhone] = useState<string>("");
  const [registerInfo, setRegisterInfo] = useState<any>({});
  const [cookies] = useCookies(["_fbp"]);
  const [blockedDomains, setBlockedDomains] = useState<string[]>([]);
  const [blockedPhoneNumbers, setBlockedPhoneNumbers] = useState<string[]>([]);
  const [turnstileToken, setTurnstileToken] = useState<string>("");
  const [turnstileError, setTurnstileError] = useState<string>("");
  const [turnstileReset, setTurnstileReset] = useState<number>(0);

  const closeModal = () => {
    setShow(false);
  };

  const closeSuccess = () => {
    setShowSuccess(false);
    navigate(from, { replace: true });
  };
  const validationSchema = Yup.object().shape({
    email: Yup.string().required("El correo es requerido").email("El formato del correo no es correcto"),
    username: Yup.string()
      .required("El nombre de usuario es requerido")
      .min(5, "El nombre de usuario debe contener por lo menos 5 caracteres")
      .matches(/[a-zA-Z]/, "El nombre de usuario debe contener al menos una letra"),
    password: Yup.string()
      .required("La contraseña es requerida")
      .min(6, "La contraseña debe contenter 6 caracteres"),
    phone: Yup.string()
      .required("El teléfono es requerido")
      .matches(/^[0-9]{7,10}$/, "El teléfono no es válido"),
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

  const getEmailDomain = (email: string) => {
    const trimmed = email.trim().toLowerCase();
    const atIndex = trimmed.lastIndexOf("@");
    return atIndex === -1 ? "" : trimmed.slice(atIndex + 1);
  };

  const phoneRegex = /^\+\d{1,4}\s\d{4,14}$/;

  const normalizePhoneNumber = (phone: string) => {
    const normalized = phone.trim().replace(/\s+/g, " ");
    return phoneRegex.test(normalized) ? normalized : "";
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
      const emailDomain = getEmailDomain(values.email);
      if (emailDomain && blockedDomains.includes(emailDomain)) {
        formik.setFieldError("email", "El dominio del correo no está permitido");
        setLoader(false);
        return;
      }
      const formattedPhone = `+${code} ${values.phone}`;
      const normalizedPhone = normalizePhoneNumber(formattedPhone);
      if (normalizedPhone && blockedPhoneNumbers.includes(normalizedPhone)) {
        formik.setFieldError("phone", "El telefono no esta permitido");
        setLoader(false);
        return;
      }
      let body = {
        username: values.username,
        password: values.password,
        email: values.email,
        phone: formattedPhone,
        fbp: cookies._fbp,
        url: window.location.href,
        turnstileToken,
      };
      try {
        const register = await trpc.auth.register.mutate(body);
        setRegisterInfo(register);
        setNewUserId(register.user.id);
        setNewUserPhone(register.user.phone!);

        trackLead({ email: register.user.email, phone: register.user.phone });

        if (process.env.REACT_APP_ENVIRONMENT === "development") {
          handleLogin(register.token, register.refreshToken);
          navigate(from, { replace: true });
        }

        setShowVerify(true);
      } catch (error: any) {
        let errorMessage = error.message;

        if (error.message.includes('"validation"')) {
          errorMessage = JSON.parse(error.message)[0].message;
        }

        setShow(true);
        setErrorMessage(errorMessage);
      } finally {
        setLoader(false);
        setTurnstileToken("");
        setTurnstileReset((prev) => prev + 1);
      }
    },
  });

  const handleSuccessVerify = () => {
    handleLogin(registerInfo.token, registerInfo.refreshToken);
    setShowVerify(false);
    setShowSuccess(true);
  };

  const getUserLocation = useCallback(async () => {
    try {
      const country = detectUserCountry();
      console.log(country);
      if (country) {
        setCountryCode(country.code.toLowerCase());
        const dialCode = findDialCode(country.code.toUpperCase());
        setCode(dialCode);
      }
    } catch (error) {
      console.error("There was an error while trying to get user's location.", error);
    }
  }, []);

  useEffect(() => {
    getUserLocation();
  }, [getUserLocation]);

  useEffect(() => {
    const fetchBlockedDomains = async () => {
      try {
        const domains = await trpc.blockedEmailDomains.listBlockedEmailDomains.query();
        setBlockedDomains(domains);
      } catch (error) {
        console.error("No se pudieron cargar los dominios bloqueados.", error);
      }
    };

    fetchBlockedDomains();
  }, []);

  useEffect(() => {
    const fetchBlockedPhones = async () => {
      try {
        const numbers = await trpc.blockedPhoneNumbers.listBlockedPhoneNumbers.query();
        setBlockedPhoneNumbers(numbers);
      } catch (error) {
        console.error("No se pudieron cargar los telefonos bloqueados.", error);
      }
    };

    fetchBlockedPhones();
  }, []);

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
    <div className="auth-split">
      <div className="auth-split-panel auth-split-left">
        <h2 className="auth-split-title">Estás a 60 segundos de tenerlo todo.</h2>
        <ul className="auth-split-list">
          <li>Acceso inmediato a 12.5 TB.</li>
          <li>Descarga por FTP sin límites.</li>
          <li>Cancela cuando quieras.</li>
        </ul>
        <p className="auth-split-testimonial">"La mejor inversión para mi carrera."</p>
      </div>
      <div className="auth-split-panel auth-split-right">
        <div className="auth-split-form">
          <h2 className="auth-split-form-title">Crea tu cuenta Pro</h2>
          <ChatButton />
          <form className="sign-up-form auth-form" onSubmit={formik.handleSubmit}>
            <div className="c-row">
              <input
                placeholder="Correo electrónico"
                id="email"
                name="email"
                value={formik.values.email}
                onChange={formik.handleChange}
                type="text"
              />
              {formik.errors.email && <div className="error-formik">{formik.errors.email}</div>}
            </div>
            <div className="c-row">
              <PhoneInput
                containerClass="dial-container"
                buttonClass="dial-code"
                country={countryCode}
                preferredCountries={["mx", "us", "ca", "es"]}
                onlyCountries={twoDigitsCountryCodes.map((c) => c.toLowerCase())}
                placeholder="Teléfono"
                localization={es}
                onChange={handlePhoneNumberChange}
              />
              <p className="code">+{code}</p>
              <input
                className="phone"
                placeholder="Teléfono"
                id="phone"
                name="phone"
                value={formik.values.phone}
                onChange={formik.handleChange}
                type="text"
              />
              {formik.errors.phone && <div className="error-formik">{formik.errors.phone}</div>}
            </div>
            <div className="c-row">
              <input
                placeholder="Nombre"
                type="text"
                id="username"
                name="username"
                value={formik.values.username}
                onChange={formik.handleChange}
              />
              {formik.errors.username && <div className="error-formik">{formik.errors.username}</div>}
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
              {formik.errors.password && <div className="error-formik">{formik.errors.password}</div>}
            </div>
            <div className="c-row">
              <input
                placeholder="Repetir contraseña"
                type="password"
                id="passwordConfirmation"
                name="passwordConfirmation"
                value={formik.values.passwordConfirmation}
                onChange={formik.handleChange}
              />
              {formik.errors.passwordConfirmation && (
                <div className="error-formik">{formik.errors.passwordConfirmation}</div>
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
                REGISTRARSE
              </button>
            ) : (
              <Spinner size={3} width={0.3} color="#00e2f7" />
            )}
            <div className="c-row">
              <Link to="/auth" state={{ from }}>
                <Arrow className="arrow" />
                Ya tengo cuenta
              </Link>
            </div>
          </form>
        </div>
      </div>
      <ErrorModal show={show} onHide={closeModal} message={errorMessage} />
      <SuccessModal
        show={showSuccess}
        onHide={closeSuccess}
        message="Se ha creado su usuario con éxito!"
        title="Registro Exitoso"
      />
      <VerifyPhoneModal
        showModal={showVerify}
        newUserId={newUserId}
        newUserPhone={newUserPhone}
        onHideModal={handleSuccessVerify}
      />
    </div>
  );
}

export default SignUpForm;
