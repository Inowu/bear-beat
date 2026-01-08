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
} from "@fortawesome/free-solid-svg-icons";
import { faHeadset } from "@fortawesome/free-solid-svg-icons";
import { Link } from "react-router-dom";

interface AsideNavbarPropsI {
  show: boolean;
  onHide: () => void;
}

function AsideNavbar(props: AsideNavbarPropsI) {
  const { currentUser, resetCard } = useUserContext();
  const { show, onHide } = props;
  const location = useLocation();
  const goTo = () => {
    resetCard();
  };

  const handleButtonClick = () => {
    window.location.href = "tel:+3521005329";
  };
  return (
    <aside className={show ? "open" : ""}>
      <img src={Logo} alt="bear beat" />
      <div className="nav-container">
        <h2>Contenido</h2>
        {location.pathname.startsWith("/admin/") ? (
          <ul>
            <Link to={"/admin/usuarios"}>
              <li>
                <FontAwesomeIcon icon={faUserCircle} /> Usuarios
              </li>
            </Link>
            <Link to={"/admin/planesAdmin"}>
              <li>
                <FontAwesomeIcon icon={faCartPlus} /> Planes
              </li>
            </Link>
            <Link to={"/admin/ordenes"}>
              <li>
                <FontAwesomeIcon icon={faAddressBook} /> Ordenes
              </li>
            </Link>
            <Link to={"/admin/cupones"}>
              <li>
                <FontAwesomeIcon icon={faTicket} /> Cupones
              </li>
            </Link>
            <Link to={"/admin/almacenamiento"}>
              <li>
                <FontAwesomeIcon icon={faDatabase} /> Almacenamiento
              </li>
            </Link>
            <Link to={"/admin/historial-descargas"}>
              <li>
                <FontAwesomeIcon icon={faDownload} /> Descargas
              </li>
            </Link>
            <Link to={"/admin/historialCheckout"}>
              <li>
                <FontAwesomeIcon icon={faTag} /> Checkout
              </li>
            </Link>
            <Link to={"/admin/dominios-bloqueados"}>
              <li>
                <FontAwesomeIcon icon={faBan} /> Dominios
              </li>
            </Link>
            <Link to={"/admin/telefonos-bloqueados"}>
              <li>
                <FontAwesomeIcon icon={faPhone} /> Telefonos
              </li>
            </Link>
          </ul>
        ) : (
          <ul>
            <Link to={"/"} onClick={goTo}>
              <li>
                <FontAwesomeIcon icon={faFolder} /> Todos los archivos
              </li>
            </Link>
            {!currentUser?.hasActiveSubscription || currentUser.isSubscriptionCancelled ? (
              <Link to={"/planes"}>
                <li>
                  <FontAwesomeIcon icon={faCartPlus} /> Get plan
                </li>
              </Link>
            ) : (
              <Link to={"/actualizar-planes"}>
                <li>
                  <FontAwesomeIcon icon={faArrowAltCircleUp} /> Actualiza tu plan
                </li>
              </Link>
            )}
            <Link to={"/micuenta"}>
              <li>
                <FontAwesomeIcon icon={faUserCircle} /> Mi cuenta
              </li>
            </Link>
            <Link to={"/instrucciones"}>
              <li>
                <FontAwesomeIcon icon={faQuestion} /> Instrucciones
              </li>
            </Link>
          </ul>
        )}
      </div>
      <div onClick={handleButtonClick} className="btnSupport">
        <FontAwesomeIcon icon={faHeadset} style={{ fontSize: "25px" }} />
      </div>
    </aside>
  );
}

export default AsideNavbar;
