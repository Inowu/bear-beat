import { useUserContext } from "../../contexts/UserContext";
import { useTheme } from "../../contexts/ThemeContext";
import type { ThemeMode } from "../../contexts/ThemeContext";
import brandMarkBlack from "../../assets/brand/bearbeat-mark-black.png";
import brandMarkCyan from "../../assets/brand/bearbeat-mark-cyan.png";
import "./Navbar.scss";
import type { AppIcon } from "src/icons";
import {
  Menu,
  Shield,
  Sun,
  Moon,
  Monitor,
  Clock,
  UserRound,
  LogOut,
} from "src/icons";
import { Link } from "react-router-dom";
import { SetStateAction, useState, useRef, useEffect } from "react";
import { Button } from "src/components/ui";
interface NavbarPropsI {
  setAsideOpen: React.Dispatch<SetStateAction<boolean>>;
  menuButtonRef?: React.RefObject<HTMLButtonElement | null>;
  hideMenuButton?: boolean;
}

const THEME_OPTIONS: { value: ThemeMode; label: string; Icon: AppIcon }[] = [
  { value: "light", label: "Claro", Icon: Sun },
  { value: "dark", label: "Oscuro", Icon: Moon },
  { value: "system", label: "Según sistema", Icon: Monitor },
  { value: "schedule", label: "Por horario", Icon: Clock },
];

function Navbar(props: NavbarPropsI) {
  const { handleLogout, currentUser } = useUserContext();
  const { mode, theme, setMode } = useTheme();
  const { setAsideOpen, menuButtonRef, hideMenuButton = false } = props;
  const brandMark = theme === "light" ? brandMarkBlack : brandMarkCyan;
  const [themeMenuOpen, setThemeMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setThemeMenuOpen(false);
      }
    }
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, []);

  return (
    <nav>
      <div className="header">
        {!hideMenuButton && (
          <Button unstyled
            type="button"
            ref={menuButtonRef as React.LegacyRef<HTMLButtonElement>}
            className="burger-btn"
            onClick={() => setAsideOpen((prev) => !prev)}
            aria-label="Abrir menú"
          >
            <Menu size={20} aria-hidden />
          </Button>
        )}
        <Link to="/" className="nav-brand" aria-label="Bear Beat">
          <img src={brandMark} alt="" aria-hidden />
        </Link>
      </div>
      <div className="nav-right">
        <div className="theme-toggle-wrap" ref={menuRef}>
          <Button unstyled
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
          </Button>
          {themeMenuOpen && (
            <div className="theme-dropdown-menu">
              {THEME_OPTIONS.map(({ value, label, Icon }) => (
                <Button unstyled
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
                </Button>
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
          <li>
            <Link to="/micuenta" className="nav-item">
              <UserRound size={18} aria-hidden />
              <span>Mi cuenta</span>
            </Link>
          </li>
          <li>
            <Button unstyled
              type="button"
              className="nav-item nav-item--danger"
              onClick={() => handleLogout(true)}
            >
              <LogOut size={18} aria-hidden />
              <span>Cerrar sesión</span>
            </Button>
          </li>
        </ul>
      </div>
    </nav>
  );
}

export default Navbar;
