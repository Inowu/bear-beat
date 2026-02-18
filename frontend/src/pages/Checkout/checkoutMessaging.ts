export type CheckoutMethod = "card" | "spei" | "oxxo" | "bbva" | "paypal";

type CheckoutTrialConfig = {
  enabled: boolean;
  days: number;
  gb: number;
  eligible?: boolean | null;
};

function isPositiveNumber(value: number): boolean {
  return Number.isFinite(value) && value > 0;
}

function formatCompactAmount(amountLabel: string): string {
  const normalized = String(amountLabel ?? "").replace(/,/g, "").trim();
  const parsed = Number(normalized);
  if (Number.isFinite(parsed)) {
    return new Intl.NumberFormat("es-MX", {
      minimumFractionDigits: parsed % 1 === 0 ? 0 : 2,
      maximumFractionDigits: 2,
    }).format(parsed);
  }
  return normalized.replace(/\.00$/, "");
}

export function hasVisibleTrialOffer(opts: {
  trialConfig: CheckoutTrialConfig | null | undefined;
  trialAllowedMethods: CheckoutMethod[];
}): boolean {
  const days = Number(opts.trialConfig?.days ?? 0);
  const gb = Number(opts.trialConfig?.gb ?? 0);
  const enabled = Boolean(opts.trialConfig?.enabled);
  const explicitlyIneligible = opts.trialConfig?.eligible === false;
  if (!enabled || explicitlyIneligible) return false;
  if (!isPositiveNumber(days) || !isPositiveNumber(gb)) return false;
  return opts.trialAllowedMethods.includes("card");
}

export function isTrialVisibleForMethod(opts: {
  trialConfig: CheckoutTrialConfig | null | undefined;
  method: CheckoutMethod;
  trialAllowedMethods: CheckoutMethod[];
}): boolean {
  if (!hasVisibleTrialOffer(opts)) return false;
  return opts.trialAllowedMethods.includes(opts.method);
}

export function buildCheckoutContinueLabel(opts: {
  method: CheckoutMethod;
  processingMethod: CheckoutMethod | null;
  totalPrice: string;
  currencyCode: string;
  isMethodTrial: boolean;
}): string {
  if (opts.processingMethod === "card") return "Abriendo pasarela segura...";
  if (opts.processingMethod === "spei") return "Generando referencia SPEI...";
  if (opts.processingMethod === "bbva") return "Abriendo pago BBVA...";
  if (opts.processingMethod === "oxxo") return "Generando referencia de pago en efectivo...";
  if (opts.processingMethod === "paypal") return "Procesando PayPal...";

  const compactAmount = formatCompactAmount(opts.totalPrice);
  if (opts.method === "card") {
    return opts.isMethodTrial ? "Iniciar prueba" : `Pagar $${compactAmount}`;
  }
  if (opts.method === "paypal") return `Pagar $${compactAmount}`;
  if (opts.method === "spei") return `Pagar $${compactAmount}`;
  if (opts.method === "bbva") return `Pagar $${compactAmount}`;
  return `Pagar $${compactAmount}`;
}

