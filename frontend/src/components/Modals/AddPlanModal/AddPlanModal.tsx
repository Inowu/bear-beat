import { useNavigate } from "react-router-dom";
import "react-phone-input-2/lib/material.css";
import "../Modal.scss";
import { ErrorModal } from "../ErrorModal/ErrorModal";
import { useFormik } from "formik";
import * as Yup from "yup";
import { useState } from "react";
import { Spinner } from "../../Spinner/Spinner";
import { SuccessModal } from "../SuccessModal/SuccessModal";
import { Modal } from "react-bootstrap";
import { RiCloseCircleLine } from "react-icons/ri";
import "react-phone-input-2/lib/material.css";
import trpc from "../../../api";

interface IAddPlanModal {
  showModal: boolean;
  onHideModal: () => void;
}

function AddPlanModal(props: IAddPlanModal) {

  const { showModal, onHideModal } = props;

  // const navigate = useNavigate();
  const [currency, setCurrency] = useState('USD');
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
    duration: Yup.string()
      .required("duration is required"),
    name: Yup.string()
      .required("name is required"),
    price: Yup.number()
      .typeError("price must be a number")
      .required("price is required"),
    paymentMethod: Yup.string()
      .required("payment method is required"),
  });
  const initialValues = {
    description: "",
    duration: "",
    name: "",
    price: "",
    paymentMethod: "",
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
        price: values.price,
      }
      try {
        await trpc.plans.createPaypalPlan.mutate({ data: body });
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



  return (
    <Modal show={showModal} onHide={onHideModal} centered>
      <form className="modal-addusers" onSubmit={formik.handleSubmit}>
        <RiCloseCircleLine className='icon' onClick={onHideModal} />
        <h2>Crear Plan</h2>
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
        <div className="c-row-price">
          <select
            id="currency"
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
          >
            <option value="usd">USD</option>
            <option value="mxn">MXN</option>
          </select>
          <input
            placeholder="Price"
            type="price"
            id="price"
            name="price"
            value={formik.values.price}
            onChange={formik.handleChange}
          />
          {formik.errors.price && (
            <div className="formik">
              {formik.errors.price}
            </div>
          )}
        </div>
        <div className="c-row">
          {/* <label htmlFor="paymentMethod">Método de Pago</label>
          <br/> */}
          <select
            id="paymentMethod"
            name="paymentMethod"
            value={formik.values.paymentMethod}
            onChange={formik.handleChange}
          >
            <option value="">Selecciona un método de pago</option>
            <option value="stripe">Stripe</option>
            <option value="paypal">PayPal</option>
          </select>
          {formik.errors.paymentMethod && (
            <div className="formik">{formik.errors.paymentMethod}</div>
          )}
        </div>
        {
          !loader
            ? <button className="btn-option-4" type="submit">Crear Plan</button>
            : <Spinner size={3} width={.3} color="#00e2f7" />
        }
        <button className="btn-cancel" onClick={onHideModal} type="reset">Cancelar</button>
        <ErrorModal show={show} onHide={closeModal} message={errorMessage} />
        <SuccessModal
          show={showSuccess}
          onHide={closeSuccess}
          message="Se ha añadido su plan con éxito!"
          title="Registro Exitoso"
        />
      </form>
    </Modal>
  );
}

export default AddPlanModal;
