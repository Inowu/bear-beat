import { Link, NavLink } from "react-router-dom";
import type { ReactNode } from "react";
import { useTheme } from "../../contexts/ThemeContext";
import { useUserContext } from "../../contexts/UserContext";
import brandMarkBlack from "../../assets/brand/bearbeat-mark-black.png";
import brandMarkCyan from "../../assets/brand/bearbeat-mark-cyan.png";

type PublicTopNavProps = {
  className?: string;
  brandAriaCurrent?: boolean;
  loginFrom?: string;
  cta?: ReactNode;
  plansTo?: string;
};

export default function PublicTopNav({
  className,
  brandAriaCurrent,
  loginFrom,
  cta,
  plansTo = "/planes",
}: PublicTopNavProps) {
  const { userToken } = useUserContext();
  const { theme } = useTheme();
  const brandMark = theme === "light" ? brandMarkBlack : brandMarkCyan;
  const usePlansAsHashLink = plansTo.includes("#");

  return (
    <header
      className={["home-topnav", className].filter(Boolean).join(" ")}
      aria-label="Navegación pública"
    >
      <div className="ph__container home-topnav__inner">
        <Link
          to="/"
          className="home-topnav__brand"
          aria-label="Bear Beat"
          aria-current={brandAriaCurrent ? "page" : undefined}
        >
          <img src={brandMark} alt="Bear Beat" width={40} height={40} />
        </Link>
        <div className="home-topnav__right" aria-label="Acciones">
          <nav className="home-topnav__nav" aria-label="Links">
            {usePlansAsHashLink ? (
              <Link to={plansTo} className="home-topnav__link">
                Planes
              </Link>
            ) : (
              <NavLink
                to={plansTo}
                className={({ isActive }) => `home-topnav__link${isActive ? " is-active" : ""}`}
              >
                Planes
              </NavLink>
            )}
            {userToken ? (
              <NavLink
                to="/micuenta"
                className={({ isActive }) => `home-topnav__link${isActive ? " is-active" : ""}`}
              >
                Mi cuenta
              </NavLink>
            ) : (
              <Link
                to="/auth"
                state={loginFrom ? { from: loginFrom } : undefined}
                className="home-topnav__link"
              >
                Iniciar sesión
              </Link>
            )}
          </nav>
          {cta}
        </div>
      </div>
    </header>
  );
}
