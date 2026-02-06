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
const CATALOG_TOTAL_FILES = 195_727;
const CATALOG_TOTAL_GB = 12_350.1;
const CATALOG_UNIQUE_GENRES = 209;
const CATALOG_VIDEOS = 90_651;
const CATALOG_VIDEOS_GB = 11_499.3;
const CATALOG_AUDIOS = 105_076;
const CATALOG_AUDIOS_GB = 850.8;
const CATALOG_KARAOKES = 1_353;
const CATALOG_KARAOKES_GB = 24.99;
const CATALOG_TOTAL_TB = CATALOG_TOTAL_GB / 1000;
const HOME_GENRES_LIMIT = 24;
const API_BASE =
  process.env.REACT_APP_ENVIRONMENT === "development"
    ? "http://localhost:5001"
    : "https://thebearbeatapi.lat";

interface GenreStats {
  name: string;
  files: number;
  gb: number;
}

const FALLBACK_GENRES: GenreStats[] = [
  { name: "Reguetton", files: 20_421, gb: 1_129.58 },
  { name: "Electro", files: 14_165, gb: 956.82 },
  { name: "House", files: 12_138, gb: 949.31 },
  { name: "Hip Hop", files: 11_960, gb: 674.09 },
  { name: "Dembow", files: 6_305, gb: 276.52 },
  { name: "Pop Ingles", files: 5_984, gb: 411.56 },
  { name: "Retro Ingles Dance", files: 5_743, gb: 385.8 },
  { name: "Cumbia", files: 5_549, gb: 362.48 },
  { name: "Reggae", files: 5_079, gb: 266.93 },
  { name: "Salsa", files: 4_725, gb: 273.88 },
  { name: "Cubaton", files: 4_625, gb: 246.31 },
  { name: "Guaracha", files: 4_555, gb: 468.43 },
  { name: "Acapella In Out", files: 4_083, gb: 223.03 },
  { name: "Pop Latino Dance", files: 4_069, gb: 254.28 },
  { name: "Reggaeton", files: 3_952, gb: 203.79 },
  { name: "Alternativo", files: 3_779, gb: 246.07 },
  { name: "80's", files: 3_684, gb: 237.78 },
  { name: "Bachata", files: 3_426, gb: 177.58 },
  { name: "Transition", files: 2_973, gb: 211.94 },
  { name: "Country", files: 2_840, gb: 151.62 },
  { name: "Merengue", files: 2_436, gb: 139.3 },
  { name: "Cumbia Sonidera", files: 2_200, gb: 174.06 },
  { name: "Retro Ingles", files: 2_153, gb: 145.61 },
  { name: "Latino", files: 1_984, gb: 114.51 },
];

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
  return (
    <div className="ph__compare-slider">
      <div className="ph__compare-head">
        <span>DJ Amateur</span>
        <span>DJ Bear Beat</span>
      </div>
      <div className="ph__compare-grid">
        <motion.div
          className="ph__compare-slider-card ph__compare-slider-card--bad"
          initial={{ opacity: 0, x: -20 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true, amount: 0.25 }}
          transition={{ duration: 0.35 }}
        >
          <PiWarning className="ph__compare-icon" aria-hidden />
          <h3>DJ Amateur</h3>
          <p>Estresado, YouTube, mala calidad. Una pista que no tienes = una pista que no suena.</p>
        </motion.div>
        <motion.div
          className="ph__compare-slider-card ph__compare-slider-card--good"
          initial={{ opacity: 0, x: 20 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true, amount: 0.25 }}
          transition={{ duration: 0.35 }}
        >
          <PiCheckCircle className="ph__compare-icon" aria-hidden />
          <h3>DJ Bear Beat</h3>
          <p>Carpeta lista, reputación blindada. No arriesgues tu reputación dependiendo del WiFi del lugar.</p>
        </motion.div>
      </div>
    </div>
  );
}

