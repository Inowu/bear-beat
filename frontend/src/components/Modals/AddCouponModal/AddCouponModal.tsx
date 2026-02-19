import "../Modal.scss";
import { ErrorModal } from "../ErrorModal/ErrorModal";
import { useFormik } from "formik";
import * as Yup from "yup";
import { useState } from "react";
import { Spinner } from "../../Spinner/Spinner";
import { SuccessModal } from "../SuccessModal/SuccessModal";
import { Modal } from "src/components/ui";
import { XCircle } from "src/icons";
import trpc from "../../../api";
import { Button, Input, Select } from "src/components/ui";

interface IAddCouponModal {
  showModal: boolean;
  onHideModal: () => void;
  getCoupons: () => void;
}

export const AddCouponModal = (props: IAddCouponModal) => {
  const { showModal, onHideModal, getCoupons } = props;

  // const navigate = useNavigate();
  const [loader, setLoader] = useState<boolean>(false);
  const [show, setShow] = useState<boolean>(false);
  const [showSuccess, setShowSuccess] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<any>("");
  const closeModal = () => {
    setShow(false);
  };
  const closeSuccess = () => {
    onHideModal();
    setShowSuccess(false);
    // navigate("/");
  };
  const validationSchema = Yup.object().shape({
    code: Yup.string().required("El código es requerido"),
    description: Yup.string().required("La descripción es requerido"),
    discount: Yup.number()
      .required("El descuento es requerido")
      .typeError("El descuento debe ser un número"),
    active: Yup.string().required("Este campo es obligatorio"),
  });
  const initialValues = {
    code: "",
    description: "",
    discount: 0,
    active: 0,
    type: 1,
  };
  const formik = useFormik({
    initialValues: initialValues,
    validationSchema: validationSchema,
    onSubmit: async (values) => {
      setLoader(true);
      let body = {
        code: values.code,
        description: values.description,
        discount: Number(values.discount),
        active: Number(values.active),
        type: Number(values.type),
      };
      try {
        await trpc.cupons.createStripeCupon.mutate({ data: body });
        // console.log(body);
        getCoupons();
        setShowSuccess(true);
        setLoader(false);
      } catch (error) {
        setShow(true);
        setErrorMessage(error);
        setLoader(false);
      }
    },
  });

  return (
    <Modal show={showModal} onHide={onHideModal} centered>
      <form className="modal-addusers" onSubmit={formik.handleSubmit}>
        <XCircle className="icon" onClick={onHideModal} aria-label="Cerrar" />
        <h2>Crear Cupon</h2>
        <div className="c-row">
          <Input
            placeholder="Code"
            type="text"
            id="code"
            name="code"
            value={formik.values.code}
            onChange={formik.handleChange}
          />
          {formik.errors.code && (
            <div className="error-formik">{formik.errors.code}</div>
          )}
        </div>
        <div className="c-row">
          <Input
            placeholder="Description"
            type="text"
            id="description"
            name="description"
            value={formik.values.description}
            onChange={formik.handleChange}
          />
          {formik.errors.description && (
            <div className="error-formik">{formik.errors.description}</div>
          )}
        </div>
        <div className="c-row">
          <Input
            placeholder="Discount"
            id="discount"
            name="discount"
            value={formik.values.discount}
            onChange={formik.handleChange}
            type="text"
          />
          {formik.errors.discount && (
            <div className="error-formik">{formik.errors.discount}</div>
          )}
        </div>
        <div className="c-row">
          <Select
            id="active"
            name="active"
            value={formik.values.active}
            onChange={formik.handleChange}
          >
            <option value="" disabled>
              Choose a Option
            </option>
            <option value="1">Active</option>
            <option value="0">No Active</option>
          </Select>
          {formik.errors.active && (
            <div className="error-formik">{formik.errors.active}</div>
          )}
        </div>
        {!loader ? (
          <Button unstyled className="btn-option-4" type="submit">
            Crear Cupon
          </Button>
        ) : (
          <Spinner size={3} width={0.3} color="var(--app-accent)" />
        )}
        <Button unstyled className="btn-cancel" onClick={onHideModal} type="reset">
          Cancelar
        </Button>
        <ErrorModal show={show} onHide={closeModal} message={errorMessage} />
        <SuccessModal
          show={showSuccess}
          onHide={closeSuccess}
          message="Se ha añadido su cupon con éxito!"
          title="Creación Exitosa"
        />
      </form>
    </Modal>
  );
};
