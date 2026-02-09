import { Link } from "react-router-dom";
import { MessageCircle, ShieldCheck, WalletCards, FileText, CircleHelp } from "lucide-react";
import { SUPPORT_CHAT_URL } from "../../utils/supportChat";
import "./Legal.scss";

const FAQ_ITEMS = [
  {
    question: "¿Qué incluye la membresía?",
    answer:
      "Incluye acceso al catálogo para DJ y descarga de hasta 500 GB por ciclo mensual, con contenido organizado por carpetas para búsqueda rápida.",
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
      "Te ayudamos por soporte en chat para activar cuenta, validar credenciales FTP y resolver incidencias de pago o acceso.",
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
  return (
    <div className="legal2026" role="region" aria-label="Centro legal y ayuda">
      <div className="legal2026__container">
        <header className="legal2026__hero">
          <p className="legal2026__eyebrow">Centro legal y ayuda</p>
          <h1>Preguntas frecuentes, privacidad y reembolsos</h1>
          <p className="legal2026__lead">
            Información basada en el funcionamiento actual del sitio y el flujo real de cuenta, pagos y soporte.
          </p>
          <p className="legal2026__updated">Última actualización: 6 de febrero de 2026</p>
          <div className="legal2026__hero-actions">
            <Link to="/instrucciones" className="legal2026__btn legal2026__btn--ghost">
              Ver instrucciones de descarga
            </Link>
            <a
              href={SUPPORT_CHAT_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="legal2026__btn legal2026__btn--primary"
            >
              <MessageCircle size={16} />
              Abrir soporte por chat
            </a>
          </div>
        </header>

        <nav className="legal2026__quick-nav" aria-label="Secciones legales">
          <a href="#faq">
            <CircleHelp size={16} />
            FAQ
          </a>
          <a href="#privacidad">
            <ShieldCheck size={16} />
            Privacidad
          </a>
          <a href="#reembolsos">
            <WalletCards size={16} />
            Reembolsos
          </a>
          <a href="#terminos">
            <FileText size={16} />
            Términos
          </a>
        </nav>

        <section id="faq" className="legal2026__section">
          <div className="legal2026__section-head">
            <CircleHelp size={18} />
            <h2>Preguntas frecuentes (FAQ)</h2>
          </div>
          <div className="legal2026__faq-list">
            {FAQ_ITEMS.map((item) => (
              <details key={item.question} className="legal2026__faq-item">
                <summary>{item.question}</summary>
                <p>{item.answer}</p>
              </details>
            ))}
          </div>
        </section>

        <section id="privacidad" className="legal2026__section">
          <div className="legal2026__section-head">
            <ShieldCheck size={18} />
            <h2>Política de privacidad</h2>
          </div>
          <div className="legal2026__content">
            <h3>1. Datos que se recaban</h3>
            <p>
              Para operar tu cuenta se recaban datos como nombre de usuario, correo electrónico, teléfono y datos
              técnicos de sesión. También se registran eventos de uso para seguridad y mejora del servicio.
            </p>
            <h3>2. Uso de los datos</h3>
            <p>
              Se usan para crear y administrar la cuenta, autenticar accesos, procesar suscripciones, brindar soporte,
              prevenir fraude y mejorar experiencia de navegación y checkout.
            </p>
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
              Puedes solicitar corrección o actualización de tu información desde tu cuenta y por soporte en chat.
            </p>
          </div>
        </section>

        <section id="reembolsos" className="legal2026__section">
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
              Las solicitudes de reembolso se revisan caso por caso por soporte, considerando si hubo falla técnica
              real de activación o acceso. No existe reembolso automático general para pagos ya procesados.
            </p>
            <h3>3. Casos que requieren soporte inmediato</h3>
            <p>
              Cobro duplicado, activación incompleta o imposibilidad de acceso deben reportarse por chat para revisión
              prioritaria.
            </p>
            <h3>4. Canales de pago</h3>
            <p>
              El procesamiento de pagos depende del método elegido (Tarjeta/PayPal/SPEI), y tiempos de reflejo o
              validación pueden variar según el proveedor.
            </p>
          </div>
        </section>

        <section id="terminos" className="legal2026__section">
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
              La membresía contempla límite de descarga por ciclo (500 GB) y acceso al catálogo conforme a la
              disponibilidad del servicio.
            </p>
            <h3>3. Continuidad del servicio</h3>
            <p>
              Se realizan mejoras continuas de plataforma, catálogo y métodos de pago; ciertos cambios operativos pueden
              aplicarse para mantener estabilidad y seguridad.
            </p>
            <h3>4. Contacto</h3>
            <p>
              Para soporte técnico, dudas de cobro o aclaraciones sobre estas políticas, usa el canal oficial de chat.
            </p>
            <h3>5. Marcas de terceros</h3>
            <p>
              Nombres y logotipos de métodos de pago se usan únicamente para identificar opciones de cobro disponibles.
              Cada marca es propiedad de su titular y su uso se ajusta a lineamientos de branding del proveedor.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}

export default Legal;
