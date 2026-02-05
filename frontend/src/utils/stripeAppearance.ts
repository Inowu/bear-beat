/**
 * Apariencia de Stripe Elements (Payment Element, Card Element) según tema light/dark.
 * Colores alineados con --app-* / --ph-* del diseño.
 */

const FONT_FAMILY = "Poppins, sans-serif";
const BORDER_RADIUS = "10px";

const LIGHT = {
  theme: "flat" as const,
  variables: {
    colorPrimary: "#06b6d4",
    colorBackground: "#ffffff",
    colorText: "#0f172a",
    colorTextSecondary: "#64748b",
    colorTextPlaceholder: "#94a3b8",
    colorDanger: "#dc2626",
    fontFamily: FONT_FAMILY,
    borderRadius: BORDER_RADIUS,
    spacingUnit: "4px",
  },
};

const DARK = {
  theme: "flat" as const,
  variables: {
    colorPrimary: "#22d3ee",
    colorBackground: "#0f172a",
    colorText: "#e2e8f0",
    colorTextSecondary: "#94a3b8",
    colorTextPlaceholder: "#64748b",
    colorDanger: "#f87171",
    fontFamily: FONT_FAMILY,
    borderRadius: BORDER_RADIUS,
    spacingUnit: "4px",
  },
};

export function getStripeAppearance(theme: "light" | "dark") {
  return theme === "dark" ? DARK : LIGHT;
}
