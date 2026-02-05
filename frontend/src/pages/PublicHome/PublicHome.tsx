import { Link } from "react-router-dom";
import { useRef, useEffect, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faSun, faMoon, faCircleHalfStroke, faClock } from "@fortawesome/free-solid-svg-icons";
import { useTheme } from "../../contexts/ThemeContext";
import type { ThemeMode } from "../../contexts/ThemeContext";
import Logo from "../../assets/images/osonuevo.png";
import {
  PiFiles,
  PiHardDrives,
  PiCalendar,
  PiHeadset,
  PiVideoCamera,
  PiFolderOpen,
  PiLightning,
  PiMusicNotes,
  PiWarning,
  PiCheckCircle,
} from "react-icons/pi";
import GenreTicker from "../../components/GenreTicker/GenreTicker";
import { trackManyChatConversion, MC_EVENTS } from "../../utils/manychatPixel";
import "./PublicHome.scss";

const THEME_OPTIONS: { value: ThemeMode; label: string; icon: typeof faSun }[] = [
  { value: "light", label: "Claro", icon: faSun },
  { value: "dark", label: "Oscuro", icon: faMoon },
  { value: "system", label: "Según sistema", icon: faCircleHalfStroke },
  { value: "schedule", label: "Por horario", icon: faClock },
];

