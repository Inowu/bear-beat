import { useUserContext } from "../../contexts/UserContext";
import osoLogo from "../../assets/images/oso-icon.png";
import "./Navbar.scss";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faUserCircle, faSignOutAlt } from "@fortawesome/free-solid-svg-icons";

function Navbar() {
  const { handleLogout } = useUserContext();
  return (
    <nav>
      <div className="header">
        <img src={osoLogo} alt="" />
        <h2>Bear Beat</h2>
      </div>
      <ul>
        <li>
          <FontAwesomeIcon icon={faUserCircle} /> Mi cuenta
        </li>
        <li onClick={handleLogout}>
          <FontAwesomeIcon icon={faSignOutAlt} /> Cerrar sesión
        </li>
      </ul>
    </nav>
  );
}

export default Navbar;
