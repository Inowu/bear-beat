import './polyfills';
import './instrument';
import fs from 'fs';
import path from 'path';
import type { Request, Response, NextFunction } from 'express';
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
import { sesSnsEndpoint } from './endpoints/webhooks/sesSns.endpoint';
import { trackCoverEndpoint } from './endpoints/track-cover.endpoint';
import { streamEndpoint } from './endpoints/stream.endpoint';
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
import {
  closeManyChatRetryQueue,
  initializeManyChatRetryQueue,
} from './queue/manyChat';
import {
  closeWebhookInboxQueue,
  enqueueWebhookInboxJob,
  initializeWebhookInboxQueue,
} from './queue/webhookInbox';
import { downloadDirEndpoint } from './endpoints/download-dir.endpoint';
import { catalogStatsEndpoint } from './endpoints/catalog-stats.endpoint';
import { stripeOxxoHealthEndpoint } from './endpoints/stripe-oxxo-health.endpoint';
import { isMediaCdnEnabled } from './utils/demoMedia';
import { processManyChatRetryJob } from './many-chat';
import {
  processWebhookInboxEvent,
  sweepWebhookInboxEvents,
} from './webhookInbox/service';
import { runCompressedDirsCleanupSweep } from './utils/compressedDirsCleanup';
import { getZipArtifactConfig } from './utils/zipArtifact.service';
import { runZipArtifactPrewarmSweep } from './utils/zipArtifactPrewarm';
import { syncFtpTransferDownloadsBestEffort } from './utils/ftpTransferDownloadHistory';
import { prisma } from './db';

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

const resolveDirectoryFromEnv = (envVar: string, fallbackPath: string): string => {
  const configured = `${process.env[envVar] ?? ''}`.trim();
  if (!configured) return path.resolve(fallbackPath);
  return path.isAbsolute(configured) ? configured : path.resolve(configured);
};

const toReadableDirectory = (rawPath: string | undefined): string | null => {
  const normalized = `${rawPath ?? ''}`.trim();
  if (!normalized) return null;
  return path.isAbsolute(normalized) ? normalized : path.resolve(normalized);
};

const isReadableDirectory = (targetPath: string | null): boolean => {
  if (!targetPath) return false;
  try {
    const stats = fs.statSync(targetPath);
    if (!stats.isDirectory()) return false;
    fs.accessSync(targetPath, fs.constants.R_OK);
    return true;
  } catch {
    return false;
  }
};

const getClientIp = (req: Request): string => {
  const fromForwarded = req.headers['x-forwarded-for'];
  if (typeof fromForwarded === 'string' && fromForwarded.trim()) {
    return fromForwarded.split(',')[0].trim();
  }
  if (Array.isArray(fromForwarded) && fromForwarded.length > 0) {
    const first = `${fromForwarded[0] ?? ''}`.trim();
    if (first) return first.split(',')[0].trim();
  }

  const fromRealIp = req.headers['x-real-ip'];
  if (typeof fromRealIp === 'string' && fromRealIp.trim()) {
    return fromRealIp.trim();
  }

  if (req.ip?.trim()) return req.ip.trim();
  if (req.socket?.remoteAddress?.trim()) return req.socket.remoteAddress.trim();
  return 'unknown';
};

interface SoftRateLimitEntry {
  windowStartedAtMs: number;
  count: number;
  blockedUntilMs: number;
  lastSeenAtMs: number;
}

