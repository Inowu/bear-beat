import { Link } from "react-router-dom";
import "./NotFound.scss";

function NotFound() {
  return (
    <section className="not-found-page" aria-labelledby="not-found-title">
      <div className="not-found-card">
        <p className="not-found-code">404</p>
        <h1 id="not-found-title">Esta página no existe</h1>
        <p className="not-found-copy">
          La ruta que intentaste abrir no está disponible. Puedes volver al inicio o revisar los
          planes activos.
        </p>

        <div className="not-found-actions">
          <Link className="not-found-cta not-found-cta--primary" to="/planes">
            Ir a Planes
          </Link>
          <Link className="not-found-cta not-found-cta--secondary btn-back-home" to="/">
            Ir a Inicio
          </Link>
        </div>
      </div>
    </section>
  );
}

export default NotFound;
