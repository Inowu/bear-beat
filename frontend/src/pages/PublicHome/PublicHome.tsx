import { Link } from "react-router-dom";
import Logo from "../../assets/images/osonuevo.png";
import {
  PiMusicNotes,
  PiDownloadSimple,
  PiFolder,
  PiShieldCheck,
  PiHeadset,
  PiCheckCircle,
  PiArrowRight,
} from "react-icons/pi";
import "./PublicHome.scss";

function PublicHome() {
  return (
    <div className="public-home-container landing-main-container">
      {/* Hero */}
      <section className="public-home-hero">
        <img className="public-home-logo" src={Logo} alt="Bear Beat" />
        <h1 className="public-home-headline landing-title">
          Nunca más digás &quot;no lo tengo&quot;
        </h1>
        <p className="public-home-hero-sub">
          Descarga masiva por FTP · Música y videos <strong>exclusivos para DJs</strong> · Todo organizado por <strong>géneros</strong>
        </p>
        <div className="public-home-stats">
          <span><strong>+500 GB</strong> en librería</span>
          <span><strong>Música nueva</strong> cada mes</span>
          <span><strong>Cancelación</strong> flexible</span>
        </div>
        <div className="public-home-actions">
          <Link to="/auth/registro" className="public-home-btn public-home-btn-primary">
            Registrarse
          </Link>
          <Link to="/auth" className="public-home-btn public-home-btn-secondary">
            Iniciar sesión
          </Link>
        </div>
      </section>

      {/* Bento: Lo que pierdes */}
      <section className="public-home-bento">
        <h2 className="public-home-section-title">Lo que pierdes si sigues sin Bear Beat</h2>
        <div className="public-home-bento-grid">
          <div className="public-home-bento-card">
            <PiMusicNotes className="public-home-bento-icon" />
            <h3>Perdés requests</h3>
            <p>Si no tenés el tema, no podés tocarlo. La librería está lista para que nunca digas que no.</p>
          </div>
          <div className="public-home-bento-card">
            <PiFolder className="public-home-bento-icon" />
            <h3>Todo por géneros</h3>
            <p>Encontrá rápido lo que necesitás. Música y videos organizados para que armes tus sets sin perder tiempo.</p>
          </div>
          <div className="public-home-bento-card">
            <PiDownloadSimple className="public-home-bento-icon" />
            <h3>Descarga masiva</h3>
            <p>Bajá todo por FTP con FileZilla o Air Explorer. No dependés de un solo dispositivo.</p>
          </div>
          <div className="public-home-bento-card">
            <PiShieldCheck className="public-home-bento-icon" />
            <h3>Pagos legales</h3>
            <p>Suscribite tranquilo. Facturación clara y métodos seguros.</p>
          </div>
          <div className="public-home-bento-card public-home-bento-card-wide">
            <PiHeadset className="public-home-bento-icon" />
            <h3>Soporte cuando lo necesites</h3>
            <p>¿Dudas con la descarga o el FTP? Te ayudamos a tener todo listo para tus fechas.</p>
          </div>
        </div>
      </section>

      {/* Pasos + Precio */}
      <section className="public-home-steps">
        <h2 className="public-home-section-title">En 3 pasos estás descargando</h2>
        <p className="public-home-steps-sub">Registrate, elegí tu plan y accedé a la librería por FTP. Menos de lo que cobras por una hora — librería todo el mes.</p>
        <div className="public-home-steps-list">
          <span><PiCheckCircle /> Crear cuenta</span>
          <span><PiCheckCircle /> Elegir plan</span>
          <span><PiCheckCircle /> Descargar por FTP</span>
        </div>
        <Link to="/auth/registro" className="public-home-btn public-home-btn-primary public-home-btn-cta">
          Empezar ahora <PiArrowRight />
        </Link>
      </section>

      {/* CTA final */}
      <section className="public-home-cta">
        <p className="public-home-cta-text">
          La próxima vez que pidan un tema, que no sea porque no lo tenés.
        </p>
        <p className="public-home-tagline">
          Música y videos <strong>exclusivos para DJs</strong> · Todo organizado por <strong>géneros</strong> · Descarga masiva por FTP
        </p>
        <div className="public-home-actions">
          <Link to="/auth/registro" className="public-home-btn public-home-btn-primary">
            Registrarse
          </Link>
          <Link to="/auth" className="public-home-btn public-home-btn-secondary">
            Iniciar sesión
          </Link>
        </div>
      </section>
    </div>
  );
}

export default PublicHome;
