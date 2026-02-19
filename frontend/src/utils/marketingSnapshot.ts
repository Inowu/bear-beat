type NullableNumber = number | null | undefined;

const DAYS_PER_MONTH_FOR_DAILY_PRICE = 30;
const TOP_GENRES_LIMIT = 10;

const toNumber = (value: unknown): number => {
  if (typeof value === "bigint") return Number(value);
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

const toPositiveInt = (value: unknown): number => {
  const parsed = Math.floor(toNumber(value));
  return parsed > 0 ? parsed : 0;
};

const toPositiveNumber = (value: unknown): number => {
  const parsed = toNumber(value);
  return parsed > 0 ? parsed : 0;
};

const toDailyPrice = (monthlyPrice: NullableNumber): number => {
  const safeMonthly = toPositiveNumber(monthlyPrice);
  if (!safeMonthly) return 0;
  const rawDaily = safeMonthly / DAYS_PER_MONTH_FOR_DAILY_PRICE;
  return Math.floor(rawDaily * 10) / 10;
};

const normalizeGenreName = (value: unknown): string => {
  const raw = `${value ?? ""}`.trim();
  if (!raw) return "";
  return raw.replace(/\s+/g, " ");
};

const formatMoneyForMonthlyLabel = (
  amount: number,
  currency: "mxn" | "usd",
): string => {
  const safeAmount = toPositiveNumber(amount);
  if (!safeAmount) return "0";
  const locale = currency === "usd" ? "en-US" : "es-MX";
  const hasDecimals = !Number.isInteger(safeAmount);
  const formatted = new Intl.NumberFormat(locale, {
    minimumFractionDigits: hasDecimals ? 2 : 0,
    maximumFractionDigits: 2,
  }).format(safeAmount);
  return formatted;
};

export type MarketingVariablesSnapshot = {
  TOTAL_FILES: number;
  TOTAL_TB: number;
  TOTAL_GENRES: number;
  TOTAL_KARAOKE: number;
  TOTAL_AUDIO: number;
  TOTAL_VIDEO: number;
  WEEKLY_NEW_FILES: number;
  PRICE_USD: number;
  PRICE_MXN: number;
  PRICE_PER_DAY_USD: number;
  PRICE_PER_DAY_MXN: number;
  TRIAL_DAYS: number;
  TRIAL_GB: number;
  MONTHLY_GB: number;
  TOP_GENRES: string[];
  TRIAL_ELIGIBLE: boolean | null;
  MONTHLY_LABEL_DUAL: string;
};

export const EMPTY_MARKETING_VARIABLES: MarketingVariablesSnapshot = {
  TOTAL_FILES: 0,
  TOTAL_TB: 0,
  TOTAL_GENRES: 0,
  TOTAL_KARAOKE: 0,
  TOTAL_AUDIO: 0,
  TOTAL_VIDEO: 0,
  WEEKLY_NEW_FILES: 0,
  PRICE_USD: 0,
  PRICE_MXN: 0,
  PRICE_PER_DAY_USD: 0,
  PRICE_PER_DAY_MXN: 0,
  TRIAL_DAYS: 0,
  TRIAL_GB: 0,
  MONTHLY_GB: 0,
  TOP_GENRES: [],
  TRIAL_ELIGIBLE: null,
  MONTHLY_LABEL_DUAL: "",
};

export function buildMarketingVariables(input: {
  pricingConfig?: any;
  weeklyUploads?: any;
}): MarketingVariablesSnapshot {
  const pricing = input.pricingConfig ?? {};
  const weekly = input.weeklyUploads ?? {};
  const uiStats = pricing?.ui?.stats ?? {};
  const catalog = pricing?.catalog ?? {};
  const plans = pricing?.plans ?? {};
  const trial = pricing?.trialConfig ?? {};

  const totalFiles = toPositiveInt(
    uiStats?.totalFiles ?? catalog?.effectiveTotalFiles ?? catalog?.totalFiles,
  );
  const totalTB = toPositiveNumber(
    uiStats?.totalTB ?? catalog?.effectiveTotalTB ?? (catalog?.totalGB ?? 0) / 1000,
  );
  const totalGenres = toPositiveInt(
    catalog?.totalGenres ?? uiStats?.totalGenres ?? catalog?.genresDetail?.length,
  );
  const totalKaraoke = toPositiveInt(catalog?.karaokes);
  const totalAudio = toPositiveInt(catalog?.audios);
  const totalVideo = toPositiveInt(catalog?.videos);
  const weeklyNewFiles = toPositiveInt(weekly?.totalFiles);
  const priceUsd = toPositiveNumber(plans?.usd?.price);
  const priceMxn = toPositiveNumber(plans?.mxn?.price);
  const pricePerDayUsd = toDailyPrice(priceUsd);
  const pricePerDayMxn = toDailyPrice(priceMxn);
  const trialDays = toPositiveInt(trial?.days);
  const trialGb = toPositiveInt(trial?.gb);
  const monthlyGb = toPositiveInt(
    uiStats?.quotaGbDefault ??
      uiStats?.quotaGb?.mxn ??
      uiStats?.quotaGb?.usd ??
      plans?.mxn?.gigas ??
      plans?.usd?.gigas,
  );
  const topGenresRows = Array.isArray(catalog?.genresDetail)
    ? catalog.genresDetail
    : [];
  const topGenres = topGenresRows
    .map((row: any) => ({
      name: normalizeGenreName(row?.name),
      files: toPositiveInt(row?.files),
    }))
    .filter((row: { name: string; files: number }) => Boolean(row.name))
    .sort((left: { name: string; files: number }, right: { name: string; files: number }) => {
      if (right.files !== left.files) return right.files - left.files;
      return left.name.localeCompare(right.name, "es-MX");
    })
    .slice(0, TOP_GENRES_LIMIT)
    .map((row: { name: string; files: number }) => row.name);

  const monthlyLabelParts: string[] = [];
  if (priceMxn > 0) {
    monthlyLabelParts.push(
      `MXN $${formatMoneyForMonthlyLabel(priceMxn, "mxn")}/mes`,
    );
  }
  if (priceUsd > 0) {
    monthlyLabelParts.push(
      `USD $${formatMoneyForMonthlyLabel(priceUsd, "usd")}/mes`,
    );
  }

  return {
    TOTAL_FILES: totalFiles,
    TOTAL_TB: totalTB,
    TOTAL_GENRES: totalGenres,
    TOTAL_KARAOKE: totalKaraoke,
    TOTAL_AUDIO: totalAudio,
    TOTAL_VIDEO: totalVideo,
    WEEKLY_NEW_FILES: weeklyNewFiles,
    PRICE_USD: priceUsd,
    PRICE_MXN: priceMxn,
    PRICE_PER_DAY_USD: pricePerDayUsd,
    PRICE_PER_DAY_MXN: pricePerDayMxn,
    TRIAL_DAYS: trialDays,
    TRIAL_GB: trialGb,
    MONTHLY_GB: monthlyGb,
    TOP_GENRES: topGenres,
    TRIAL_ELIGIBLE:
      typeof trial?.eligible === "boolean" || trial?.eligible === null
        ? trial.eligible
        : null,
    MONTHLY_LABEL_DUAL: monthlyLabelParts.join(" · "),
  };
}

