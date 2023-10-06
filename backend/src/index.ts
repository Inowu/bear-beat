import path from 'path';
import { config } from 'dotenv';
import { createExpressMiddleware } from '@trpc/server/adapters/express';
import express from 'express';
import compression from 'compression';
import cors from 'cors';
import expressWinston from 'express-winston';
import { log } from './server';
import { initializeFileService } from './ftp';
import { appRouter } from './routers';
import { createContext } from './context';
import { download } from './endpoints/download';
import winston from 'winston';
import { verifyStripeSignature } from './routers/utils/verifyStripeSignature';
import { stripeSubscriptionWebhook } from './routers/webhooks/stripe';
import { paypalSubscriptionWebhook } from './routers/webhooks/paypal';
import { verifyConektaSignature } from './routers/utils/verifyConektaSignature';
import { conektaSubscriptionWebhook } from './routers/webhooks/conekta';
import { verifyPaypalSignature } from './routers/utils/verifyPaypalSignature';

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
      async (req, res) => {
        // const isValid = await verifyPaypalSignature(req);

        // if (!isValid) {
        //   return res.status(400).send('Invalid signature');
        // }

        try {
          await paypalSubscriptionWebhook(req);

          return res.status(200);
        } catch (e) {
          log.error(`[PAYPAL_WH] Error handling webhook: ${e}`);
          return res.status(500);
        }
      },
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

          return res.status(500).end();
        }
      },
    );

    app.use(
      '/webhooks.conekta',
      express.raw({ type: 'application/json' }),
      async (req, res) => {
        // TODO: Uncomment this when conekta signature verification is fixed
        // const isValid = verifyConektaSignature(req, req.body);
        //
        // if (!isValid) return res.status(401).send('Invalid signature');

        try {
          await conektaSubscriptionWebhook(req);
        } catch (e) {
          log.error(`[CONEKTA_WH] Error handling webhook: ${e}`);
          return res.status(500);
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
