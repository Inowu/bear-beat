import { formatInt, normalizeSearchKey } from "./homeFormat";

export const HOME_CTA_PRIMARY_LABEL_FALLBACK = "Continuar al pago seguro";
export const HOME_CTA_PRIMARY_LABEL_TRIAL = "Probar 7 días gratis";
export const HOME_CTA_PRICING_LABEL_TRIAL = "Empezar mi prueba gratis";
export const HOME_CTA_SECONDARY_LABEL = "Escuchar demos ↓";

export function getHomeCtaPrimaryLabel(trial: { enabled: boolean; days: number } | null): string {
  if (trial?.enabled && Number.isFinite(trial.days) && trial.days > 0) {
    return HOME_CTA_PRIMARY_LABEL_TRIAL;
  }
  return HOME_CTA_PRIMARY_LABEL_FALLBACK;
}

export const HOME_HERO_TITLE = "Nunca más te quedes sin la canción que te piden.";

function toSafeCounter(value: number): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.floor(n);
}

export function getHomeHeroSubtitle(totalFiles: number): string {
  const safeTotalFiles = toSafeCounter(totalFiles);
  const remixesLead =
    safeTotalFiles > 0 ? `${formatInt(safeTotalFiles)} remixes listos` : "Remixes listos";
  return `${remixesLead}: audios, videos y karaokes — organizados por género, mes y semana para que encuentres cualquier canción en segundos.`;
}

export function getHomeHeroFitPoints(totalGenres: number): string[] {
  const safeTotalGenres = toSafeCounter(totalGenres);
  const genresLead = safeTotalGenres > 0
    ? `${formatInt(safeTotalGenres)}+ géneros latinos`
    : "Géneros latinos";

  return [
    `${genresLead}: reggaetón, cumbia, bachata, dembow, guaracha, corridos, banda, huapango, punta y más`,
    "Ya viene con BPM y Key en cada archivo — listo para mezclar",
    "Actualizaciones cada semana — lo nuevo llega antes que a cualquier otro record pool",
  ];
}

type HomeHeroStat = {
  value: string;
  label: string;
  note?: string;
};

export const HOME_MONTHLY_NEW_PACKS = 4;

function formatStatCounter(value: number, options?: { plus?: boolean }): string {
  const safe = toSafeCounter(value);
  if (safe <= 0) return "N/D";
  const base = formatInt(safe);
  return options?.plus ? `${base}+` : base;
}

export function getHomeHeroStats(input: {
  totalFiles: number;
  totalTBLabel: string;
  totalGenres: number;
}): HomeHeroStat[] {
  const totalTBLabel = `${input.totalTBLabel ?? ""}`.trim() || "N/D";

  return [
    {
      value: formatStatCounter(input.totalFiles),
      label: "ARCHIVOS LISTOS",
    },
    {
      value: totalTBLabel,
      label: "DE CONTENIDO TOTAL",
    },
    {
      value: formatStatCounter(input.totalGenres, { plus: true }),
      label: "GÉNEROS LATINOS CUBIERTOS",
    },
    {
      value: `${HOME_MONTHLY_NEW_PACKS} packs`,
      label: "NUEVOS CADA MES",
      note: "ACTUALIZACIONES SEMANALES",
    },
  ];
}

export const HOME_HERO_MICROCOPY_BASE =
  "Pago seguro. Activa en minutos y cancela cuando quieras.";
export const HOME_HERO_TRUST_ITEMS = [
  "Pago seguro con Tarjeta, PayPal, SPEI y efectivo.",
] as const;
export const HOME_HERO_MICROCOPY_TRIAL =
  "Prueba solo con tarjeta. Cancela antes de que termine y no se cobra.";

export const HOME_USE_CASES = [
  {
    title: "Pedido inesperado",
    body: "Encuentra rápido por carpeta (año/mes/semana/género). Responde sin cortar el ritmo.",
  },
  {
    title: "Evento social multi‑género",
    body: "Carpetas listas por año/mes/semana/género para transiciones sin estrés.",
  },
  {
    title: "Sin WiFi (evita YouTube)",
    body: "Descargas a tu compu. No dependes del internet del lugar.",
  },
] as const;

