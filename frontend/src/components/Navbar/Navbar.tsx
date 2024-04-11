import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useUserContext } from "../../contexts/UserContext";
import { useNavigate } from "react-router-dom";
import osoLogo from "../../assets/images/oso-icon.png";
import "./Navbar.scss";
import {
  faUserCircle,
  faSignOutAlt,
  faBars,
  faShield,
} from "@fortawesome/free-solid-svg-icons";
import { Link } from "react-router-dom";
import { SetStateAction } from "react";

interface NavbarPropsI {
  setAsideOpen: React.Dispatch<SetStateAction<boolean>>;
}

interface AdminToken {
  adminToken: string,
  adminRefreshToken: string
}

function Navbar(props: NavbarPropsI) {
  const { handleLogout, currentUser, handleLogin } = useUserContext();
  const navigate = useNavigate();
  const { setAsideOpen } = props;
  let isAdminAccess = localStorage.getItem("isAdminAccess");

  const goBackAsAdmin = () => {
    if (isAdminAccess) {
      const adminToken: AdminToken = JSON.parse(isAdminAccess);
      handleLogin(adminToken.adminToken, adminToken.adminRefreshToken);
      localStorage.removeItem("isAdminAccess");
      navigate("/micuenta");
    }
  }
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
          <>
            <Link to={"admin/usuarios"}>
              <li>
                <FontAwesomeIcon icon={faShield} /> <span>Admin</span>
              </li>
            </Link>
          </>
        }
        {
          isAdminAccess &&
          <>
              <li onClick={goBackAsAdmin}>
                <FontAwesomeIcon icon={faShield} /> <span>Admin</span>
              </li>
          </>
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
