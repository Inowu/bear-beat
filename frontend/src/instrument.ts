import * as Sentry from "@sentry/react";

Sentry.init({
  dsn: process.env.REACT_APP_SENTRY_DSN || "https://b1199b86d9489b928d5a58660bc79c6b@o4508382588305408.ingest.us.sentry.io/4510831772237824",
  // Setting this option to true will send default PII data to Sentry.
  // For example, automatic IP address collection on events
  sendDefaultPii: true,
});
