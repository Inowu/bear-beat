import { Link, useNavigate } from "react-router-dom";
import PhoneInput from "react-phone-input-2";
import "react-phone-input-2/lib/material.css";
import "./SignUpForm.scss";
import es from "react-phone-input-2/lang/es.json";
import { ReactComponent as Arrow } from "../../../assets/icons/arrow-down.svg";
import { useUserContext } from "../../../contexts/UserContext";
import trpc from "../../../api";
import { useFormik } from 'formik';
import * as Yup from 'yup';
import { useState } from "react";

function SignUpForm() {
  const navigate = useNavigate();
  const [loader, setLoader] = useState<boolean>(false);
  const { handleLogin } = useUserContext();
  const validationSchema = Yup.object().shape({
    email:  Yup.string()
    .required('Email is required')
    .email('Invalid email format'),
    username: Yup.string()
    .required('Username is required')
    .min(5, 'Username must be at least 5 characters long'),
    password: Yup.string().required('Password is required')
    .min(3, 'Password must contain 3 characters atleast'),
    phone: Yup.string().required('Phone is required'),
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
  const formik = useFormik({
    initialValues: initialValues,
    validationSchema: validationSchema,
    onSubmit: async (values) => {
        setLoader(true);
        let body = {
          username: values.username,
          password: values.password,
          email: values.email,
          phone: values.phone,
        }
        console.log(body);
        try{
          const register = await trpc.auth.register.mutate(body);
          handleLogin(register.token);
          navigate("/");
          setLoader(false);
        }
        catch(error){
          alert(error);
          setLoader(false);
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
        />
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
    </form>
  );
}

export default SignUpForm;
