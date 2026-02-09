const HOME_NUMBER_LOCALE = "es-MX";

const nfInt = new Intl.NumberFormat(HOME_NUMBER_LOCALE, {
  maximumFractionDigits: 0,
});

const nfTb = new Intl.NumberFormat(HOME_NUMBER_LOCALE, {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const nfGb = new Intl.NumberFormat(HOME_NUMBER_LOCALE, {
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
  if (!Number.isFinite(n) || n <= 0) return `0.00 TB`;
  return `${nfTb.format(n)} TB`;
}

export function formatGB(gbValue: number): string {
  const n = Number(gbValue);
  if (!Number.isFinite(n) || n <= 0) return `0.0 GB`;
  return `${nfGb.format(n)} GB`;
}

export function formatDownloads(value: number): string {
  return `${formatInt(value)} descargas`;
}

export function normalizeSearchKey(value: string): string {
  return `${value ?? ""}`
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function normalizeGenreDisplayName(raw: string): string {
  let name = `${raw ?? ""}`.trim();
  if (!name) return "";

  // Targeted corrections for credibility on the landing (do not change backend data).
  const corrections: Array<[RegExp, string]> = [
    [/\bRequetton\b/gi, "Reggaetón"],
    [/\bReguetton\b/gi, "Reggaetón"],
    [/\bReggaeton\b/gi, "Reggaetón"],
    [/\bIngles\b/gi, "Inglés"],
    [/\bEspanol\b/gi, "Español"],
    [/\bNorteno\b/gi, "Norteño"],
    [/\bNortenos\b/gi, "Norteños"],
  ];

  for (const [re, replacement] of corrections) {
    name = name.replace(re, replacement);
  }

  name = name.replace(/\s+/g, " ").trim();
  return name;
}

export type HomeNumberLocale = typeof HOME_NUMBER_LOCALE;
export { HOME_NUMBER_LOCALE };

