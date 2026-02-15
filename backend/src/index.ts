import './polyfills';
import './instrument';
import path from 'path';
import pm2 from 'pm2';
import * as Sentry from '@sentry/node';
import { createExpressMiddleware } from '@trpc/server/adapters/express';
import express from 'express';
import cors from 'cors';
import expressWinston from 'express-winston';
import winston from 'winston';
import { log } from './server';
import {
  getSentryBackendStatus,
  sendBackendSentryTestEvent,
} from './instrument';
import { initializeFileService } from './ftp';
import { appRouter } from './routers';
import { createContext } from './context';
import { downloadEndpoint } from './endpoints/download.endpoint';
import { initializeSearch } from './search';
import { rebuildTrackMetadataIndex } from './metadata';
import { conektaEndpoint } from './endpoints/webhooks/conekta.endpoint';
import { stripeEndpoint } from './endpoints/webhooks/stripe.endpoint';
import { paypalEndpoint } from './endpoints/webhooks/paypal.endpoint';
import { stripePiEndpoint } from './endpoints/webhooks/stripePaymentIntents.endpoint';
import { trackCoverEndpoint } from './endpoints/track-cover.endpoint';
import {
  compressionQueue,
  initializeCompressionQueue,
} from './queue/compression';
import { stripeProductsEndpoint } from './endpoints/webhooks/stripeProducts.endpoint';
import { analyticsCollectEndpoint } from './endpoints/analytics.endpoint';
import {
  manyChatHandoffCreateEndpoint,
  manyChatHandoffResolveEndpoint,
} from './endpoints/manychat-handoff.endpoint';
import { commsUnsubscribeEndpoint } from './endpoints/comms-unsubscribe.endpoint';
import { billingPortalEndpoint } from './endpoints/billing-portal.endpoint';
import {
  initializeRemoveUsersQueue,
  removeUsersQueue,
} from './queue/removeUsers';
import { downloadDirEndpoint } from './endpoints/download-dir.endpoint';
import { catalogStatsEndpoint } from './endpoints/catalog-stats.endpoint';
import { stripeOxxoHealthEndpoint } from './endpoints/stripe-oxxo-health.endpoint';

const DEFAULT_CORS_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:4173',
  'https://thebearbeat.com',
  'https://www.thebearbeat.com',
  // Netlify previews/staging (public marketing QA).
  'https://staging--incredible-druid-62114b.netlify.app',
  'https://deploy-preview-*--incredible-druid-62114b.netlify.app',
];

const getAllowedCorsOrigins = (): string[] => {
  const rawOrigins = process.env.CORS_ALLOWED_ORIGINS;
  if (!rawOrigins) return DEFAULT_CORS_ORIGINS;

  const parsed = rawOrigins
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  return parsed.length ? parsed : DEFAULT_CORS_ORIGINS;
};

const escapeRegex = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const matchesCorsOriginPattern = (pattern: string, origin: string): boolean => {
  if (!pattern.includes('*')) return pattern === origin;
  const re = new RegExp(`^${escapeRegex(pattern).replace(/\\\*/g, '.*')}$`);
  return re.test(origin);
};

const isAllowedCorsOrigin = (origin: string, allowedOrigins: string[]): boolean => {
  const needle = origin.trim();
  if (!needle) return false;
  return allowedOrigins.some((pattern) => matchesCorsOriginPattern(pattern, needle));
};

const toPositiveInt = (value: string | undefined, fallback = 0): number => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.floor(parsed);
};

