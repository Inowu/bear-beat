import "./AsideNavbar.scss";
import Logo from "../../assets/images/osonuevo.png";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faUserCircle,
  faFolder,
  faCartPlus,
  faQuestion,
} from "@fortawesome/free-solid-svg-icons";
import { Link } from "react-router-dom";

interface AsideNavbarPropsI {
  show: boolean;
  onHide: () => void;
}

function AsideNavbar(props: AsideNavbarPropsI) {
  const { show, onHide } = props;
  return (
    <aside className={show ? "open" : ""}>
      <img src={Logo} alt="bear beat" />
      <div className="nav-container">
        <h2>Contenido</h2>
        <ul>
          <Link to={"/"}>
            <li>
              <FontAwesomeIcon icon={faFolder} /> Todos los archivos
            </li>
          </Link>
          <Link to={"/planes"}>
            <li>
              <FontAwesomeIcon icon={faCartPlus} /> Get plan
            </li>
          </Link>
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
      </div>
    </aside>
  );
}

export default AsideNavbar;
