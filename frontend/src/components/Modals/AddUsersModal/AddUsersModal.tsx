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
import PhoneInput from "react-phone-input-2";
import "react-phone-input-2/lib/material.css";
import es from "react-phone-input-2/lang/es.json";
import trpc from "../../../api";

interface IAddUsersModal {
  showModal: boolean;
  onHideModal: () => void;
}

function AddUsersModal(props: IAddUsersModal) {

  const { showModal, onHideModal } = props;

  // const navigate = useNavigate();
  const [loader, setLoader] = useState<boolean>(false);
  const [show, setShow] = useState<boolean>(false);
  const [code, setCode] = useState<string>('52');
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
    email: Yup.string()
      .required("Email is required")
      .email("Invalid email format"),
    username: Yup.string()
      .required('Username is required')
      .min(5, 'Username must be at least 5 characters long')
      .matches(/[a-zA-Z]/, 'Field must contain at least 1 letter')
    ,
    password: Yup.string().required('Password is required')
      .min(6, 'Password must contain 6 characters atleast'),
    passwordConfirmation:
      Yup.string().required('Confirmation Password is required')
        .oneOf([Yup.ref('password')], 'Both should be the same'),
  });
  const initialValues = {
    username: "",
    password: "",
    phone: "",
    email: "",
    passwordConfirmation: "",
  };
  const handlePhoneNumberChange = (value:any, country:any) => {
    setCode(country.dialCode);
  };
  const formik = useFormik({
    initialValues: initialValues,
    validationSchema: validationSchema,
    onSubmit: async (values) => {
      setLoader(true);
      let body = {
        username: values.username,
        password: values.password,
        email: values.email,
        phone: `+${code} ${values.phone}`,
      }
      try {
        await trpc.users.createOneUsers.mutate({data: body});
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
        <h2>Añadir Usuario</h2>
        <div className="c-row">
          <input
            placeholder="Username"
            type="text"
            id="username"
            name="username"
            value={formik.values.username}
            onChange={formik.handleChange}
          />
          {formik.errors.username && (
            <div className="formik">{formik.errors.username}</div>
          )}
        </div>
        <div className="c-row">
          <input
            placeholder="E-mail"
            id="email"
            name="email"
            value={formik.values.email}
            onChange={formik.handleChange}
            type="text"
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
            placeholder="Phone"
            localization={es}
            onChange={handlePhoneNumberChange}
          />
          <p className="code">+{code}</p>
          <input
            className="phone"
            placeholder="Phone"
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
          <input
            placeholder="Password"
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
        <div className="c-row">
          <input
            placeholder="Repetir password"
            type="password"
            id="passwordConfirmation"
            name="passwordConfirmation"
            value={formik.values.passwordConfirmation}
            onChange={formik.handleChange}
          />
          {formik.errors.passwordConfirmation && (
            <div className="formik">
              {formik.errors.passwordConfirmation}
            </div>
          )}
        </div>
        {
          !loader
            ? <button className="btn-option-4" type="submit">Añadir Usuario</button>
            : <Spinner size={3} width={.3} color="#00e2f7" />
        }
        <button className="btn-cancel" onClick={onHideModal} type="reset">Cancelar</button>
        <ErrorModal show={show} onHide={closeModal} message={errorMessage} />
        <SuccessModal
          show={showSuccess}
          onHide={closeSuccess}
          message="Se ha añadido su usuario con éxito!"
          title="Registro Exitoso"
        />
      </form>
    </Modal>
  );
}

export default AddUsersModal;
