import { Link, useNavigate } from "react-router-dom";
import { useUserContext } from "../../../contexts/UserContext";
import trpc from "../../../api";
import { useState } from "react";

function LoginForm() {
  const { handleLogin } = useUserContext();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const navigate = useNavigate();

  const handlesubmit = async (e: any) => {
    e.preventDefault();

    try {
      const response = await trpc.auth.login.query({
        username,
        password,
      });

      console.log(response);
      handleLogin(response.token);
      // navigate("/");
    } catch (e) {
      console.log(e);
    }
  };

  return (
    <form onSubmit={handlesubmit}>
      <h2>LOGIN</h2>
      <div className="c-row">
        <input
          placeholder="username"
          type="text"
          onChange={(e) => setUsername(e.target.value)}
        />
      </div>
      <div className="c-row">
        <input
          placeholder="password"
          type="password"
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>
      <div className="c-row">
        <Link to={"recuperar"}>¿Olvidaste tu contraseña?</Link>
      </div>
      <button className="btn" type="submit">
        INGRESAR
      </button>
      <div className="c-row">
        <Link to={"registro"}>Registrarme</Link>
      </div>
    </form>
  );
}

export default LoginForm;
