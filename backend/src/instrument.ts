/**
 * Sentry para Node/Express – debe cargarse antes que cualquier otro módulo.
 * https://docs.sentry.io/platforms/javascript/guides/node/
 * DSN: process.env.SENTRY_DSN (backend/.env)
 */
import path from "path";
import { config } from "dotenv";

config({ path: path.resolve(__dirname, "../.env") });

import * as Sentry from "@sentry/node";

const dsn = process.env.SENTRY_DSN;
if (dsn) {
  Sentry.init({
    dsn,
    sendDefaultPii: true,
  });
}
