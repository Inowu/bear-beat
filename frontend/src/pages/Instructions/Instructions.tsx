import "./Instructions.scss";
import { Link } from "react-router-dom";
import type { AppIcon } from "src/icons";
import {
  ArrowRight,
  CheckCircle2,
  Download,
  ExternalLink,
  FolderSearch,
  HardDriveDownload,
  MousePointerClick,
  ShieldCheck,
  WifiOff,
} from "src/icons";
import PublicTopNav from "../../components/PublicTopNav/PublicTopNav";
import { useUserContext } from "../../contexts/UserContext";

const FILEZILLA_URL = "https://filezilla-project.org/download.php?type=client";
const AIR_EXPLORER_URL = "https://www.airexplorer.net/en/download/";

interface DownloadMethod {
  id: "filezilla" | "air-explorer" | "web";
  title: string;
  subtitle: string;
  icon: AppIcon;
  steps: string[];
  tip: string;
  ctaLabel: string;
  ctaHref: string;
  ctaExternal: boolean;
  showFtpButton: boolean;
}

const DOWNLOAD_METHODS: DownloadMethod[] = [
  {
    id: "filezilla",
    title: "FileZilla (Recomendado)",
    subtitle: "La forma más estable para descargas grandes por FTP.",
    icon: HardDriveDownload,
    steps: [
      "Instala FileZilla en tu computadora.",
      "Entra a Mi Cuenta y copia tus datos FTP: Host, Usuario, Contraseña y Puerto.",
      "Abre el Gestor de sitios en FileZilla, crea una conexión FTP y pega tus datos.",
      "Conecta y arrastra carpetas del panel derecho (servidor) al izquierdo (tu PC).",
    ],
    tip: "Para mejor velocidad y estabilidad, usa cable Ethernet cuando descargues carpetas grandes.",
    ctaLabel: "Descargar FileZilla",
    ctaHref: FILEZILLA_URL,
    ctaExternal: true,
    showFtpButton: true,
  },
  {
    id: "air-explorer",
    title: "Air Explorer",
    subtitle: "Alternativa FTP simple para DJs que prefieren interfaz tipo explorador.",
    icon: FolderSearch,
    steps: [
      "Instala Air Explorer y abre la app.",
      "Crea una nueva cuenta FTP y pega tus credenciales de Mi Cuenta.",
      "Conecta tu servidor Bear Beat y navega carpetas por año, mes, semana y género.",
      "Selecciona archivos o carpetas y envíalos a tu ruta local de descarga.",
    ],
    tip: "Si solo quieres bajar sets específicos, usa búsqueda dentro de Air Explorer para ir directo al género.",
    ctaLabel: "Descargar Air Explorer",
    ctaHref: AIR_EXPLORER_URL,
    ctaExternal: true,
    showFtpButton: true,
  },
  {
    id: "web",
    title: "Descarga directa desde la web",
    subtitle: "Ideal para archivos puntuales sin abrir software externo.",
    icon: MousePointerClick,
    steps: [
      "Inicia sesión y entra al Explorador de archivos en Inicio.",
      "Usa la barra de búsqueda y las rutas para ubicar rápido tu contenido.",
      "En archivos individuales usa el botón Descargar archivo.",
      "Para carpetas pequeñas usa Descargar carpeta; si es carpeta grande usa FTP.",
    ],
    tip: "Si una carpeta no permite descarga directa, es por tamaño. Ahí conviene FileZilla o Air Explorer.",
    ctaLabel: "Ir al explorador web",
    ctaHref: "/",
    ctaExternal: false,
    showFtpButton: false,
  },
];

