import { formatTB } from "./format";

// These values are used only when the public catalog summary endpoint is unavailable.
// Keep them in sync across pages to avoid trust-breaking inconsistencies.
export const FALLBACK_CATALOG_TOTAL_FILES = 248_321;
export const FALLBACK_CATALOG_TOTAL_GB = 14_140;
export const FALLBACK_CATALOG_TOTAL_TB_LABEL = formatTB(FALLBACK_CATALOG_TOTAL_GB / 1000);

