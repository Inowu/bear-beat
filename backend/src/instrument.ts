import * as Sentry from '@sentry/node';
import { loadEnvOnce } from './utils/loadEnv';

loadEnvOnce();

const resolveNumber = (
  value: string | undefined,
  fallbackValue: number,
): number => {
  if (typeof value !== 'string') return fallbackValue;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallbackValue;
};

const dsn =
  process.env.SENTRY_DSN ||
  process.env.SENTRY_BACKEND_DSN ||
  '';

const sentryEnvironment =
  process.env.SENTRY_ENVIRONMENT ||
  process.env.NODE_ENV ||
  'development';
const normalizedSentryEnvironment = sentryEnvironment.trim().toLowerCase();
const isLiveSentryEnvironment =
  normalizedSentryEnvironment === 'production' ||
  normalizedSentryEnvironment === 'prod' ||
  normalizedSentryEnvironment === 'live';
const sentryRelease = process.env.SENTRY_RELEASE || process.env.npm_package_version;
const sentryDebug = process.env.SENTRY_DEBUG === '1';

const isProdRuntime = process.env.NODE_ENV === 'production';
const captureDevErrors = process.env.SENTRY_CAPTURE_DEV_ERRORS === '1';
const sampleRate = resolveNumber(
  process.env.SENTRY_SAMPLE_RATE,
  1,
);
const tracesSampleRate = resolveNumber(
  process.env.SENTRY_TRACES_SAMPLE_RATE,
  isProdRuntime ? 0.05 : 0,
);
const profilesSampleRate = resolveNumber(
  process.env.SENTRY_PROFILES_SAMPLE_RATE,
  isProdRuntime ? 0.05 : 0,
);

const sentryEnabled = Boolean(dsn);

if (sentryEnabled) {
  Sentry.init({
    dsn,
    environment: sentryEnvironment,
    release: sentryRelease,
    // Strict privacy: do not send default PII from the backend.
    sendDefaultPii: false,
    debug: sentryDebug,
    sampleRate,
    tracesSampleRate,
    profilesSampleRate,
    attachStacktrace: true,
    beforeSend(event) {
      const message = typeof event.message === 'string' ? event.message : '';
      const testMarker =
        message.includes('BACKEND_TEST_EVENT:') ||
        event.tags?.sentry_test === 'true';

      if (isLiveSentryEnvironment && testMarker) {
        return null;
      }

      // In dev runtimes, only allow explicit test events unless overridden.
      if (!isProdRuntime && !captureDevErrors) {
        const hasTestMarker =
          message.includes('BACKEND_TEST_EVENT:') ||
          message.includes('My first Sentry error') ||
          event.tags?.sentry_test === 'true';
        if (!hasTestMarker) return null;
      }
      return event;
    },
  });
}

const maskDsn = (value: string): string => {
  try {
    const parsed = new URL(value);
    const projectId = parsed.pathname.replace('/', '');
    return `${parsed.protocol}//${parsed.host}/${projectId}`;
  } catch {
    return 'invalid-dsn';
  }
};

export const getSentryBackendStatus = () => ({
  enabled: sentryEnabled,
  dsn: sentryEnabled ? maskDsn(dsn) : null,
  environment: sentryEnvironment,
  release: sentryRelease || null,
  sampleRate,
  tracesSampleRate,
  profilesSampleRate,
});

export const sendBackendSentryTestEvent = async (
  label = 'manual-backend-test',
): Promise<string> => {
  if (!sentryEnabled) {
    throw new Error('Sentry backend no está habilitado');
  }
  const eventId = Sentry.captureMessage(`BACKEND_TEST_EVENT:${label}`, 'error');
  await Sentry.flush(4000);
  return eventId;
};