function PublicHome() {
  const { mode, theme, setMode } = useTheme();
  const [themeMenuOpen, setThemeMenuOpen] = useState(false);
  const [region, setRegion] = useState<PriceRegion>(() =>
    detectMexicoRegion() ? "mexico" : "global"
  );
  const [genres, setGenres] = useState<GenreStats[]>(FALLBACK_GENRES);
  const [genreTotal, setGenreTotal] = useState(CATALOG_UNIQUE_GENRES);
  const menuRef = useRef<HTMLDivElement>(null);
  const authorityRef = useRef<HTMLDivElement>(null);
  const heroFilesCount = useCountUp(CATALOG_TOTAL_FILES, 1.1);
  const filesCount = useCountUp(CATALOG_TOTAL_FILES, 1.5, true, authorityRef);

  const totalTBLabel = `${CATALOG_TOTAL_TB.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} TB`;
  const totalGBLabel = `${CATALOG_TOTAL_GB.toLocaleString("es-MX", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} GB`;
  const totalFilesLabel = CATALOG_TOTAL_FILES.toLocaleString("es-MX");
  const uniqueGenresLabel = CATALOG_UNIQUE_GENRES.toLocaleString("es-MX");
  const videosLabel = CATALOG_VIDEOS.toLocaleString("es-MX");
  const videosGbLabel = `${CATALOG_VIDEOS_GB.toLocaleString("es-MX", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} GB`;
  const audiosLabel = CATALOG_AUDIOS.toLocaleString("es-MX");
  const audiosGbLabel = `${CATALOG_AUDIOS_GB.toLocaleString("es-MX", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} GB`;
  const karaokesLabel = CATALOG_KARAOKES.toLocaleString("es-MX");
  const karaokesGbLabel = `${CATALOG_KARAOKES_GB.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} GB`;

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

  useEffect(() => {
    const token = localStorage.getItem("token") ?? "";
    fetch(`${API_BASE}/api/catalog-stats`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then((res) => {
        if (!res.ok) throw new Error("catalog-stats-unavailable");
        return res.json();
      })
      .then((res: { totalGenres?: number; genresDetail?: GenreStats[] }) => {
        const rows = Array.isArray(res.genresDetail) ? res.genresDetail : [];
        if (!rows.length) return;
        const sorted = [...rows]
          .sort((a, b) => b.files - a.files)
          .slice(0, HOME_GENRES_LIMIT);
        setGenres(sorted);
        setGenreTotal(typeof res.totalGenres === "number" ? res.totalGenres : rows.length);
      })
      .catch(() => {
        // Keep fallback genres for landing UX when endpoint/token is unavailable.
      });
  }, []);

  return (
    <div className="ph ph--light-premium">
      <header className="ph__nav">
        <div className="ph__container ph__nav-inner">
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
        </div>
      </header>

      <motion.section
        className="ph__hero ph__hero--split"
        variants={heroVariants}
        initial="hidden"
        animate="visible"
      >
        <div className="ph__hero-atmosphere ph__hero-atmosphere--one" aria-hidden />
        <div className="ph__hero-atmosphere ph__hero-atmosphere--two" aria-hidden />
        <div className="ph__container">
          <div className="ph__hero-inner">
            <div className="ph__hero-left">
              <motion.h1 className="ph__hero-h1" variants={heroItemVariants}>
                El arsenal que te convierte en el DJ que nunca falla.
              </motion.h1>
              <motion.div className="ph__hero-keywords" variants={heroItemVariants}>
                <span className="ph__hero-big-number">{totalTBLabel}</span>
                <span className="ph__hero-keyword">Video Remixes</span>
              </motion.div>
              <motion.p className="ph__hero-sub" variants={heroItemVariants}>
                Descarga masiva vía FTP. Música, Video y Karaokes.
              </motion.p>
              <motion.div className="ph__hero-proof" variants={heroItemVariants}>
                <span>Acceso Inmediato</span>
                <span>Cancela cuando quieras</span>
                <span>500 GB descarga</span>
              </motion.div>
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
                  <div className="ph__hero-visual-head">
                    <span className="ph__hero-visual-label">Video Remixes</span>
                    <strong className="ph__hero-visual-value">{totalTBLabel}</strong>
                  </div>
                  <p className="ph__hero-visual-copy">Descarga masiva vía FTP. Música, Video y Karaokes.</p>
                  <div className="ph__hero-visual-folders">
                    <div className="ph__hero-visual-folder ph__hero-visual-folder--1" />
                    <div className="ph__hero-visual-folder ph__hero-visual-folder--2" />
                    <div className="ph__hero-visual-folder ph__hero-visual-folder--3" />
                    <div className="ph__hero-visual-folder ph__hero-visual-folder--4" />
                  </div>
                  <div className="ph__hero-visual-meta">
                    <span>{heroFilesCount.toLocaleString("es-MX")} Archivos</span>
                    <span>Acceso Total</span>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </motion.section>

      <motion.section
        className="ph__spine"
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.25 }}
        transition={{ duration: 0.45 }}
      >
        <div className="ph__container">
          <div className="ph__spine-grid">
            <article className="ph__spine-card">
              <span className="ph__spine-label">El Arsenal</span>
              <strong className="ph__spine-value">{totalGBLabel}</strong>
              <p className="ph__spine-meta">{totalFilesLabel} archivos</p>
            </article>
            <article className="ph__spine-card">
              <span className="ph__spine-label">Videos</span>
              <strong className="ph__spine-value">{videosLabel}</strong>
              <p className="ph__spine-meta">{videosGbLabel}</p>
            </article>
            <article className="ph__spine-card">
              <span className="ph__spine-label">Géneros únicos</span>
              <strong className="ph__spine-value">{uniqueGenresLabel}</strong>
              <p className="ph__spine-meta">por carpeta</p>
            </article>
          </div>
        </div>
      </motion.section>

      <motion.section
        className="ph__arsenal"
        variants={bentoGridVariants}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.1 }}
      >
        <div className="ph__container">
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
              <span className="ph__arsenal-stat-value">{totalTBLabel}</span>
              <span className="ph__arsenal-stat-label">Contenido Total</span>
            </motion.div>
            <motion.div className="ph__arsenal-card ph__arsenal-card--square" variants={bentoGridVariants}>
              <span className="ph__arsenal-stat-value">{filesCount.toLocaleString("es-MX")}</span>
              <span className="ph__arsenal-stat-label">Archivos</span>
            </motion.div>
            <motion.div className="ph__arsenal-card ph__arsenal-card--wide ph__arsenal-card--genres" variants={bentoGridVariants}>
              <PiVideoCamera className="ph__arsenal-icon" aria-hidden />
              <h3>Video Remixes</h3>
              <p>Videos: {videosLabel} ({videosGbLabel}) · Audios: {audiosLabel} ({audiosGbLabel}) · Karaokes: {karaokesLabel} ({karaokesGbLabel})</p>
            </motion.div>
          </div>
        </div>
      </motion.section>

      <motion.section
        className="ph__compare"
        initial={{ opacity: 0, y: 40 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.2 }}
        transition={{ duration: 0.5 }}
      >
        <div className="ph__container">
          <h2 className="ph__section-title ph__section-title--left">¿Cuánto te cuesta decir &quot;No la tengo&quot;?</h2>
          <CompareSlider />
        </div>
      </motion.section>

      <motion.section
        className="ph__genres"
        initial={{ opacity: 0, y: 36 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.2 }}
        transition={{ duration: 0.45 }}
      >
        <div className="ph__container">
          <h2 className="ph__section-title ph__section-title--left">Por género</h2>
          <p className="ph__genres-caption">Cada género = nombre de la carpeta donde están los archivos.</p>
          <p className="ph__genres-meta">Mostrando {genres.length} de {genreTotal} géneros únicos.</p>
          <div className="ph__genres-grid">
            {genres.map((genre) => (
              <article key={genre.name} className="ph__genre-chip">
                <strong>{genre.name}</strong>
                <span>{genre.files.toLocaleString("es-MX")} archivos</span>
                <span>{genre.gb.toLocaleString("es-MX", { maximumFractionDigits: 2 })} GB</span>
              </article>
            ))}
          </div>
        </div>
      </motion.section>

      <motion.section
        className="ph__pricing ph__pricing--membership"
        initial={{ opacity: 0, y: 40 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.2 }}
        transition={{ duration: 0.5 }}
      >
        <div className="ph__container">
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
        </div>
      </motion.section>

      <footer className="ph__footer ph__footer--2026">
        <div className="ph__container">
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
        </div>
      </footer>

      <div className="ph__sticky-cta">
        <Link
          to="/auth/registro"
          state={{ from: "/planes" }}
          className="ph__sticky-cta-btn"
          onClick={() => trackManyChatConversion(MC_EVENTS.CLICK_CTA_REGISTER)}
        >
          Obtener Acceso
        </Link>
      </div>
    </div>
  );
}

export default PublicHome;
