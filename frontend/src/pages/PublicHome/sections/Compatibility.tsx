import { Link } from "react-router-dom";
import { HOME_COMPATIBILITY_ITEMS } from "../homeCopy";

type CompatibilityProps = {
  onFaqScroll?: () => void;
};

export default function Compatibility({ onFaqScroll }: CompatibilityProps) {
  const ftp = HOME_COMPATIBILITY_ITEMS[0];
  const web = HOME_COMPATIBILITY_ITEMS[1];
  const formats = HOME_COMPATIBILITY_ITEMS[2];
  const workflow = HOME_COMPATIBILITY_ITEMS[3];

  return (
    <section className="compatibility" aria-label="Compatibilidad y formatos">
      <div className="ph__container">
        <h2 className="home-h2">Compatible con tu flujo</h2>
        <p className="home-sub">
          FTP o web: tú eliges. Descargas a tu computadora e importas a tu software como siempre.
        </p>

        <ul className="compatibility__compare" aria-label="Opciones de descarga">
          <li className="compatibility__card compatibility__card--primary">
            <p className="compatibility__tag">FTP</p>
            <h3>{ftp?.title ?? "Descargas por FTP"}</h3>
            <p>{ftp?.body}</p>
            <p className="compatibility__hint">Recomendado para descargas grandes.</p>
          </li>
          <li className="compatibility__card">
            <p className="compatibility__tag">Web</p>
            <h3>{web?.title ?? "También por web"}</h3>
            <p>{web?.body}</p>
            <p className="compatibility__hint">Útil para archivos puntuales.</p>
          </li>
        </ul>

        <ul className="compatibility__extras" aria-label="Detalles">
          <li className="compatibility__card compatibility__card--soft">
            <h3>{formats?.title ?? "Formatos comunes"}</h3>
            <p>{formats?.body}</p>
          </li>
          <li className="compatibility__card compatibility__card--soft">
            <h3>{workflow?.title ?? "Tu software, tu forma"}</h3>
            <p>{workflow?.body}</p>
          </li>
        </ul>

        <div className="compatibility__cta">
          <Link to="/instrucciones" className="home-link">
            Ver instrucciones de descarga →
          </Link>
          <button
            type="button"
            className="home-link"
            onClick={() => {
              onFaqScroll?.();
            }}
          >
            Ver formatos en el FAQ →
          </button>
        </div>
      </div>
    </section>
  );
}
