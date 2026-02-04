/**
 * Meta / Facebook Pixel – inicialización y tracking seguro.
 * Solo llama a fbq si el script está cargado; evita errores si el pixel no está listo.
 * Requiere REACT_APP_FB_PIXEL_ID en las variables de entorno (Netlify / .env).
 */

const PIXEL_ID = (process.env.REACT_APP_FB_PIXEL_ID || "").trim();

declare global {
  interface Window {
    fbq?: (
      action: "track" | "trackCustom" | "init",
      eventName: string,
      params?: Record<string, unknown>
    ) => void;
    _fbq?: unknown;
  }
}

function isFbqReady(): boolean {
  return typeof window !== "undefined" && typeof window.fbq === "function";
}

/**
 * Carga el script de fbevents.js e inicializa el pixel.
 * Llamar una vez al montar la app (ej. en index.tsx).
 */
export function initFacebookPixel(): void {
  if (typeof window === "undefined" || typeof document === "undefined") return;
  if (!PIXEL_ID) return;
  const id = PIXEL_ID;

  // Evitar doble init
  if (window.fbq && (window as any).fbqLoaded) return;

  (function (f: Window, b: Document, e: string, v: string, n?: any, t?: HTMLScriptElement, s?: Element) {
    if (f.fbq) return;
    n = f.fbq = function () {
      n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments);
    };
    if (!(f as any)._fbq) (f as any)._fbq = n;
    n.push = n;
    n.loaded = true;
    n.version = "2.0";
    n.queue = [];
    t = b.createElement(e) as HTMLScriptElement;
    t.async = true;
    t.src = v;
    s = b.getElementsByTagName(e)[0];
    if (s && s.parentNode) s.parentNode.insertBefore(t, s);
  })(window, document, "script", "https://connect.facebook.net/en_US/fbevents.js");

  window.fbq("init", id);
  window.fbq("track", "PageView");
  (window as any).fbqLoaded = true;
}

/**
 * Dispara un evento estándar de Meta (Purchase, Lead, etc.).
 * No hace nada si fbq no está disponible.
 */
export function trackStandardEvent(
  eventName: string,
  params?: Record<string, unknown>
): void {
  if (!isFbqReady()) return;
  try {
    window.fbq!("track", eventName, params);
  } catch {
    // ignorar si el pixel falla
  }
}

/**
 * Dispara un evento personalizado (trackCustom).
 * No hace nada si fbq no está disponible.
 */
export function trackCustomEvent(
  eventName: string,
  params?: Record<string, unknown>
): void {
  if (!isFbqReady()) return;
  try {
    window.fbq!("trackCustom", eventName, params);
  } catch {
    // ignorar si el pixel falla
  }
}

/**
 * Purchase: uso en checkout exitoso (Stripe, etc.).
 * Meta recomienda value y currency para optimización.
 */
export function trackPurchase(options: {
  value?: number;
  currency?: string;
  email?: string;
  phone?: string;
}): void {
  const { value = 0, currency = "USD", email, phone } = options;
  trackStandardEvent("Purchase", {
    value,
    currency,
    ...(email && { content_name: email }),
    ...(phone && { content_category: phone }),
  });
  // Mantener evento personalizado por si lo usan en ManyChat/otros
  trackCustomEvent("PagoExitoso", { email, phone });
}

/**
 * Lead / CompleteRegistration: uso al completar registro.
 */
export function trackLead(options?: { email?: string; phone?: string; value?: number; currency?: string }): void {
  const params: Record<string, unknown> = {};
  if (options?.value != null) params.value = options.value;
  if (options?.currency) params.currency = options.currency;
  trackStandardEvent("Lead", params);
  trackStandardEvent("CompleteRegistration", params);
  trackCustomEvent("BearBeatRegistro", { email: options?.email, phone: options?.phone });
}

/**
 * Cuando el usuario revisa planes (para audiencias y remarketing).
 */
export function trackViewPlans(options?: { email?: string; phone?: string }): void {
  trackCustomEvent("UsuarioRevisoPlanes", options || {});
}
