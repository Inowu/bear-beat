import "./AsideNavbar.scss";
import { useUserContext } from "../../contexts/UserContext";
import { useTheme } from "../../contexts/ThemeContext";
import { useLocation } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import brandMarkBlack from "../../assets/brand/bearbeat-mark-black.png";
import brandMarkCyan from "../../assets/brand/bearbeat-mark-cyan.png";
import { ADMIN_NAVIGATION_GROUPS } from "../../constants/adminNavigation";
import {
  Users,
  FolderOpen,
  ShoppingCart,
  HelpCircle,
  ArrowUpCircle,
  X,
  UserRound,
  Shield,
  LogOut,
  Undo2,
} from "src/icons";
import { Link, NavLink } from "react-router-dom";
import { Button } from "src/components/ui";
interface AsideNavbarPropsI {
  show: boolean;
  onHide: () => void;
}

function AsideNavbar(props: AsideNavbarPropsI) {
  const { currentUser, resetCard, handleLogout } = useUserContext();
  const { theme } = useTheme();
  const { show, onHide } = props;
  const location = useLocation();
  const closeBtnRef = useRef<HTMLButtonElement>(null);
  const [isDesktop, setIsDesktop] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    return window.matchMedia("(min-width: 1024px)").matches;
  });

  // Keep JS breakpoint aligned with `frontend/src/styles/mixin.scss` desktop=1024px
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mql = window.matchMedia("(min-width: 1024px)");

    const onChange = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    setIsDesktop(mql.matches);

    if (mql.addEventListener) mql.addEventListener("change", onChange);
    // Safari < 14
    else mql.addListener(onChange);

    return () => {
      if (mql.removeEventListener) mql.removeEventListener("change", onChange);
      else mql.removeListener(onChange);
    };
  }, []);

  const drawerOpen = isDesktop ? true : show;
  const brandMark = theme === "light" ? brandMarkBlack : brandMarkCyan;

  useEffect(() => {
    if (isDesktop || !show) return;
    closeBtnRef.current?.focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onHide();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [isDesktop, show, onHide]);

  // Avoid focusing the (hidden) burger button on desktop; drawer close is mobile-only.
  const closeDrawer = () => {
    if (!isDesktop) onHide();
  };

  const handleLinkClick = () => {
    resetCard();
    closeDrawer();
  };

  const linkProps = { onClick: closeDrawer };

  const navLinkClassName = ({ isActive }: { isActive: boolean }) =>
    `nav-link-item${isActive ? " is-active" : ""}`;

  // Mobile: when closed, unmount to avoid `aria-hidden-focus` violations in axe.
  if (!drawerOpen && !isDesktop) return null;

  return (
    <aside
      className={drawerOpen ? "open" : ""}
      aria-hidden={drawerOpen ? undefined : true}
      aria-label="Menú lateral"
    >
      {/* Mobile: backdrop to close on tap outside */}
      {!isDesktop && show && (
        <div className="aside-backdrop" onClick={onHide} aria-hidden />
      )}
      <div className="aside-inner" onClick={(e) => e.stopPropagation()}>
        <div className="aside-drawer-header">
          <Link
            to="/"
            onClick={handleLinkClick}
            className="aside-drawer-brand"
            aria-label="Bear Beat"
          >
            <img src={brandMark} alt="Bear Beat" width={32} height={32} />
          </Link>
          <span className="aside-drawer-title">Menú</span>
        </div>
        <div className="nav-container">
          <h2 className="nav-title">Contenido</h2>
          <div className="nav-links-wrap">
            {location.pathname.startsWith("/admin") ? (
              <div className="nav-admin-groups">
                {ADMIN_NAVIGATION_GROUPS.map((group) => (
                  <section key={group.id} className="nav-group">
                    <p className="nav-group__title">{group.label}</p>
                    <ul className="nav-list">
                      {group.items.map((item) => (
                        <li key={item.to}>
                          <NavLink to={item.to} className={navLinkClassName} {...linkProps}>
                            <item.Icon size={18} aria-hidden />
                            {item.label}
                          </NavLink>
                        </li>
                      ))}
                    </ul>
                  </section>
                ))}

                <section className="nav-group nav-group--actions">
                  <ul className="nav-list">
                    <li>
                      <Link to="/" onClick={handleLinkClick} className="nav-link-item nav-link-item--secondary">
                        <Undo2 size={18} aria-hidden />
                        Modo usuario
                      </Link>
                    </li>
                    <li>
                      <Button unstyled
                        type="button"
                        className="nav-link-item nav-link-item--danger"
                        onClick={() => {
                          handleLogout(true);
                          onHide();
                        }}
                        aria-label="Cerrar sesión"
                      >
                        <LogOut size={18} aria-hidden />
                        Cerrar sesión
                      </Button>
                    </li>
                  </ul>
                </section>
              </div>
            ) : (
              <ul className="nav-list">
                <li>
                  <NavLink to="/" onClick={handleLinkClick} className={navLinkClassName}>
                    <FolderOpen size={18} aria-hidden />
                    Todos los archivos
                  </NavLink>
                </li>
                {!currentUser?.hasActiveSubscription || currentUser.isSubscriptionCancelled ? (
                  <li>
                    <NavLink to="/planes" className={navLinkClassName} {...linkProps}>
                      <ShoppingCart size={18} aria-hidden />
                      Planes
                    </NavLink>
                  </li>
                ) : (
                  <li>
                    <NavLink to="/actualizar-planes" className={navLinkClassName} {...linkProps}>
                      <ArrowUpCircle size={18} aria-hidden />
                      Actualiza tu plan
                    </NavLink>
                  </li>
                )}
                {currentUser?.role === "admin" && (
                  <li>
                    <NavLink to="/admin/usuarios" className={navLinkClassName} {...linkProps}>
                      <Shield size={18} aria-hidden />
                      Admin
                    </NavLink>
                  </li>
                )}
                <li>
                  <NavLink to="/micuenta" className={navLinkClassName} {...linkProps}>
                    <UserRound size={18} aria-hidden />
                    Mi cuenta
                  </NavLink>
                </li>
                <li>
                  <NavLink to="/instrucciones" className={navLinkClassName} {...linkProps}>
                    <HelpCircle size={18} aria-hidden />
                    Guía FTP
                  </NavLink>
                </li>
                <li>
                  <Button unstyled
                    type="button"
                    className="nav-link-item nav-link-item--danger"
                    onClick={() => {
                      handleLogout(true);
                      onHide();
                    }}
                    aria-label="Cerrar sesión"
                  >
                    <LogOut size={18} aria-hidden /> Cerrar sesión
                  </Button>
                </li>
              </ul>
            )}
          </div>
        </div>
        <Button unstyled
          type="button"
          className="aside-close-btn"
          onClick={onHide}
          aria-label="Cerrar menú"
          ref={closeBtnRef}
        >
          <X size={20} aria-hidden />
        </Button>
      </div>
    </aside>
  );
}

export default AsideNavbar;
