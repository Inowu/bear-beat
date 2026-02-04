import { useUserContext } from "../contexts/UserContext";
import Home from "../pages/Home/Home";
import PublicHome from "../pages/PublicHome/PublicHome";

/**
 * En "/" muestra:
 * - PublicHome (landing) si el usuario NO está logueado
 * - Home (explorador de archivos) si está logueado
 * No rompe reglas: el resto de rutas siguen protegidas con AuthRoute.
 */
function HomeOrLanding() {
  const { userToken } = useUserContext();

  if (userToken) {
    return <Home />;
  }

  return <PublicHome />;
}

export default HomeOrLanding;
