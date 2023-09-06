import { Link, useNavigate } from "react-router-dom";
import { ReactComponent as Arrow } from "../../../assets/icons/arrow-down.svg";
import trpc from "../../../api";
import { useFormik } from 'formik';
import * as Yup from 'yup';
import { useState } from "react";
import { ErrorModal } from "components/Modals/ErrorModal/ErrorModal";
import { SuccessModal } from "components/Modals/SuccessModal/SuccessModal";

function ForgotPasswordForm() {
  const navigate = useNavigate();
  const [loader, setLoader] = useState<boolean>(false);
  const [show, setShow] = useState<boolean>(false);
  const [showSuccess, setShowSuccess] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<any>('');
  const closeError = () => {
    setShow(false);
  }
  const closeSuccess = () => {
    setShowSuccess(false);
  }
  const validationSchema = Yup.object().shape({
    email:  Yup.string()
    .required('Email is required')
    .email('Invalid email format'),
});
  const initialValues = {
    email: '',
  };
  const formik = useFormik({
    initialValues: initialValues,
    validationSchema: validationSchema,
    onSubmit: async (values) => {
        setLoader(true);
        let body = {
          email: values.email,
        }
        try{
          setLoader(false);
          setShowSuccess(true);
        }
        catch(error){
          setShow(true);
          setErrorMessage(error);
          setLoader(false);
        }
    },
  });
  return (
    <form onSubmit={formik.handleSubmit}>
      <h2>CAMBIAR CONTRASEÑA</h2>
      <div className="c-row">
        <input placeholder="E-mail" type="text" />
      </div>
      <button className="btn" type="submit">ENVIAR LINK</button>
      <div className="c-row">
        <Link to={"/auth"}>
          <Arrow className="arrow" />
          Ya tengo cuenta
        </Link>
      </div>
      <ErrorModal show={show} onHide={closeError} message={errorMessage}/>
      <SuccessModal show={showSuccess} onHide={closeSuccess} message= "Revise las instrucciones en su correo para realizar el cambio de contraseña" title ="Correo enviado!"/> 
    </form>
  );
}

export default ForgotPasswordForm;
