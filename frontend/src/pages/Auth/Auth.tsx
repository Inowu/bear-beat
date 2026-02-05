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
    <div className="min-h-screen w-full bg-slate-950 flex flex-col items-center justify-center p-4">
      <img className="h-12 w-auto mb-4" src={Logo} alt="Bear Beat" />
      <p className="auth-tagline text-slate-300 text-center text-sm sm:text-base mb-6 max-w-md">
        Música y videos <strong className="text-white">exclusivos para DJs</strong>
        <span className="text-slate-500"> · </span>
        Todo organizado por <strong className="text-white">géneros</strong>
      </p>
      <Outlet />
    </div>
  );
}

export default Auth;
