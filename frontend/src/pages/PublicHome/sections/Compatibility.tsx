import { Link } from "react-router-dom";
import { HOME_COMPATIBILITY_ITEMS } from "../homeCopy";

export default function Compatibility() {
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

        <div className="compatibility__compare" role="list" aria-label="Opciones de descarga">
          <article className="compatibility__card compatibility__card--primary" role="listitem">
            <p className="compatibility__tag">FTP</p>
            <h3>{ftp?.title ?? "Descargas por FTP"}</h3>
            <p>{ftp?.body}</p>
          </article>
          <article className="compatibility__card" role="listitem">
            <p className="compatibility__tag">Web</p>
            <h3>{web?.title ?? "También por web"}</h3>
            <p>{web?.body}</p>
          </article>
        </div>

        <div className="compatibility__extras" role="list" aria-label="Detalles">
          <article className="compatibility__card compatibility__card--soft" role="listitem">
            <h3>{formats?.title ?? "Formatos comunes"}</h3>
            <p>{formats?.body}</p>
          </article>
          <article className="compatibility__card compatibility__card--soft" role="listitem">
            <h3>{workflow?.title ?? "Tu software, tu forma"}</h3>
            <p>{workflow?.body}</p>
          </article>
        </div>

        <div className="compatibility__cta">
          <Link to="/instrucciones" className="home-link">
            Ver instrucciones de descarga →
          </Link>
          <a href="#faq-formats" className="home-link">
            Ver formatos en el FAQ →
          </a>
        </div>
      </div>
    </section>
  );
}
