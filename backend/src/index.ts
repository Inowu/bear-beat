import './instrument';
import path from 'path';
import pm2 from 'pm2';
import * as Sentry from '@sentry/node';
import { config } from 'dotenv';
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
import { conektaEndpoint } from './endpoints/webhooks/conekta.endpoint';
import { stripeEndpoint } from './endpoints/webhooks/stripe.endpoint';
import { paypalEndpoint } from './endpoints/webhooks/paypal.endpoint';
import { stripePiEndpoint } from './endpoints/webhooks/stripePaymentIntents.endpoint';
import {
  compressionQueue,
  initializeCompressionQueue,
} from './queue/compression';
import { stripeProductsEndpoint } from './endpoints/webhooks/stripeProducts.endpoint';
import { analyticsCollectEndpoint } from './endpoints/analytics.endpoint';
import {
  initializeRemoveUsersQueue,
  removeUsersQueue,
} from './queue/removeUsers';
import { downloadDirEndpoint } from './endpoints/download-dir.endpoint';
import { catalogStatsEndpoint } from './endpoints/catalog-stats.endpoint';

config({
  path: path.resolve(__dirname, '../.env'),
});

const DEFAULT_CORS_ORIGINS = [
  'http://localhost:3001',
  'http://localhost:4173',
  'https://thebearbeat.com',
  'https://www.thebearbeat.com',
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

async function main() {
  try {
    const app = express();
    const port = Number(process.env.PORT) || 5001;
    const allowedOrigins = getAllowedCorsOrigins();

    app.use(
      expressWinston.logger({
        transports: [new winston.transports.Console()],
        format: winston.format.json(),
      }),
    );

    app.use(
      cors({
        origin(origin, callback) {
          if (!origin) {
            callback(null, true);
            return;
          }

          callback(null, allowedOrigins.includes(origin));
        },
        credentials: true,
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

    app.get('/api/catalog-stats', catalogStatsEndpoint);

    app.post(
      '/api/analytics/collect',
      express.json({ limit: '128kb' }),
      analyticsCollectEndpoint,
    );

    app.get('/api/analytics/health', (_req, res) => {
      res.json({
        ok: true,
        analyticsDbConfigured: Boolean(process.env.DATABASE_URL),
      });
    });

    app.get('/health/sentry', (_req, res) => {
      res.json({
        ok: true,
        sentry: getSentryBackendStatus(),
      });
    });

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
