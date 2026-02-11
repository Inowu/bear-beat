/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: "class",
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // PALETA SEMÁNTICA (para index.css light/dark)
        bg: {
          main: "var(--bg-main)",
          card: "var(--bg-card)",
          input: "var(--bg-input)",
        },
        text: {
          main: "var(--text-main)",
          muted: "var(--text-muted)",
        },
        border: {
          DEFAULT: "var(--border-main)",
        },
        bear: {
          cyan: "#08E1F7",      // Tu Cyan Principal
          mint: "#00E6C1",      // Tu Menta
          dark: {
            100: "#404040",     // Items Nav
            200: "#3B3B3B",     // Items Nav alt
            300: "#2A2A2A",     // Body Modales
            400: "#292929",     // Navbar / Aside
            500: "#1A1A1A",     // Cards / Fondos
            900: "#020617",     // Fondo Principal
          },
          light: {
            100: "#FFFFFF",     // Superficies
            200: "#EEEEEE",     // Fondo General Light
          }
        },
        status: {
          error: "#FF2D2C",
          success: "#39D834",
          warning: "#FEBC2E",
        }
      },
      fontFamily: {
        ui: ["var(--bb-font-ui)"],
        poppins: ["var(--bb-font-ui)"],
        bear: ["Bear-font", "Poppins", "sans-serif"], // Arkhip para títulos
      },
      backgroundImage: {
        'bear-gradient': 'linear-gradient(11deg, #00E6C1 0%, #08E1F7 100%)',
      },
      borderRadius: {
        'pill': '999px',
        'card': '12px',
      }
    },
  },
  plugins: [],
}
