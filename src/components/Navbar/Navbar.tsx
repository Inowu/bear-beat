import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useUserContext } from "../../contexts/UserContext";
import osoLogo from "../../assets/images/oso-icon.png";
import "./Navbar.scss";
import {
  faUserCircle,
  faSignOutAlt,
  faBars,
} from "@fortawesome/free-solid-svg-icons";
import { Link } from "react-router-dom";
import { SetStateAction } from "react";

interface NavbarPropsI {
  setAsideOpen: React.Dispatch<SetStateAction<boolean>>;
}

function Navbar(props: NavbarPropsI) {
  const { handleLogout } = useUserContext();
  const { setAsideOpen } = props;

  return (
    <nav>
      <div className="header">
        <div
          className="burger-btn"
          onClick={() => setAsideOpen((prev) => !prev)}
        >
          <FontAwesomeIcon icon={faBars} />
        </div>
        <img src={osoLogo} alt="" />
        <h2>Bear Beat</h2>
      </div>
      <ul>
        <Link to={"/micuenta"}>
          <li>
            <FontAwesomeIcon icon={faUserCircle} /> <span>Mi cuenta</span>
          </li>
        </Link>
        <li onClick={handleLogout}>
          <FontAwesomeIcon icon={faSignOutAlt} /> <span>Cerrar sesión</span>
        </li>
      </ul>
    </nav>
  );
}

export default Navbar;
