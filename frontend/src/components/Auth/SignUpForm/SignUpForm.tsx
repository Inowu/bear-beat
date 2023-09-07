import { Link, useNavigate } from "react-router-dom";
import PhoneInput from "react-phone-input-2";
import "react-phone-input-2/lib/material.css";
import "./SignUpForm.scss";
import es from "react-phone-input-2/lang/es.json";
import { ReactComponent as Arrow } from "../../../assets/icons/arrow-down.svg";
import { useUserContext } from "../../../contexts/UserContext";
import { ErrorModal } from "../../../components/Modals/ErrorModal/ErrorModal";
import trpc from "../../../api";
import { useFormik } from 'formik';
import * as Yup from 'yup';
import { useState } from "react";
import { SuccessModal } from "components/Modals/SuccessModal/SuccessModal";

function SignUpForm() {
  const navigate = useNavigate();
  const [loader, setLoader] = useState<boolean>(false);
  const { handleLogin } = useUserContext();
  const [show, setShow] = useState<boolean>(false);
  const [code, setCode] = useState<string>('52');
  const [showSuccess, setShowSuccess] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<any>('');
  const closeModal = () => {
    setShow(false);
  }
  const closeSuccess = () => {
    setShowSuccess(false);
    navigate("/");
  }
  const validationSchema = Yup.object().shape({
    email:  Yup.string()
    .required('Email is required')
    .email('Invalid email format'),
    username: Yup.string()
    .required('Username is required')
    .min(5, 'Username must be at least 5 characters long'),
    password: Yup.string().required('Password is required')
    .min(6, 'Password must contain 6 characters atleast'),
    phone: Yup.string().required('Phone is required')
    .matches(/^[0-9]{10}$/, 'Phone number is not valid'),
    passwordConfirmation: 
    Yup.string().required('Confirmation Password is required')
    .oneOf([Yup.ref('password')], 'Both should be the same'),
});
  const initialValues = {
    username: '',
    password: '',
    email: '',
    phone: '',
    passwordConfirmation: '',
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
        try{
          const register = await trpc.auth.register.mutate(body);
          handleLogin(register.token);
          setShowSuccess(true);
          setLoader(false);
        }
        catch(error){
          setShow(true);
          setErrorMessage(error);
          setLoader(false)
        }
    },
  });

  return (
    <form className="sign-up-form" onSubmit={formik.handleSubmit}>
      <h2>REGISTRARSE</h2>
      <div className="c-row">
        <input 
          placeholder="E-mail" 
          id="email" 
          name="email" 
          value={formik.values.email} 
          onChange={formik.handleChange}
          type="text" 
        />
        {formik.errors.email && <div className="error-formik">{formik.errors.email}</div>}
      </div>
      <div className="c-row">
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
          placeholder="phone" 
          id="phone" 
          name="phone" 
          value={formik.values.phone} 
          onChange={formik.handleChange}
          type="text" 
        />
         {formik.errors.phone && <div className="error-formik">{formik.errors.phone}</div>}
      </div>
      <div className="c-row">
        <input 
          placeholder="Username" 
          type="text" 
          id="username" 
          name="username" 
          value={formik.values.username} 
          onChange={formik.handleChange}
        />
         {formik.errors.username && <div className="error-formik">{formik.errors.username}</div>}
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
         {formik.errors.password && <div className="error-formik">{formik.errors.password}</div>}
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
         {formik.errors.passwordConfirmation && <div className="error-formik">{formik.errors.passwordConfirmation}</div>}
      </div>
      <button className="btn" type="submit">REGISTRARSE</button>
      <div className="c-row">
        <Link to={"/auth"}>
          <Arrow className="arrow" />
          Ya tengo cuenta
        </Link>
      </div>
      <ErrorModal show={show} onHide={closeModal} message={errorMessage}/>
      <SuccessModal 
        show={showSuccess} 
        onHide={closeSuccess} 
        message="Se ha creado su usuario con éxito!"
        title= "Registro Exitoso"
      />
    </form>
  );
}

export default SignUpForm;
