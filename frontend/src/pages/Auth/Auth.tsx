import "./Auth.scss";
import { Outlet } from "react-router-dom";
import { useEffect } from "react";
import { useTheme } from "../../contexts/ThemeContext";
import { trackManyChatConversion, MC_EVENTS } from "../../utils/manychatPixel";

function Auth() {
  const { theme } = useTheme();

  useEffect(() => {
    trackManyChatConversion(MC_EVENTS.VIEW_AUTH);
  }, []);

  return (
    <div
      className={[
        "auth-main-container",
        "auth-page",
        "bb-auth-surface",
        `auth-page--${theme}`,
      ].join(" ")}
    >
      <Outlet />
    </div>
  );
}

export default Auth;
