import "./Auth.scss";
import { Outlet } from "react-router-dom";
import { useEffect } from "react";
import { useTheme } from "../../contexts/ThemeContext";
import { trackManyChatConversion, MC_EVENTS } from "../../utils/manychatPixel";
import { Button } from "src/components/ui";
import { Moon, Sun } from "src/icons";
function Auth() {
  const { theme, setMode } = useTheme();
  const nextTheme = theme === "dark" ? "light" : "dark";

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
      <Button
        unstyled
        type="button"
        className="auth-theme-toggle"
        onClick={() => setMode(nextTheme)}
        aria-label={theme === "dark" ? "Cambiar a tema claro" : "Cambiar a tema oscuro"}
        aria-pressed={theme === "dark"}
        title={theme === "dark" ? "Tema oscuro activo" : "Tema claro activo"}
      >
        {theme === "dark" ? <Moon size={18} aria-hidden /> : <Sun size={18} aria-hidden />}
      </Button>
      <Outlet />
    </div>
  );
}

export default Auth;
