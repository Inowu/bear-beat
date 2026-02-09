import { Link } from "react-router-dom";
import { HOME_COMPATIBILITY_ITEMS } from "../homeCopy";

export default function Compatibility() {
  return (
    <section className="compatibility" aria-label="Compatibilidad y formatos">
      <div className="ph__container">
        <h2 className="home-h2">Compatible con tu flujo</h2>
        <p className="home-sub">
          Descargas a tu computadora e importas a tu software como siempre. Si nunca usaste FTP, te guiamos.
        </p>

        <ul className="compatibility__grid" aria-label="Compatibilidad">
          {HOME_COMPATIBILITY_ITEMS.map((item) => (
            <li key={item.title} className="compatibility__card">
              <h3>{item.title}</h3>
              <p>{item.body}</p>
            </li>
          ))}
        </ul>

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
