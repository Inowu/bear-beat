import {
  APP_NUMBER_LOCALE,
  formatGB as formatGBBase,
  formatInt as formatIntBase,
  formatTB as formatTBBase,
} from "../../utils/format";

const HOME_NUMBER_LOCALE = APP_NUMBER_LOCALE;

export const formatInt = formatIntBase;
export const formatTB = formatTBBase;
export const formatGB = formatGBBase;

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
