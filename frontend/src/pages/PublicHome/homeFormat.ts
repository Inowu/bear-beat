import {
  APP_NUMBER_LOCALE,
  formatCatalogSizeMarketing as formatCatalogSizeMarketingBase,
  formatGB as formatGBBase,
  formatInt as formatIntBase,
  formatTB as formatTBBase,
} from "../../utils/format";

const HOME_NUMBER_LOCALE = APP_NUMBER_LOCALE;

export const formatInt = formatIntBase;
export const formatTB = formatTBBase;
export const formatGB = formatGBBase;
export const formatCatalogSizeMarketing = formatCatalogSizeMarketingBase;

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
    [/\bCubaton\b/gi, "Cubatón"],
    [/\bIngles\b/gi, "Inglés"],
    [/\bEspanol\b/gi, "Español"],
    [/\bNorteno\b/gi, "Norteño"],
    [/\bNortenos\b/gi, "Norteños"],
  ];

  for (const [re, replacement] of corrections) {
    name = name.replace(re, replacement);
  }

  // Decades labels should look consistent (80s, 90s, 00s).
  name = name.replace(/\b(?:19|20)?(70|80|90|00)\s*['’]?\s*s\b/gi, "$1s");
  name = name.replace(/\s+/g, " ").trim();
  return name;
}

export function isSingleLetterGenreLabel(value: string): boolean {
  const label = `${value ?? ""}`.trim();
  if (!label) return false;
  return /^[a-záéíóúüñ]$/i.test(label);
}

export function normalizeGenreGroupingKey(value: string): string {
  let key = normalizeSearchKey(value);
  if (!key) return "";

  const decade = key.match(/\b(?:19|20)?(70|80|90|00)\s*s\b/);
  if (decade) return `${decade[1]}s`;

  const hasLatinoContext =
    key.includes("latino") ||
    key.includes("latin") ||
    key.includes("espanol");

  if (hasLatinoContext && key.includes("pop")) return "pop latino";
  if (hasLatinoContext && key.includes("electro")) return "electro latino";
  if (key.includes("cumbia") && key.includes("sonidera"))
    return "cumbia sonidera";
  if (
    key.includes("cumbia") &&
    (key.includes("nortena") || key.includes("norteno"))
  )
    return "cumbia nortena";

  key = key.replace(/\s+/g, " ").trim();
  return key;
}

export type HomeNumberLocale = typeof HOME_NUMBER_LOCALE;
export { HOME_NUMBER_LOCALE };
