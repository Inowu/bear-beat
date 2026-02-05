/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: "class",
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // PALETA SEMÁNTICA (cambia según el modo light/dark)
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
        // MARCA (siempre igual)
        bear: {
          cyan: "#08E1F7",
          mint: "#00E6C1",
          dark: {
            100: "#404040",
            200: "#3B3B3B",
            300: "#2A2A2A",
            400: "#292929",
            500: "#1A1A1A",
            900: "#020617",
          },
          light: {
            100: "#FFFFFF",
            200: "#EEEEEE",
          },
        },
        status: {
          error: "#FF2D2C",
          success: "#39D834",
          warning: "#FEBC2E",
        },
      },
      fontFamily: {
        poppins: ["Poppins", "sans-serif"],
        bear: ["Bear-font", "Poppins", "sans-serif"],
      },
      backgroundImage: {
        "bear-gradient": "linear-gradient(11deg, #00E6C1 0%, #08E1F7 100%)",
      },
      borderRadius: {
        pill: "999px",
        card: "12px",
      },
    },
  },
  plugins: [],
};
