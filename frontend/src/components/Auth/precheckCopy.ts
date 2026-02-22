import type { CheckoutIntentMethod } from "./checkoutIntent";

export const PRECHECK_MESSAGE_KEYS = [
  "welcome_back_trial",
  "welcome_back_no_trial",
  "new_account_trial",
  "new_account_no_trial",
  "blocked_account",
  "deleted_account",
] as const;

export type PrecheckMessageKey = (typeof PRECHECK_MESSAGE_KEYS)[number];

const precheckMessageSet = new Set<string>(PRECHECK_MESSAGE_KEYS);

export function isPrecheckMessageKey(value: unknown): value is PrecheckMessageKey {
  return typeof value === "string" && precheckMessageSet.has(value);
}

export type PrecheckMessageContext = {
  intentMethod?: CheckoutIntentMethod | null;
  intentAllowsTrial?: boolean | null;
};

function getMethodLabel(method: CheckoutIntentMethod | null | undefined): string {
  switch (method) {
    case "paypal":
      return "PayPal";
    case "spei":
      return "SPEI";
    case "oxxo":
      return "Efectivo";
    case "bbva":
      return "BBVA";
    default:
      return "";
  }
}

function getNoTrialMethodSuffix(context?: PrecheckMessageContext): string {
  const label = getMethodLabel(context?.intentMethod ?? null);
  if (label) return ` con ${label}`;
  return " con este método de pago";
}

export function getPrecheckMessage(
  key: PrecheckMessageKey,
  context?: PrecheckMessageContext,
): string {
  const intentAllowsTrial = context?.intentAllowsTrial !== false;

  switch (key) {
    case "welcome_back_trial":
      if (!intentAllowsTrial) {
        return `Bienvenido de vuelta. Con este correo puedes iniciar sesión para activar tu membresía${getNoTrialMethodSuffix(context)} (sin prueba).`;
      }
      return "Bienvenido de vuelta. Este correo puede activar prueba gratis al continuar con tarjeta.";
    case "welcome_back_no_trial":
      return "Bienvenido de vuelta. Con este correo ya has usado anteriormente tu prueba gratis; inicia sesión para activar tu membresía.";
    case "new_account_trial":
      if (!intentAllowsTrial) {
        return `Este correo aún no tiene cuenta. Crea tu cuenta para activar tu membresía${getNoTrialMethodSuffix(context)} (sin prueba).`;
      }
      return "Este correo aún no tiene cuenta. Crea tu cuenta para empezar tu prueba gratis. La elegibilidad final se confirma al activar con tarjeta.";
    case "new_account_no_trial":
      return "Este correo aún no tiene cuenta. Crea tu cuenta para activar tu membresía.";
    case "blocked_account":
      return "Esta cuenta está bloqueada temporalmente. Escríbenos por WhatsApp y te ayudamos a recuperarla.";
    case "deleted_account":
      return "Esta cuenta fue desactivada anteriormente. Escríbenos por WhatsApp y te ayudamos a recuperarla.";
    default:
      return "";
  }
}
