import { Link, useNavigate } from "react-router-dom";
import { useUserContext } from "../../../contexts/UserContext";
import trpc from "../../../api";
import { useFormik } from 'formik';
import * as Yup from 'yup';
import { useState } from "react";
import { ErrorModal } from "../../../components/Modals/ErrorModal/ErrorModal";
import { Spinner } from "../../../components/Spinner/Spinner";
import { faHeadset } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";



function LoginForm() {
  const [loader, setLoader] = useState<boolean>(false);
  const [show, setShow] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<any>('');
  const { handleLogin } = useUserContext();
  const navigate = useNavigate();
  const closeModal = () => {
    setShow(false);
  }
  const validationSchema = Yup.object().shape({
    email: Yup.string()
      .required('Email is required')
      .email("Invalid email format"),
    password: Yup.string().required('Password is required')
      .min(3, 'Password must contain 3 characters atleast'),
  });
  const initialValues = {
    email: "",
    password: "",
  };
  const formik = useFormik({
    initialValues: initialValues,
    validationSchema: validationSchema,
    onSubmit: async (values) => {
      setLoader(true);
      let body = {
        email: values.email,
        password: values.password,
      }
      try {
        const login = await trpc.auth.login.query(body);
        handleLogin(login.token);
        navigate("/");
        setLoader(false);
      }
      catch (error) {
        setShow(true);
        setErrorMessage(error);
        setLoader(false);
      }
    },
  });

  const handleButtonClick = () => {
    window.location.href = 'tel:+12312312312';
  };
  
  return (
    <form onSubmit={formik.handleSubmit}>
      <h2>LOGIN</h2>
      <div className="c-row">
        <input
          placeholder="email"
          type="text"
          id="email"
          name="email"
          value={formik.values.email}
          onChange={formik.handleChange}
        />
        {formik.errors.email && (
          <div className="error-formik">{formik.errors.email}</div>
        )}
      </div>
      <div className="c-row">
        <input
          placeholder="password"
          type="password"
          id="password"
          name="password"
          value={formik.values.password}
          onChange={formik.handleChange}
        />
        {formik.errors.password && (
          <div className="error-formik">{formik.errors.password}</div>
        )}
      </div>
      <div className="c-row">
        <Link to={"recuperar"}>¿Olvidaste tu contraseña?</Link>
      </div>
      {
        !loader
          ?
          <button className="btn" type="submit">
            INGRESAR
          </button>
          :
          <Spinner size={3} width={.3} color="#00e2f7" />
      }
      <div className="c-row">
        <Link to={"registro"}>Registrarme</Link>
      </div>
      <div
        style={{
          position: 'fixed',
          bottom: '20px',
          right: '30px',
          padding: '12px',
          background: '#fff',
          color: '#2c2828',
          borderRadius: '50%',
          cursor: 'pointer',
        }}
        onClick={handleButtonClick}
      >
        <FontAwesomeIcon icon={faHeadset} style={{ fontSize: '25px' }} />
      </div>
      <ErrorModal show={show} onHide={closeModal} message={errorMessage} />
    </form>
  );
}

export default LoginForm;
