import { useNavigate } from "react-router-dom";
import "react-phone-input-2/lib/material.css";
import "../Modal.scss";
import { ErrorModal } from "../ErrorModal/ErrorModal";
import { useFormik } from "formik";
import * as Yup from "yup";
import { useState, useEffect } from "react";
import { Spinner } from "../../Spinner/Spinner";
import { Modal } from "react-bootstrap";
import { RiCloseCircleLine } from "react-icons/ri";
import "react-phone-input-2/lib/material.css";
import trpc from "../../../api";
import { SuccessModal } from "../SuccessModal/SuccessModal";
import { handleChangeBigint, handleChangeBigIntToNumber } from "../../../functions/functions";

interface IEditPlanModal {
    showModal: boolean;
    onHideModal: () => void;
    editingPlan: any;
    callPlans: () => void;
}

function EditPlanModal(props: IEditPlanModal) {
    const { showModal, onHideModal, editingPlan, callPlans } = props;

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
        onHideModal();
        callPlans();
    }
    const validationSchema = Yup.object().shape({
        description: Yup.string()
            .required("description is required"),
        duration: Yup.string()
            .required("duration is required"),
        name: Yup.string()
            .required("name is required"),
        price: Yup.number()
            .typeError("price must be a number")
            .required("price is required"),
    });
    const initialValues = {
        description: "",
        duration: "",
        name: "",
        price: 0,
        moneda: "",
        activated: 0,
        gigas: '',
    };
    const formik = useFormik({
        initialValues: initialValues,
        validationSchema: validationSchema,
        onSubmit: async (values) => {
            setLoader(true);
            let body = {
                description: values.description,
                duration: values.duration,
                name: values.name,
                price: Number(values.price),
                moneda: values.moneda,
                activated: Number(values.activated),
                gigas: handleChangeBigint(values.gigas),
            }
            try {
                await trpc.plans.updateOnePlans.mutate({where: {id: editingPlan.id}, data: body});
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
        if (editingPlan) {
            formik.setValues({
                    description: editingPlan.description,
                    duration: editingPlan.duration,
                    name: editingPlan.name,
                    price: Number(editingPlan.price),
                    moneda: editingPlan.moneda,
                    activated: Number(editingPlan.activated),
                    gigas: editingPlan.gigas
            });
        }
    }, [editingPlan]);

    return (
        <Modal show={showModal} onHide={onHideModal} centered>
            <form className="modal-addusers" onSubmit={formik.handleSubmit}>
                <RiCloseCircleLine className='icon' onClick={onHideModal} />
                <h2>Editar Plan</h2>
                <div className="c-row-price" style={{display: "flex", gap: 20 ,marginBottom: 20}}>
                    <p ><b>Moneda: </b>{formik.values.moneda}</p>
                    <p><b>Precio: </b>{formik.values.price}</p>
                    <p><b>Gigas: </b>{editingPlan && editingPlan.gigas.toString()}</p>
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
                        placeholder="Duration"
                        id="duration"
                        name="duration"
                        value={formik.values.duration}
                        onChange={formik.handleChange}
                        type="text"
                    />
                    {formik.errors.duration && (
                        <div className="formik">{formik.errors.duration}</div>
                    )}
                </div>
                <div className="c-row">
                    <input
                        placeholder="gigas"
                        id="gigas"
                        name="gigas"
                        value={formik.values.gigas}
                        onChange={formik.handleChange}
                        type="number"
                    />
                    {formik.errors.gigas && (
                        <div className="formik">{formik.errors.duration}</div>
                    )}
                </div>
                <div className="c-row">
                    <input
                        placeholder="Name"
                        type="name"
                        id="name"
                        name="name"
                        value={formik.values.name}
                        onChange={formik.handleChange}
                    />
                    {formik.errors.name && (
                        <div className="formik">{formik.errors.name}</div>
                    )}
                </div>
                <div className="c-row">
                    {/* <label htmlFor="paymentMethod">Método de Pago</label>
          <br/> */}
                    <select
                        id="activated"
                        name="activated"
                        value={formik.values.activated}
                        onChange={formik.handleChange}
                    >
                        <option value="1">Activo</option>
                        <option value="0">No Activo</option>
                    </select>
                </div>
                {
                    !loader
                        ? <button className="btn-option-4" type="submit">Editar Plan</button>
                        : <div style={{marginBottom: 10}}><Spinner size={3} width={.3} color="#00e2f7" /></div>
                }
                <button className="btn-cancel" onClick={onHideModal} type="reset">Cancelar</button>
                <ErrorModal show={show} onHide={closeModal} message={errorMessage} />
                <SuccessModal
                    show={showSuccess}
                    onHide={closeSuccess}
                    message="Se ha actualizado su plan con éxito!"
                    title="Edición Exitoso"
                />
            </form>
        </Modal>
    );
}

export default EditPlanModal;