function Instructions() {
  const { userToken } = useUserContext();

  return (
    <div className="instructions2026" role="region" aria-label="Instrucciones de descarga">
      <a className="instructions2026__skip" href="#instructions-main">
        Saltar al contenido
      </a>

      <PublicTopNav className="instructions2026__topnav" loginFrom="/instrucciones" />

      <section id="instructions-main" className="instructions2026__main" aria-label="Contenido principal de instrucciones">
        <div className="ph__container instructions2026__container">
          <header className="instructions2026__hero">
            <p className="instructions2026__eyebrow">Guía de descarga</p>
            <h1>Descarga tu contenido en minutos</h1>
            <p className="instructions2026__lead">
              Elige tu método favorito: FileZilla, Air Explorer o descarga directa en la web.
            </p>
            <div className="instructions2026__hero-actions">
              {userToken ? (
                <Link
                  to="/micuenta"
                  className="home-cta home-cta--primary instructions2026__btn instructions2026__btn--primary"
                >
                  Ver mis credenciales FTP
                  <ArrowRight size={16} />
                </Link>
              ) : (
                <Link
                  to="/auth/registro"
                  state={{ from: "/micuenta" }}
                  className="home-cta home-cta--primary instructions2026__btn instructions2026__btn--primary"
                >
                  Crear cuenta para ver FTP
                  <ArrowRight size={16} />
                </Link>
              )}
            </div>
          </header>

          <section className="instructions2026__navigator" aria-label="Selector de método">
            <div className="instructions2026__navigator-head">
              <p className="instructions2026__navigator-title">Método de descarga</p>
              <p className="instructions2026__navigator-help">Selecciona una opción para ir directo al tutorial.</p>
            </div>
            <nav className="instructions2026__quick-nav bb-segmented" aria-label="Métodos de descarga">
              {DOWNLOAD_METHODS.map((method, index) => (
                <a key={method.id} href={`#${method.id}`} className="instructions2026__quick-link bb-segmented__btn">
                  <span className="instructions2026__quick-link-index">{index + 1}</span>
                  <span className="instructions2026__quick-link-label">{method.title}</span>
                </a>
              ))}
            </nav>
          </section>

          <section id="instrucciones-metodos" className="instructions2026__methods" aria-label="Pasos por método">
            {DOWNLOAD_METHODS.map((method, index) => {
              const Icon = method.icon;
              return (
                <article key={method.id} id={method.id} className="instructions2026__method-card">
                  <div className="instructions2026__method-head">
                    <span className="instructions2026__method-index">{index + 1}</span>
                    <span className="instructions2026__method-icon" aria-hidden>
                      <Icon size={18} />
                    </span>
                    <div className="instructions2026__method-copy">
                      <h2>{method.title}</h2>
                      <p>{method.subtitle}</p>
                    </div>
                  </div>

                  <ol className="instructions2026__steps">
                    {method.steps.map((step) => (
                      <li key={`${method.id}-${step}`}>
                        <CheckCircle2 size={16} aria-hidden />
                        <span>{step}</span>
                      </li>
                    ))}
                  </ol>

                  <p className="instructions2026__tip">
                    <ShieldCheck size={16} aria-hidden />
                    {method.tip}
                  </p>

                  <div className="instructions2026__method-actions">
                    {method.ctaExternal ? (
                      <a
                        href={method.ctaHref}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="home-cta home-cta--primary instructions2026__btn instructions2026__btn--primary"
                      >
                        <Download size={16} />
                        {method.ctaLabel}
                        <ExternalLink size={15} />
                      </a>
                    ) : (
                      <Link
                        to={method.ctaHref}
                        className="home-cta home-cta--primary instructions2026__btn instructions2026__btn--primary"
                      >
                        {method.ctaLabel}
                        <ArrowRight size={16} />
                      </Link>
                    )}

                    {method.showFtpButton && (
                      userToken ? (
                        <Link
                          to="/micuenta"
                          className="home-cta home-cta--secondary instructions2026__btn instructions2026__btn--ghost"
                        >
                          Ver credenciales FTP
                        </Link>
                      ) : (
                        <Link
                          to="/auth"
                          state={{ from: "/micuenta" }}
                          className="home-cta home-cta--secondary instructions2026__btn instructions2026__btn--ghost"
                        >
                          Iniciar sesión para ver FTP
                        </Link>
                      )
                    )}
                  </div>
                </article>
              );
            })}
          </section>

          <section className="instructions2026__troubleshoot" aria-label="Solución rápida de problemas">
            <h2>Si algo no conecta</h2>
            <ul>
              <li>
                <WifiOff size={16} aria-hidden />
                Revisa que Host, Usuario, Contraseña y Puerto estén copiados exactamente desde Mi Cuenta.
              </li>
              <li>
                <WifiOff size={16} aria-hidden />
                Prueba cerrar y abrir la app FTP, luego reconecta.
              </li>
              <li>
                <WifiOff size={16} aria-hidden />
                Si el problema sigue, vuelve a validar tus credenciales FTP y prueba reconectar.
              </li>
            </ul>
            {userToken ? (
              <Link
                to="/micuenta"
                className="home-cta home-cta--primary instructions2026__btn instructions2026__btn--primary"
              >
                Revisar credenciales FTP
              </Link>
            ) : (
              <Link
                to="/auth"
                state={{ from: "/micuenta" }}
                className="home-cta home-cta--primary instructions2026__btn instructions2026__btn--primary"
              >
                Revisar credenciales FTP
              </Link>
            )}
          </section>
        </div>
      </section>
    </div>
  );
}

export default Instructions;
