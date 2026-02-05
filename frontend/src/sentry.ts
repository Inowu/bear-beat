/**
 * Sentry: debe ejecutarse antes que cualquier otro código de la app.
 * Este archivo se importa en la primera línea de index.tsx.
 * En CRA/Netlify, REACT_APP_SENTRY_DSN debe estar definida en el build.
 */
import * as Sentry from "@sentry/react";

const dsn = process.env.REACT_APP_SENTRY_DSN;
if (dsn) {
  Sentry.init({
    dsn,
    release: "bear-beat@1.0.0",
    environment: process.env.NODE_ENV || "production",
    sendDefaultPii: true,
    debug: process.env.NODE_ENV === "development",
    tracesSampleRate: 0,
    integrations: [],
  });
} else if (typeof window !== "undefined") {
  console.warn(
    "[Sentry] REACT_APP_SENTRY_DSN no definido. En Netlify: Site configuration → Environment variables → añade REACT_APP_SENTRY_DSN y vuelve a desplegar."
  );
}
