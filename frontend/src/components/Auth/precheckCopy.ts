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

export function getPrecheckMessage(key: PrecheckMessageKey): string {
  switch (key) {
    case "welcome_back_trial":
      return "Bienvenido de vuelta. Este correo puede activar prueba gratis al continuar.";
    case "welcome_back_no_trial":
      return "Bienvenido de vuelta. Con este correo ya has usado anteriormente tu prueba gratis; inicia sesión para activar tu membresía.";
    case "new_account_trial":
      return "Este correo aún no tiene cuenta. Crea tu cuenta para empezar tu prueba gratis.";
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