async function main() {
  try {
    const app = express();
    const port = Number(process.env.PORT) || 5001;
    const allowedOrigins = getAllowedCorsOrigins();

    app.disable('x-powered-by');

    // Security headers (defense-in-depth). Keep this safe for APIs + static demos.
    app.use((_req, res, next) => {
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Referrer-Policy', 'no-referrer');
      res.setHeader('X-Frame-Options', 'DENY');
      res.setHeader(
        'Permissions-Policy',
        'geolocation=(), microphone=(), camera=(), usb=()',
      );
      // Clickjacking protection (primary). Avoid a restrictive CSP here because this
      // server also serves internal static demos under `/demos`.
      res.setHeader('Content-Security-Policy', "frame-ancestors 'none';");
      res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');
      next();
    });

    app.use(
      expressWinston.logger({
        transports: [new winston.transports.Console()],
        // `express-winston` and `winston` can resolve different `logform` typings.
        // Keep runtime JSON logging and avoid a type-only mismatch.
        format: winston.format.json() as any,
        // Never log headers/query/body (PII/secrets). Keep a minimal request line only.
        meta: false,
        msg(req, res) {
          const path =
            typeof (req as any).path === 'string' && (req as any).path
              ? (req as any).path
              : String((req as any).originalUrl ?? (req as any).url ?? '').split('?')[0];
          return `[HTTP] ${req.method} ${path} ${res.statusCode}`;
        },
      }),
    );

    app.use(
      cors({
        origin(origin, callback) {
          // If there is no Origin header, treat as a non-browser/server-to-server request.
          // Do not emit wildcard CORS headers for these requests.
          if (!origin) {
            callback(null, false);
            return;
          }
          if (isAllowedCorsOrigin(origin, allowedOrigins)) {
            callback(null, origin.trim());
            return;
          }
          callback(null, false);
        },
        credentials: true,
        methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization'],
        optionsSuccessStatus: 204,
      }),
    );

    app.use(
      '/trpc',
      createExpressMiddleware({
        router: appRouter,
        createContext,
        onError({ path, error, type }) {
          log.error(
            `[TRPC] ${type} ${path ?? 'unknown-path'} failed: ${error.message}`,
          );
        },
      }),
    );

    app.use(
      '/webhooks.paypal',
      express.raw({ type: 'application/json' }),
      paypalEndpoint,
    );

    app.use(
      '/webhooks.stripe',
      express.raw({ type: 'application/json' }),
      stripeEndpoint,
    );

    app.use(
      '/webhooks.stripe.pi',
      express.raw({ type: 'application/json' }),
      stripePiEndpoint,
    );

    app.use(
      '/webhooks.stripe.products',
      express.raw({ type: 'application/json' }),
      stripeProductsEndpoint,
    );

    app.use(
      '/webhooks.conekta',
      express.raw({ type: 'application/json' }),
      conektaEndpoint,
    );

    app.use('/demos', express.static(path.resolve(__dirname, '../demos')));

    app.get('/download', downloadEndpoint);

    app.get('/download-dir', downloadDirEndpoint);

    app.get('/track-cover', trackCoverEndpoint);

    app.get('/api/catalog-stats', catalogStatsEndpoint);

    app.post(
      '/api/analytics/collect',
      express.json({ limit: '128kb' }),
      analyticsCollectEndpoint,
    );

    // ManyChat -> Web handoff: generate a tokenized link and later resolve it in the browser.
    app.post(
      '/api/manychat/handoff',
      express.json({ limit: '64kb' }),
      express.urlencoded({ extended: true, limit: '64kb' }),
      manyChatHandoffCreateEndpoint,
    );
    app.get('/api/manychat/handoff/resolve', manyChatHandoffResolveEndpoint);

    // Public unsubscribe (email marketing). Supports GET (human click) and POST (one-click).
    app.get('/api/comms/unsubscribe', commsUnsubscribeEndpoint);
    app.post(
      '/api/comms/unsubscribe',
      express.urlencoded({ extended: false, limit: '8kb' }),
      commsUnsubscribeEndpoint,
    );

    // Public: expiring magic link to open Stripe Billing Portal (used by dunning emails).
    app.get('/api/billing/portal', billingPortalEndpoint);

    app.get('/api/analytics/health', (_req, res) => {
      res.json({
        ok: true,
        analyticsDbConfigured: Boolean(process.env.DATABASE_URL),
      });
    });

    app.get('/health/comms', (_req, res) => {
      const has = (key: string): boolean => Boolean(process.env[key]?.trim());
      res.json({
        ok: true,
        ses: {
          configured: (has('AWS_REGION') || has('AWS_DEFAULT_REGION')) && has('SES_FROM_EMAIL'),
        },
        twilio: {
          configured: has('TWILIO_ACCOUNT_SID') && has('TWILIO_AUTH_TOKEN'),
          verifyConfigured: has('TWILIO_VERIFY_SID'),
          messagingConfigured: has('TWILIO_CONTENT_SID') && has('TWILIO_MESSAGING_SID'),
        },
      });
    });

    app.get('/health/sentry', (_req, res) => {
      res.json({
        ok: true,
        sentry: getSentryBackendStatus(),
      });
    });

    // Public: quick readiness check for the separate Stripe account that powers OXXO.
    // Returns only booleans + safe error codes (no secrets).
    app.get('/health/stripe-oxxo', stripeOxxoHealthEndpoint);

    // Debug endpoint for validating Sentry wiring.
    // Disable by default in production (avoid noise and abuse).
    const enableSentryDebugRoute =
      process.env.SENTRY_DEBUG_ROUTE_ENABLED === '1' || process.env.NODE_ENV !== 'production';
    if (enableSentryDebugRoute) {
      app.get('/debug-sentry', async (req, res, next) => {
        try {
          const mode = String(req.query?.mode || 'capture');
          if (mode === 'throw') {
            return next(new Error('My first Sentry error (Backend Bear Beat)!'));
          }

          const label = String(req.query?.label || 'debug-route');
          const eventId = await sendBackendSentryTestEvent(label);
          return res.status(202).json({
            ok: true,
            mode: 'capture',
            eventId,
            sentry: getSentryBackendStatus(),
          });
        } catch (error) {
          return next(error);
        }
      });
    } else {
      app.get('/debug-sentry', (_req, res) => res.status(404).end());
    }

    Sentry.setupExpressErrorHandler(app);

    app.listen(port);

    log.info(`Express server listening on port ${port}`);

    try {
      await initializeFileService();
    } catch (error: any) {
      log.warn(
        `[FTP] File service disabled in this environment: ${error?.message ?? 'unknown error'}`,
      );
    }

    try {
      await initializeSearch();
    } catch (error: any) {
      log.warn(
        `[SEARCH] Search service disabled in this environment: ${error?.message ?? 'unknown error'}`,
      );
    }

    if (process.env.TRACK_METADATA_SCAN_ON_BOOT === '1') {
      void rebuildTrackMetadataIndex()
        .then((result) => {
          log.info(
            `[TRACK_METADATA] Boot scan done: indexed=${result.indexedTracks}, skipped=${result.skippedFiles}`,
          );
        })
        .catch((error: any) => {
          log.warn(
            `[TRACK_METADATA] Boot scan failed: ${error?.message ?? 'unknown error'}`,
          );
        });
    }

    const trackMetadataScanIntervalMinutes = toPositiveInt(
      process.env.TRACK_METADATA_SCAN_INTERVAL_MINUTES,
      0,
    );
    if (trackMetadataScanIntervalMinutes > 0) {
      const intervalMs = trackMetadataScanIntervalMinutes * 60 * 1000;
      let scanInProgress = false;

      const runIntervalScan = async () => {
        if (scanInProgress) {
          log.warn('[TRACK_METADATA] Interval scan skipped: previous scan still running');
          return;
        }

        scanInProgress = true;
        try {
          const result = await rebuildTrackMetadataIndex({
            clearBeforeInsert: false,
          });
          log.info(
            `[TRACK_METADATA] Interval scan done: indexed=${result.indexedTracks}, skipped=${result.skippedFiles}`,
          );
        } catch (error: any) {
          log.warn(
            `[TRACK_METADATA] Interval scan failed: ${error?.message ?? 'unknown error'}`,
          );
        } finally {
          scanInProgress = false;
        }
      };

      const intervalRef = setInterval(() => {
        void runIntervalScan();
      }, intervalMs);
      if (typeof intervalRef.unref === 'function') {
        intervalRef.unref();
      }

      log.info(
        `[TRACK_METADATA] Interval scan enabled every ${trackMetadataScanIntervalMinutes} minute(s)`,
      );
    }

    try {
      initializeCompressionQueue();

      initializeRemoveUsersQueue();
    } catch (e: any) {
      log.error(`[QUEUE] Error while initializing queues: ${e.message}`);
    }

    pm2.connect((err) => {
      if (err) {
        log.error(`[PM2] Error while connecting to pm2: ${err}`);
      }
    });
    log.info(`[PM2] Connected to pm2`);
  } catch (e: any) {
    log.error(e.message);
    await closeConnections();
    process.exit(1);
  }
}

const closeConnections = async () => {
  if (compressionQueue) {
    await compressionQueue.close();
  }
  if (removeUsersQueue) {
    await removeUsersQueue.close();
  }
};

process.on('SIGTERM', async () => {
  log.info('SIGTERM signal received: closing connections');

  await closeConnections();

  log.info('All connections closed');
});

main();
