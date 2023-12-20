import "../Modal.scss";
import { ErrorModal } from "../ErrorModal/ErrorModal";
import { useFormik } from "formik";
import * as Yup from "yup";
import { useState, useEffect } from "react";
import { Spinner } from "../../Spinner/Spinner";
import { Modal } from "react-bootstrap";
import { RiCloseCircleLine } from "react-icons/ri";
import trpc from "../../../api";
import { SuccessModal } from "../SuccessModal/SuccessModal";

interface IEditCouponModal {
    showModal: boolean;
    onHideModal: () => void;
    editingCoupon: any;
}

export const EditCouponModal = (props: IEditCouponModal) => {

    const { showModal, onHideModal, editingCoupon } = props;

    // const navigate = useNavigate();
    const [loader, setLoader] = useState<boolean>(false);
    const [show, setShow] = useState<boolean>(false);
    const [showSuccess, setShowSuccess] = useState<boolean>(false);
    const [errorMessage, setErrorMessage] = useState<any>('');
    const closeModal = () => {
        setShow(false);
    }
    const closeSuccess = () => {
        setShowSuccess(false);
        // navigate("/");
    }

    const validationSchema = Yup.object().shape({
        description: Yup.string()
            .required("description is required"),

        active: Yup.string()
            .required("active is required"),
    });
    const initialValues = {
        code: "",
        description: "",
        discount: 0,
        active: 0,
        type: 1
    };
    const formik = useFormik({
        initialValues: initialValues,
        validationSchema: validationSchema,
        onSubmit: async (values) => {
            setLoader(true);
            let body = {
                // code: values.code,
                description: values.description,
                // discount: Number(values.discount),
                active: Number(values.active),
                // type: Number(values.type)
            }
            try {
                await trpc.cupons.updateStripeCupon.mutate({ where: { id: editingCoupon.id }, data: body });
                // console.log(body);
                setShowSuccess(true);
                setLoader(false);
            }
            catch (error) {
                setShow(true);
                setErrorMessage(error);
                setLoader(false)
            }
        },
    });

    useEffect(() => {
        if (editingCoupon) {
            formik.setValues({
                code: editingCoupon.code,
                description: editingCoupon.description,
                discount: Number(editingCoupon.discount),
                active: Number(editingCoupon.active),
                type: 1,
            });
        }
    }, [editingCoupon]);

    return (
        <Modal show={showModal} onHide={onHideModal} centered>
            <form className="modal-addusers" onSubmit={formik.handleSubmit}>
                <RiCloseCircleLine className='icon' onClick={onHideModal} />
                <h2>Crear Cupon</h2>
                <div className="c-row">
                    <input
                    disabled
                        placeholder="Code"
                        type="text"
                        id="code"
                        name="code"
                        value={formik.values.code}
                        onChange={formik.handleChange}
                    />
                    {formik.errors.code && (
                        <div className="formik">{formik.errors.code}</div>
                    )}
                </div>
                <div className="c-row">
                    <input
                        placeholder="Description"
                        type="text"
                        id="description"
                        name="description"
                        value={formik.values.description}
                        onChange={formik.handleChange}
                    />
                    {formik.errors.description && (
                        <div className="formik">{formik.errors.description}</div>
                    )}
                </div>
                <div className="c-row">
                    <input
                        disabled
                        placeholder="Discount"
                        id="discount"
                        name="discount"
                        value={formik.values.discount}
                        onChange={formik.handleChange}
                        type="text"
                    />
                    {formik.errors.discount && (
                        <div className="formik">{formik.errors.discount}</div>
                    )}
                </div>
                <div className="c-row">
                    <select
                        id="active"
                        name="active"
                        value={formik.values.active}
                        onChange={formik.handleChange}
                    >
                        <option value="">Choose a Option</option>
                        <option value="1">Active</option>
                        <option value="0">No Active</option>
                    </select>
                    {formik.errors.active && (
                        <div className="formik">{formik.errors.active}</div>
                    )}
                </div>
                {
                    !loader
                        ? <button className="btn-option-4" type="submit">Modificar Cupon</button>
                        : <Spinner size={3} width={.3} color="#00e2f7" />
                }
                <button className="btn-cancel" onClick={onHideModal} type="reset">Cancelar</button>
                <ErrorModal show={show} onHide={closeModal} message={errorMessage} />
                <SuccessModal
                    show={showSuccess}
                    onHide={closeSuccess}
                    message="Se ha modificado su cupon con éxito!"
                    title="Modificación Exitosa"
                />
            </form>
        </Modal>
    )
}
