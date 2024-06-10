import "../Modal.scss";
import "./VerifyUpdatePhoneModal.scss";
import { ErrorModal } from "../ErrorModal/ErrorModal";
import { Modal } from "react-bootstrap";
import { of } from "await-of";
import { Spinner } from "../../Spinner/Spinner";
import { SuccessModal } from "../SuccessModal/SuccessModal";
import { useFormik } from "formik";
import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import * as Yup from "yup";
import trpc from "../../../api";
import PhoneInput from "react-phone-input-2";
import es from "react-phone-input-2/lang/es.json";
import { findCountryCode } from "../../../utils/country_codes";

interface IVerifyPhoneModal {
    showModal: boolean;
    onHideModal: () => void;
    newUserId: number;
    newUserPhone: string;
}

export function VerifyUpdatePhoneModal(props: IVerifyPhoneModal) {
    const { showModal, onHideModal, newUserId, newUserPhone } = props;
    const navigate = useNavigate();
    const [loader, setLoader] = useState<boolean>(false);
    const [sendingCodeLoader, setSendingCodeLoader] = useState<boolean>(false);
    const [show, setShow] = useState<boolean>(false);
    const [showSuccess, setShowSuccess] = useState<boolean>(false);
    const [errorMessage, setErrorMessage] = useState<any>("");
    const [code, setCode] = useState<string>("52");
    const [countryCode, setCountryCode] = useState<string>('mx');
    const [disableConfirmPhone, setDisableConfirmPhone] = useState<boolean>(true);
    const [disableSendCode, setDisableSendCode] = useState<boolean>(false);
    const [codeSent, setCodeSent] = useState<boolean>(false);

    const closeModal = () => {
        setShow(false);
    };

    const closeSuccess = () => {
        setShowSuccess(false);
        onHideModal();
        navigate("/");
    };

    const validationSchema = Yup.object().shape({
        code: Yup.string().required("El código es requerido").length(6, "El código debe tener 6 digitos"),
        phone: Yup.string()
            .required("El teléfono es requerido")
            .matches(/^[0-9]{7,10}$/, "El teléfono no es válido"),
    });

    const initialValues = {
        code: "",
        phone: newUserPhone
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
                userId: newUserId,
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
                }
                setShowSuccess(true);
                setLoader(false);
            }
        },
    });

    const confirmPhone = async () => {
        setSendingCodeLoader(true);
        const phone = formik.values.phone;

        const [verification, errorVerification] = await of(trpc.auth.sendVerificationCode.mutate({
            userId: newUserId,
            phoneNumber: `+${code} ${phone}`
        }))

        if (errorVerification || !verification) {
            setShow(true);
            setErrorMessage(errorVerification?.message);
        } else {
            setDisableSendCode(true);
            setDisableConfirmPhone(false);
            setCodeSent(true);
        }
        setSendingCodeLoader(false);

    }

    useEffect(() => {
        let dialCode = "52";
        let phoneNumber = newUserPhone;

        if (newUserPhone) {
            if (newUserPhone.includes(" ")) {
              dialCode = newUserPhone.trim().split(" ")[0].replace("+", "");
              phoneNumber = newUserPhone.trim().split(" ")[1];
              setCountryCode(findCountryCode(newUserPhone.trim().split(" ")[0]));
            } else {
              phoneNumber = ""
            }
          }

        formik.setFieldValue('phone', phoneNumber);
        setCountryCode(findCountryCode(newUserPhone.trim().split(" ")[0]));
        setCode(dialCode);
    }, [newUserPhone])
    
    return (
        <Modal show={showModal} centered>
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
                    {formik.errors.phone && (
                        <div className="error-formik">{formik.errors.phone}</div>
                    )}
                    {!sendingCodeLoader ? (
                        <button className="btn-option-4" onClick={confirmPhone} disabled={disableSendCode}>
                            Enviar
                        </button>
                    ) : (
                        <div style={{ marginBottom: 10 }}>
                            <Spinner size={3} width={0.3} color="#00e2f7" />
                        </div>
                    )}
                </div>
                {codeSent && (
                    <div className="c-row">
                        <p>Se ha enviado el codigo a su WhatsApp</p>
                    </div>
                )}

                <div className="c-row">
                    <label>Código</label>
                    <input
                        placeholder="Código"
                        type="name"
                        id="code"
                        name="code"
                        value={formik.values.code}
                        onChange={formik.handleChange}
                    />
                    {formik.errors.code && (
                        <div className="formik">{formik.errors.code}</div>
                    )}
                </div>
                {!loader ? (
                    <button className="btn-option-4" type="submit" disabled={disableConfirmPhone}>
                        Confirmar
                    </button>
                ) : (
                    <div style={{ marginBottom: 10 }}>
                        <Spinner size={3} width={0.3} color="#00e2f7" />
                    </div>
                )}
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