function PublicHome() {
  const { mode, theme, setMode } = useTheme();
  const [themeMenuOpen, setThemeMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    trackManyChatConversion(MC_EVENTS.VIEW_HOME);
  }, []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setThemeMenuOpen(false);
      }
    }
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, []);

  return (
    <div className="ph">
      {/* 1. NAVBAR — Minimalista & Sticky */}
      <header className="ph__nav">
        <Link to="/" className="ph__nav-logo">
          <img src={Logo} alt="Bear Beat" />
        </Link>
        <div className="ph__nav-actions">
          <div className="ph__theme-wrap" ref={menuRef}>
            <button
              type="button"
              className="ph__theme-btn"
              onClick={() => setThemeMenuOpen((o) => !o)}
              title={THEME_OPTIONS.find((o) => o.value === mode)?.label ?? "Tema"}
              aria-label="Cambiar tema"
            >
              <FontAwesomeIcon icon={theme === "light" ? faSun : faMoon} />
            </button>
            {themeMenuOpen && (
              <div className="ph__theme-dropdown">
                {THEME_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    className={mode === opt.value ? "ph__theme-dropdown-item--active" : ""}
                    onClick={() => {
                      setMode(opt.value);
                      setThemeMenuOpen(false);
                    }}
                  >
                    <FontAwesomeIcon icon={opt.icon} />
                    <span>{opt.label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <Link to="/auth" state={{ from: "/planes" }} className="ph__nav-btn ph__nav-btn--ghost" onClick={() => trackManyChatConversion(MC_EVENTS.CLICK_CTA_REGISTER)}>
            Iniciar Sesión
          </Link>
          <Link to="/auth/registro" state={{ from: "/planes" }} className="ph__nav-btn ph__nav-btn--primary" onClick={() => trackManyChatConversion(MC_EVENTS.CLICK_CTA_REGISTER)}>
            Obtener Acceso
          </Link>
        </div>
      </header>

      {/* 2. HERO — El Gancho */}
      <section className="ph__hero">
        <div className="ph__hero-bg" aria-hidden />
        <h1 className="ph__hero-h1">
          El Arsenal de 12.5 TB que te convierte en el DJ que nunca falla.
        </h1>
        <h2 className="ph__hero-h2">
          Descarga masiva vía FTP. Música, Video (93% del catálogo) y Karaokes organizados por carpetas. Mientras duermes, tu disco duro se llena.
        </h2>
        <Link to="/auth/registro" state={{ from: "/planes" }} className="ph__hero-cta" onClick={() => trackManyChatConversion(MC_EVENTS.CLICK_CTA_REGISTER)}>
          QUIERO BLINDAR MI LIBRERÍA →
        </Link>
        <p className="ph__hero-micro">
          Cancela cuando quieras • Acceso Inmediato
        </p>
      </section>

      {/* 2.5 TICKER DE GÉNEROS */}
      <GenreTicker />

      {/* 3. BARRA DE AUTORIDAD */}
      <section className="ph__authority">
        <div className="ph__authority-inner">
          <span className="ph__authority-item">
            <PiFiles className="ph__authority-icon" aria-hidden />
            195,000+ Archivos
          </span>
          <span className="ph__authority-item">
            <PiHardDrives className="ph__authority-icon" aria-hidden />
            12.35 TB de Contenido
          </span>
          <span className="ph__authority-item">
            <PiCalendar className="ph__authority-icon" aria-hidden />
            Actualización Semanal
          </span>
          <span className="ph__authority-item">
            <PiHeadset className="ph__authority-icon" aria-hidden />
            Soporte Humano (Chat/Tel)
          </span>
        </div>
      </section>

      {/* 4. SECCIÓN DE DOLOR */}
      <section className="ph__pain">
        <h2 className="ph__pain-title">¿Cuánto te cuesta decir &quot;No la tengo&quot;?</h2>
        <div className="ph__pain-grid">
          <div className="ph__pain-card ph__pain-card--bad">
            <PiWarning className="ph__pain-icon" aria-hidden />
            <h3>DJ Amateur</h3>
            <p>Estresado, buscando en YouTube, mala calidad. Una pista que no tienes = una pista que no suena.</p>
          </div>
          <div className="ph__pain-card ph__pain-card--good">
            <PiCheckCircle className="ph__pain-icon" aria-hidden />
            <h3>DJ Bear Beat</h3>
            <p>Tranquilo, carpeta lista. No arriesgues tu reputación dependiendo del WiFi del lugar.</p>
          </div>
        </div>
      </section>

      {/* 5. VALUE STACK — Bento Grid */}
      <section className="ph__bento">
        <h2 className="ph__section-title">Todo lo que necesitas en un solo lugar</h2>
        <div className="ph__bento-grid">
          <div className="ph__bento-card ph__bento-card--large">
            <PiVideoCamera className="ph__bento-icon" aria-hidden />
            <h3>Especialistas en Video Remixes (11.5 TB)</h3>
            <p>Lo que nadie más tiene.</p>
          </div>
          <div className="ph__bento-card">
            <PiFolderOpen className="ph__bento-icon" aria-hidden />
            <h3>Estructura Inteligente</h3>
            <p>Género &gt; Año &gt; Mes. Ahorra 10 horas de trabajo de oficina.</p>
          </div>
          <div className="ph__bento-card">
            <PiLightning className="ph__bento-icon" aria-hidden />
            <h3>Servidores FTP de Alta Velocidad</h3>
            <p>Sin límites de bajada.</p>
          </div>
          <div className="ph__bento-card">
            <PiMusicNotes className="ph__bento-icon" aria-hidden />
            <h3>Catálogo Completo</h3>
            <p>Desde Cumbias Wepa y Corridos hasta Tech House y Retro 80s.</p>
          </div>
        </div>
      </section>

      {/* 6. PRECIOS — The Pricing Stack: encabezados sólidos, México estrella */}
      <section className="ph__pricing">
        <h2 className="ph__section-title">Planes que se pagan solos</h2>
        <div className="ph__pricing-grid">
          <div className="ph__price-card ph__price-card--global">
            <div className="ph__price-header ph__price-header--global">GLOBAL / USA</div>
            <div className="ph__price-body">
              <span className="ph__price-amount">$18</span>
              <span className="ph__price-period">USD / mes</span>
              <p className="ph__price-anchor">Menos de lo que cobras por 20 min de show.</p>
              <ul className="ph__price-features">
                <li>500 GB descarga</li>
                <li>Acceso Total</li>
                <li>Tarjeta / PayPal</li>
              </ul>
              <Link to="/auth/registro" state={{ from: "/planes" }} className="ph__btn ph__btn--primary" onClick={() => trackManyChatConversion(MC_EVENTS.CLICK_PLAN_USD)}>
                Quiero el plan USD
              </Link>
            </div>
          </div>
          <div className="ph__price-card ph__price-card--mexico">
            <span className="ph__price-badge">MEJOR OPCIÓN</span>
            <div className="ph__price-header ph__price-header--mexico">MÉXICO (SPEI/FACTURA)</div>
            <div className="ph__price-body">
              <span className="ph__price-amount">$350</span>
              <span className="ph__price-period">MXN / mes</span>
              <div className="ph__price-payment-methods" aria-label="Métodos de pago">
                <span className="ph__price-pay-label ph__price-pay-label--oxxo">OXXO</span>
                <span className="ph__price-pay-label ph__price-pay-label--spei">SPEI</span>
              </div>
              <p className="ph__price-cash-cta">¡Paga en efectivo en OXXO o Transferencia Directa!</p>
              <ul className="ph__price-features">
                <li>500 GB descarga</li>
                <li>SPEI, OXXO, Tarjeta</li>
              </ul>
              <Link to="/auth/registro" state={{ from: "/planes" }} className="ph__btn ph__btn--primary" onClick={() => trackManyChatConversion(MC_EVENTS.CLICK_PLAN_MXN)}>
                Quiero el plan MXN
              </Link>
            </div>
          </div>
        </div>
        <p className="ph__guarantee">Garantía de Satisfacción</p>
      </section>

      {/* 7. FOOTER */}
      <footer className="ph__footer">
        <Link to="/" className="ph__footer-logo">
          <img src={Logo} alt="Bear Beat" />
        </Link>
        <div className="ph__footer-links">
          <Link to="/auth" state={{ from: "/planes" }}>Iniciar sesión</Link>
          <Link to="/auth/registro" state={{ from: "/planes" }}>Registrarme</Link>
          <a href="/#soporte">Soporte</a>
        </div>
        <p className="ph__footer-payments">
          Pagos seguros: Stripe · PayPal · Conekta
        </p>
        <p className="ph__footer-copy">© Bear Beat. Todos los derechos reservados.</p>
      </footer>
    </div>
  );
}

export default PublicHome;
