import { Link, Outlet, useNavigate } from "react-router-dom";
import "./Auth.scss";
import Logo from "../../assets/images/osonuevo.png";
import { useUserContext } from "../../contexts/UserContext";

function Auth() {
  return (
    <div className="auth-main-container">
      <img className="logo" src={Logo} alt="bear beat" />
      <Outlet />
    </div>
  );
}

export default Auth;
