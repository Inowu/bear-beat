import "../Modal.scss";
import "./VerifyUpdatePhoneModal.scss";
import { ErrorModal } from "../ErrorModal/ErrorModal";
import { Modal } from "react-bootstrap";
import { of } from "await-of";
import { Spinner } from "../../Spinner/Spinner";
import { SuccessModal } from "../SuccessModal/SuccessModal";
import { useFormik } from "formik";
import { useEffect, useState } from "react";
import * as Yup from "yup";
import trpc from "../../../api";
import PhoneInput from "react-phone-input-2";
import es from "react-phone-input-2/lang/es.json";
import { findCountryCode, twoDigitsCountryCodes } from "../../../utils/country_codes";

interface IVerifyPhoneModal {
  showModal: boolean;
  onHideModal: () => void;
  onDismissModal?: () => void;
  newUserPhone: string;
}

export function VerifyUpdatePhoneModal(props: IVerifyPhoneModal) {
  const { showModal, onHideModal, onDismissModal, newUserPhone } = props;
  const [loader, setLoader] = useState<boolean>(false);
  const [sendingCodeLoader, setSendingCodeLoader] = useState<boolean>(false);
  const [show, setShow] = useState<boolean>(false);
  const [showSuccess, setShowSuccess] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<any>("");
  const [code, setCode] = useState<string>("52");
  const [countryCode, setCountryCode] = useState<string>("mx");
  const [disableConfirmPhone, setDisableConfirmPhone] = useState<boolean>(true);
  const [codeSent, setCodeSent] = useState<boolean>(false);
  const [deliveryChannel, setDeliveryChannel] = useState<"whatsapp" | "sms" | null>(null);

  const closeModal = () => {
    setShow(false);
  };

  const closeSuccess = () => {
    setShowSuccess(false);
    onHideModal();
  };

  const closeWithoutVerify = () => {
    onDismissModal?.();
  };

  const validationSchema = Yup.object().shape({
    code: Yup.string().required("El código es requerido").length(6, "El código debe tener 6 digitos"),
    phone: Yup.string()
      .required("El teléfono es requerido")
      .matches(/^[0-9]{7,14}$/, "El teléfono no es válido"),
  });

  const initialValues = {
    code: "",
    phone: newUserPhone,
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
        code: values.code,
        phoneNumber: `+${code} ${values.phone}`,
      };

      const [verifyingPhone, errorUpdate] = await of(trpc.auth.verifyPhone.mutate(body));

      if (errorUpdate || !verifyingPhone) {
        setShow(true);
        setErrorMessage(errorUpdate?.message);
        setLoader(false);
      } else {
        if (!verifyingPhone.success) {
          setShow(true);
          setErrorMessage(verifyingPhone.message);
          setLoader(false);
          return;
        }
        setShowSuccess(true);
        setLoader(false);
      }
    },
  });

  const confirmPhone = async () => {
    setSendingCodeLoader(true);
    const phone = formik.values.phone;

    const [verification, errorVerification] = await of(
      trpc.auth.sendVerificationCode.mutate({
        phoneNumber: `+${code} ${phone}`,
      })
    );

    if (errorVerification || !verification) {
      setShow(true);
      setErrorMessage(errorVerification?.message);
    } else {
      setDisableConfirmPhone(false);
      setCodeSent(true);
      // Backend may fall back to SMS if WhatsApp delivery fails.
      const channel = (verification as any)?.channel;
      setDeliveryChannel(channel === "sms" ? "sms" : channel === "whatsapp" ? "whatsapp" : null);
    }
    setSendingCodeLoader(false);
  };

  useEffect(() => {
    let dialCode = "52";
    let phoneNumber = newUserPhone;

    if (newUserPhone) {
      if (newUserPhone.includes(" ")) {
        dialCode = newUserPhone.trim().split(" ")[0].replace("+", "");
        phoneNumber = newUserPhone.trim().split(" ")[1];
        setCountryCode(findCountryCode(newUserPhone.trim().split(" ")[0]));
      } else {
        phoneNumber = "";
      }
    }

    formik.setFieldValue("phone", phoneNumber);
    setCountryCode(findCountryCode(newUserPhone.trim().split(" ")[0]));
    setCode(dialCode);
  }, [newUserPhone]);

  useEffect(() => {
    if (showModal) {
      setDisableConfirmPhone(true);
      setCodeSent(false);
      setDeliveryChannel(null);
      formik.setFieldValue("code", "");
    }
  }, [showModal]);

  return (
    <Modal show={showModal} centered onHide={closeWithoutVerify}>
      <form className="modal-addusers" onSubmit={formik.handleSubmit}>
        <h2>Verificar Teléfono</h2>
        <p>Confirme su numero de telefono para enviarle el codigo de verificacion.</p>
        <div className="c-row2">
          <PhoneInput
            containerClass="dial-container"
            buttonClass="dial-code"
            country={countryCode}
            placeholder="Teléfono"
            localization={es}
            onChange={handlePhoneNumberChange}
            preferredCountries={["mx", "us", "ca", "es"]}
            onlyCountries={twoDigitsCountryCodes.map((c) => c.toLowerCase())}
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
          {!sendingCodeLoader ? (
            <button
              type="button"
              className="btn-option-4"
              onClick={confirmPhone}
              disabled={sendingCodeLoader}
            >
              {codeSent ? "Reenviar" : "Enviar"}
            </button>
          ) : (
            <div style={{ marginBottom: 10 }}>
              <Spinner size={3} width={0.3} color="var(--app-accent)" />
            </div>
          )}
        </div>
        {codeSent && (
          <div className="c-row">
            <p>
              Se ha enviado el código a{" "}
              {deliveryChannel === "sms"
                ? "tu SMS"
                : deliveryChannel === "whatsapp"
                  ? "tu WhatsApp"
                  : "tu teléfono"}
              .
            </p>
          </div>
        )}

        <div className="c-row">
          <label>Código</label>
          <input
            placeholder="Código"
            type="text"
            id="code"
            name="code"
            value={formik.values.code}
            onChange={formik.handleChange}
          />
          {formik.errors.code && <div className="formik">{formik.errors.code}</div>}
        </div>
        {!loader ? (
          <button className="btn-option-4" type="submit" disabled={disableConfirmPhone}>
            Confirmar
          </button>
        ) : (
          <div style={{ marginBottom: 10 }}>
            <Spinner size={3} width={0.3} color="var(--app-accent)" />
          </div>
        )}
        <button type="button" className="btn-option-5" onClick={closeWithoutVerify}>
          Ahora no
        </button>
        <ErrorModal show={show} onHide={closeModal} message={errorMessage} />
        <SuccessModal
          show={showSuccess}
          onHide={closeSuccess}
          message="Su cuenta ha sido verificada"
          title="Verificación Exitosa"
        />
      </form>
    </Modal>
  );
}
