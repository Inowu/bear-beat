import fastify from 'fastify';
import cors from '@fastify/cors';
import { fastifyTRPCPlugin } from '@trpc/server/adapters/fastify';
import compress from '@fastify/compress';
import { appRouter } from './routers';
import { createContext } from './context';
import { fileService } from './ftp';
import { createReadStream, readFileSync } from 'fs';
import { pino } from 'pino';

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

// export const { log } = server;
const transport = pino.transport({
  target: 'pino-pretty',
});

export const log = pino(transport);

// server.register(fastifyTRPCPlugin, {
//   prefix: '/trpc',
//   trpcOptions: {
//     router: appRouter,
//     createContext,
//   },
// });
