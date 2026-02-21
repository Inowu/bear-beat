export interface AnalyticsCurrencyTotals {
  mxn: number;
  usd: number;
  other: number;
  convertedMxn: number | null;
  usdToMxnRate: number | null;
}

const roundCurrency = (value: number, decimals = 2): number => {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
};

const toSafeNumber = (value: unknown): number => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'bigint') return Number(value);
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
};

export const resolveAnalyticsUsdToMxnRate = (): number | null => {
  const raw = process.env.ANALYTICS_USD_TO_MXN_RATE;
  if (!raw) return null;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return roundCurrency(parsed, 6);
};

export const computeAnalyticsCurrencyTotals = (params: {
  mxn: unknown;
  usd: unknown;
  other?: unknown;
  usdToMxnRate?: number | null;
}): AnalyticsCurrencyTotals => {
  const mxn = roundCurrency(Math.max(0, toSafeNumber(params.mxn)), 2);
  const usd = roundCurrency(Math.max(0, toSafeNumber(params.usd)), 2);
  const other = roundCurrency(Math.max(0, toSafeNumber(params.other ?? 0)), 2);
  const usdToMxnRate =
    params.usdToMxnRate !== undefined
      ? params.usdToMxnRate
      : resolveAnalyticsUsdToMxnRate();
  const convertedMxn =
    usdToMxnRate != null
      ? roundCurrency(mxn + usd * usdToMxnRate, 2)
      : null;

  return {
    mxn,
    usd,
    other,
    convertedMxn,
    usdToMxnRate,
  };
};

