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
import { of } from "await-of";
import PhoneInput from "react-phone-input-2";
import es from "react-phone-input-2/lang/es.json";


interface IEditPlanModal {
  showModal: boolean;
  onHideModal: () => void;
  editingUser: UserToEdit;
}

interface UserToEdit {
  id: number;
  email: string;
  password: string;
  username: string;
  phone: string;
}

function EditUserModal(props: IEditPlanModal) {
  const { showModal, onHideModal, editingUser } = props;

  // const navigate = useNavigate();
  const [loader, setLoader] = useState<boolean>(false);
  const [show, setShow] = useState<boolean>(false);
  const [showSuccess, setShowSuccess] = useState<boolean>(false);
  const [code, setCode] = useState<string>("52");
  const [errorMessage, setErrorMessage] = useState<any>("");
  const closeModal = () => {
    setShow(false);
  };
  const closeSuccess = () => {
    setShowSuccess(false);
    window.location.reload();
    onHideModal();
  };

  const validationSchema = Yup.object().shape({
    email: Yup.string().required("El correo es requerido"),
    password: Yup.string().required("Este campo es obligatorio").min(6, "La contraseña debe contener por lo menos 6 caracteres"),
    name: Yup.string().required("El nombre es requerido"),
    phone: Yup.string()
      .required("El teléfono es requerido")
      .matches(/^[0-9]{10}$/, "El teléfono no es válido"),
  });

  const handlePhoneNumberChange = (value: any, country: any) => {
    setCode(country.dialCode);
  };

  const initialValues = {
    email: "",
    password: "",
    name: "",
    phone: "",
  };

  const formik = useFormik({
    initialValues: initialValues,
    validationSchema: validationSchema,
    onSubmit: async (values) => {
      setLoader(true);
      let body = {
        email: values.email,
        username: values.name,
        password: values.password,
        phone: `+${code} ${values.phone}`,
      };
      
      const [, errorUpdate] = await of(trpc.users.updateOneUsers.mutate({
        where: {id: editingUser.id},
        data: body
      }));

      if (errorUpdate) {
        setShow(true);
        setErrorMessage(errorUpdate.message);
        setLoader(false);
      } else {
        setShowSuccess(true);
        setLoader(false);
      }
    },
  });

  useEffect(() => {
    if (editingUser) {
      let countryCode = "52";
      let phoneNumber = editingUser.phone;
      if ( editingUser.phone && editingUser.phone.length > 10) {
        countryCode = editingUser.phone.slice(1, 3);
        phoneNumber = editingUser.phone.slice(3).trim();
      }

      formik.setValues({
        password: editingUser.password,
        email: editingUser.email,
        name: editingUser.username,
        phone: phoneNumber,
      });

      setCode(countryCode);
    }
  }, [editingUser]);

  return (
    <Modal show={showModal} onHide={onHideModal} centered>
      <form className="modal-addusers" onSubmit={formik.handleSubmit}>
        <RiCloseCircleLine className="icon" onClick={onHideModal} />
        <h2>Editar Usuario</h2>
        <div className="c-row">
          <label>Nombre de usuario</label>
          <input
            placeholder="Nombre"
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
          <label>Correo</label>
          <input
            placeholder="Correo electrónico"
            type="email"
            id="email"
            name="email"
            value={formik.values.email}
            onChange={formik.handleChange}
          />
          {formik.errors.email && (
            <div className="formik">{formik.errors.email}</div>
          )}
        </div>
        <div className="c-row2">
          <PhoneInput
            containerClass="dial-container"
            buttonClass="dial-code"
            country={"mx"}
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
        </div>
        <div className="c-row">
          <label>Contraseña</label>
          <input
            placeholder="Contraseña"
            type="password"
            id="password"
            name="password"
            value={formik.values.password}
            onChange={formik.handleChange}
          />
          {formik.errors.password && (
            <div className="formik">{formik.errors.password}</div>
          )}
        </div>
        {!loader ? (
          <button className="btn-option-4" type="submit">
            Editar Usuario
          </button>
        ) : (
          <div style={{ marginBottom: 10 }}>
            <Spinner size={3} width={0.3} color="#00e2f7" />
          </div>
        )}
        <button className="btn-cancel" onClick={onHideModal} type="reset">
          Cancelar
        </button>
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

export default EditUserModal;
