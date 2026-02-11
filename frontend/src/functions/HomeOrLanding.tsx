import { Suspense, lazy } from "react";
import { useUserContext } from "../contexts/UserContext";
import PublicHome from "../pages/PublicHome/PublicHome";

const Home = lazy(() => import("../pages/Home/Home"));

/**
 * En "/" muestra:
 * - PublicHome (landing) si el usuario NO está logueado
 * - Home (explorador de archivos) si está logueado
 * No rompe reglas: el resto de rutas siguen protegidas con AuthRoute.
 */
function HomeOrLanding() {
  const { userToken } = useUserContext();

  if (userToken) {
    return (
      <Suspense fallback={null}>
        <Home />
      </Suspense>
    );
  }

  return <PublicHome />;
}

export default HomeOrLanding;