export function buildCheckoutMethodCopy(opts: {
  method: CheckoutMethod;
  totalPrice: string;
  currencyCode: string;
  monthlyLabel: string;
  trialDays: number;
  trialGbLabel: string;
  isMethodTrial: boolean;
}): {
  summaryLine: string;
  detailLine: string;
  trustLine: string;
} {
  const compactAmount = formatCompactAmount(opts.totalPrice);
  const compactMonthlyLabel = `$${compactAmount} ${opts.currencyCode}/mes`;

  if (opts.isMethodTrial) {
    return {
      summaryLine: `Hoy: $0 (prueba ${opts.trialDays} días + ${opts.trialGbLabel} GB)`,
      detailLine: `Después: ${compactMonthlyLabel} (si no cancelas)`,
      trustLine: "Tu prueba se activa hoy al confirmar tu tarjeta. Cancela cuando quieras.",
    };
  }

  const summaryLine = `Pago hoy: $${compactAmount} ${opts.currencyCode}`;
  const recurring = `Renovación automática: ${opts.monthlyLabel}.`;

  switch (opts.method) {
    case "paypal":
      return {
        summaryLine,
        detailLine: "Acceso inmediato",
        trustLine: "Tu cuenta se activa al aprobar el pago en PayPal. Cancela cuando quieras.",
      };
    case "spei":
      return {
        summaryLine,
        detailLine:
          "Generamos CLABE/referencia SPEI. Acceso automático al confirmarse tu transferencia. Te avisamos antes de vencer. Renovación manual desde Mi cuenta.",
        trustLine:
          "Tu cuenta se activa cuando el banco confirma la transferencia. Renovación manual desde Mi cuenta.",
      };
    case "bbva":
      return {
        summaryLine,
        detailLine: "Te redirigimos a BBVA para autorizar. Acceso automático al confirmarse el pago.",
        trustLine: "Tu cuenta se activa al confirmar el pago con BBVA.",
      };
    case "oxxo":
      return {
        summaryLine,
        detailLine:
          "Generamos referencia para pagar en tienda. Acceso automático al confirmarse el pago (puede tardar hasta 48 hrs). Te avisamos antes de vencer. Renovación manual desde Mi cuenta.",
        trustLine:
          "Tu cuenta se activa al confirmarse el pago en tienda. Renovación manual desde Mi cuenta.",
      };
    case "card":
    default:
      return {
        summaryLine,
        detailLine: "Acceso inmediato",
        trustLine: `Tu cuenta se activa al pagar. ${recurring} Cancela cuando quieras.`,
      };
  }
}

export function buildCheckoutChargeSummary(opts: {
  method: CheckoutMethod;
  totalPrice: string;
  currencyCode: string;
  monthlyLabel: string;
  trialDays: number;
  trialGbLabel: string;
  isMethodTrial: boolean;
  isAutoRenewMethod: boolean;
}): {
  todayLabel: string;
  todayValue: string;
  afterLabel: string;
  afterValue: string;
  accountLine: string;
} {
  const compactAmount = formatCompactAmount(opts.totalPrice);
  const compactMonthlyLabel = `$${compactAmount} ${opts.currencyCode}/mes`;

  if (opts.isMethodTrial) {
    return {
      todayLabel: "Hoy",
      todayValue: `$0 (prueba ${opts.trialDays} días + ${opts.trialGbLabel} GB)`,
      afterLabel: "Después",
      afterValue: `${compactMonthlyLabel} (si no cancelas)`,
      accountLine: "Cancela cuando quieras desde Mi cuenta.",
    };
  }

  const todayValue = `$${compactAmount} ${opts.currencyCode}`;
  if (opts.isAutoRenewMethod) {
    return {
      todayLabel: "Pago hoy",
      todayValue,
      afterLabel: "Acceso",
      afterValue: "Acceso inmediato",
      accountLine: "Cancela cuando quieras desde Mi cuenta.",
    };
  }

  switch (opts.method) {
    case "spei":
    case "oxxo":
      return {
        todayLabel: "Pago hoy",
        todayValue,
        afterLabel: "Renovación",
        afterValue: "Renovación manual desde Mi cuenta.",
        accountLine: "Te avisamos antes de vencer desde Mi cuenta.",
      };
    case "bbva":
      return {
        todayLabel: "Pago hoy",
        todayValue,
        afterLabel: "Acceso",
        afterValue: "Pago por evento (sin cobro automático).",
        accountLine: "Gestiona renovación y pagos desde Mi cuenta.",
      };
    case "paypal":
    case "card":
    default:
      return {
        todayLabel: "Pago hoy",
        todayValue,
        afterLabel: "Acceso",
        afterValue: "Acceso inmediato",
        accountLine: "Cancela cuando quieras desde Mi cuenta.",
      };
  }
}
