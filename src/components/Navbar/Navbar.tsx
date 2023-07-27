import { useUserContext } from "../../contexts/UserContext";
import "./Navbar.scss";

function Navbar() {
  const { handleLogout } = useUserContext();
  return (
    <nav>
      <h2>Bear Beat</h2>
      <ul>
        <li>Mi cuenta</li>
        <li onClick={handleLogout}>Cerrar sesión</li>
      </ul>
    </nav>
  );
}

export default Navbar;
