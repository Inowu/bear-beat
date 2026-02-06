import { Link } from "react-router-dom";
import { useRef, useEffect, useState, type RefObject } from "react";
import { motion, AnimatePresence, useInView, animate, type Variants } from "framer-motion";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faSun, faMoon, faCircleHalfStroke, faClock } from "@fortawesome/free-solid-svg-icons";
import { useTheme } from "../../contexts/ThemeContext";
import type { ThemeMode } from "../../contexts/ThemeContext";
import Logo from "../../assets/images/osonuevo.png";
import {
  PiVideoCamera,
  PiFolderOpen,
  PiLightning,
  PiWarning,
  PiCheckCircle,
} from "react-icons/pi";
import { trackManyChatConversion, MC_EVENTS } from "../../utils/manychatPixel";
import "./PublicHome.scss";

const THEME_OPTIONS: { value: ThemeMode; label: string; icon: typeof faSun }[] = [
  { value: "light", label: "Claro", icon: faSun },
  { value: "dark", label: "Oscuro", icon: faMoon },
  { value: "system", label: "Según sistema", icon: faCircleHalfStroke },
  { value: "schedule", label: "Por horario", icon: faClock },
];

type PriceRegion = "global" | "mexico";
const BEAR_EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

/** Simula detección de IP México (por ahora). En producción: llamar a API geolocalización. */
function detectMexicoRegion(): boolean {
  if (typeof window === "undefined") return false;
  const simulated = localStorage.getItem("bear_region_mexico");
  if (simulated !== null) return simulated === "true";
  return navigator.language === "es-MX" || navigator.language.startsWith("es-");
}

function useCountUp(end: number, duration = 1.5, startOnView = false, ref: RefObject<Element> | null = null) {
  const [count, setCount] = useState(0);
  const inView = useInView(ref ?? ({ current: null } as RefObject<Element>), { once: true, amount: 0.2 });

  useEffect(() => {
    const shouldRun = startOnView ? inView : true;
    if (!shouldRun) return;

    const controls = animate(0, end, {
      duration,
      ease: "easeOut",
      onUpdate: (v) => setCount(Math.round(v)),
    });
    return () => controls.stop();
  }, [end, duration, startOnView, inView]);

  return count;
}

const heroVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.15,
      delayChildren: 0.1,
    },
  },
};

const heroItemVariants: Variants = {
  hidden: { opacity: 0, y: 24 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: BEAR_EASE },
  },
};

const bentoGridVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.3,
    },
  },
};

