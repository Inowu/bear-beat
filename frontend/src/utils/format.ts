export const APP_NUMBER_LOCALE = "es-MX";

const nfInt = new Intl.NumberFormat(APP_NUMBER_LOCALE, {
  maximumFractionDigits: 0,
});

const nfTb2 = new Intl.NumberFormat(APP_NUMBER_LOCALE, {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const nfGb1 = new Intl.NumberFormat(APP_NUMBER_LOCALE, {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

export function formatInt(value: number): string {
  const n = Number(value);
  if (!Number.isFinite(n)) return "0";
  return nfInt.format(Math.round(n));
}

export function formatTB(tbValue: number): string {
  const n = Number(tbValue);
  if (!Number.isFinite(n) || n <= 0) return "0.00 TB";
  return `${nfTb2.format(n)} TB`;
}

export function formatGB(gbValue: number): string {
  const n = Number(gbValue);
  if (!Number.isFinite(n) || n <= 0) return "0.0 GB";
  return `${nfGb1.format(n)} GB`;
}

export function formatCurrency(
  amount: number,
  currency: "MXN" | "USD",
  locale: string = APP_NUMBER_LOCALE,
): string {
  const n = Number(amount);
  const safe = Number.isFinite(n) ? n : 0;
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
    }).format(safe);
  } catch {
    return `${safe.toFixed(2)} ${currency}`;
  }
}