export const HOME_COMPATIBILITY_ITEMS = [
  {
    title: "Descargas por FTP",
    body: "FileZilla o Air Explorer. Si nunca usaste FTP, te guiamos paso a paso.",
  },
  {
    title: "También por web",
    body: "Para archivos puntuales puedes descargar desde el explorador web.",
  },
  {
    title: "Formatos comunes",
    body: "Formatos comunes: MP3 (audio) y MP4 (video).",
  },
  {
    title: "Tu software, tu forma",
    body: "Descargas a tu computadora e importas a tu software como siempre.",
  },
] as const;

export type HomeFaqItem = {
  id: string;
  question: string;
  answer: string;
};

export type HomeFaqGenreStats = {
  name: string;
  searchKey?: string;
  files: number;
};

type BuildHomeFaqItemsInput = {
  totalFiles: number;
  karaokes: number;
  totalGenres: number;
  quotaGbDefault: number;
  trialEnabled: boolean;
  trialDays: number;
  trialGb: number;
  genres: HomeFaqGenreStats[];
};

function formatPlus(value: number): string {
  const safe = toSafeCounter(value);
  if (safe <= 0) return "0";
  return `${formatInt(safe)}+`;
}

function sumGenreFiles(
  genres: HomeFaqGenreStats[],
  matchers: Array<string | RegExp>,
): number {
  const rows = Array.isArray(genres) ? genres : [];
  return rows.reduce((sum, genre) => {
    const normalizedKey = normalizeSearchKey(
      `${genre?.searchKey || genre?.name || ""}`.trim(),
    );
    if (!normalizedKey) return sum;

    const matched = matchers.some((matcher) => {
      if (typeof matcher === "string") return normalizedKey.includes(matcher);
      return matcher.test(normalizedKey);
    });
    if (!matched) return sum;

    return sum + toSafeCounter(genre.files);
  }, 0);
}

function formatGenreMention(label: string, files: number): string {
  const safeFiles = toSafeCounter(files);
  if (safeFiles <= 0) return label;
  return `${label} (${formatPlus(safeFiles)} archivos)`;
}

