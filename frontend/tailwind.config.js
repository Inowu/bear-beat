/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: "class",
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // === PALETA BEAR BEAT ===
        bear: {
          cyan: "#08E1F7",      // Tu Cyan Principal (Brand Highlight)
          mint: "#00E6C1",      // Tu Menta para el Gradiente
          dark: {
            100: "#404040",     // Chips / Items Nav
            200: "#3B3B3B",     // Items Nav alt
            300: "#2A2A2A",     // Body Modales
            400: "#292929",     // Navbar / Aside Fondo
            500: "#1A1A1A",     // Header Modales / Fondos oscuros
            900: "#020617",     // Fondo General (Deep Dark) - Mantenemos slate-950 para contraste
          },
          light: {
            100: "#FFFFFF",     // Superficies
            200: "#EEEEEE",     // Fondo General Light
          },
          status: {
            error: "#FF2D2C",
            success: "#39D834",
            warning: "#FEBC2E",
          }
        }
      },
      fontFamily: {
        poppins: ["Poppins", "sans-serif"], // UI, Párrafos, Tablas
        bear: ["Bear-font", "Poppins", "sans-serif"], // Títulos, Branding, Precios
      },
      backgroundImage: {
        'bear-gradient': 'linear-gradient(11deg, #00E6C1 0%, #08E1F7 100%)', // Tu gradiente oficial
      },
      borderRadius: {
        'pill': '999px', // Para tus botones redondos
      }
    },
  },
  plugins: [],
}
