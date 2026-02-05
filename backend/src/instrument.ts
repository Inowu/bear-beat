/**
 * Sentry: debe cargarse antes que cualquier otro módulo.
 * Configura DSN desde process.env.SENTRY_DSN (no hardcodear).
 */
import path from "path";
import { config } from "dotenv";

config({ path: path.resolve(__dirname, "../.env") });

import * as Sentry from "@sentry/node";
import { nodeProfilingIntegration } from "@sentry/profiling-node";

const dsn = process.env.SENTRY_DSN;
if (dsn) {
  Sentry.init({
    dsn,
    integrations: [nodeProfilingIntegration()],
    tracesSampleRate: 1.0,
    profilesSampleRate: 1.0,
  });
}
