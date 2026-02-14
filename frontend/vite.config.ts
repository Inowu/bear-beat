import path from "node:path";
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const compatEnv: Record<string, string> = {};

  for (const [key, value] of Object.entries(env)) {
    if (key.startsWith("REACT_APP_")) compatEnv[key] = value;
  }

  compatEnv.NODE_ENV = mode === "production" ? "production" : "development";

  return {
    plugins: [react()],
    resolve: {
      alias: {
        src: path.resolve(__dirname, "src"),
      },
    },
    css: {
      preprocessorOptions: {
        scss: {
          includePaths: [path.resolve(__dirname)],
        },
      },
    },
    define: {
      "process.env": JSON.stringify(compatEnv),
      global: "globalThis",
    },
    server: {
      host: "0.0.0.0",
      port: 3000,
    },
    preview: {
      host: "0.0.0.0",
      port: 4173,
    },
    build: {
      outDir: "dist",
    },
  };
});
