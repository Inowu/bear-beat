import { Outlet } from "react-router-dom";

/**
 * Layout para rutas de la app (landing, instrucciones, mi cuenta, etc.).
 * Solo renderiza el hijo correspondiente a la ruta actual.
 */
function LandingOrAuthRoute() {
  return <Outlet />;
}

export default LandingOrAuthRoute;
