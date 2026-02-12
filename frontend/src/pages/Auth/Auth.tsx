import "./Auth.scss";
import "../../components/Auth/LoginForm/LoginForm.scss";
import "../../components/Auth/SignUpForm/SignUpForm.scss";
import "../../components/Auth/ForgotPasswordForm/ForgotPasswordForm.scss";
import "../../components/Auth/ResetPassword/ResetPassword.scss";
import { Outlet } from "react-router-dom";
import { useEffect } from "react";
import { trackManyChatConversion, MC_EVENTS } from "../../utils/manychatPixel";

function Auth() {
  useEffect(() => {
    trackManyChatConversion(MC_EVENTS.VIEW_AUTH);
  }, []);
  return (
    <div className="auth-main-container auth-page min-h-screen w-full bg-bg-main text-text-main">
      <Outlet />
    </div>
  );
}

export default Auth;
