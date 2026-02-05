import "../Modal.scss";
import { ErrorModal } from "../ErrorModal/ErrorModal";
import { Modal } from "react-bootstrap";
import { of } from "await-of";
import { Spinner } from "../../Spinner/Spinner";
import { SuccessModal } from "../SuccessModal/SuccessModal";
import { useFormik } from "formik";
import { useEffect, useState } from "react";
import * as Yup from "yup";
import trpc from "../../../api";


interface IAddInstructions {
    showModal: boolean;
    onHideModal: () => void;
    videoURL: string;
    videoId: number;
}

export function AddInstructionsModal(props: IAddInstructions) {
    const { showModal, onHideModal, videoURL, videoId } = props;
    const [loader, setLoader] = useState<boolean>(false);
    const [show, setShow] = useState<boolean>(false);
    const [showSuccess, setShowSuccess] = useState<boolean>(false);
    const [errorMessage, setErrorMessage] = useState<any>("");

    const closeModal = () => {
        setShow(false);
    };

    const closeSuccess = () => {
        setShowSuccess(false);
        onHideModal();
        window.location.reload();
    };

    const validationSchema = Yup.object().shape({
        video: Yup.string().url('Este URL no es valido')
    });

    const initialValues = {
        video: "",
    };

    const formik = useFormik({
        initialValues: initialValues,
        validationSchema: validationSchema,
        onSubmit: async (values) => {
            setLoader(true);
            const body = {
                where: { id: videoId },
                data: { value: values.video }
            };

            console.log(body)
            const [updateVideoUrl, errorUpdate] = await of(trpc.config.updateOneConfig.mutate(body));

            if (errorUpdate || !updateVideoUrl) {
                setShow(true);
                setErrorMessage(errorUpdate?.message);
                setLoader(false);
            } else {
                setShowSuccess(true);
                setLoader(false);
            }
        },
    });

    useEffect(() => {
        if (videoURL) {
          formik.setValues({
            video: videoURL,
          });
        }
      }, [videoURL]);

    return (
        <Modal show={showModal} centered>
            <form className="modal-addusers" onSubmit={formik.handleSubmit}>
                <h2>Agregar video a Instrucciones</h2>
                <p>Proporcione el link del video embebido para instrucciones.</p>
                <div className="c-row">
                    <label>Vídeo URL</label>
                    <input
                        placeholder="URL"
                        type="url"
                        id="video"
                        name="video"
                        value={formik.values.video}
                        onChange={formik.handleChange}
                    />
                    {formik.errors.video && (
                        <div className="formik">{formik.errors.video}</div>
                    )}
                </div>
                {!loader ? (
                    <button className="btn-option-4" type="submit">
                        Confirmar
                    </button>
                ) : (
                    <div style={{ marginBottom: 10 }}>
                        <Spinner size={3} width={0.3} color="var(--app-accent)" />
                    </div>
                )}
                <ErrorModal show={show} onHide={closeModal} message={errorMessage} />
                <SuccessModal
                    show={showSuccess}
                    onHide={closeSuccess}
                    message="Las instrucciones han sido actualizadas"
                    title="Modificación exitosa"
                />
            </form>
        </Modal>
    );
}