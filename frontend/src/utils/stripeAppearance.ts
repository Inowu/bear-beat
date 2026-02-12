/**
 * Apariencia de Stripe Elements (Payment Element, Card Element) según tema light/dark.
 * Colores alineados con --app-* / --ph-* del diseño.
 */

const FONT_FAMILY = "Manrope, sans-serif";
const BORDER_RADIUS = "12px";

const LIGHT = {
  theme: "flat" as const,
  variables: {
    colorPrimary: "#08E1F7",
    colorBackground: "#FFFFFF",
    colorText: "#1A1A1A",
    colorTextSecondary: "#5F5F5F",
    colorTextPlaceholder: "#8A8A8A",
    colorDanger: "#FF2D2C",
    fontFamily: FONT_FAMILY,
    borderRadius: BORDER_RADIUS,
    spacingUnit: "4px",
  },
};

const DARK = {
  theme: "flat" as const,
  variables: {
    colorPrimary: "#08E1F7",
    colorBackground: "#2A2A2A",
    colorText: "#F7F7F7",
    colorTextSecondary: "#B8B8B8",
    colorTextPlaceholder: "#9A9A9A",
    colorDanger: "#FF2D2C",
    fontFamily: FONT_FAMILY,
    borderRadius: BORDER_RADIUS,
    spacingUnit: "4px",
  },
};

export function getStripeAppearance(theme: "light" | "dark") {
  return theme === "dark" ? DARK : LIGHT;
}
