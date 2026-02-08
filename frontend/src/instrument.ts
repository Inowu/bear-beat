import * as Sentry from "@sentry/react";

const resolveNumber = (
  value: string | undefined,
  fallbackValue: number,
): number => {
  if (!value) return fallbackValue;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallbackValue;
};

const dsn =
  process.env.REACT_APP_SENTRY_DSN ||
  process.env.REACT_APP_SENTRY_FRONTEND_DSN ||
  "";
const sentryEnvironment =
  process.env.REACT_APP_SENTRY_ENVIRONMENT ||
  process.env.REACT_APP_ENVIRONMENT ||
  process.env.NODE_ENV ||
  "development";
const sentryRelease = process.env.REACT_APP_SENTRY_RELEASE;
const sentryDebug = process.env.REACT_APP_SENTRY_DEBUG === "1";

const isProdBuild = process.env.NODE_ENV === "production";
const captureDevErrors = process.env.REACT_APP_SENTRY_CAPTURE_DEV_ERRORS === "1";

// Control event volume (prevents hitting Sentry quotas during development).
const sampleRate = resolveNumber(
  process.env.REACT_APP_SENTRY_SAMPLE_RATE,
  1,
);
const tracesSampleRate = resolveNumber(
  process.env.REACT_APP_SENTRY_TRACES_SAMPLE_RATE,
  isProdBuild ? 0.05 : 0,
);
const replaysSessionSampleRate = resolveNumber(
  process.env.REACT_APP_SENTRY_REPLAY_SESSION_SAMPLE_RATE,
  // Default to 0 to avoid duplicating Hotjar session recordings.
  // Keep "replay on error" enabled for debugging real issues.
  isProdBuild ? 0 : 0,
);
const replaysOnErrorSampleRate = resolveNumber(
  process.env.REACT_APP_SENTRY_REPLAY_ON_ERROR_SAMPLE_RATE,
  // Capture all error replays by default in production; override via env if needed.
  isProdBuild ? 1 : 0,
);

const sentryEnabled = Boolean(dsn);
const TEST_EVENT_COOLDOWN_MS = 20_000;
const TEST_EVENT_LAST_TS_KEY = "bb.sentry.lastTestTs";

if (sentryEnabled) {
  Sentry.init({
    dsn,
    enabled: true,
    environment: sentryEnvironment,
    release: sentryRelease,
    debug: sentryDebug,
    // Strict privacy: do not send default PII (user IP/cookies) from the browser.
    // We still tag issues with a stable user id in UserContext.
    sendDefaultPii: false,
    sampleRate,
    tracesSampleRate,
    replaysSessionSampleRate,
    replaysOnErrorSampleRate,
    integrations: [
      Sentry.replayIntegration({
        // Strict privacy defaults: do not record readable text or input values.
        // Unmask/unblock only explicitly safe elements.
        maskAllText: true,
        maskAllInputs: true,
        blockAllMedia: true,
        unmask: ["[data-replay-unmask]"],
        unblock: ["[data-replay-unblock]"],
      }),
    ],
    beforeSend(event) {
      const message = typeof event.message === "string" ? event.message : "";
      const excMessage =
        event.exception?.values?.[0]?.value ||
        event.exception?.values?.[0]?.type ||
        "";

      // Drop low-signal browser noise.
      const combined = `${message} ${excMessage}`.toLowerCase();
      if (
        combined.includes("resizeobserver loop limit exceeded") ||
        combined.includes("resizeobserver loop completed with undelivered notifications")
      ) {
        return null;
      }

      // Fetch/navigation aborts are common (especially in in-app browsers) and not actionable.
      if (
        combined.includes("aborterror") ||
        combined.includes("fetch is aborted") ||
        combined.includes("signal is aborted") ||
        combined.includes("the user aborted a request")
      ) {
        return null;
      }

      // Replay (rrweb) may attempt to introspect cross-origin iframes (PayPal, etc).
      // These SecurityErrors are expected and not actionable.
      if (
        combined.includes("blocked a frame with origin") &&
        combined.includes("cross-origin frame")
      ) {
        return null;
      }

      // Rare Safari/third-party noise with no useful stack traces.
      if (combined.includes("emptyranges")) {
        return null;
      }

      // In dev builds, only allow explicit Sentry test events unless overridden.
      if (!isProdBuild && !captureDevErrors) {
        const isExplicitTest =
          event.tags?.sentry_test === "true" ||
          combined.includes("frontend_test_exception") ||
          combined.includes("frontend_unhandled_exception");
        if (!isExplicitTest) return null;
      }

      return event;
    },
  });
}

const maskDsn = (value: string): string => {
  try {
    const parsed = new URL(value);
    const projectId = parsed.pathname.replace("/", "");
    return `${parsed.protocol}//${parsed.host}/${projectId}`;
  } catch {
    return "invalid-dsn";
  }
};

export const getFrontendSentryStatus = () => ({
  enabled: sentryEnabled,
  dsn: sentryEnabled ? maskDsn(dsn) : null,
  environment: sentryEnvironment,
  release: sentryRelease || null,
  sampleRate,
  tracesSampleRate,
  replaysSessionSampleRate,
  replaysOnErrorSampleRate,
});

export const sendFrontendSentryTestEvent = async (
  label = "manual-frontend-test",
): Promise<string> => {
  if (!sentryEnabled) {
    throw new Error("Sentry frontend no está habilitado");
  }
  if (typeof window !== "undefined") {
    const raw = window.sessionStorage.getItem(TEST_EVENT_LAST_TS_KEY);
    const lastTs = raw ? Number(raw) : NaN;
    const now = Date.now();
    if (Number.isFinite(lastTs) && now - lastTs < TEST_EVENT_COOLDOWN_MS) {
      throw new Error("Espera unos segundos antes de volver a enviar otro test.");
    }
    window.sessionStorage.setItem(TEST_EVENT_LAST_TS_KEY, String(now));
  }
  const eventId = Sentry.captureException(
    new Error(`FRONTEND_TEST_EXCEPTION:${label}`),
    {
      tags: {
        sentry_test: "true",
        source: "frontend-manual",
      },
      level: "error",
    },
  );
  await Sentry.flush(4000);
  return eventId;
};

export const triggerFrontendUnhandledSentryError = (
  label = "manual-frontend-throw",
): void => {
  setTimeout(() => {
    throw new Error(`FRONTEND_UNHANDLED_EXCEPTION:${label}`);
  }, 0);
};

declare global {
  interface Window {
    bbSentryStatus?: () => ReturnType<typeof getFrontendSentryStatus>;
    bbSentryTest?: (label?: string) => Promise<string>;
    bbSentryThrow?: (label?: string) => void;
  }
}

if (typeof window !== "undefined") {
  window.bbSentryStatus = getFrontendSentryStatus;
  window.bbSentryTest = sendFrontendSentryTestEvent;
  window.bbSentryThrow = triggerFrontendUnhandledSentryError;
}
