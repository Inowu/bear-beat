import { useNavigate } from "react-router-dom";
import "../Modal.scss";
import { ErrorModal } from "../ErrorModal/ErrorModal";
import { useFormik } from "formik";
import * as Yup from "yup";
import { useState } from "react";
import { Spinner } from "../../Spinner/Spinner";
import { SuccessModal } from "../SuccessModal/SuccessModal";
import { Modal } from "react-bootstrap";
import { XCircle } from "lucide-react";
import trpc from "../../../api";
import { handleChangeBigint } from "../../../functions/functions";
import { ICreatePlans } from "../../../interfaces/Plans";

interface IAddPlanModal {
  showModal: boolean;
  onHideModal: () => void;
  callPlans: () => void;
}

function AddPlanModal(props: IAddPlanModal) {
  const { showModal, onHideModal, callPlans } = props;
  // const navigate = useNavigate();
  const [loader, setLoader] = useState<boolean>(false);
  const [show, setShow] = useState<boolean>(false);
  const [showSuccess, setShowSuccess] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<any>("");
  const closeModal = () => {
    setShow(false);
  };
  const closeSuccess = () => {
    setShowSuccess(false);
    callPlans();
    // navigate("/");
  };
  const validationSchema = Yup.object().shape({
    description: Yup.string().required("La descripción es requerida"),
    interval: Yup.string().required("Este campo es obligatorio"),
    name: Yup.string().required("El nombre es requerido"),
    price: Yup.number()
      .typeError("El precio debe ser un número")
      .required("El precio es requerido")
      .min(1, "El precio no puede ser 0"),
    paymentMethod: Yup.string().required("El método de pago es requerido"),
    gigas: Yup.string().required("Este campo es obligatorio"),
  });
  const initialValues: ICreatePlans = {
    description: "",
    interval: "month",
    name: "",
    price: "",
    paymentMethod: "",
    moneda: "usd",
    homedir: "/home/products/",
    stripe_prod_id_test: "",
    gigas: "",
    duration: "",
  };
  const formik = useFormik({
    initialValues: initialValues,
    validationSchema: validationSchema,
    onSubmit: async (values) => {
      setLoader(true);
      let body = {
        description: values.description,
        name: values.name,
        price: values.price,
        moneda: values.moneda,
        homedir: values.homedir,
        stripe_prod_id_test: values.stripe_prod_id_test,
        duration: values.interval === "month" ? "30" : "365",
        gigas: handleChangeBigint(values.gigas),
      };
      try {
        if (values.paymentMethod === "stripe") {
          await trpc.plans.createStripePlan.mutate({
            data: body,
            interval: values.interval,
          });
        } else if (values.paymentMethod === "paypal") {
          body.moneda = body.moneda.toUpperCase();
          await trpc.plans.createPaypalPlan.mutate({
            data: body,
            where: { id: 0 },
            interval: values.interval,
          });
        }
        formik.resetForm();
        setShowSuccess(true);
        setLoader(false);
      } catch (error: any) {
        setShow(true);
        setErrorMessage(error.message);
        setLoader(false);
      }
    },
  });
  return (
    <Modal show={showModal} onHide={onHideModal} centered>
      <form className="modal-addusers" onSubmit={formik.handleSubmit}>
        <XCircle className="icon" onClick={onHideModal} aria-label="Cerrar" />
        <h2>Crear Plan</h2>
        <div className="c-row">
          <label>Plan Name</label>
          <input
            placeholder="Name"
            type="text"
            id="name"
            name="name"
            value={formik.values.name}
            onChange={formik.handleChange}
          />
          {formik.touched.name && formik.errors.name && (
            <div className="formik">{formik.errors.name}</div>
          )}
        </div>
        <div className="c-row">
          <label>Description</label>
          <input
            placeholder="Description"
            type="text"
            id="description"
            name="description"
            value={formik.values.description}
            onChange={formik.handleChange}
          />
          {formik.touched.description && formik.errors.description && (
            <div className="formik">{formik.errors.description}</div>
          )}
        </div>
        <div className="c-row">
          <label>Duration</label>
          <select
            id="interval"
            defaultValue={formik.values.interval}
            onChange={formik.handleChange}
          >
            <option value={"month"}>Mes</option>
            <option value={"year"}>Año</option>
          </select>
          {formik.touched.interval && formik.errors.interval && (
            <div className="formik">{formik.errors.interval}</div>
          )}
        </div>
        <div className="c-row">
          <label>Gigas (gb)</label>
          <input
            placeholder="gigas (GB)"
            type="number"
            id="gigas"
            name="gigas"
            value={formik.values.gigas}
            onChange={formik.handleChange}
          />
          {formik.touched.gigas && formik.errors.gigas && (
            <div className="error-formik">{formik.errors.gigas}</div>
          )}
        </div>
        <div className="c-row">
          <label>Curreny / Price</label>
          <div className="c-row-price">
            <select
              id="moneda"
              value={formik.values.moneda}
              onChange={formik.handleChange}
            >
              <option value="USD">USD</option>
              <option value="MXN">MXN</option>
            </select>
            <input
              placeholder="Price"
              type="number"
              id="price"
              name="price"
              value={formik.values.price}
              onChange={formik.handleChange}
            />
            {formik.touched.price && formik.errors.price && (
              <div className="error-formik">{formik.errors.price}</div>
            )}
          </div>
        </div>
        <div className="c-row">
          {/* <label htmlFor="paymentMethod">Método de Pago</label>
          <br/> */}
          <label>Payment Type</label>
          <select
            id="paymentMethod"
            name="paymentMethod"
            value={formik.values.paymentMethod}
            onChange={formik.handleChange}
          >
            <option value="">Choose a payment method</option>
            <option value="stripe">Stripe</option>
            <option value="paypal">PayPal</option>
          </select>
          {formik.touched.paymentMethod && formik.errors.paymentMethod && (
            <div className="error-formik">{formik.errors.paymentMethod}</div>
          )}
        </div>
        {!loader ? (
          <button className="btn-option-4" type="submit">
            Crear Plan
          </button>
        ) : (
          <div style={{ marginBottom: 10 }}>
            <Spinner size={3} width={0.3} color="var(--app-accent)" />
          </div>
        )}
        <button className="btn-cancel" onClick={onHideModal} type="reset">
          Cancelar
        </button>
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
