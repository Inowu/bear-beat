import path from 'path';
import { config } from 'dotenv';
import { createExpressMiddleware } from '@trpc/server/adapters/express';
import express from 'express';
import compression from 'compression';
import cors from 'cors';
import expressWinston from 'express-winston';
// import logger from 'pino-http';
// import pino from 'pino';
import { log } from './server';
import { fileService, initializeFileService } from './ftp';
import { appRouter } from './routers';
import { createContext } from './context';
import { download } from './endpoints/download';
import winston from 'winston';
import { verifyStripeSignature } from './routers/utils/verifyStripeSignature';
import { stripeSubscriptionWebhook } from './routers/webhooks/stripe';

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
      '/webhooks.stripe',
      express.raw({ type: 'application/json' }),
      async (req, res) => {
        const isValid = verifyStripeSignature(req);

        if (!isValid) {
          return res.status(400).send('Invalid signature');
        }

        try {
          await stripeSubscriptionWebhook(req);

          return res.status(200).end();
        } catch (e) {
          log.error(`[STRIPE_WH] Error handling webhook: ${e}`);

          return res.status(400).end();
        }
      },
    );

    app.use('/demos', express.static(path.resolve(__dirname, '../demos')));

    app.get('/download', download);

    app.listen(process.env.PORT);
    log.info(`Express server listening on port ${process.env.PORT}`);

    await initializeFileService();
  } catch (e) {
    log.error(e);
    process.exit(1);
  }
}

main();
