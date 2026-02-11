import { useUserContext } from "../../contexts/UserContext";
import { useTheme } from "../../contexts/ThemeContext";
import type { ThemeMode } from "../../contexts/ThemeContext";
import { useNavigate } from "react-router-dom";
import osoLogo from "../../assets/images/oso-icon.png";
import "./Navbar.scss";
import type { LucideIcon } from "lucide-react";
import {
  Menu,
  Shield,
  Sun,
  Moon,
  Monitor,
  Clock,
  UserRound,
  LogOut,
} from "lucide-react";
import { Link } from "react-router-dom";
import { SetStateAction, useState, useRef, useEffect } from "react";
import {
  clearAdminAccessBackup,
  getAdminAccessBackup,
} from "../../utils/authStorage";

interface NavbarPropsI {
  setAsideOpen: React.Dispatch<SetStateAction<boolean>>;
  menuButtonRef?: React.RefObject<HTMLButtonElement | null>;
}

const THEME_OPTIONS: { value: ThemeMode; label: string; Icon: LucideIcon }[] = [
  { value: "light", label: "Claro", Icon: Sun },
  { value: "dark", label: "Oscuro", Icon: Moon },
  { value: "system", label: "Según sistema", Icon: Monitor },
  { value: "schedule", label: "Por horario", Icon: Clock },
];

function Navbar(props: NavbarPropsI) {
  const { handleLogout, currentUser, handleLogin } = useUserContext();
  const { mode, theme, setMode } = useTheme();
  const navigate = useNavigate();
  const { setAsideOpen, menuButtonRef } = props;
  const [themeMenuOpen, setThemeMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const adminAccessBackup = getAdminAccessBackup();

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
    if (adminAccessBackup) {
      handleLogin(adminAccessBackup.adminToken, adminAccessBackup.adminRefreshToken);
      clearAdminAccessBackup();
      navigate("/micuenta");
    }
  }
  //   useEffect(() => {
  // }, [currentUser])
  return (
    <nav>
      <div className="header">
        <button
          type="button"
          ref={menuButtonRef as React.LegacyRef<HTMLButtonElement>}
          className="burger-btn"
          onClick={() => setAsideOpen((prev) => !prev)}
          aria-label="Abrir menú"
        >
          <Menu size={20} aria-hidden />
        </button>
        <img src={osoLogo} alt="Bear Beat logo" />
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
            {theme === "light" ? (
              <Sun size={18} aria-hidden />
            ) : (
              <Moon size={18} aria-hidden />
            )}
          </button>
          {themeMenuOpen && (
            <div className="theme-dropdown-menu">
              {THEME_OPTIONS.map(({ value, label, Icon }) => (
                <button
                  key={value}
                  type="button"
                  className={mode === value ? "active" : ""}
                  onClick={() => {
                    setMode(value);
                    setThemeMenuOpen(false);
                  }}
                >
                  <Icon size={18} aria-hidden />
                  <span>{label}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        <ul>
          {currentUser?.role === "admin" && (
            <li>
              <Link to="/admin/usuarios" className="nav-item">
                <Shield size={18} aria-hidden />
                <span>Admin</span>
              </Link>
            </li>
          )}
          {adminAccessBackup && (
            <li>
              <button type="button" className="nav-item" onClick={goBackAsAdmin}>
                <Shield size={18} aria-hidden />
                <span>Admin</span>
              </button>
            </li>
          )}
          <li>
            <Link to="/micuenta" className="nav-item">
              <UserRound size={18} aria-hidden />
              <span>Mi cuenta</span>
            </Link>
          </li>
          <li>
            <button
              type="button"
              className="nav-item"
              onClick={() => handleLogout(true)}
            >
              <LogOut size={18} aria-hidden />
              <span>Cerrar sesión</span>
            </button>
          </li>
        </ul>
      </div>
    </nav>
  );
}

export default Navbar;
