export const HOME_CTA_PRIMARY_LABEL_FALLBACK = "Activar acceso";
export const HOME_CTA_SECONDARY_LABEL = "Ver los 200 géneros al activar";

export function getHomeCtaPrimaryLabel(trial: { enabled: boolean; days: number } | null): string {
  if (trial?.enabled && Number.isFinite(trial.days) && trial.days > 0) {
    return `Empezar prueba (${trial.days} días)`;
  }
  return HOME_CTA_PRIMARY_LABEL_FALLBACK;
}

export const HOME_HERO_TITLE = "Nunca vuelvas a decir “No la tengo” en cabina.";
export const HOME_HERO_SUBTITLE =
  "Membresía para DJs: video remixes, audios y karaokes organizados para descargar y llegar con repertorio listo.";

export const HOME_HERO_MICROCOPY_BASE = "Pago seguro • Cancela cuando quieras";
export const HOME_HERO_MICROCOPY_TRIAL = "Se cobra al terminar la prueba si no cancelas.";

export const HOME_USE_CASES = [
  {
    title: "Pedido inesperado",
    body: "Encuentra rápido por género y carpeta. Responde sin cortar el ritmo.",
  },
  {
    title: "Evento social multi‑género",
    body: "Carpetas listas por género/año para transiciones sin estrés.",
  },
  {
    title: "Sin WiFi (evita YouTube)",
    body: "Descargas a tu compu. No dependes del internet del lugar.",
  },
] as const;

export const HOME_COMPATIBILITY_ITEMS = [
  {
    title: "Descargas por FTP",
    body: "FileZilla o Air Explorer. Si nunca usaste FTP, te guiamos paso a paso.",
  },
  {
    title: "También por web",
    body: "Para archivos puntuales puedes descargar desde el explorador web.",
  },
  {
    title: "Formatos comunes",
    body: "Formatos comunes: MP3 y MP4. Ver formatos completos en el FAQ.",
  },
  {
    title: "Tu software, tu forma",
    body: "Descargas a tu computadora e importas a tu software como siempre.",
  },
] as const;

export type HomeFaqItem = {
  id: string;
  question: string;
  answer: string;
};

export const HOME_FAQ_ITEMS: HomeFaqItem[] = [
  {
    id: "includes",
    question: "¿Qué incluye la membresía?",
    answer:
      "Incluye acceso al catálogo y descargas de hasta 500 GB por ciclo mensual, con contenido organizado por carpetas para búsqueda rápida.",
  },
  {
    id: "quota",
    question: "¿Qué significa 500 GB/mes en la práctica?",
    answer:
      "Tienes una cuota mensual de descarga. Tú eliges qué bajar del catálogo total según lo que necesites para tus eventos.",
  },
  {
    id: "catalog-vs-quota",
    question: "¿Catálogo total vs cuota mensual: qué es cada cosa?",
    answer:
      "El catálogo total es el tamaño del repertorio disponible. La cuota mensual (500 GB/mes) es lo que puedes descargar cada ciclo.",
  },
  {
    id: "how-download",
    question: "¿Cómo descargo? ¿Necesito FileZilla?",
    answer:
      "Puedes descargar por FTP (FileZilla/Air Explorer) o por web para archivos puntuales. FileZilla es lo más estable para descargas grandes.",
  },
  {
    id: "web-download",
    question: "¿Puedo descargar por web?",
    answer:
      "Sí, para archivos puntuales. Para carpetas grandes conviene FTP por estabilidad y velocidad.",
  },
  {
    id: "cancel",
    question: "¿Puedo cancelar cuando quiera? ¿Cómo?",
    answer:
      "Sí. Puedes solicitar la cancelación desde Mi Cuenta. Al cancelar, se detienen cobros futuros según tu próximo ciclo de facturación.",
  },
  {
    id: "trial",
    question: "¿Cómo funciona la prueba gratis?",
    answer:
      "Si está habilitada, aplica solo con tarjeta (Stripe) y solo la primera vez. Puedes cancelar antes de que termine y no se cobra.",
  },
  {
    id: "formats",
    question: "¿Qué formatos manejan?",
    answer:
      "Soportamos audio en MP3/WAV/FLAC/AAC/M4A/OGG/WMA y video en MP4/MKV/AVI/MOV/WMV/WEBM/M4V/FLV. (Karaoke se identifica por carpeta “karaoke”.)",
  },
  {
    id: "support",
    question: "¿Qué pasa si no logro activar o descargar?",
    answer:
      "Te ayudamos por soporte en chat para activar cuenta, validar credenciales FTP y resolver incidencias de pago o acceso.",
  },
  {
    id: "payments",
    question: "¿Qué métodos de pago manejan?",
    answer:
      "Según el plan y la moneda puedes pagar con Tarjeta, PayPal, SPEI y efectivo. Las opciones visibles en checkout dependen del plan seleccionado (algunos métodos pueden deshabilitarse temporalmente).",
  },
];
