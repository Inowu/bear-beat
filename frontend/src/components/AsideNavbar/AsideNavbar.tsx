import "./AsideNavbar.scss";
import { useUserContext } from "../../contexts/UserContext";
import { useTheme } from "../../contexts/ThemeContext";
import { useLocation } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import brandMarkBlack from "../../assets/brand/bearbeat-mark-black.png";
import brandMarkCyan from "../../assets/brand/bearbeat-mark-cyan.png";
import {
  Activity,
  Users,
  FolderOpen,
  ShoppingCart,
  HelpCircle,
  Database,
  Ticket,
  Receipt,
  FileText,
  ArrowUpCircle,
  Download,
  Ban,
  Phone,
  BarChart3,
  X,
  UserRound,
  Shield,
  LogOut,
  Undo2,
} from "src/icons";
import { Link, NavLink } from "react-router-dom";

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
                <section className="nav-group">
                  <p className="nav-group__title">Operación</p>
                  <ul className="nav-list">
                    <li>
                      <NavLink to="/admin/usuarios" className={navLinkClassName} {...linkProps}>
                        <Users size={18} aria-hidden />
                        Usuarios
                      </NavLink>
                    </li>
                    <li>
                      <NavLink to="/admin/ordenes" className={navLinkClassName} {...linkProps}>
                        <Receipt size={18} aria-hidden />
                        Órdenes
                      </NavLink>
                    </li>
                    <li>
                      <NavLink to="/admin/historialCheckout" className={navLinkClassName} {...linkProps}>
                        <FileText size={18} aria-hidden />
                        Checkout
                      </NavLink>
                    </li>
                    <li>
                      <NavLink to="/admin/historial-descargas" className={navLinkClassName} {...linkProps}>
                        <Download size={18} aria-hidden />
                        Descargas
                      </NavLink>
                    </li>
                  </ul>
                </section>

                <section className="nav-group">
                  <p className="nav-group__title">Comercial</p>
                  <ul className="nav-list">
                    <li>
                      <NavLink to="/admin/planesAdmin" className={navLinkClassName} {...linkProps}>
                        <ShoppingCart size={18} aria-hidden />
                        Planes
                      </NavLink>
                    </li>
                    <li>
                      <NavLink to="/admin/cupones" className={navLinkClassName} {...linkProps}>
                        <Ticket size={18} aria-hidden />
                        Cupones
                      </NavLink>
                    </li>
                  </ul>
                </section>

                <section className="nav-group">
                  <p className="nav-group__title">Analítica</p>
                  <ul className="nav-list">
                    <li>
                      <NavLink to="/admin/catalogo" className={navLinkClassName} {...linkProps}>
                        <BarChart3 size={18} aria-hidden />
                        Catálogo
                      </NavLink>
                    </li>
                    <li>
                      <NavLink to="/admin/analitica" className={navLinkClassName} {...linkProps}>
                        <BarChart3 size={18} aria-hidden />
                        Analítica
                      </NavLink>
                    </li>
                    <li>
                      <NavLink to="/admin/crm" className={navLinkClassName} {...linkProps}>
                        <Users size={18} aria-hidden />
                        CRM
                      </NavLink>
                    </li>
                    <li>
                      <NavLink to="/admin/live" className={navLinkClassName} {...linkProps}>
                        <Activity size={18} aria-hidden />
                        Live
                      </NavLink>
                    </li>
                  </ul>
                </section>

                <section className="nav-group">
                  <p className="nav-group__title">Seguridad y sistema</p>
                  <ul className="nav-list">
                    <li>
                      <NavLink to="/admin/audit-logs" className={navLinkClassName} {...linkProps}>
                        <FileText size={18} aria-hidden />
                        Auditoría
                      </NavLink>
                    </li>
                    <li>
                      <NavLink to="/admin/webhook-inbox" className={navLinkClassName} {...linkProps}>
                        <Activity size={18} aria-hidden />
                        Webhook Inbox
                      </NavLink>
                    </li>
                    <li>
                      <NavLink to="/admin/dominios-bloqueados" className={navLinkClassName} {...linkProps}>
                        <Ban size={18} aria-hidden />
                        Dominios
                      </NavLink>
                    </li>
                    <li>
                      <NavLink to="/admin/telefonos-bloqueados" className={navLinkClassName} {...linkProps}>
                        <Phone size={18} aria-hidden />
                        Teléfonos
                      </NavLink>
                    </li>
                    <li>
                      <NavLink to="/admin/almacenamiento" className={navLinkClassName} {...linkProps}>
                        <Database size={18} aria-hidden />
                        Almacenamiento
                      </NavLink>
                    </li>
                  </ul>
                </section>

                <section className="nav-group nav-group--actions">
                  <ul className="nav-list">
                    <li>
                      <Link to="/" onClick={handleLinkClick} className="nav-link-item nav-link-item--secondary">
                        <Undo2 size={18} aria-hidden />
                        Modo usuario
                      </Link>
                    </li>
                    <li>
                      <button
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
                      </button>
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
                    Instrucciones
                  </NavLink>
                </li>
                <li>
                  <button
                    type="button"
                    className="nav-link-item nav-link-item--danger"
                    onClick={() => {
                      handleLogout(true);
                      onHide();
                    }}
                    aria-label="Cerrar sesión"
                  >
                    <LogOut size={18} aria-hidden /> Cerrar sesión
                  </button>
                </li>
              </ul>
            )}
          </div>
        </div>
        <button
          type="button"
          className="aside-close-btn"
          onClick={onHide}
          aria-label="Cerrar menú"
          ref={closeBtnRef}
        >
          <X size={20} aria-hidden />
        </button>
      </div>
    </aside>
  );
}

export default AsideNavbar;
