/**
 * SEO por ruta: actualiza <title>, meta description, canonical y og/twitter url al navegar (SPA).
 */

const BASE_URL = "https://thebearbeat.com";
const BASE_TITLE = "Bear Beat";
const BASE_DESC = "Librería de música y videos exclusivos para DJs. 500 GB cada mes por FTP, contenido organizado por géneros.";
const HOME_DESC =
  "Membresía para DJs: video remixes, audios y karaokes. Catálogo 14.14 TB, 500 GB/mes. Prueba 7 días + 100 GB (solo tarjeta, 1ª vez).";

export const ROUTE_SEO: Record<string, { title: string; description: string }> = {
  "/": {
    title: `${BASE_TITLE} – Membresía para DJs (videos, remixes y karaokes) | 14.14 TB + 500 GB/mes`,
    description: HOME_DESC,
  },
  "/auth": {
    title: `Iniciar sesión | ${BASE_TITLE}`,
    description: "Inicia sesión en Bear Beat para acceder a tu librería de música y videos para DJs.",
  },
  "/auth/registro": {
    title: `Registrarme | ${BASE_TITLE}`,
    description: "Crea tu cuenta en Bear Beat. Accede a 500 GB de música y videos para DJs cada mes por FTP.",
  },
  "/auth/recuperar": {
    title: `Recuperar contraseña | ${BASE_TITLE}`,
    description: "Recupera el acceso a tu cuenta Bear Beat.",
  },
  "/auth/reset-password": {
    title: `Nueva contraseña | ${BASE_TITLE}`,
    description: "Establece tu nueva contraseña de Bear Beat.",
  },
  "/planes": {
    title: `Planes y precios | ${BASE_TITLE} – 14.14 TB + 500 GB/mes (MXN o USD)`,
    description:
      "Elige MXN (México) o USD (internacional). Catálogo 14.14 TB, 500 GB/mes. Prueba 7 días + 100 GB (solo tarjeta, 1ª vez).",
  },
  "/comprar": {
    title: `Comprar | ${BASE_TITLE}`,
    description: "Elige tu plan y paga de forma segura con Visa, Mastercard, PayPal o SPEI.",
  },
  "/instrucciones": {
    title: `Instrucciones de descarga | ${BASE_TITLE}`,
    description: "Cómo descargar tu librería con FileZilla o Air Explorer. Guía paso a paso.",
  },
  "/legal": {
    title: `Centro legal y FAQ | ${BASE_TITLE} – privacidad, reembolsos y términos`,
    description: "Consulta FAQ, política de privacidad, reembolsos, cancelaciones y términos de uso de Bear Beat.",
  },
  "/descargas": {
    title: `Mis descargas | ${BASE_TITLE}`,
    description: "Accede a tus descargas y gestiona tu librería de música para DJs.",
  },
  "/micuenta": {
    title: `Mi cuenta | ${BASE_TITLE}`,
    description: "Gestiona tu suscripción, métodos de pago y datos de cuenta.",
  },
  "/actualizar-planes": {
    title: `Actualizar plan | ${BASE_TITLE}`,
    description: "Cambia o actualiza tu plan de Bear Beat.",
  },
};

const DEFAULT_SEO = {
  title: BASE_TITLE,
  description: BASE_DESC,
};

/**
 * Aplica título, meta description, canonical y og/twitter url para la pathname actual.
 * Llamar desde un componente que use useLocation() y useEffect.
 */
export function applyRouteSeo(pathname: string): void {
  const path = pathname.endsWith("/") && pathname !== "/" ? pathname.slice(0, -1) : pathname;
  const seo = ROUTE_SEO[path] ?? DEFAULT_SEO;
  const url = path === "" ? BASE_URL : `${BASE_URL}${path}`;

  document.title = seo.title;

  const metaDesc = document.querySelector('meta[name="description"]');
  if (metaDesc) metaDesc.setAttribute("content", seo.description);

  const ogTitle = document.querySelector('meta[property="og:title"]');
  if (ogTitle) ogTitle.setAttribute("content", seo.title);

  const ogDesc = document.querySelector('meta[property="og:description"]');
  if (ogDesc) ogDesc.setAttribute("content", seo.description);

  const ogUrl = document.querySelector('meta[property="og:url"]');
  if (ogUrl) ogUrl.setAttribute("content", url);

  const twitterUrl = document.querySelector('meta[name="twitter:url"]');
  if (twitterUrl) twitterUrl.setAttribute("content", url);

  const twitterTitle = document.querySelector('meta[name="twitter:title"]');
  if (twitterTitle) twitterTitle.setAttribute("content", seo.title);

  const twitterDesc = document.querySelector('meta[name="twitter:description"]');
  if (twitterDesc) twitterDesc.setAttribute("content", seo.description);

  let canonical = document.querySelector('link[rel="canonical"]');
  if (!canonical) {
    canonical = document.createElement("link");
    canonical.setAttribute("rel", "canonical");
    document.head.appendChild(canonical);
  }
  canonical.setAttribute("href", url);
}
