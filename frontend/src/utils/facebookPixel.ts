/**
 * Meta / Facebook Pixel – inicialización y tracking seguro.
 * Solo llama a fbq si el script está cargado; evita errores si el pixel no está listo.
 * Ideal: configurar REACT_APP_FB_PIXEL_ID en variables de entorno (Netlify / .env).
 */

import { ensureMetaAttributionCookies } from "./metaAttributionCookies";

// Pixel ID no es secreto. Este fallback coincide con el <noscript> de public/index.html
// para que el pixel funcione aunque falte el env var en el build.
const DEFAULT_PIXEL_ID = "1325763147585869";
const PIXEL_ID = (process.env.REACT_APP_FB_PIXEL_ID || DEFAULT_PIXEL_ID).trim();

declare global {
  interface Window {
    // fbq admite un 4to parámetro (options) para deduplicación con eventID.
    // Tipamos flexible para no romper con variaciones del script.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    fbq?: (...args: any[]) => void;
    _fbq?: unknown;
    fbqLoaded?: boolean;
  }
}

function isFbqReady(): boolean {
  return typeof window !== "undefined" && typeof window.fbq === "function";
}

type FbQueuedEvent = {
  action: "track" | "trackCustom";
  eventName: string;
  params?: Record<string, unknown>;
  eventId?: string;
};

const MAX_QUEUE = 80;
let queued: FbQueuedEvent[] = [];

function enqueue(event: FbQueuedEvent): void {
  queued.push(event);
  if (queued.length > MAX_QUEUE) queued = queued.slice(-MAX_QUEUE);
}

function flushQueueIfReady(): void {
  if (!isFbqReady()) return;
  if (!queued.length) return;
  const pending = queued;
  queued = [];
  for (const item of pending) {
    try {
      if (item.eventId) {
        window.fbq!(item.action, item.eventName, item.params, { eventID: item.eventId });
      } else {
        window.fbq!(item.action, item.eventName, item.params);
      }
    } catch {
      // Best-effort: never break UX for tracking.
    }
  }
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
  if (typeof window.fbqLoaded === "boolean" && window.fbqLoaded) {
    flushQueueIfReady();
    return;
  }

  // Ensure attribution cookies exist early for browser + CAPI tracking.
  ensureMetaAttributionCookies();

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
  window.fbqLoaded = true;
  flushQueueIfReady();
}

function fireFbq(
  action: "track" | "trackCustom",
  eventName: string,
  params?: Record<string, unknown>,
  eventId?: string
): void {
  if (typeof window === "undefined") return;
  // Ensure cookies also exist when events fire before delayed tracker init.
  ensureMetaAttributionCookies();
  if (!isFbqReady()) {
    enqueue({ action, eventName, params, eventId });
    return;
  }
  try {
    if (eventId) {
      window.fbq!(action, eventName, params, { eventID: eventId });
      return;
    }
    window.fbq!(action, eventName, params);
  } catch {
    // ignorar si el pixel falla
  }
}

/**
 * Dispara un evento estándar de Meta (Purchase, Lead, etc.).
 * No hace nada si fbq no está disponible.
 */
export function trackStandardEvent(
  eventName: string,
  params?: Record<string, unknown>,
  eventId?: string
): void {
  fireFbq("track", eventName, params, eventId);
}

/**
 * Dispara un evento personalizado (trackCustom).
 * No hace nada si fbq no está disponible.
 */
export function trackCustomEvent(
  eventName: string,
  params?: Record<string, unknown>,
  eventId?: string
): void {
  fireFbq("trackCustom", eventName, params, eventId);
}

/**
 * PageView: necesario para SPAs (route changes).
 */
export function trackPageView(options?: { eventId?: string }): void {
  fireFbq("track", "PageView", undefined, options?.eventId);
}

/**
 * Purchase: uso en checkout exitoso (Stripe, etc.).
 * Meta recomienda value y currency para optimización.
 */
export function trackPurchase(options: {
  value: number;
  currency: string;
  eventId?: string;
}): void {
  const { value, currency, eventId } = options;
  trackStandardEvent(
    "Purchase",
    {
      value,
      currency: currency.toUpperCase(),
    },
    eventId
  );
  trackCustomEvent(
    "PagoExitoso",
    { value, currency: currency.toUpperCase() },
    eventId
  );
}

/**
 * Lead / CompleteRegistration: uso al completar registro.
 */
export function trackLead(options?: { value?: number; currency?: string; eventId?: string }): void {
  const params: Record<string, unknown> = {};
  if (options?.value != null) params.value = options.value;
  if (options?.currency) params.currency = options.currency.toUpperCase();
  trackStandardEvent("Lead", params, options?.eventId);
  trackStandardEvent("CompleteRegistration", params, options?.eventId);
  trackCustomEvent("BearBeatRegistro", params, options?.eventId);
}

/**
 * Cuando el usuario revisa planes (para audiencias y remarketing).
 */
export function trackViewPlans(options?: { currency?: string; eventId?: string }): void {
  const params: Record<string, unknown> = {};
  if (options?.currency) params.currency = options.currency.toUpperCase();
  trackCustomEvent("UsuarioRevisoPlanes", params, options?.eventId);
}

/**
 * InitiateCheckout: cuando el usuario inicia pago (ideal para remarketing).
 */
export function trackInitiateCheckout(options: {
  value: number;
  currency: string;
  eventId?: string;
}): void {
  trackStandardEvent(
    "InitiateCheckout",
    {
      value: options.value,
      currency: options.currency.toUpperCase(),
    },
    options.eventId
  );
}
