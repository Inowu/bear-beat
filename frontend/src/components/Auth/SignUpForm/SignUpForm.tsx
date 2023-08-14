import { Link, useNavigate } from "react-router-dom";
import PhoneInput from "react-phone-input-2";
import "react-phone-input-2/lib/material.css";
import "./SignUpForm.scss";
import es from "react-phone-input-2/lang/es.json";
import { ReactComponent as Arrow } from "../../../assets/icons/arrow-down.svg";

function SignUpForm() {
  const navigate = useNavigate();

  const handlesubmit = (e: any) => {
    e.preventDefault();
    navigate("/");
  };

  return (
    <form className="sign-up-form" onSubmit={handlesubmit}>
      <h2>REGISTRARSE</h2>
      <div className="c-row">
        <input placeholder="E-mail" type="text" />
      </div>
      <div className="c-row">
        <PhoneInput
          containerClass="dial-container"
          buttonClass="dial-code"
          country={"mx"}
          placeholder="Phone"
          localization={es}
        />
        <input className="phone" placeholder="phone" type="text" />
      </div>
      <div className="c-row">
        <input placeholder="Username" type="text" />
      </div>
      <div className="c-row">
        <input placeholder="Password" type="password" />
      </div>
      <div className="c-row">
        <input placeholder="Repetir password" type="password" />
      </div>
      <button className="btn">REGISTRARSE</button>
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
