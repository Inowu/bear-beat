import { Link, NavLink } from "react-router-dom";
import type { ReactNode } from "react";
import { useTheme } from "../../contexts/ThemeContext";
import { useUserContext } from "../../contexts/UserContext";
import brandMarkBlack from "../../assets/brand/bearbeat-mark-black.png";
import brandMarkCyan from "../../assets/brand/bearbeat-mark-cyan.png";
import { Button } from "src/components/ui";
type PublicTopNavProps = {
  className?: string;
  brandAriaCurrent?: boolean;
  brandTo?: string;
  loginFrom?: string;
  cta?: ReactNode;
  plansTo?: string;
  onPlansClick?: () => void;
};

export default function PublicTopNav({
  className,
  brandAriaCurrent,
  brandTo = "/",
  loginFrom,
  cta,
  plansTo = "/planes",
  onPlansClick,
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
          to={brandTo}
          className="home-topnav__brand"
          aria-label="Bear Beat"
          aria-current={brandAriaCurrent ? "page" : undefined}
        >
          <img src={brandMark} alt="Bear Beat" width={40} height={40} />
        </Link>
        <div className="home-topnav__right" aria-label="Acciones">
          <nav className="home-topnav__nav" aria-label="Links">
            {usePlansAsHashLink ? (
              <Link to={plansTo} className="home-topnav__link" onClick={onPlansClick}>
                Planes
              </Link>
            ) : (
              <NavLink
                to={plansTo}
                className={({ isActive }) => `home-topnav__link${isActive ? " is-active" : ""}`}
                onClick={onPlansClick}
              >
                Planes
              </NavLink>
            )}
            {userToken ? (
              <NavLink
                to="/micuenta"
                className={({ isActive }) =>
                  `home-topnav__link home-topnav__link--account${isActive ? " is-active" : ""}`
                }
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
          {userToken && (
            <NavLink
              to="/micuenta"
              className={({ isActive }) =>
                `home-topnav__mobile-account${isActive ? " is-active" : ""}`
              }
            >
              Mi cuenta
            </NavLink>
          )}
          {cta}
        </div>
      </div>
    </header>
  );
}
