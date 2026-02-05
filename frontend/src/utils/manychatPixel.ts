/**
 * ManyChat Pixel – eventos de conversión y dinero.
 * Requiere el script ManyChat Pixel en index.html (ManyChat Settings → Pixel).
 * Los eventos se disparan solo si MC_PIXEL está cargado.
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

/**
 * Dispara un evento de conversión en ManyChat (clicks, vistas, acciones).
 */
export function trackManyChatConversion(eventName: string): void {
  if (!isMcPixelReady()) return;
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
  if (!isMcPixelReady()) return;
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
  CLICK_PAYPAL: "bear_beat_click_paypal",
  START_CHECKOUT: "bear_beat_start_checkout",
  REGISTRATION: "bear_beat_registration",
  PAYMENT_SUCCESS: "bear_beat_payment_success",
  CANCEL_SUBSCRIPTION: "bear_beat_cancel_subscription",
  CHANGE_PLAN: "bear_beat_change_plan",
} as const;
