import { Link } from "react-router-dom";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ShieldCheck, WalletCards, FileText, CircleHelp, ChevronDown, ArrowUp } from "src/icons";
import "./Legal.scss";

const LEGAL_LAST_UPDATED_LABEL = "6 de febrero de 2026";
const LEGAL_LAST_UPDATED_ISO = "2026-02-06";

const FAQ_ITEMS = [
  {
    question: "¿Qué incluye la membresía?",
    answer:
      "Incluye acceso al catálogo para DJ, cuota de descarga de 500 GB/mes y contenido organizado por carpetas para búsqueda rápida. Actualizaciones: semanales (nuevos packs).",
  },
  {
    question: "¿Qué métodos de pago manejan?",
    answer:
      "Según el plan y la moneda puedes pagar con Tarjeta, PayPal, SPEI y efectivo. Las opciones visibles en checkout dependen del plan seleccionado (algunos métodos pueden deshabilitarse temporalmente).",
  },
  {
    question: "¿Cómo cancelo mi suscripción?",
    answer:
      "Puedes solicitar la cancelación desde Mi Cuenta. Al cancelar, se detienen cobros futuros según tu próximo ciclo de facturación.",
  },
  {
    question: "¿Cómo descargo los archivos?",
    answer:
      "Puedes descargar por FTP (FileZilla/Air Explorer) o desde el explorador web para archivos puntuales. En /instrucciones está la guía paso a paso.",
  },
  {
    question: "¿Qué pasa si tengo problemas al activar o descargar?",
    answer:
      "Revisa la guía de /instrucciones y tus credenciales FTP en Mi Cuenta. Si falla el pago, intenta nuevamente con otro método disponible.",
  },
  {
    question: "¿Guardan mi número completo de tarjeta?",
    answer:
      "No. Los datos de tarjeta se procesan por pasarelas de pago externas; en la plataforma solo se manejan referencias seguras del método de pago.",
  },
  {
    question: "¿Pueden usar logos de Visa, Mastercard, PayPal, efectivo o SPEI?",
    answer:
      "Sí, solo como señalización de métodos aceptados y respetando guías de marca de cada proveedor. Esas marcas y logotipos pertenecen a sus respectivos titulares (y pueden variar por disponibilidad).",
  },
];

