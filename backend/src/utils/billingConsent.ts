export const BILLING_CONSENT_VERSION = '2026-02-14.v1';
export const BILLING_CONSENT_TYPE_RECURRING = 'recurring_billing';

const toFiniteNumber = (value: unknown): number => {
  const n = typeof value === 'number' ? value : value != null ? Number(value) : NaN;
  return Number.isFinite(n) ? n : 0;
};

export const formatRecurringAmountLabel = (params: { amount: unknown; currency: unknown }): string => {
  const currency = String(params.currency ?? '').trim().toUpperCase() || 'USD';
  const amount = toFiniteNumber(params.amount);
  const formatted = amount.toFixed(2);
  return `$${formatted} ${currency}/mes`;
};

export const buildRecurringBillingConsentText = (params: {
  amount: unknown;
  currency: unknown;
  trialDays?: number | null;
}): string => {
  const trialDaysRaw = typeof params.trialDays === 'number' ? params.trialDays : 0;
  const trialDays = Number.isFinite(trialDaysRaw) && trialDaysRaw > 0 ? Math.floor(trialDaysRaw) : 0;
  const recurring = formatRecurringAmountLabel({ amount: params.amount, currency: params.currency });

  if (trialDays > 0) {
    return (
      `Autorizo cobros recurrentes a mi método de pago por ${recurring}, ` +
      `que comenzarán al finalizar mi prueba de ${trialDays} días y se renovarán automáticamente hasta que cancele. ` +
      `Puedo cancelar en cualquier momento desde Mi cuenta.`
    );
  }

  return (
    `Autorizo cobros recurrentes a mi método de pago por ${recurring}. ` +
    `Se renovará automáticamente hasta que cancele. ` +
    `Puedo cancelar en cualquier momento desde Mi cuenta.`
  );
};