function CompareSlider() {
  const [active, setActive] = useState<"amateur" | "pro">("amateur");
  return (
    <div className="ph__compare-slider">
      <div className="ph__compare-toggle">
        <button
          type="button"
          className={`ph__compare-toggle-btn ${active === "amateur" ? "ph__compare-toggle-btn--active" : ""}`}
          onClick={() => setActive("amateur")}
          aria-pressed={active === "amateur"}
        >
          DJ Amateur
        </button>
        <button
          type="button"
          className={`ph__compare-toggle-btn ${active === "pro" ? "ph__compare-toggle-btn--active" : ""}`}
          onClick={() => setActive("pro")}
          aria-pressed={active === "pro"}
        >
          DJ Bear Beat
        </button>
      </div>
      <AnimatePresence mode="wait">
        {active === "amateur" ? (
          <motion.div
            key="amateur"
            className="ph__compare-slider-card ph__compare-slider-card--bad"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            transition={{ duration: 0.3 }}
          >
            <PiWarning className="ph__compare-icon" aria-hidden />
            <h3>DJ Amateur</h3>
            <p>Estresado, YouTube, mala calidad. Una pista que no tienes = una pista que no suena.</p>
          </motion.div>
        ) : (
          <motion.div
            key="pro"
            className="ph__compare-slider-card ph__compare-slider-card--good"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
          >
            <PiCheckCircle className="ph__compare-icon" aria-hidden />
            <h3>DJ Bear Beat</h3>
            <p>Carpeta lista, reputación blindada. No arriesgues tu reputación dependiendo del WiFi del lugar.</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function PublicHome() {
  const { mode, theme, setMode } = useTheme();
  const [themeMenuOpen, setThemeMenuOpen] = useState(false);
  const [region, setRegion] = useState<PriceRegion>(() =>
    detectMexicoRegion() ? "mexico" : "global"
  );
  const menuRef = useRef<HTMLDivElement>(null);
  const authorityRef = useRef<HTMLDivElement>(null);
  const filesCount = useCountUp(195000, 1.5, true, authorityRef);

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
    <div className="ph ph--light-premium">
      {/* 1. NAVBAR */}
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

      {/* 2. HERO — Split Layout: Left copy, Right visual */}
      <motion.section
        className="ph__hero ph__hero--split"
        variants={heroVariants}
        initial="hidden"
        animate="visible"
      >
        <div className="ph__hero-inner">
          <div className="ph__hero-left">
            <motion.h1 className="ph__hero-h1" variants={heroItemVariants}>
              El arsenal que te convierte en el DJ que nunca falla.
            </motion.h1>
            <motion.div className="ph__hero-keywords" variants={heroItemVariants}>
              <span className="ph__hero-big-number">12.5 TB</span>
              <span className="ph__hero-keyword">Video Remixes</span>
            </motion.div>
            <motion.p className="ph__hero-sub" variants={heroItemVariants}>
              Descarga masiva vía FTP. Música, Video y Karaokes.
            </motion.p>
            <motion.div variants={heroItemVariants}>
              <Link
                to="/auth/registro"
                state={{ from: "/planes" }}
                className="ph__hero-cta ph__hero-cta--pill"
                onClick={() => trackManyChatConversion(MC_EVENTS.CLICK_CTA_REGISTER)}
              >
                QUIERO BLINDAR MI LIBRERÍA →
              </Link>
            </motion.div>
            <motion.p className="ph__hero-micro" variants={heroItemVariants}>
              Cancela cuando quieras • Acceso Inmediato
            </motion.p>
          </div>
          <motion.div className="ph__hero-right" variants={heroItemVariants} aria-hidden>
            <div className="ph__hero-visual">
              <div className="ph__hero-visual-frame">
                <div className="ph__hero-visual-folders">
                  <div className="ph__hero-visual-folder ph__hero-visual-folder--1" />
                  <div className="ph__hero-visual-folder ph__hero-visual-folder--2" />
                  <div className="ph__hero-visual-folder ph__hero-visual-folder--3" />
                  <div className="ph__hero-visual-folder ph__hero-visual-folder--4" />
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </motion.section>

      {/* 3. ARSENAL BENTO — Mosaic: FTP wide, Structure tall, Stats square */}
      <motion.section
        className="ph__arsenal"
        variants={bentoGridVariants}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.1 }}
      >
        <h2 className="ph__section-title ph__section-title--left">El Arsenal</h2>
        <div className="ph__arsenal-grid">
          <motion.div className="ph__arsenal-card ph__arsenal-card--wide" variants={bentoGridVariants}>
            <PiLightning className="ph__arsenal-icon" aria-hidden />
            <h3>FTP Ultra Rápido</h3>
            <p>Servidores de alta velocidad. Sin límites de bajada. 500 GB/mes con FileZilla.</p>
            <div className="ph__arsenal-visual ph__arsenal-visual--speed">
              <span className="ph__arsenal-visual-bar" style={{ width: "92%" }} />
            </div>
          </motion.div>
          <motion.div className="ph__arsenal-card ph__arsenal-card--tall" variants={bentoGridVariants}>
            <PiFolderOpen className="ph__arsenal-icon" aria-hidden />
            <h3>Estructura Inteligente</h3>
            <div className="ph__arsenal-folder-tree">
              <span>Video Remixes</span>
              <span>→ 2024 → Enero</span>
              <span>→ Género → Año → Mes</span>
            </div>
            <p>Ahorra 10 horas de trabajo de oficina.</p>
          </motion.div>
          <motion.div className="ph__arsenal-card ph__arsenal-card--square" variants={bentoGridVariants} ref={authorityRef}>
            <span className="ph__arsenal-stat-value">12.5 TB</span>
            <span className="ph__arsenal-stat-label">Contenido Total</span>
          </motion.div>
          <motion.div className="ph__arsenal-card ph__arsenal-card--square" variants={bentoGridVariants}>
            <span className="ph__arsenal-stat-value">{filesCount.toLocaleString("es-MX")}+</span>
            <span className="ph__arsenal-stat-label">Archivos</span>
          </motion.div>
          <motion.div className="ph__arsenal-card ph__arsenal-card--wide ph__arsenal-card--genres" variants={bentoGridVariants}>
            <PiVideoCamera className="ph__arsenal-icon" aria-hidden />
            <h3>Video Remixes</h3>
            <p>11.5 TB — Reggaeton, Cumbias, Corridos, Banda, Tech House, Salsa, Retro 80s.</p>
          </motion.div>
        </div>
      </motion.section>

      {/* 4. COMPARATIVA — Interactive Toggle Slider */}
      <motion.section
        className="ph__compare"
        initial={{ opacity: 0, y: 40 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.2 }}
        transition={{ duration: 0.5 }}
      >
        <h2 className="ph__section-title ph__section-title--left">¿Cuánto te cuesta decir &quot;No la tengo&quot;?</h2>
        <CompareSlider />
      </motion.section>

      {/* 5. PRICING — Membership Pass */}
      <motion.section
        className="ph__pricing ph__pricing--membership"
        initial={{ opacity: 0, y: 40 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.2 }}
        transition={{ duration: 0.5 }}
      >
        <h2 className="ph__section-title ph__section-title--left">Tu pase de membresía</h2>

        <div className="ph__pricing-toggle ph__pricing-toggle--membership">
          <button
            type="button"
            className={`ph__pricing-toggle-btn ${region === "global" ? "ph__pricing-toggle-btn--active" : ""}`}
            onClick={() => setRegion("global")}
            aria-pressed={region === "global"}
          >
            Global ($ USD)
          </button>
          <button
            type="button"
            className={`ph__pricing-toggle-btn ${region === "mexico" ? "ph__pricing-toggle-btn--active" : ""}`}
            onClick={() => setRegion("mexico")}
            aria-pressed={region === "mexico"}
          >
            México ($ MXN)
          </button>
        </div>

        <div className="ph__pricing-card-wrapper ph__pricing-card-wrapper--membership">
          <AnimatePresence mode="wait">
            {region === "global" ? (
              <motion.div
                key="global"
                className="ph__pricing-card ph__pricing-card--single ph__pricing-card--global"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.3, ease: "easeOut" }}
              >
                <div className="ph__pricing-card-header ph__pricing-card-header--global">Membresía Global</div>
                <div className="ph__pricing-card-body">
                  <span className="ph__pricing-amount">$18</span>
                  <span className="ph__pricing-period">USD / mes</span>
                  <p className="ph__pricing-anchor">Menos de lo que cobras por 20 min de show.</p>
                  <ul className="ph__pricing-features">
                    <li>500 GB descarga</li>
                    <li>Acceso Total</li>
                    <li>Tarjeta / PayPal</li>
                  </ul>
                  <Link to="/auth/registro" state={{ from: "/planes" }} className="ph__pricing-cta" onClick={() => trackManyChatConversion(MC_EVENTS.CLICK_PLAN_USD)}>
                    Quiero el plan USD
                  </Link>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="mexico"
                className="ph__pricing-card ph__pricing-card--single ph__pricing-card--mexico"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3, ease: "easeOut" }}
              >
                <div className="ph__pricing-card-header ph__pricing-card-header--mexico">Membresía México</div>
                <div className="ph__pricing-card-body">
                  <span className="ph__pricing-amount">$350</span>
                  <span className="ph__pricing-period">MXN / mes</span>
                  <p className="ph__pricing-anchor">Menos de lo que cobras por 20 min de show.</p>
                  <ul className="ph__pricing-features">
                    <li>500 GB descarga</li>
                    <li>SPEI, OXXO, Tarjeta</li>
                    <li>Acceso Total</li>
                  </ul>
                  <Link to="/auth/registro" state={{ from: "/planes" }} className="ph__pricing-cta" onClick={() => trackManyChatConversion(MC_EVENTS.CLICK_PLAN_MXN)}>
                    Quiero el plan MXN
                  </Link>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        <p className="ph__guarantee">Acceso inmediato • Cancela cuando quieras • Garantía de satisfacción</p>
      </motion.section>

      {/* 8. FOOTER */}
      <footer className="ph__footer ph__footer--2026">
        <Link to="/" className="ph__footer-logo">
          <img src={Logo} alt="Bear Beat" />
        </Link>
        <div className="ph__footer-links">
          <Link to="/auth" state={{ from: "/planes" }}>Iniciar sesión</Link>
          <Link to="/auth/registro" state={{ from: "/planes" }}>Registrarme</Link>
        </div>
        <div className="ph__footer-payments" aria-label="Pagos seguros">
          <span className="ph__footer-payment-logo" title="Stripe">Stripe</span>
          <span className="ph__footer-payment-logo" title="PayPal">PayPal</span>
        </div>
        <p className="ph__footer-copy">© Bear Beat. Todos los derechos reservados.</p>
      </footer>
    </div>
  );
}

export default PublicHome;
