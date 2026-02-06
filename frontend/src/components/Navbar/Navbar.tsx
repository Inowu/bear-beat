import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useUserContext } from "../../contexts/UserContext";
import { useTheme } from "../../contexts/ThemeContext";
import type { ThemeMode } from "../../contexts/ThemeContext";
import { useNavigate } from "react-router-dom";
import osoLogo from "../../assets/images/oso-icon.png";
import "./Navbar.scss";
import {
  faUserCircle,
  faSignOutAlt,
  faBars,
  faShield,
  faSun,
  faMoon,
  faCircleHalfStroke,
  faClock,
} from "@fortawesome/free-solid-svg-icons";
import { Link } from "react-router-dom";
import { SetStateAction, useState, useRef, useEffect } from "react";

interface NavbarPropsI {
  setAsideOpen: React.Dispatch<SetStateAction<boolean>>;
  menuButtonRef?: React.RefObject<HTMLButtonElement | null>;
}

interface AdminToken {
  adminToken: string,
  adminRefreshToken: string
}

const THEME_OPTIONS: { value: ThemeMode; label: string; icon: typeof faSun }[] = [
  { value: "light", label: "Claro", icon: faSun },
  { value: "dark", label: "Oscuro", icon: faMoon },
  { value: "system", label: "Según sistema", icon: faCircleHalfStroke },
  { value: "schedule", label: "Por horario", icon: faClock },
];

function Navbar(props: NavbarPropsI) {
  const { handleLogout, currentUser, handleLogin } = useUserContext();
  const { mode, theme, setMode } = useTheme();
  const navigate = useNavigate();
  const { setAsideOpen, menuButtonRef } = props;
  const [themeMenuOpen, setThemeMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  let isAdminAccess = localStorage.getItem("isAdminAccess");

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setThemeMenuOpen(false);
      }
    }
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, []);

  const goBackAsAdmin = () => {
    if (isAdminAccess) {
      const adminToken: AdminToken = JSON.parse(isAdminAccess);
      handleLogin(adminToken.adminToken, adminToken.adminRefreshToken);
      localStorage.removeItem("isAdminAccess");
      navigate("/micuenta");
    }
  }
  //   useEffect(() => {
  // }, [currentUser])
  return (
    <nav className="bg-bear-dark-400 border-b border-bear-dark-100">
      <div className="header">
        <button
          type="button"
          ref={menuButtonRef as React.LegacyRef<HTMLButtonElement>}
          className="burger-btn"
          onClick={() => setAsideOpen((prev) => !prev)}
          aria-label="Abrir menú"
        >
          <FontAwesomeIcon icon={faBars} />
        </button>
        <img src={osoLogo} alt="" />
        <h2>Bear Beat</h2>
      </div>
      <div className="nav-right">
        <div className="theme-toggle-wrap" ref={menuRef}>
          <button
            type="button"
            className="theme-btn"
            onClick={() => setThemeMenuOpen((o) => !o)}
            title={THEME_OPTIONS.find((o) => o.value === mode)?.label ?? "Tema"}
            aria-label="Cambiar tema"
          >
            <FontAwesomeIcon icon={theme === "light" ? faSun : faMoon} />
          </button>
          {themeMenuOpen && (
            <div className="theme-dropdown-menu">
              {THEME_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  className={mode === opt.value ? "active" : ""}
                  onClick={() => {
                    setMode(opt.value);
                    setThemeMenuOpen(false);
                  }}
                >
                  <FontAwesomeIcon icon={opt.icon} />
                  <span>{opt.label}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        <ul>
        {
          currentUser?.role === "admin" &&
          <>
            <Link to={"admin/usuarios"}>
              <li>
                <FontAwesomeIcon icon={faShield} /> <span>Admin</span>
              </li>
            </Link>
          </>
        }
        {
          isAdminAccess &&
          <>
              <li onClick={goBackAsAdmin}>
                <FontAwesomeIcon icon={faShield} /> <span>Admin</span>
              </li>
          </>
        }
        <Link to={"/micuenta"}>
          <li>
            <FontAwesomeIcon icon={faUserCircle} /> <span>Mi cuenta</span>
          </li>
        </Link>
        <li onClick={handleLogout}>
          <FontAwesomeIcon icon={faSignOutAlt} /> <span>Cerrar sesión</span>
        </li>
        </ul>
      </div>
    </nav>
  );
}

export default Navbar;
