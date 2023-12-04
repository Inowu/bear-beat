import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useUserContext } from "../../contexts/UserContext";
import osoLogo from "../../assets/images/oso-icon.png";
import "./Navbar.scss";
import {
  faUserCircle,
  faSignOutAlt,
  faBars,
  faShield,
} from "@fortawesome/free-solid-svg-icons";
import { Link } from "react-router-dom";
import { SetStateAction, useEffect } from "react";

interface NavbarPropsI {
  setAsideOpen: React.Dispatch<SetStateAction<boolean>>;
}

function Navbar(props: NavbarPropsI) {
  const { handleLogout, currentUser } = useUserContext();
  const { setAsideOpen } = props;
//   useEffect(() => {
// }, [currentUser])
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
        {
          currentUser?.role === "admin" &&
          <Link to={"/admin"}>
            <li>
              <FontAwesomeIcon icon={faShield} /> <span>Admin</span>
            </li>
          </Link>
        }
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