export function buildHomeFaqItems(input: BuildHomeFaqItemsInput): HomeFaqItem[] {
  const safeTotalFiles = toSafeCounter(input.totalFiles);
  const safeKaraokes = toSafeCounter(input.karaokes);
  const safeTotalGenres = toSafeCounter(input.totalGenres);
  const safeQuotaGb = Math.max(1, toSafeCounter(input.quotaGbDefault));
  const trialEnabled = Boolean(input.trialEnabled);
  const safeTrialDays = Math.max(1, toSafeCounter(input.trialDays));
  const safeTrialGb = Math.max(1, toSafeCounter(input.trialGb));

  const videosEstimate = safeQuotaGb * 6;
  const audiosEstimate = safeQuotaGb * 20;
  const trialSongsEstimate = safeTrialGb * 6;

  const reggaetonFiles = sumGenreFiles(input.genres, [
    "reggaeton",
    "perreo",
    /reguet/,
  ]);
  const cumbiaFiles = sumGenreFiles(input.genres, ["cumbia"]);
  const bachataFiles = sumGenreFiles(input.genres, ["bachata"]);
  const dembowFiles = sumGenreFiles(input.genres, ["dembow"]);
  const guarachaFiles = sumGenreFiles(input.genres, ["guaracha"]);
  const dayOneTrialLine = trialEnabled
    ? `Con ${formatInt(safeTrialGb)} GB de descarga durante tu prueba de ${safeTrialDays} días, puedes llevarte ${formatPlus(trialSongsEstimate)} canciones para tu primer evento.`
    : `Desde el día 1 descargas con tu cuota activa (${formatInt(safeQuotaGb)} GB por ciclo) para armar tu set sin esperar.`;
  const contractTrialLine = trialEnabled
    ? `Si cancelas durante la prueba de ${safeTrialDays} días, no se te cobra.`
    : "No hay contrato anual ni permanencia forzada.";
  const trialChargeLine = trialEnabled
    ? `Solo si dejas activa la membresía al terminar tu prueba de ${safeTrialDays} días. Si cancelas antes del corte, no hay cobro.`
    : "No hay cargos sorpresa: tu siguiente cobro siempre se muestra antes en tu cuenta.";

  return [
    {
      id: "day-one",
      question: "¿Qué recibo desde el día 1?",
      answer:
        `Acceso inmediato a ${formatInt(safeTotalFiles)} archivos: audios DJ (extended, remix, acapella in/out), videos para pantalla y ${formatPlus(safeKaraokes)} karaokes. Todo organizado por género, mes y semana. ${dayOneTrialLine}`,
    },
    {
      id: "quota-enough",
      question: `¿${formatInt(safeQuotaGb)} GB es suficiente para mis eventos?`,
      answer:
        `Sí, para la mayoría de operación mensual en cabina. ${formatInt(safeQuotaGb)} GB equivalen aproximadamente a ${formatInt(videosEstimate)} videos o ${formatInt(audiosEstimate)} audios MP3 (según peso y calidad de cada archivo). Si necesitas más cuota, te ayudamos a escalar.`,
    },
    {
      id: "download-all-catalog",
      question: "¿Puedo descargar TODO el catálogo?",
      answer:
        `Puedes elegir cualquier archivo del catálogo completo (${formatInt(safeTotalFiles)} disponibles), pero la descarga se rige por tu cuota mensual (${formatInt(safeQuotaGb)} GB por ciclo). Así mantienes acceso total para seleccionar sin sorpresas en consumo.`,
    },
    {
      id: "not-technical",
      question: "¿Es difícil descargar? No soy técnico.",
      answer:
        "No. Puedes descargar por web o por FTP (FileZilla/Air Explorer). Si nunca usaste FTP, te guiamos paso a paso para que arranques hoy mismo sin complicarte.",
    },
    {
      id: "contract",
      question: "¿Hay contrato o letra chiquita?",
      answer:
        `No. Es mes a mes. Cancelas desde tu cuenta en pocos clics, sin llamadas ni esperas. ${contractTrialLine}`,
    },
    {
      id: "trial-charge",
      question: "¿Me van a cobrar si no me gusta?",
      answer:
        trialChargeLine,
    },
    {
      id: "dj-software",
      question: "¿Funciona con Serato / Rekordbox / Virtual DJ?",
      answer:
        "Sí. Los archivos están en MP3 (audio) y MP4 (video/karaoke), compatibles con software DJ profesional. Además, cada archivo incluye BPM y Key en el nombre para que importes y mezcles sin preparar metadata extra.",
    },
    {
      id: "genres-covered",
      question: "¿Tienen reggaetón nuevo / cumbia / mi género?",
      answer:
        `Sí. Cubrimos ${formatPlus(safeTotalGenres)} géneros latinos, incluyendo ${formatGenreMention("reggaetón", reggaetonFiles)}, ${formatGenreMention("cumbia", cumbiaFiles)}, ${formatGenreMention("bachata", bachataFiles)}, ${formatGenreMention("dembow", dembowFiles)}, ${formatGenreMention("guaracha", guarachaFiles)}, además de corridos, banda, norteño, huapango, cubatón, punta y más. Si no ves algo específico, escríbenos y lo buscamos.`,
    },
    {
      id: "update-frequency",
      question: "¿Cada cuánto suben música nueva?",
      answer:
        "Cada semana. Publicamos packs nuevos de forma continua para que llegues al evento con repertorio actualizado y no te quedes atrás en tendencias.",
    },
    {
      id: "karaoke",
      question: "¿Sirve para karaoke?",
      answer:
        `Sí. Incluye ${formatInt(safeKaraokes)} canciones de karaoke en video, organizadas para búsqueda rápida por artista/título y listas para evento social, boda, bar o antro.`,
    },
  ];
}
