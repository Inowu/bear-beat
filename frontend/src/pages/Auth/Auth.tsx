import { Outlet } from "react-router-dom";
import "./Auth.scss";
import Logo from "../../assets/images/osonuevo.png";

function Auth() {
  return (
    <div className="auth-main-container auth-page">
      <img className="auth-logo" src={Logo} alt="Bear Beat" />
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
