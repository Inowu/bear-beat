import "./AsideNavbar.scss";
import Logo from "../../assets/images/osonuevo.png";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useUserContext } from "../../contexts/UserContext";
import { useLocation } from "react-router-dom";
import {
  faUserCircle,
  faFolder,
  faCartPlus,
  faQuestion,
  faDatabase,
  faTicket,
  faAddressBook,
  faTag,
  faArrowAltCircleUp,
  faDownload,
  faBan,
  faPhone,
  faChartBar,
  faTimes,
  faHeadset,
} from "@fortawesome/free-solid-svg-icons";
import { Link } from "react-router-dom";

interface AsideNavbarPropsI {
  show: boolean;
  onHide: () => void;
}

function AsideNavbar(props: AsideNavbarPropsI) {
  const { currentUser, resetCard } = useUserContext();
  const { show, onHide } = props;
  const location = useLocation();

  const handleLinkClick = () => {
    resetCard();
    onHide();
  };

  const handleSupportClick = () => {
    window.location.href = "tel:+3521005329";
  };

  const linkProps = { onClick: onHide };

  return (
    <aside className={show ? "open" : ""} aria-hidden={!show}>
      {/* Mobile: backdrop to close on tap outside */}
      {show && <div className="aside-backdrop" onClick={onHide} aria-hidden />}
      <div className="aside-inner" onClick={(e) => e.stopPropagation()}>
        <img src={Logo} alt="Bear Beat" className="aside-logo" />
        <div className="nav-container">
          <h2 className="nav-title">Contenido</h2>
          <div className="nav-links-wrap">
            {location.pathname.startsWith("/admin/") ? (
              <ul className="nav-list">
                <li><Link to="/admin/usuarios" {...linkProps}><FontAwesomeIcon icon={faUserCircle} /> Usuarios</Link></li>
                <li><Link to="/admin/planesAdmin" {...linkProps}><FontAwesomeIcon icon={faCartPlus} /> Planes</Link></li>
                <li><Link to="/admin/ordenes" {...linkProps}><FontAwesomeIcon icon={faAddressBook} /> Ordenes</Link></li>
                <li><Link to="/admin/cupones" {...linkProps}><FontAwesomeIcon icon={faTicket} /> Cupones</Link></li>
                <li><Link to="/admin/almacenamiento" {...linkProps}><FontAwesomeIcon icon={faDatabase} /> Almacenamiento</Link></li>
                <li><Link to="/admin/catalogo" {...linkProps}><FontAwesomeIcon icon={faChartBar} /> Catálogo</Link></li>
                <li><Link to="/admin/historial-descargas" {...linkProps}><FontAwesomeIcon icon={faDownload} /> Descargas</Link></li>
                <li><Link to="/admin/historialCheckout" {...linkProps}><FontAwesomeIcon icon={faTag} /> Checkout</Link></li>
                <li><Link to="/admin/dominios-bloqueados" {...linkProps}><FontAwesomeIcon icon={faBan} /> Dominios</Link></li>
                <li><Link to="/admin/telefonos-bloqueados" {...linkProps}><FontAwesomeIcon icon={faPhone} /> Telefonos</Link></li>
              </ul>
            ) : (
              <ul className="nav-list">
                <li><Link to="/" onClick={handleLinkClick}><FontAwesomeIcon icon={faFolder} /> Todos los archivos</Link></li>
                {!currentUser?.hasActiveSubscription || currentUser.isSubscriptionCancelled ? (
                  <li><Link to="/planes" {...linkProps}><FontAwesomeIcon icon={faCartPlus} /> Get plan</Link></li>
                ) : (
                  <li><Link to="/actualizar-planes" {...linkProps}><FontAwesomeIcon icon={faArrowAltCircleUp} /> Actualiza tu plan</Link></li>
                )}
                <li><Link to="/micuenta" {...linkProps}><FontAwesomeIcon icon={faUserCircle} /> Mi cuenta</Link></li>
                <li><Link to="/instrucciones" {...linkProps}><FontAwesomeIcon icon={faQuestion} /> Instrucciones</Link></li>
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
          <FontAwesomeIcon icon={faTimes} />
        </button>
      </div>
      <button
        type="button"
        className="btnSupport"
        onClick={handleSupportClick}
        aria-label="Llamar a soporte"
      >
        <FontAwesomeIcon icon={faHeadset} style={{ fontSize: "25px" }} />
      </button>
    </aside>
  );
}

export default AsideNavbar;
