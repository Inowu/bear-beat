import path from 'path';
import { config } from 'dotenv';
import { createExpressMiddleware } from '@trpc/server/adapters/express';
import express from 'express';
import compression from 'compression';
import cors from 'cors';
import expressWinston from 'express-winston';
import winston from 'winston';
import { log } from './server';
import { initializeFileService } from './ftp';
import { appRouter } from './routers';
import { createContext } from './context';
import { downloadEndpoint } from './endpoints/download.endpoint';
import { initializeRedis, redis } from './redis';
import { initializeSearch } from './search';
import { conektaEndpoint } from './endpoints/webhooks/conekta.endpoint';
import { stripeEndpoint } from './endpoints/webhooks/stripe.endpoint';
import { paypalEndpoint } from './endpoints/webhooks/paypal.endpoint';

config({
  path: path.resolve(__dirname, '../.env'),
});

async function main() {
  try {
    const app = express();

    app.use(compression());
    app.use(
      expressWinston.logger({
        transports: [new winston.transports.Console()],
        format: winston.format.json(),
      }),
    );

    app.use(cors({ origin: '*' }));

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
      '/webhooks.conekta',
      express.raw({ type: 'application/json' }),
      conektaEndpoint,
    );

    app.use('/demos', express.static(path.resolve(__dirname, '../demos')));

    app.get('/download', downloadEndpoint);

    app.listen(process.env.PORT);

    log.info(`Express server listening on port ${process.env.PORT}`);

    await initializeFileService();

    await initializeRedis();

    await initializeSearch();
  } catch (e) {
    log.error(e);
    console.log(e);
    await redis.quit();
    process.exit(1);
  }
}

// Graceful shutdown
['exit'].forEach((event) => {
  process.on(event, async () => {
    log.info('Shutting down...');
    await redis.quit();
  });
});

main();
