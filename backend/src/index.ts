import path from 'path';
import { config } from 'dotenv';
import { createExpressMiddleware } from '@trpc/server/adapters/express';
import express from 'express';
import compression from 'compression';
import cors from 'cors';
import logger from 'pino-http';
import pino from 'pino';
import { log } from './server';
import { fileService, initializeFileService } from './ftp';
import { appRouter } from './routers';
import { createContext } from './context';
import { download } from './endpoints/download';

config({
  path: path.resolve(__dirname, '../.env'),
});

async function main() {
  try {
    const app = express();

    app.use(compression());
    app.use(
      logger({
        transport: {
          target: 'pino-http-print',
          options: {
            colorize: true,
          },
        },
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
