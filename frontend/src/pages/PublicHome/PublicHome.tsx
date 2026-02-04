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
      {/* Header */}
      <header className="public-home-header">
        <Link to="/" className="public-home-header-logo">
          <img src={Logo} alt="Bear Beat" />
        </Link>
        <div className="public-home-header-actions">
          <Link to="/auth" className="public-home-header-link">Iniciar sesión</Link>
          <Link to="/auth/registro" className="public-home-header-btn">Registrarme</Link>
        </div>
      </header>

      {/* Hero */}
      <section className="public-home-hero">
        <p className="public-home-tagline-hero">La librería que no te deja colgado</p>
        <h1 className="public-home-headline landing-title">
          Nunca más digas &quot;no lo tengo&quot;
        </h1>
        <p className="public-home-hero-desc">
          Música y videos exclusivos para DJs. Todo el catálogo organizado por géneros. Descarga masiva vía FTP con FileZilla o Air Explorer. 500 GB cada mes, contenido nuevo cada semana.
        </p>
        <div className="public-home-hero-ctas">
          <Link to="/auth/registro" className="public-home-btn public-home-btn-primary">
            Quiero mi acceso ahora
          </Link>
          <Link to="/planes" className="public-home-btn public-home-btn-secondary">
            Ver planes desde $18/mes
          </Link>
        </div>
        <div className="public-home-stats">
          <span><strong>500 GB</strong> cada mes · FTP masivo</span>
          <span><strong>Por géneros</strong> todo organizado</span>
          <span><strong>Cancelas</strong> cuando quieras</span>
          <span><strong>Pago seguro</strong> Visa · Mastercard · PayPal · SPEI</span>
        </div>
      </section>

      {/* Lo que pierdes */}
      <section className="public-home-bento">
        <h2 className="public-home-section-title">Lo que pierdes si sigues sin Bear Beat</h2>
        <p className="public-home-bento-intro">
          Tu imagen depende de tener el tema
        </p>
        <p className="public-home-bento-intro-sub">
          Una pista que no tienes = pista que no suena
        </p>
        <p className="public-home-bento-desc">
          Música y videos exclusivos para DJs. Todo el catálogo organizado por géneros. Descarga masiva vía FTP con FileZilla o Air Explorer. 500 GB al mes, contenido nuevo cada semana.
        </p>
        <div className="public-home-bento-grid">
          <div className="public-home-bento-card">
            <PiMusicNotes className="public-home-bento-icon" />
            <h3>Exclusivo para DJs</h3>
            <p>Música y video · todo por géneros</p>
          </div>
          <div className="public-home-bento-card">
            <PiDownloadSimple className="public-home-bento-icon" />
            <h3>Descarga masiva vía FTP</h3>
            <p>Catálogo organizado por géneros. FileZilla o Air Explorer: conectas, eliges la carpeta del género que quieras y bajas en bloque. Credenciales en Mi Cuenta.</p>
          </div>
          <div className="public-home-bento-card">
            <PiShieldCheck className="public-home-bento-icon" />
            <h3>Pagos legales, sin líos</h3>
            <p>Stripe, PayPal, SPEI. Facturación en regla para venues y cadenas.</p>
          </div>
          <div className="public-home-bento-card">
            <PiHeadset className="public-home-bento-icon" />
            <h3>Soporte cuando lo necesites</h3>
            <p>Chat y teléfono para DJs</p>
          </div>
          <div className="public-home-bento-card">
            <PiFolder className="public-home-bento-icon" />
            <h3>Sin ataduras</h3>
            <p>Renovación automática. Cancela cuando quieras.</p>
          </div>
        </div>
      </section>

      {/* En 3 pasos */}
      <section className="public-home-steps">
        <h2 className="public-home-section-title">En 3 pasos estás descargando</h2>
        <div className="public-home-steps-cards">
          <div className="public-home-step-card">
            <span className="public-home-step-num">01</span>
            <h3>Regístrate</h3>
            <p>Cuenta en menos de un minuto. Sin tarjeta para probar.</p>
          </div>
          <div className="public-home-step-card">
            <span className="public-home-step-num">02</span>
            <h3>Elige tu plan</h3>
            <p>Desde $18 USD o $350 MXN al mes. Tarjeta, PayPal o SPEI.</p>
          </div>
          <div className="public-home-step-card">
            <span className="public-home-step-num">03</span>
            <h3>Descarga masiva</h3>
            <p>Credenciales FTP en Mi Cuenta. FileZilla o Air Explorer y bajas todo lo que quieras.</p>
          </div>
        </div>
        <p className="public-home-steps-sub">
          Menos de lo que cobras por una hora — librería todo el mes
        </p>
      </section>

      {/* Precios */}
      <section className="public-home-pricing">
        <div className="public-home-price-card">
          <span className="public-home-price-currency">USD</span>
          <span className="public-home-price-amount">$18</span>
          <span className="public-home-price-period">/ mes</span>
          <p className="public-home-price-desc">500 GB. Tarjeta o PayPal. Ideal para USA y Latinoamérica.</p>
          <Link to="/planes" className="public-home-btn public-home-btn-primary">Quiero el plan USD</Link>
        </div>
        <div className="public-home-price-card">
          <span className="public-home-price-country">México</span>
          <span className="public-home-price-currency">MXN</span>
          <span className="public-home-price-amount">$350</span>
          <span className="public-home-price-period">/ mes</span>
          <p className="public-home-price-desc">500 GB. SPEI, tarjeta o PayPal. Facturación incluida.</p>
          <Link to="/planes" className="public-home-btn public-home-btn-primary">Quiero el plan MXN</Link>
        </div>
      </section>

      {/* Descarga masiva FTP */}
      <section className="public-home-ftp">
        <h2 className="public-home-section-title">Descarga masiva: FileZilla o Air Explorer</h2>
        <p className="public-home-ftp-desc">
          Todo el contenido es exclusivo para DJs y está organizado por géneros. Usuario y contraseña FTP en Mi Cuenta. Con FileZilla o Air Explorer te conectas, eliges el género o las carpetas que quieras y bajas en bloque. Instrucciones paso a paso dentro.
        </p>
        <Link to="/auth/registro" className="public-home-btn public-home-btn-primary public-home-btn-cta">
          Quiero empezar ya
        </Link>
      </section>

      {/* CTA final */}
      <section className="public-home-cta">
        <p className="public-home-cta-text">
          La próxima vez que pidan un tema, que no sea porque no lo tienes
        </p>
        <p className="public-home-cta-sub">
          Cuenta gratis. Sin compromiso. Cancela cuando quieras.
        </p>
        <Link to="/auth/registro" className="public-home-btn public-home-btn-primary public-home-btn-large">
          Dame mi acceso a Bear Beat
        </Link>
      </section>

      {/* Footer */}
      <footer className="public-home-footer">
        <Link to="/" className="public-home-footer-logo">
          <img src={Logo} alt="Bear Beat" />
        </Link>
        <div className="public-home-footer-links">
          <Link to="/auth">Iniciar sesión</Link>
          <Link to="/auth/registro">Registrarme</Link>
          <a href="/#soporte" className="public-home-footer-soporte">Soporte</a>
        </div>
        <p className="public-home-footer-copy">© Bear Beat. Todos los derechos reservados.</p>
      </footer>
    </div>
  );
}

export default PublicHome;
