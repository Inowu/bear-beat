/**
 * ManyChat Pixel – eventos de conversión y dinero.
 * Los scripts de ManyChat ahora se cargan dinámicamente (ver manychatLoader.ts),
 * así que los eventos se encolan y esperan a que MC_PIXEL esté listo.
 */

declare global {
  interface Window {
    MC_PIXEL?: {
      fireLogConversionEvent: (eventName: string) => void;
      fireLogMoneyEvent: (eventName: string, amount: number, currency?: string) => void;
    };
  }
}

function isMcPixelReady(): boolean {
  return typeof window !== "undefined" && typeof window.MC_PIXEL?.fireLogConversionEvent === "function";
}

type McQueuedEvent =
  | { kind: "conversion"; eventName: string }
  | { kind: "money"; eventName: string; amount: number; currency: string };

const MAX_QUEUE = 50;
const FLUSH_INTERVAL_MS = 800;
// Some users land via ManyChat links on slow mobile networks. Keep a longer window so
// we don't drop early conversion events before the widget/pixel finishes loading.
const FLUSH_MAX_MS = 60_000;

let queue: McQueuedEvent[] = [];
let flushTimer: number | null = null;
let flushStartedAt: number | null = null;

function clearFlushTimer(): void {
  if (typeof window === "undefined") return;
  if (flushTimer != null) {
    window.clearTimeout(flushTimer);
    flushTimer = null;
  }
  flushStartedAt = null;
}

function flushQueueIfReady(): void {
  if (!isMcPixelReady()) return;
  const pending = queue;
  queue = [];
  for (const item of pending) {
    try {
      if (item.kind === "conversion") {
        window.MC_PIXEL!.fireLogConversionEvent(item.eventName);
      } else {
        window.MC_PIXEL!.fireLogMoneyEvent(item.eventName, item.amount, item.currency);
      }
    } catch {
      // noop
    }
  }
}

function scheduleFlush(): void {
  if (typeof window === "undefined") return;
  if (flushTimer != null) return;
  flushStartedAt = Date.now();

  const tick = () => {
    // Si el pixel ya está listo, dispara todo y corta.
    if (isMcPixelReady()) {
      flushQueueIfReady();
      clearFlushTimer();
      return;
    }

    // Evitar loops infinitos si el script nunca carga.
    if (flushStartedAt && Date.now() - flushStartedAt > FLUSH_MAX_MS) {
      queue = [];
      clearFlushTimer();
      return;
    }

    flushTimer = window.setTimeout(tick, FLUSH_INTERVAL_MS);
  };

  flushTimer = window.setTimeout(tick, FLUSH_INTERVAL_MS);
}

function enqueue(event: McQueuedEvent): void {
  queue.push(event);
  if (queue.length > MAX_QUEUE) queue = queue.slice(-MAX_QUEUE);
  scheduleFlush();
}

/**
 * Dispara un evento de conversión en ManyChat (clicks, vistas, acciones).
 */
export function trackManyChatConversion(eventName: string): void {
  if (!isMcPixelReady()) {
    enqueue({ kind: "conversion", eventName });
    return;
  }
  try {
    window.MC_PIXEL!.fireLogConversionEvent(eventName);
  } catch {
    // ignorar si el pixel falla
  }
}

/**
 * Dispara un evento de compra en ManyChat (valor monetario).
 */
export function trackManyChatPurchase(eventName: string, amount: number, currency = "USD"): void {
  if (!isMcPixelReady()) {
    enqueue({ kind: "money", eventName, amount, currency });
    return;
  }
  try {
    window.MC_PIXEL!.fireLogMoneyEvent(eventName, amount, currency);
  } catch {
    // ignorar
  }
}

/** Eventos ManyChat – solo funnel de conversión */
export const MC_EVENTS = {
  VIEW_HOME: "bear_beat_view_home",
  CLICK_CTA_REGISTER: "bear_beat_click_cta_register",
  CLICK_PLAN_USD: "bear_beat_click_plan_usd",
  CLICK_PLAN_MXN: "bear_beat_click_plan_mxn",
  VIEW_AUTH: "bear_beat_view_auth",
  LOGIN_SUCCESS: "bear_beat_login_success",
  CLICK_CHAT: "bear_beat_click_chat",
  VIEW_PLANS: "bear_beat_view_plans",
  SELECT_PLAN: "bear_beat_select_plan",
  CLICK_BUY: "bear_beat_click_buy",
  CLICK_SPEI: "bear_beat_click_spei",
  CLICK_OXXO: "bear_beat_click_oxxo",
  CLICK_PAYPAL: "bear_beat_click_paypal",
  START_CHECKOUT: "bear_beat_start_checkout",
  REGISTRATION: "bear_beat_registration",
  ABANDON_REGISTRATION: "bear_beat_abandon_registration",
  ABANDON_CHECKOUT: "bear_beat_abandon_checkout",
  LP_SEGMENT_SELECTED: "bear_beat_segment_selected",
  DOWNLOAD_CHECKLIST: "bear_beat_download_checklist",
  PAYMENT_SUCCESS: "bear_beat_payment_success",
  CANCEL_SUBSCRIPTION: "bear_beat_cancel_subscription",
  CHANGE_PLAN: "bear_beat_change_plan",
} as const;
