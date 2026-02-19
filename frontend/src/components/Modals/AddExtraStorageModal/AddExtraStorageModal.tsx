import "../Modal.scss";
import "./AddExtraStorageModal.scss";
import { ErrorModal } from "../ErrorModal/ErrorModal";
import { handleChangeBigint } from "../../../functions/functions";
import { Modal } from "src/components/ui";
import { of } from "await-of";
import { XCircle } from "src/icons";
import { Spinner } from "../../Spinner/Spinner";
import { SuccessModal } from "../SuccessModal/SuccessModal";
import { useCallback, useEffect, useState } from "react";
import { useFormik } from "formik";
import { useNavigate } from "react-router-dom";
import * as Yup from "yup";
import trpc from "../../../api";
import { Button, Input } from "src/components/ui";

interface IVerifyPhoneModal {
    showModal: boolean;
    onHideModal: () => void;
    userId: number;
}

export function AddExtraStorageModal(props: IVerifyPhoneModal) {
    const { showModal, onHideModal, userId } = props;
    const navigate = useNavigate();
    const [loader, setLoader] = useState<boolean>(false);
    const [show, setShow] = useState<boolean>(false);
    const [showSuccess, setShowSuccess] = useState<boolean>(false);
    const [errorMessage, setErrorMessage] = useState<any>("");
    const [currentGB, setCurrentGB] = useState<number>(0);
    const [quotaId, setQuotaId] = useState<number>(0);
    const [disableAddButton, setDisableAddButton] = useState<boolean>(false);

    const closeModal = () => {
        setShow(false);
    };

    const closeSuccess = () => {
        setShowSuccess(false);
        onHideModal();
        setQuotaId(0);
        setCurrentGB(0);
        navigate("/admin/usuarios");
    };

    const validationSchema = Yup.object().shape({
        additionalGigas: Yup.number().required("Debes ingresar una cantidad").moreThan(0, "Debes ingresar una cantidad mayor que 0 GB")
    });

    const initialValues = {
        additionalGigas: 1,
    };

    const formik = useFormik({
        initialValues: initialValues,
        validationSchema: validationSchema,
        onSubmit: async (values) => {
            setLoader(true);

            const newGigasLimit = values.additionalGigas + currentGB;
            const [updateQuotas, errorUpdate] = await of(trpc.ftpquotalimits.addAdditionalGBToQuotaLimit.mutate({quotaId, gigas: newGigasLimit}));

            if (errorUpdate || !updateQuotas) {
                setShow(true);
                setErrorMessage(errorUpdate?.message);
                setLoader(false);
            } else {
                setShowSuccess(true);
                setLoader(false);
            }
        },
    });

    const getQuotaLimits = useCallback(async () => {
        setLoader(true);

        const [quotaLimits, errorQuota] = await of(trpc.ftpquotalimits.findManyFtpQuotaLimitsByUser.query({ userId }));
        if (errorQuota || !quotaLimits) {
            setCurrentGB(0);
            setDisableAddButton(true);
            setQuotaId(0);
        } else {
            setCurrentGB(Number(quotaLimits.bytes_out_avail) / (1024 * 1024 * 1024));
            setDisableAddButton(false);
            setQuotaId(quotaLimits.id);
        }
        setLoader(false);
    }, [userId])

    useEffect(() => { getQuotaLimits() }, [getQuotaLimits])


    return (
        <Modal show={showModal} onHide={onHideModal} centered>
            <form className="modal-addusers" onSubmit={formik.handleSubmit}>
                <XCircle className="icon" onClick={onHideModal} aria-label="Cerrar" />
                <h2>Agregar GBs adicionales</h2>
                <p>El usuario cuenta con {currentGB} GBs actualmente.</p>
                <div className="c-row">
                    <label>GB a agregar</label>
                    <Input
                        placeholder="Gigas"
                        type="number"
                        id="additionalGigas"
                        name="additionalGigas"
                        value={formik.values.additionalGigas}
                        onChange={formik.handleChange}
                    />
                    {formik.errors.additionalGigas && (
                        <div className="formik">{formik.errors.additionalGigas}</div>
                    )}
                </div>
                {!loader ? (
                    <Button unstyled className="btn-option-4" type="submit" disabled={disableAddButton}>
                        Agregar
                    </Button>
                ) : (
                    <div style={{ marginBottom: 10 }}>
                        <Spinner size={3} width={0.3} color="var(--app-accent)" />
                    </div>
                )}
                <ErrorModal show={show} onHide={closeModal} message={errorMessage} />
                <SuccessModal
                    show={showSuccess}
                    onHide={closeSuccess}
                    message="Se han agregado los GB adicionales al usuario"
                    title="Limite actualizado"
                />
            </form>
        </Modal>
    );
}
