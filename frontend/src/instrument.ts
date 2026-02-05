/**
 * Sentry – documento oficial: este archivo debe importarse ANTES que cualquier otro.
 * https://docs.sentry.io/platforms/javascript/guides/react/
 *
 * En CRA/Netlify, REACT_APP_SENTRY_DSN debe existir en el momento del build.
 */
import * as Sentry from "@sentry/react";

const dsn = process.env.REACT_APP_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    sendDefaultPii: true,
    debug: true, // Ver en consola si los eventos se envían (doc: "observe your console output")
    release: "bear-beat@1.0.0",
    environment: process.env.NODE_ENV || "production",
    // Sin tracing/replay para no saturar cuota y evitar 429
    tracesSampleRate: 0,
    integrations: [],
  });
} else if (typeof window !== "undefined") {
  console.warn(
    "[Sentry] REACT_APP_SENTRY_DSN no definido. En Netlify añade la variable, guarda y haz Trigger deploy (el DSN se incluye en el build)."
  );
}
