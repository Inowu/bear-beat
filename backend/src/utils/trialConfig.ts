export type MarketingTrialConfig = {
  enabled: boolean;
  days: number;
  gb: number;
};

function clampInt(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, Math.floor(value)));
}

function clampNumber(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, value));
}

export function getMarketingTrialConfigFromEnv(): MarketingTrialConfig {
  const daysRaw = process.env.BB_TRIAL_DAYS ?? '';
  const gbRaw = process.env.BB_TRIAL_GB ?? '';

  const days = clampInt(Number(daysRaw) || 0, 0, 60);
  const gb = clampNumber(Number(gbRaw) || 0, 0, 10_000);

  return { enabled: days > 0, days, gb };
}

