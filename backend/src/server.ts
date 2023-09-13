import fastify from 'fastify';
import cors from '@fastify/cors';
// import { fastifyTRPCPlugin } from '@trpc/server/adapters/fastify';
// import compress from '@fastify/compress';
// import { appRouter } from './routers';
// import { createContext } from './context';
// import { fileService } from './ftp';
// import { createReadStream, readFileSync } from 'fs';
// import { pino } from 'pino';
import winston from 'winston';
// import DatadogWinston from 'datadog-winston';

export const server = fastify({
  logger: {
    transport: {
      target: 'pino-pretty',
      options: {
        colorize: true,
      },
    },
  },
  maxParamLength: 5000,
});

server.register(cors, {
  origin: '*',
});

export const log = winston.createLogger();

log.add(
  new winston.transports.File({
    filename: `${__dirname}/../logs/error.log`,
  }),
);

log.add(new winston.transports.Console());

// export const { log } = server;
// const transport = pino.transport({
//   target: 'pino-pretty',
// });
//
// export const log = pino(transport);

// export const log = pino(
//   {},
//   pino.transport({
//     target: 'pino-datadog-transport',
//     options: {
//       ddClientConf: {
//         authMethods: {
//           apiKeyAuth: '322425cc4859de7ddd30c1cf2a33878a',
//         },
//       },
//       service: 'bearbeat',
//       ddServerConf: {
//         site: 'us5.datadoghq.eu',
//       },
//     },
//   }),
// );

// server.register(fastifyTRPCPlugin, {
//   prefix: '/trpc',
//   trpcOptions: {
//     router: appRouter,
//     createContext,
//   },
// });
