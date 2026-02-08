import "./AsideNavbar.scss";
import { useUserContext } from "../../contexts/UserContext";
import { useLocation } from "react-router-dom";
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
  Headphones,
  UserRound,
  Shield,
  LogOut,
} from "lucide-react";
import { Link } from "react-router-dom";
import { trackManyChatConversion, MC_EVENTS } from "../../utils/manychatPixel";
import { SUPPORT_CHAT_URL, openSupportChat } from "../../utils/supportChat";

interface AsideNavbarPropsI {
  show: boolean;
  onHide: () => void;
}

function AsideNavbar(props: AsideNavbarPropsI) {
  const { currentUser, resetCard, handleLogout } = useUserContext();
  const { show, onHide } = props;
  const location = useLocation();

  const handleLinkClick = () => {
    resetCard();
    onHide();
  };

  const handleSupportClick = () => {
    trackManyChatConversion(MC_EVENTS.CLICK_CHAT);
    onHide();
    openSupportChat();
  };

  const handleSupportLinkClick = () => {
    trackManyChatConversion(MC_EVENTS.CLICK_CHAT);
    handleLinkClick();
  };

  const linkProps = { onClick: onHide };

  return (
    <aside className={show ? "open" : ""} aria-hidden={!show}>
      {/* Mobile: backdrop to close on tap outside */}
      {show && <div className="aside-backdrop" onClick={onHide} aria-hidden />}
      <div className="aside-inner" onClick={(e) => e.stopPropagation()}>
        <div className="aside-drawer-header">
          <span className="aside-drawer-title">Menú</span>
        </div>
        <div className="nav-container">
          <h2 className="nav-title">Contenido</h2>
          <div className="nav-links-wrap">
            {location.pathname.startsWith("/admin/") ? (
              <ul className="nav-list">
                <li><Link to="/admin/usuarios" {...linkProps}><Users size={18} aria-hidden /> Usuarios</Link></li>
                <li><Link to="/admin/planesAdmin" {...linkProps}><ShoppingCart size={18} aria-hidden /> Planes</Link></li>
                <li><Link to="/admin/ordenes" {...linkProps}><Receipt size={18} aria-hidden /> Ordenes</Link></li>
                <li><Link to="/admin/cupones" {...linkProps}><Ticket size={18} aria-hidden /> Cupones</Link></li>
                <li><Link to="/admin/almacenamiento" {...linkProps}><Database size={18} aria-hidden /> Almacenamiento</Link></li>
                <li><Link to="/admin/catalogo" {...linkProps}><BarChart3 size={18} aria-hidden /> Catálogo</Link></li>
                <li><Link to="/admin/analitica" {...linkProps}><BarChart3 size={18} aria-hidden /> Analítica</Link></li>
                <li><Link to="/admin/crm" {...linkProps}><Users size={18} aria-hidden /> CRM</Link></li>
                <li><Link to="/admin/live" {...linkProps}><Activity size={18} aria-hidden /> Live</Link></li>
                <li><Link to="/admin/historial-descargas" {...linkProps}><Download size={18} aria-hidden /> Descargas</Link></li>
                <li><Link to="/admin/historialCheckout" {...linkProps}><FileText size={18} aria-hidden /> Checkout</Link></li>
                <li><Link to="/admin/dominios-bloqueados" {...linkProps}><Ban size={18} aria-hidden /> Dominios</Link></li>
                <li><Link to="/admin/telefonos-bloqueados" {...linkProps}><Phone size={18} aria-hidden /> Telefonos</Link></li>
                <li>
                  <a
                    href={SUPPORT_CHAT_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={handleSupportLinkClick}
                    aria-label="Abrir chat de soporte"
                  >
                    <Headphones size={18} aria-hidden /> Soporte
                  </a>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => {
                      handleLogout();
                      onHide();
                    }}
                    aria-label="Cerrar sesión"
                  >
                    <LogOut size={18} aria-hidden /> Cerrar sesión
                  </button>
                </li>
              </ul>
            ) : (
              <ul className="nav-list">
                <li><Link to="/" onClick={handleLinkClick}><FolderOpen size={18} aria-hidden /> Todos los archivos</Link></li>
                {!currentUser?.hasActiveSubscription || currentUser.isSubscriptionCancelled ? (
                  <li><Link to="/planes" {...linkProps}><ShoppingCart size={18} aria-hidden /> Planes</Link></li>
                ) : (
                  <li><Link to="/actualizar-planes" {...linkProps}><ArrowUpCircle size={18} aria-hidden /> Actualiza tu plan</Link></li>
                )}
                {currentUser?.role === "admin" && (
                  <li><Link to="/admin/usuarios" {...linkProps}><Shield size={18} aria-hidden /> Admin</Link></li>
                )}
                <li><Link to="/micuenta" {...linkProps}><UserRound size={18} aria-hidden /> Mi cuenta</Link></li>
                <li><Link to="/instrucciones" {...linkProps}><HelpCircle size={18} aria-hidden /> Instrucciones</Link></li>
                <li><Link to="/legal" {...linkProps}><FileText size={18} aria-hidden /> FAQ y políticas</Link></li>
                <li>
                  <a
                    href={SUPPORT_CHAT_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={handleSupportLinkClick}
                    aria-label="Abrir chat de soporte"
                  >
                    <Headphones size={18} aria-hidden /> Soporte
                  </a>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => {
                      handleLogout();
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
        >
          <X size={20} aria-hidden />
        </button>
      </div>
      <button
        type="button"
        className="btnSupport btnSupport-float"
        onClick={handleSupportClick}
        aria-label="Abrir chat de soporte"
      >
        <Headphones size={24} aria-hidden />
      </button>
    </aside>
  );
}

export default AsideNavbar;
