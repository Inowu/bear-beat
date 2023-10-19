import { Link, useNavigate } from "react-router-dom";
import { useUserContext } from "../../../contexts/UserContext";
import trpc from "../../../api";
import { useFormik } from 'formik';
import * as Yup from 'yup';
import {  useState } from "react";
import { ErrorModal } from "../../../components/Modals/ErrorModal/ErrorModal";
import { Spinner } from "../../../components/Spinner/Spinner";

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
    username: Yup.string()
    .required('Username is required')
    .min(3, 'Username must be at least 3 characters long'),
    password: Yup.string().required('Password is required')
    .min(3, 'Password must contain 3 characters atleast'),
});
  const initialValues = {
    username: "",
    password: "",
  };
  const formik = useFormik({
    initialValues: initialValues,
    validationSchema: validationSchema,
    onSubmit: async (values) => {
        setLoader(true);
        let body = {
          username: values.username,
          password: values.password,
        }
        try{
          const login = await trpc.auth.login.query(body);
          handleLogin(login.token);
          navigate("/");
          setLoader(false);
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
      <h2>LOGIN</h2>
      <div className="c-row">
        <input
          placeholder="username"
          type="text"
          id="username"
          name="username"
          value={formik.values.username}
          onChange={formik.handleChange}
        />
        {formik.errors.username && (
          <div className="error-formik">{formik.errors.username}</div>
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
        <Spinner size={3} width={.3} color="#00e2f7"/>
      }
      <div className="c-row">
        <Link to={"registro"}>Registrarme</Link>
      </div>
      <ErrorModal show={show} onHide={closeModal} message={errorMessage}/>
    </form>
  );
}

export default LoginForm;