const createSoftRateLimitMiddleware = (options: {
  windowMs: number;
  maxRequests: number;
  blockMs: number;
}) => {
  const { windowMs, maxRequests, blockMs } = options;
  const entries = new Map<string, SoftRateLimitEntry>();
  let lastCleanupAtMs = Date.now();

  const applyRateHeaders = (
    res: Response,
    limit: number,
    remaining: number,
    resetSeconds: number,
  ) => {
    const boundedRemaining = Math.max(0, remaining);
    const boundedResetSeconds = Math.max(1, Math.floor(resetSeconds));
    res.setHeader('RateLimit-Limit', String(limit));
    res.setHeader('RateLimit-Remaining', String(boundedRemaining));
    res.setHeader('RateLimit-Reset', String(boundedResetSeconds));
    // Compatibility with older clients/proxies.
    res.setHeader('X-RateLimit-Limit', String(limit));
    res.setHeader('X-RateLimit-Remaining', String(boundedRemaining));
    res.setHeader('X-RateLimit-Reset', String(boundedResetSeconds));
  };

  return (req: Request, res: Response, next: NextFunction) => {
    const now = Date.now();
    const clientIp = getClientIp(req);
    let entry = entries.get(clientIp);

    if (!entry) {
      entry = {
        windowStartedAtMs: now,
        count: 0,
        blockedUntilMs: 0,
        lastSeenAtMs: now,
      };
      entries.set(clientIp, entry);
    }

    if (now - entry.windowStartedAtMs >= windowMs) {
      entry.windowStartedAtMs = now;
      entry.count = 0;
      entry.blockedUntilMs = 0;
    }

    entry.lastSeenAtMs = now;

    if (entry.blockedUntilMs > now) {
      const retryAfterMs = Math.max(250, entry.blockedUntilMs - now);
      const retryAfterSeconds = Math.max(1, Math.ceil(retryAfterMs / 1000));
      applyRateHeaders(res, maxRequests, 0, retryAfterSeconds);
      res.setHeader('Retry-After', String(retryAfterSeconds));
      res.status(429).json({
        error: 'demo_rate_limited',
        message: 'Estamos recibiendo muchas solicitudes de demo. Reintenta en unos segundos.',
        retryable: true,
        retryAfterMs,
      });
      return;
    }

    entry.count += 1;
    const windowRemainingMs = Math.max(0, entry.windowStartedAtMs + windowMs - now);
    const windowRemainingSeconds = Math.max(1, Math.ceil(windowRemainingMs / 1000));
    const remaining = maxRequests - entry.count;
    applyRateHeaders(res, maxRequests, remaining, windowRemainingSeconds);

    if (entry.count > maxRequests) {
      entry.blockedUntilMs = now + blockMs;
      const retryAfterSeconds = Math.max(1, Math.ceil(blockMs / 1000));
      res.setHeader('Retry-After', String(retryAfterSeconds));
      res.status(429).json({
        error: 'demo_rate_limited',
        message: 'Estamos recibiendo muchas solicitudes de demo. Reintenta en unos segundos.',
        retryable: true,
        retryAfterMs: blockMs,
      });
      return;
    }

    if (now - lastCleanupAtMs >= Math.max(60_000, windowMs)) {
      const staleAfterMs = Math.max(windowMs * 4, 120_000);
      for (const [key, value] of entries.entries()) {
        if (value.blockedUntilMs <= now && now - value.lastSeenAtMs > staleAfterMs) {
          entries.delete(key);
        }
      }
      lastCleanupAtMs = now;
    }

    next();
  };
};

