import { formatInt } from "../../../utils/format";

export type SignUpPrecheckTrialState = {
  enabled: boolean;
  days: number;
  gb: number;
  trialState: "eligible" | "ineligible" | "unknown_for_new";
  accountState: "new" | "existing_active" | "existing_blocked" | "existing_deleted";
};

export type SignUpTrialConfig = {
  enabled: boolean;
  days: number;
  gb: number;
  eligible: boolean | null;
};

type SignUpCheckoutChargeCopy = {
  summaryPrimary: string;
  todayLabel: string;
  todayValue: string;
  afterLabel: string;
  afterValue: string;
};

function toFiniteNumber(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function parseSignUpPrecheckTrial(
  value: unknown,
): SignUpPrecheckTrialState | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;

  const trialState = record.trialState;
  const accountState = record.accountState;
  if (
    trialState !== "eligible" &&
    trialState !== "ineligible" &&
    trialState !== "unknown_for_new"
  ) {
    return null;
  }
  if (
    accountState !== "new" &&
    accountState !== "existing_active" &&
    accountState !== "existing_blocked" &&
    accountState !== "existing_deleted"
  ) {
    return null;
  }

  return {
    enabled: Boolean(record.enabled),
    days: Math.max(0, Math.floor(toFiniteNumber(record.days))),
    gb: Math.max(0, Math.floor(toFiniteNumber(record.gb))),
    trialState,
    accountState,
  };
}

export function mapPrecheckTrialToConfig(
  precheckTrial: SignUpPrecheckTrialState | null,
): SignUpTrialConfig | null {
  if (!precheckTrial) return null;
  return {
    enabled: Boolean(precheckTrial.enabled),
    days: Math.max(0, Math.floor(toFiniteNumber(precheckTrial.days))),
    gb: Math.max(0, Math.floor(toFiniteNumber(precheckTrial.gb))),
    eligible:
      precheckTrial.trialState === "ineligible"
        ? false
        : precheckTrial.trialState === "eligible"
          ? true
          : null,
  };
}

export function shouldShowSignUpCheckoutTrial(input: {
  trialConfig: SignUpTrialConfig | null;
  intentAllowsTrial: boolean;
}): boolean {
  const { trialConfig, intentAllowsTrial } = input;
  if (!intentAllowsTrial) return false;
  if (!trialConfig) return false;
  if (!trialConfig.enabled) return false;
  if (trialConfig.eligible === false) return false;
  if (!Number.isFinite(trialConfig.days) || trialConfig.days <= 0) return false;
  if (!Number.isFinite(trialConfig.gb) || trialConfig.gb <= 0) return false;
  return true;
}

export function buildSignUpCheckoutChargeCopy(input: {
  showCheckoutTrial: boolean;
  trialConfig: SignUpTrialConfig | null;
  checkoutPlanPriceLabel: string | null;
}): SignUpCheckoutChargeCopy {
  const { showCheckoutTrial, trialConfig, checkoutPlanPriceLabel } = input;

  if (showCheckoutTrial && trialConfig) {
    const days = Math.max(0, Math.floor(toFiniteNumber(trialConfig.days)));
    const gb = Math.max(0, Math.floor(toFiniteNumber(trialConfig.gb)));
    return {
      summaryPrimary: "Hoy $0",
      todayLabel: "Hoy",
      todayValue: `$0 (prueba ${days} días + ${formatInt(gb)} GB)`,
      afterLabel: "Después",
      afterValue: checkoutPlanPriceLabel
        ? `${checkoutPlanPriceLabel}/mes (si no cancelas)`
        : "Se confirma al activar (si no cancelas)",
    };
  }

  return {
    summaryPrimary: checkoutPlanPriceLabel
      ? `Pago hoy ${checkoutPlanPriceLabel}`
      : "Pago hoy",
    todayLabel: "Pago hoy",
    todayValue: checkoutPlanPriceLabel ?? "—",
    afterLabel: "Acceso",
    afterValue: "Acceso inmediato al confirmar el pago.",
  };
}
