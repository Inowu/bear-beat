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

export const log = winston.createLogger();

log.add(new winston.transports.Console());
