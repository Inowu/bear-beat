export const HOME_CTA_PRIMARY_LABEL_FALLBACK = "Continuar al pago seguro";
export const HOME_CTA_SECONDARY_LABEL = "Ver demo";

export function getHomeCtaPrimaryLabel(trial: { enabled: boolean; days: number } | null): string {
  if (trial?.enabled && Number.isFinite(trial.days) && trial.days > 0) return "Iniciar prueba";
  return HOME_CTA_PRIMARY_LABEL_FALLBACK;
}

export const HOME_HERO_TITLE = "Todo tu repertorio para cabina, listo para descargar hoy.";
export const HOME_HERO_SUBTITLE =
  "Membresía para DJs de eventos y antros: audios, videos y karaokes organizados para encontrar rápido y responder pedidos sin estrés.";
export const HOME_HERO_FIT_POINTS = [
  "Hecho para DJs de eventos y antros",
  "Descargas por FTP o web, sin depender de internet en cabina",
  "Activación guiada para arrancar hoy mismo",
] as const;

export const HOME_HERO_MICROCOPY_BASE =
  "Pago seguro. Activa en minutos y cancela cuando quieras.";
export const HOME_HERO_TRUST_ITEMS = [
  "Pago seguro con Tarjeta, PayPal, SPEI y efectivo.",
] as const;
export const HOME_HERO_MICROCOPY_TRIAL =
  "Prueba solo con tarjeta. Cancela antes de que termine y no se cobra.";

export const HOME_USE_CASES = [
  {
    title: "Pedido inesperado",
    body: "Encuentra rápido por carpeta (año/mes/semana/género). Responde sin cortar el ritmo.",
  },
  {
    title: "Evento social multi‑género",
    body: "Carpetas listas por año/mes/semana/género para transiciones sin estrés.",
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
    body: "Formatos comunes: MP3 (audio) y MP4 (video).",
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
      "Incluye acceso al catálogo, cuota de descarga de 500 GB/mes y contenido organizado por carpetas para búsqueda rápida. Actualizaciones: semanales (nuevos packs).",
  },
  {
    id: "quota",
    question: "¿Qué significa 500 GB/mes en la práctica?",
    answer:
      "Tienes una cuota de descarga de 500 GB/mes. Como referencia, 500 GB equivalen aprox. a 3,000 videos (depende del peso/calidad de cada archivo).",
  },
  {
    id: "catalog-vs-quota",
    question: "¿Catálogo total vs cuota de descarga: qué es cada cosa?",
    answer:
      "El catálogo total es lo disponible para elegir. La cuota de descarga (500 GB/mes) es lo que puedes descargar en cada ciclo.",
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
      "Si está habilitada, aplica solo con tarjeta y solo la primera vez. Puedes cancelar antes de que termine y no se cobra.",
  },
  {
    id: "formats",
    question: "¿Qué formatos manejan?",
    answer:
      "Audio: MP3. Video: MP4.",
  },
  {
    id: "support",
    question: "¿Qué pasa si no logro activar o descargar?",
    answer:
      "Te ayudamos con activación guiada para validar credenciales FTP y resolver incidencias de pago o acceso.",
  },
  {
    id: "payments",
    question: "¿Qué métodos de pago manejan?",
    answer:
      "Según el plan y la moneda puedes pagar con Tarjeta, PayPal, SPEI y efectivo. Las opciones visibles en checkout dependen del plan seleccionado (algunos métodos pueden deshabilitarse temporalmente).",
  },
];
