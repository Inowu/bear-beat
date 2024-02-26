import path from 'path';
import fs from 'fs';
import tracer from 'dd-trace';
import { config } from 'dotenv';
import { Queue, Worker } from 'bullmq';
import { createExpressMiddleware } from '@trpc/server/adapters/express';
import express from 'express';
import cors from 'cors';
import expressWinston from 'express-winston';
import winston from 'winston';
import { log } from './server';
import { initializeFileService } from './ftp';
import { appRouter } from './routers';
import { createContext } from './context';
import { downloadEndpoint } from './endpoints/download.endpoint';
import { initializeSearch } from './search';
import { conektaEndpoint } from './endpoints/webhooks/conekta.endpoint';
import { stripeEndpoint } from './endpoints/webhooks/stripe.endpoint';
import { paypalEndpoint } from './endpoints/webhooks/paypal.endpoint';
import { stripePiEndpoint } from './endpoints/webhooks/stripePaymentIntents.endpoint';
import { sse } from './sse';
import {
  compressionQueue,
  initializeCompressionQueue,
} from './queue/compression';
import { compressionWorkers, workerFactory } from './queue/workerFactory';
import { stripeProductsEndpoint } from './endpoints/webhooks/stripeProducts.endpoint';
import {
  initializeRemoveUsersQueue,
  removeUsersQueue,
} from './queue/removeUsers';
import { removeUsersWorkers } from './queue/workerFactory';
import { downloadDirEndpoint } from './endpoints/download-dir.endpoint';

config({
  path: path.resolve(__dirname, '../.env'),
});

tracer.init({
  env: 'prod',
  service: 'bearbeat',
  logInjection: true,
});

async function main() {
  try {
    const app = express();

    app.use(
      expressWinston.logger({
        transports: [new winston.transports.Console()],
        format: winston.format.json(),
      }),
    );

    app.use(cors({ origin: '*' }));

    app.get('/sse', sse.init);

    app.use(
      '/trpc',
      createExpressMiddleware({
        router: appRouter,
        createContext,
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

    app.listen(process.env.PORT);

    log.info(`Express server listening on port ${process.env.PORT}`);

    await initializeFileService();

    await initializeSearch();

    initializeCompressionQueue();

    initializeRemoveUsersQueue();

    workerFactory('users');
    // workerFactory('compression');
  } catch (e: any) {
    log.error(e.message);
    await closeConnections();
    process.exit(1);
  }
}

const closeConnections = async () => {
  await compressionQueue.close();
  await removeUsersQueue.close();
  await Promise.all(compressionWorkers.map(async (worker) => worker.close()));
  await Promise.all(removeUsersWorkers.map(async (worker) => worker.close()));
};

process.on('SIGTERM', async () => {
  log.info('SIGTERM signal received: closing connections');

  await closeConnections();

  log.info('All connections closed');
});

main();
