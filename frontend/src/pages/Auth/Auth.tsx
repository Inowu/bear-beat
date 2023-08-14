import { Outlet } from "react-router-dom";
import "./Auth.scss";
import Logo from "../../assets/images/osonuevo.png";

function Auth() {
  return (
    <div className="auth-main-container">
      <img className="logo" src={Logo} alt="bear beat" />
      <Outlet />
    </div>
  );
}

export default Auth;
