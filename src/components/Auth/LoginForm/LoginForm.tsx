import { Link, useNavigate } from "react-router-dom";
import { useUserContext } from "../../../contexts/UserContext";

function LoginForm() {
  const { handleLogin } = useUserContext();
  const navigate = useNavigate();

  const handlesubmit = (e: any) => {
    e.preventDefault();
    navigate("/");
  };
  return (
    <form onSubmit={handlesubmit}>
      <h2>LOGIN</h2>
      <div className="c-row">
        <input placeholder="username" type="text" />
      </div>
      <div className="c-row">
        <input placeholder="password" type="password" />
      </div>
      <div className="c-row">
        <Link to={"recuperar"}>¿Olvidaste tu contraseña?</Link>
      </div>
      <button className="btn" onClick={handleLogin}>
        INGRESAR
      </button>
      <div className="c-row">
        <Link to={"registro"}>Registrarme</Link>
      </div>
    </form>
  );
}

export default LoginForm;
