import "../Modal.scss";
import { ErrorModal } from "../ErrorModal/ErrorModal";
import { Modal } from "react-bootstrap";
import { of } from "await-of";
import { Spinner } from "../../Spinner/Spinner";
import { SuccessModal } from "../SuccessModal/SuccessModal";
import { useFormik } from "formik";
import { useNavigate } from "react-router-dom";
import { useState } from "react";
import * as Yup from "yup";
import trpc from "../../../api";


interface IVerifyPhoneModal {
    showModal: boolean;
    onHideModal: () => void;
    newUserId: number;
    newUserPhone: string;
}

export function VerifyPhoneModal(props: IVerifyPhoneModal) {
    const { showModal, onHideModal, newUserId, newUserPhone } = props;
    const navigate = useNavigate();
    const [loader, setLoader] = useState<boolean>(false);
    const [show, setShow] = useState<boolean>(false);
    const [showSuccess, setShowSuccess] = useState<boolean>(false);
    const [errorMessage, setErrorMessage] = useState<any>("");

    const closeModal = () => {
        setShow(false);
    };

    const closeSuccess = () => {
        setShowSuccess(false);
        window.location.reload();
        navigate("/");
        onHideModal();
    };

    const validationSchema = Yup.object().shape({
        code: Yup.string().required("El código es requerido").length(6, "El código debe tener 6 digitos"),
    });

    const initialValues = {
        code: "",
    };

    const formik = useFormik({
        initialValues: initialValues,
        validationSchema: validationSchema,
        onSubmit: async (values) => {
            setLoader(true);
            let body = {
                code: values.code,
                phoneNumber: newUserPhone,
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

    //   useEffect(() => {
    //     if (editingUser) {
    //       let countryCode = "52";
    //       let phoneNumber = editingUser.phone;
    //       if ( editingUser.phone && editingUser.phone.length > 10) {
    //         countryCode = editingUser.phone.slice(1, 3);
    //         phoneNumber = editingUser.phone.slice(3).trim();
    //       }

    //       formik.setValues({
    //         password: editingUser.password,
    //         email: editingUser.email,
    //         name: editingUser.username,
    //         phone: phoneNumber,
    //       });

    //       setCode(countryCode);
    //     }
    //   }, [editingUser]);

    return (
        <Modal show={showModal} centered>
            <form className="modal-addusers" onSubmit={formik.handleSubmit}>
                <h2>Verificar Teléfono</h2>
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
                    <button className="btn-option-4" type="submit">
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
                    message="Se ha actualizado la información del usuario"
                    title="Edición Exitosa"
                />
            </form>
        </Modal>
    );
}