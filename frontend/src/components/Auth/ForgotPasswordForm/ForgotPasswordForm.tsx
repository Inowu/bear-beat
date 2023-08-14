import { Link, useNavigate } from "react-router-dom";
import { ReactComponent as Arrow } from "../../../assets/icons/arrow-down.svg";

function ForgotPasswordForm() {
  const navigate = useNavigate();

  const handlesubmit = (e: any) => {
    e.preventDefault();
    navigate("/");
  };
  return (
    <form onSubmit={handlesubmit}>
      <h2>CAMBIAR CONTRASEÑA</h2>
      <div className="c-row">
        <input placeholder="E-mail" type="text" />
      </div>
      <button className="btn">ENVIAR LINK</button>

      <div className="c-row">
        <Link to={"/auth"}>
          <Arrow className="arrow" />
          Ya tengo cuenta
        </Link>
      </div>
    </form>
  );
}

export default ForgotPasswordForm;
