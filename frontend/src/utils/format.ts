export const APP_NUMBER_LOCALE = "es-MX";

const nfInt = new Intl.NumberFormat(APP_NUMBER_LOCALE, {
  maximumFractionDigits: 0,
});

const nfMb0 = new Intl.NumberFormat(APP_NUMBER_LOCALE, {
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

const dfShort = new Intl.DateTimeFormat(APP_NUMBER_LOCALE, {
  day: "numeric",
  month: "short",
  year: "numeric",
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

// Marketing-safe label for catalog size to avoid brittle decimal promises in copy.
export function formatCatalogSizeMarketing(tbValue: number, minFloorTB = 14): string {
  const n = Number(tbValue);
  const minFloor = Number.isFinite(minFloorTB) && minFloorTB > 0 ? Math.floor(minFloorTB) : 14;
  if (!Number.isFinite(n) || n <= 0) return `${minFloor}+ TB`;
  const floored = Math.max(1, Math.floor(n));
  return `${Math.max(minFloor, floored)}+ TB`;
}

export function formatGB(gbValue: number): string {
  const n = Number(gbValue);
  if (!Number.isFinite(n) || n <= 0) return "0.0 GB";
  return `${nfGb1.format(n)} GB`;
}

export function formatBytes(sizeInBytes: number | bigint | null | undefined): string {
  if (sizeInBytes === null || sizeInBytes === undefined) return "—";
  const n = typeof sizeInBytes === "bigint" ? Number(sizeInBytes) : Number(sizeInBytes);
  if (!Number.isFinite(n) || n < 0) return "—";
  if (n === 0) return "0 B";

  const KB = 1024;
  const MB = KB * 1024;
  const GB = MB * 1024;
  const TB = GB * 1024;

  if (n >= TB) return formatTB(n / TB);
  if (n >= GB) return formatGB(n / GB);
  if (n >= MB) return `${nfMb0.format(n / MB)} MB`;
  if (n >= KB) return `${nfMb0.format(n / KB)} KB`;
  return `${nfInt.format(n)} B`;
}

export function formatDateShort(value: Date | string | number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return dfShort.format(d);
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