function Legal() {
  const sections = useMemo(
    () => [
      { id: "faq", label: "FAQ", Icon: CircleHelp },
      { id: "privacidad", label: "Privacidad", Icon: ShieldCheck },
      { id: "reembolsos", label: "Reembolsos", Icon: WalletCards },
      { id: "terminos", label: "Términos", Icon: FileText },
    ],
    [],
  );

  const [activeSection, setActiveSection] = useState(() => {
    if (typeof window === "undefined") return "faq";
    return window.location.hash?.replace("#", "") || "faq";
  });

  const focusSection = useCallback((id: string) => {
    if (!id) return;
    const el = document.getElementById(id) as HTMLElement | null;
    if (!el) return;
    // Programmatic focus helps screen readers announce the section after following deep links.
    try {
      el.focus({ preventScroll: true });
    } catch {
      // noop
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const hash = window.location.hash?.replace("#", "") || "";
    if (hash) {
      const el = document.getElementById(hash);
      el?.scrollIntoView({ block: "start" });
      focusSection(hash);
      setActiveSection(hash);
    }

    const onHashChange = () => {
      const next = window.location.hash?.replace("#", "") || "faq";
      setActiveSection(next);
      focusSection(next);
    };
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, [focusSection]);

  const [faqOpen, setFaqOpen] = useState<boolean[]>(() => FAQ_ITEMS.map(() => false));

  const toggleFaq = useCallback((idx: number) => {
    setFaqOpen((prev) => prev.map((open, i) => (i === idx ? !open : open)));
  }, []);

  const expandAllFaq = useCallback(() => setFaqOpen(FAQ_ITEMS.map(() => true)), []);
  const collapseAllFaq = useCallback(() => setFaqOpen(FAQ_ITEMS.map(() => false)), []);

  useEffect(() => {
    if (typeof document === "undefined") return;

    const schema = {
      "@context": "https://schema.org",
      "@type": "WebPage",
      name: "Preguntas frecuentes, privacidad y reembolsos | Bear Beat",
      url: "https://thebearbeat.com/legal",
      inLanguage: "es-MX",
      dateModified: LEGAL_LAST_UPDATED_ISO,
      isPartOf: {
        "@type": "WebSite",
        name: "Bear Beat",
        url: "https://thebearbeat.com",
      },
    } as const;

    const existing = document.querySelector("script[data-schema='bb-legal-webpage']") as HTMLScriptElement | null;
    const script = existing ?? document.createElement("script");
    script.type = "application/ld+json";
    script.setAttribute("data-schema", "bb-legal-webpage");
    script.text = JSON.stringify(schema);
    if (!existing) document.head.appendChild(script);

    return () => {
      script.remove();
    };
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") return;
    if (FAQ_ITEMS.length === 0) return;

    const schema = {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: FAQ_ITEMS.map((item) => ({
        "@type": "Question",
        name: item.question,
        acceptedAnswer: { "@type": "Answer", text: item.answer },
      })),
    } as const;

    const existing = document.querySelector("script[data-schema='bb-legal-faq']") as HTMLScriptElement | null;
    const script = existing ?? document.createElement("script");
    script.type = "application/ld+json";
    script.setAttribute("data-schema", "bb-legal-faq");
    script.text = JSON.stringify(schema);
    if (!existing) document.head.appendChild(script);

    return () => {
      script.remove();
    };
  }, []);

  return (
    <div className="legal2026 bb-marketing-page" role="region" aria-label="Centro legal y ayuda">
      <div className="legal2026__container bb-marketing-container--wide">
        <a className="legal2026__skip" href="#faq">
          Saltar al FAQ
        </a>

        <header id="legal-top" className="legal2026__hero">
          <p className="legal2026__eyebrow">Centro legal y ayuda</p>
          <h1>Preguntas frecuentes, privacidad y reembolsos</h1>
          <p className="legal2026__lead">
            Información basada en el funcionamiento actual del sitio y el flujo real de cuenta y pagos.
          </p>
          <p className="legal2026__updated">Última actualización: {LEGAL_LAST_UPDATED_LABEL}</p>
          <div className="legal2026__hero-actions">
            <Link to="/instrucciones" className="legal2026__btn legal2026__btn--ghost">
              Ver instrucciones de descarga
            </Link>
            <Link to="/planes" className="legal2026__btn legal2026__btn--primary">
              Ver planes
            </Link>
          </div>
        </header>

        <nav className="legal2026__quick-nav bb-segmented" aria-label="Contenido">
          {sections.map(({ id, label, Icon }) => (
            <a
              key={id}
              href={`#${id}`}
              className="bb-segmented__btn"
              aria-current={activeSection === id ? "location" : undefined}
            >
              <Icon size={16} aria-hidden />
              {label}
            </a>
          ))}
        </nav>

        <section id="faq" className="legal2026__section" tabIndex={-1}>
          <div className="legal2026__section-head">
            <CircleHelp size={18} />
            <h2>Preguntas frecuentes (FAQ)</h2>
          </div>
          <div className="legal2026__faq-actions" aria-label="Acciones de FAQ">
            <button type="button" onClick={expandAllFaq}>
              Expandir todo
            </button>
            <button type="button" onClick={collapseAllFaq}>
              Contraer todo
            </button>
          </div>
          <div className="legal2026__faq-list bb-accordion">
            {FAQ_ITEMS.map((item, idx) => {
              const isOpen = Boolean(faqOpen[idx]);
              const buttonId = `legal-faq-button-${idx}`;
              const panelId = `legal-faq-panel-${idx}`;
              return (
                <div key={item.question} className="legal2026__faq-item bb-accordion__item">
                  <h3 className="legal2026__faq-question">
                    <button
                      type="button"
                      className="legal2026__faq-trigger bb-accordion__trigger"
                      id={buttonId}
                      aria-expanded={isOpen}
                      aria-controls={panelId}
                      onClick={() => toggleFaq(idx)}
                    >
                      <span>{item.question}</span>
                      <ChevronDown className="legal2026__faq-icon" size={18} aria-hidden />
                    </button>
                  </h3>
                  <div
                    id={panelId}
                    className="legal2026__faq-panel bb-accordion__panel"
                    role="region"
                    aria-labelledby={buttonId}
                    hidden={!isOpen}
                  >
                    <p>{item.answer}</p>
                  </div>
                </div>
              );
            })}
          </div>
          <a className="legal2026__backtop" href="#legal-top">
            <ArrowUp size={16} aria-hidden />
            Volver arriba
          </a>
        </section>

        <section id="privacidad" className="legal2026__section" tabIndex={-1}>
          <div className="legal2026__section-head">
            <ShieldCheck size={18} />
            <h2>Política de privacidad</h2>
          </div>
          <div className="legal2026__content">
            <h3>1. Datos que se recaban</h3>
            <ul>
              <li>Nombre de usuario</li>
              <li>Correo electrónico</li>
              <li>Teléfono</li>
              <li>Datos técnicos de sesión</li>
              <li>Eventos de uso para seguridad y mejora del servicio</li>
            </ul>
            <h3>2. Uso de los datos</h3>
            <ul>
              <li>Crear y administrar la cuenta</li>
              <li>Autenticar accesos</li>
              <li>Procesar suscripciones</li>
              <li>Brindar soporte</li>
              <li>Prevenir fraude</li>
              <li>Mejorar experiencia de navegación y checkout</li>
            </ul>
            <h3>3. Proveedores externos</h3>
            <p>
              El sitio integra servicios de terceros para cobro y operación (por ejemplo pasarelas de pago y
              herramientas de seguridad/analítica). Cada proveedor procesa datos bajo sus propios términos.
            </p>
            <h3>4. Protección y retención</h3>
            <p>
              Se aplican medidas técnicas razonables para proteger la información. Los datos se conservan mientras la
              cuenta esté activa o cuando exista obligación operativa/legal para conservarlos.
            </p>
            <h3>5. Derechos del usuario</h3>
            <p>
              Puedes solicitar corrección o actualización de tu información directamente desde tu cuenta.
            </p>
          </div>
          <a className="legal2026__backtop" href="#legal-top">
            <ArrowUp size={16} aria-hidden />
            Volver arriba
          </a>
        </section>

        <section id="reembolsos" className="legal2026__section" tabIndex={-1}>
          <div className="legal2026__section-head">
            <WalletCards size={18} />
            <h2>Política de reembolsos y cancelaciones</h2>
          </div>
          <div className="legal2026__content">
            <h3>1. Cancelación</h3>
            <p>
              Puedes cancelar desde Mi Cuenta. La cancelación aplica para cobros futuros según tu ciclo activo.
            </p>
            <h3>2. Reembolsos</h3>
            <p>
              Las solicitudes de reembolso se revisan caso por caso, considerando si hubo falla técnica
              real de activación o acceso. No existe reembolso automático general para pagos ya procesados.
            </p>
            <h3>3. Casos que requieren revisión inmediata</h3>
            <ul>
              <li>Cobro duplicado</li>
              <li>Activación incompleta</li>
              <li>Imposibilidad de acceso</li>
            </ul>
            <p>Estos casos deben reportarse desde tu cuenta para revisión prioritaria.</p>
            <h3>4. Canales de pago</h3>
            <p>
              El procesamiento de pagos depende del método elegido (Tarjeta/PayPal/SPEI), y tiempos de reflejo o
              validación pueden variar según el proveedor.
            </p>
          </div>
          <a className="legal2026__backtop" href="#legal-top">
            <ArrowUp size={16} aria-hidden />
            Volver arriba
          </a>
        </section>

        <section id="terminos" className="legal2026__section" tabIndex={-1}>
          <div className="legal2026__section-head">
            <FileText size={18} />
            <h2>Términos básicos de uso</h2>
          </div>
          <div className="legal2026__content">
            <h3>1. Uso de la cuenta</h3>
            <p>
              El acceso es para el titular de la suscripción. Compartir credenciales o usar la plataforma para fines
              distintos al servicio puede derivar en restricciones de cuenta.
            </p>
            <h3>2. Descargas y cuota</h3>
            <p>
              La membresía contempla cuota de descarga por ciclo (500 GB/mes) y acceso al catálogo conforme a la
              disponibilidad del servicio.
            </p>
            <h3>3. Continuidad del servicio</h3>
            <p>
              Se realizan mejoras continuas de plataforma, catálogo y métodos de pago; ciertos cambios operativos pueden
              aplicarse para mantener estabilidad y seguridad.
            </p>
            <h3>4. Contacto</h3>
            <p>
              Para dudas de cobro o aclaraciones sobre estas políticas, usa los canales oficiales dentro de tu cuenta.
            </p>
            <h3>5. Marcas de terceros</h3>
            <p>
              Nombres y logotipos de métodos de pago se usan únicamente para identificar opciones de cobro disponibles.
              Cada marca es propiedad de su titular y su uso se ajusta a lineamientos de branding del proveedor.
            </p>
          </div>
          <a className="legal2026__backtop" href="#legal-top">
            <ArrowUp size={16} aria-hidden />
            Volver arriba
          </a>
        </section>
      </div>
    </div>
  );
}

export default Legal;
