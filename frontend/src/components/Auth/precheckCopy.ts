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
export const PRECHECK_INELIGIBLE_REASONS = [
  "trial_already_used",
  "already_paid_member",
  "phone_linked_history",
  "trial_disabled",
  "unknown",
] as const;
export type PrecheckIneligibleReason =
  (typeof PRECHECK_INELIGIBLE_REASONS)[number];

const precheckMessageSet = new Set<string>(PRECHECK_MESSAGE_KEYS);
const precheckIneligibleReasonSet = new Set<string>(
  PRECHECK_INELIGIBLE_REASONS,
);

export function isPrecheckMessageKey(value: unknown): value is PrecheckMessageKey {
  return typeof value === "string" && precheckMessageSet.has(value);
}

export function isPrecheckIneligibleReason(
  value: unknown,
): value is PrecheckIneligibleReason {
  return (
    typeof value === "string" && precheckIneligibleReasonSet.has(value)
  );
}

export type PrecheckMessageContext = {
  intentMethod?: CheckoutIntentMethod | null;
  intentAllowsTrial?: boolean | null;
  ineligibleReason?: PrecheckIneligibleReason | null;
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

function getNoTrialReasonMessage(context?: PrecheckMessageContext): string {
  switch (context?.ineligibleReason) {
    case "trial_already_used":
      return "ya has usado tu prueba gratis anteriormente";
    case "already_paid_member":
      return "tu cuenta ya tiene historial de membresía de pago";
    case "phone_linked_history":
      return "detectamos historial previo de prueba o membresía en un número asociado";
    case "trial_disabled":
      return "la prueba gratis no está disponible temporalmente";
    default:
      return "la prueba gratis no está disponible para esta cuenta";
  }
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
      return `Bienvenido de vuelta. Con este correo ${getNoTrialReasonMessage(context)}; inicia sesión para activar tu membresía.`;
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
