import { Outlet } from "react-router-dom";
import { useEffect } from "react";
import "./Auth.scss";
import Logo from "../../assets/images/osonuevo.png";
import { trackManyChatConversion, MC_EVENTS } from "../../utils/manychatPixel";

function Auth() {
  useEffect(() => {
    trackManyChatConversion(MC_EVENTS.VIEW_AUTH);
  }, []);
  return (
    <div className="auth-main-container auth-page bg-slate-950 min-h-screen flex flex-col items-center justify-center py-8">
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