async function main() {
  try {
    const app = express();
    const port = Number(process.env.PORT) || 5001;
    const allowedOrigins = getAllowedCorsOrigins();
    const demosRootPath = resolveDirectoryFromEnv('DEMOS_PATH', path.join(__dirname, '../demos'));
    const songsRootPath = toReadableDirectory(process.env.SONGS_PATH);
    const demosCacheControl =
      process.env.DEMOS_CACHE_CONTROL?.trim() ||
      'public, max-age=1800, stale-while-revalidate=120';
    const demosCdnCacheControl = process.env.DEMOS_CDN_CACHE_CONTROL?.trim() || null;
    const demosSurrogateControl = process.env.DEMOS_SURROGATE_CONTROL?.trim() || null;
    const demosRateLimitWindowMs = toPositiveInt(
      process.env.DEMOS_RATE_LIMIT_WINDOW_MS,
      10_000,
    );
    const demosRateLimitMax = toPositiveInt(process.env.DEMOS_RATE_LIMIT_MAX, 180);
    const demosRateLimitBlockMs = toPositiveInt(
      process.env.DEMOS_RATE_LIMIT_BLOCK_MS,
      demosRateLimitWindowMs,
    );
    const demosRateLimitMiddleware =
      demosRateLimitMax > 0
        ? createSoftRateLimitMiddleware({
            windowMs: demosRateLimitWindowMs,
            maxRequests: demosRateLimitMax,
            blockMs: demosRateLimitBlockMs,
          })
        : null;

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
      express.raw({ type: '*/*', limit: '1mb' }),
      conektaEndpoint,
    );
    // Backward-compat alias: some providers/configs use slash style.
    app.use(
      '/webhooks/conekta',
      express.raw({ type: '*/*', limit: '1mb' }),
      conektaEndpoint,
    );

    app.use(
      '/webhooks.ses.sns',
      express.text({ type: '*/*', limit: '512kb' }),
      sesSnsEndpoint,
    );

    if (demosRateLimitMiddleware) {
      app.use('/demos', demosRateLimitMiddleware);
    }

    app.use(
      '/demos',
      express.static(demosRootPath, {
        fallthrough: true,
        index: false,
        acceptRanges: true,
        cacheControl: false,
        setHeaders(res) {
          res.setHeader('Cache-Control', demosCacheControl);
          if (demosCdnCacheControl) {
            res.setHeader('CDN-Cache-Control', demosCdnCacheControl);
          }
          if (demosSurrogateControl) {
            res.setHeader('Surrogate-Control', demosSurrogateControl);
          }
        },
      }),
    );

    app.use('/demos', (_req: Request, res: Response) => {
      res.status(404).json({
        error: 'demo_not_found',
        message: 'No encontramos este demo. Intenta con otro archivo.',
      });
    });

    app.use(
      '/demos',
      (error: any, _req: Request, res: Response, next: NextFunction) => {
        if (!error) {
          next();
          return;
        }
        if (res.headersSent) {
          next(error);
          return;
        }

        const errorCode =
          typeof error?.code === 'string' && error.code ? error.code : 'unknown_error';
        log.error(`[DEMOS] Upstream serving failure (${errorCode}): ${error?.message ?? ''}`);

        res.status(502).json({
          error: 'demo_upstream_failed',
          message: 'No pudimos servir el demo en este momento. Reintenta en unos segundos.',
          retryable: true,
          retryAfterMs: 2500,
        });
      },
    );

    app.get('/download', downloadEndpoint);

    app.get('/download-dir', downloadDirEndpoint);

    app.get('/track-cover', trackCoverEndpoint);
    app.get('/stream', streamEndpoint);

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
      const sesConfigurationSet = (process.env.SES_CONFIGURATION_SET || '').trim();
      res.json({
        ok: true,
        ses: {
          configured: (has('AWS_REGION') || has('AWS_DEFAULT_REGION')) && has('SES_FROM_EMAIL'),
          configurationSetConfigured: Boolean(sesConfigurationSet),
          configurationSetName: sesConfigurationSet || null,
          snsWebhookPath: '/webhooks.ses.sns',
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

    app.get('/health/media', (_req, res) => {
      const demosReadable = isReadableDirectory(demosRootPath);
      const songsReadable = isReadableDirectory(songsRootPath);

      res.json({
        ok: demosReadable,
        media: {
          demos: {
            readable: demosReadable,
            cacheControl: demosCacheControl,
            cdnCacheControl: demosCdnCacheControl,
            surrogateControl: demosSurrogateControl,
          },
          songs: {
            configured: Boolean(songsRootPath),
            readable: songsReadable,
          },
          rateLimit: {
            enabled: Boolean(demosRateLimitMiddleware),
            maxRequests: demosRateLimitMax,
            windowMs: demosRateLimitWindowMs,
            blockMs: demosRateLimitBlockMs,
          },
          cdn: {
            enabled: isMediaCdnEnabled(),
          },
        },
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

    const fileServiceMode = `${process.env.FILE_SERVICE ?? ''}`.trim().toLowerCase();
    if (fileServiceMode === 'ftp') {
      void syncFtpTransferDownloadsBestEffort(prisma);

      const ftpTransferSyncIntervalMs = toPositiveInt(
        process.env.FTP_TRANSFER_LOG_SYNC_POLL_INTERVAL_MS,
        15_000,
      );
      const intervalRef = setInterval(() => {
        void syncFtpTransferDownloadsBestEffort(prisma);
      }, ftpTransferSyncIntervalMs);
      if (typeof intervalRef.unref === 'function') {
        intervalRef.unref();
      }
      log.info(
        `[FTP_TRANSFER_SYNC] Background sync enabled every ${ftpTransferSyncIntervalMs}ms`,
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

    const compressedDirsCleanupIntervalMinutes = toPositiveInt(
      process.env.COMPRESSED_DIRS_CLEANUP_INTERVAL_MINUTES,
      60,
    );
    if (compressedDirsCleanupIntervalMinutes > 0) {
      let cleanupInProgress = false;

      const runCleanupSweep = async () => {
        if (cleanupInProgress) return;
        cleanupInProgress = true;
        try {
          const result = await runCompressedDirsCleanupSweep();
          if (
            result.deletedRows > 0 ||
            result.deletedFiles > 0 ||
            result.missingFiles > 0 ||
            result.errors > 0 ||
            result.artifactExpiredDeletedRows > 0 ||
            result.artifactEvictedRows > 0 ||
            result.artifactExpiredErrors > 0 ||
            result.artifactEvictionErrors > 0
          ) {
            log.info(
              `[COMPRESSED_DIRS] Cleanup: expiredRows=${result.expiredRows} deletedRows=${result.deletedRows} deletedFiles=${result.deletedFiles} missingFiles=${result.missingFiles} errors=${result.errors} artifactLock=${result.artifactLockAcquired ? 'yes' : 'no'} artifactExpiredRows=${result.artifactExpiredRows} artifactExpiredDeletedRows=${result.artifactExpiredDeletedRows} artifactEvictedRows=${result.artifactEvictedRows} artifactDiskUsedBytes=${result.artifactDiskUsedBytes.toString()} artifactDiskBudgetBytes=${result.artifactDiskBudgetBytes.toString()} artifactErrors=${result.artifactExpiredErrors + result.artifactEvictionErrors}`,
            );
          }
        } catch (error: any) {
          log.warn(
            `[COMPRESSED_DIRS] Cleanup sweep failed: ${error?.message ?? 'unknown error'}`,
          );
        } finally {
          cleanupInProgress = false;
        }
      };

      void runCleanupSweep();
      const cleanupIntervalMs = compressedDirsCleanupIntervalMinutes * 60 * 1000;
      const cleanupIntervalRef = setInterval(() => {
        void runCleanupSweep();
      }, cleanupIntervalMs);
      if (typeof cleanupIntervalRef.unref === 'function') {
        cleanupIntervalRef.unref();
      }

      log.info(
        `[COMPRESSED_DIRS] Cleanup enabled every ${compressedDirsCleanupIntervalMinutes} minute(s)`,
      );
    }

    const zipPrewarmConfig = getZipArtifactConfig();
    const zipPrewarmIntervalMinutes = zipPrewarmConfig.prewarmIntervalMinutes;
    if (zipPrewarmIntervalMinutes > 0) {
      let prewarmInProgress = false;
      const runPrewarmSweep = async () => {
        if (prewarmInProgress) return;
        prewarmInProgress = true;
        try {
          const result = await runZipArtifactPrewarmSweep(prisma);
          if (
            result.candidates > 0 ||
            result.built > 0 ||
            result.failed > 0
          ) {
            log.info(
              `[ZIP_PREWARM] Sweep: lock=${result.lockAcquired ? 'yes' : 'no'} candidates=${result.candidates} attempted=${result.attempted} built=${result.built} skippedReady=${result.skippedReady} skippedMissing=${result.skippedMissingFolder} skippedBuilding=${result.skippedBuilding} failed=${result.failed}`,
            );
          }
        } catch (error: any) {
          log.warn(
            `[ZIP_PREWARM] Sweep failed: ${error?.message ?? 'unknown error'}`,
          );
        } finally {
          prewarmInProgress = false;
        }
      };

      void runPrewarmSweep();
      const prewarmIntervalMs = zipPrewarmIntervalMinutes * 60 * 1000;
      const prewarmIntervalRef = setInterval(() => {
        void runPrewarmSweep();
      }, prewarmIntervalMs);
      if (typeof prewarmIntervalRef.unref === 'function') {
        prewarmIntervalRef.unref();
      }

      log.info(
        `[ZIP_PREWARM] Enabled every ${zipPrewarmIntervalMinutes} minute(s) with concurrency ${zipPrewarmConfig.prewarmConcurrency}`,
      );
    }

    try {
      initializeCompressionQueue();

      initializeRemoveUsersQueue();

      initializeManyChatRetryQueue(processManyChatRetryJob);

      initializeWebhookInboxQueue(
        async ({ inboxId }) => {
          await processWebhookInboxEvent(inboxId);
        },
        async () => {
          await sweepWebhookInboxEvents(async (inboxId) => {
            return enqueueWebhookInboxJob({ inboxId });
          });
        },
      );
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
  await closeManyChatRetryQueue();
  await closeWebhookInboxQueue();
};

process.on('SIGTERM', async () => {
  log.info('SIGTERM signal received: closing connections');

  await closeConnections();

  log.info('All connections closed');
});

main();
