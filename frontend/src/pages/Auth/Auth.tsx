import { Outlet } from "react-router-dom";
import "./Auth.scss";
import Logo from "../../assets/images/osonuevo.png";

function Auth() {
  return (
    <div className="auth-main-container">
      <img className="logo" src={Logo} alt="bear beat" />
      <p className="auth-tagline">
        Música y videos <strong>exclusivos para DJs</strong>
        <span className="auth-tagline-sep"> · </span>
        Todo organizado por <strong>géneros</strong>
      </p>
      <Outlet />
    </div>
  );
}

export default Auth;
