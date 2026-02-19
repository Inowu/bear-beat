import { Link, NavLink, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { useTheme } from "../../contexts/ThemeContext";
import { useUserContext } from "../../contexts/UserContext";
import brandMarkBlack from "../../assets/brand/bearbeat-mark-black.png";
import brandMarkCyan from "../../assets/brand/bearbeat-mark-cyan.png";
import { Button } from "src/components/ui";
import { Menu, Moon, Sun, X } from "src/icons";
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
  const location = useLocation();
  const { userToken } = useUserContext();
  const { theme, setMode } = useTheme();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const brandMark = theme === "light" ? brandMarkBlack : brandMarkCyan;
  const usePlansAsHashLink = plansTo.includes("#");
  const nextTheme = theme === "dark" ? "light" : "dark";
  const mobileMenuId = "public-topnav-mobile-menu";

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname, location.search, location.hash]);

  const handleToggleTheme = () => {
    setMode(nextTheme);
  };
  const closeMobileMenu = () => {
    setMobileMenuOpen(false);
  };
  const handlePlansClick = () => {
    onPlansClick?.();
    closeMobileMenu();
  };

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
          <Button
            unstyled
            type="button"
            className="home-topnav__theme-btn"
            onClick={handleToggleTheme}
            aria-label={theme === "dark" ? "Cambiar a tema claro" : "Cambiar a tema oscuro"}
            aria-pressed={theme === "dark"}
            title={theme === "dark" ? "Tema oscuro activo" : "Tema claro activo"}
          >
            {theme === "dark" ? <Moon size={18} aria-hidden /> : <Sun size={18} aria-hidden />}
          </Button>
          <nav className="home-topnav__nav home-topnav__nav--desktop" aria-label="Links">
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
          <div className="home-topnav__cta-desktop">{cta}</div>
          <Button
            unstyled
            type="button"
            className="home-topnav__menu-btn"
            aria-label={mobileMenuOpen ? "Cerrar menú" : "Abrir menú"}
            aria-expanded={mobileMenuOpen}
            aria-controls={mobileMenuId}
            onClick={() => setMobileMenuOpen((prev) => !prev)}
          >
            {mobileMenuOpen ? <X size={18} aria-hidden /> : <Menu size={18} aria-hidden />}
          </Button>
        </div>
      </div>
      <div
        id={mobileMenuId}
        className={`home-topnav__mobile-menu${mobileMenuOpen ? " is-open" : ""}`}
      >
        <div className="ph__container home-topnav__mobile-menu-inner">
          <nav className="home-topnav__mobile-links" aria-label="Links móviles">
            {usePlansAsHashLink ? (
              <Link to={plansTo} className="home-topnav__mobile-link" onClick={handlePlansClick}>
                Planes
              </Link>
            ) : (
              <NavLink
                to={plansTo}
                className={({ isActive }) => `home-topnav__mobile-link${isActive ? " is-active" : ""}`}
                onClick={handlePlansClick}
              >
                Planes
              </NavLink>
            )}
            {userToken ? (
              <NavLink
                to="/micuenta"
                className={({ isActive }) =>
                  `home-topnav__mobile-link${isActive ? " is-active" : ""}`
                }
                onClick={closeMobileMenu}
              >
                Mi cuenta
              </NavLink>
            ) : (
              <Link
                to="/auth"
                state={loginFrom ? { from: loginFrom } : undefined}
                className="home-topnav__mobile-link"
                onClick={closeMobileMenu}
              >
                Iniciar sesión
              </Link>
            )}
          </nav>
          {cta && (
            <div className="home-topnav__mobile-cta" onClick={closeMobileMenu}>
              {cta}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
