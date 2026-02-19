import { useNavigate, useLocation } from "react-router-dom";
import { Lock } from "src/icons";
import trpc from "../../../api";
import { PasswordInput } from "../../PasswordInput/PasswordInput";
import { useFormik } from "formik";
import * as Yup from "yup";
import { useEffect, useRef, useState } from "react";
import { ErrorModal } from "../../../components/Modals/ErrorModal/ErrorModal";
import { SuccessModal } from "../../../components/Modals/SuccessModal/SuccessModal";
import { Spinner } from "../../../components/Spinner/Spinner";
import { useUserContext } from "../../../contexts/UserContext";
import { GROWTH_METRICS, trackGrowthMetric } from "../../../utils/growthMetrics";
import { toErrorMessage } from "../../../utils/errorMessage";
import "./ResetPassword.scss";
import { Button } from "src/components/ui";
function inferErrorCode(message: string): string {
  const m = `${message ?? ""}`.toLowerCase();
  if (!m) return "unknown";
  if (m.includes("requerid")) return "required";
  if (m.includes("igual")) return "mismatch";
  if (m.includes("min") || m.includes("caracter")) return "too_short";
  return "error";
}

function ResetPassword() {
  const navigate = useNavigate();
  const { handleLogin, startUser } = useUserContext();
  const [loader, setLoader] = useState<boolean>(false);
  const [show, setShow] = useState<boolean>(false);
  const [showSuccess, setShowSuccess] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>("");
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
      trackGrowthMetric(GROWTH_METRICS.FORM_SUBMIT, { formId: "reset_password" });
      trackGrowthMetric(GROWTH_METRICS.AUTH_START, { flow: "reset_password" });
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
          trackGrowthMetric(GROWTH_METRICS.AUTH_SUCCESS, { flow: "reset_password" });
          handleLogin(data.token, data.refreshToken);
          await startUser();
          setShowSuccess(true);
        } else {
          trackGrowthMetric(GROWTH_METRICS.AUTH_SUCCESS, { flow: "reset_password" });
          setShowSuccess(true);
        }
      } catch (error) {
        trackGrowthMetric(GROWTH_METRICS.AUTH_ERROR, {
          flow: "reset_password",
          errorCode: "server_error",
        });
        trackGrowthMetric(GROWTH_METRICS.FORM_ERROR, {
          formId: "reset_password",
          field: "form",
          errorCode: "server_error",
        });
        setShow(true);
        setErrorMessage(toErrorMessage(error));
        setLoader(false);
      }
    },
  });

  const lastSubmitTrackedRef = useRef(0);
  useEffect(() => {
    if (formik.submitCount <= lastSubmitTrackedRef.current) return;
    lastSubmitTrackedRef.current = formik.submitCount;
    const errors = formik.errors as Record<string, string>;
    for (const [field, message] of Object.entries(errors)) {
      if (!message) continue;
      trackGrowthMetric(GROWTH_METRICS.FORM_ERROR, {
        formId: "reset_password",
        field,
        errorCode: inferErrorCode(message),
      });
    }
  }, [formik.submitCount, formik.errors]);

  const showPasswordError = Boolean((formik.touched.password || formik.submitCount > 0) && formik.errors.password);
  const showPasswordConfirmationError = Boolean(
    (formik.touched.passwordConfirmation || formik.submitCount > 0) && formik.errors.passwordConfirmation,
  );
  const passwordErrorId = showPasswordError ? "reset-password-error" : undefined;
  const passwordConfirmationErrorId = showPasswordConfirmationError ? "reset-password-confirmation-error" : undefined;

  return (
    <form className="auth-form auth-reset-form" onSubmit={formik.handleSubmit} autoComplete="on">
      <h1 className="auth-reset-title">Crea una nueva contraseña</h1>
      <div className="c-row">
        <label htmlFor="password" className="auth-field-label">
          Nueva contraseña
        </label>
        <div className="auth-password-with-icon-wrap">
          <Lock className="auth-password-icon" aria-hidden />
          <PasswordInput
            placeholder="Nueva contraseña (mín. 6 caracteres)"
            id="password"
            name="password"
            autoComplete="new-password"
            value={formik.values.password}
            onChange={formik.handleChange}
            onBlur={formik.handleBlur}
            aria-invalid={showPasswordError}
            aria-describedby={passwordErrorId}
          />
        </div>
        {showPasswordError && (
          <div className="error-formik" id={passwordErrorId} role="alert">
            {formik.errors.password}
          </div>
        )}
      </div>
      <div className="c-row">
        <label htmlFor="passwordConfirmation" className="auth-field-label">
          Repetir contraseña
        </label>
        <div className="auth-password-with-icon-wrap">
          <Lock className="auth-password-icon" aria-hidden />
          <PasswordInput
            placeholder="Repetir contraseña"
            id="passwordConfirmation"
            name="passwordConfirmation"
            autoComplete="new-password"
            value={formik.values.passwordConfirmation}
            onChange={formik.handleChange}
            onBlur={formik.handleBlur}
            aria-invalid={showPasswordConfirmationError}
            aria-describedby={passwordConfirmationErrorId}
          />
        </div>
        {showPasswordConfirmationError && (
          <div className="error-formik" id={passwordConfirmationErrorId} role="alert">
            {formik.errors.passwordConfirmation}
          </div>
        )}
      </div>
      {!loader ? (
        <Button unstyled className="btn auth-reset-submit" type="submit" data-testid="reset-submit">
          Guardar contraseña
        </Button>
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
