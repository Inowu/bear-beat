import winston, { format } from 'winston';
import { loadEnvOnce } from './utils/loadEnv';

loadEnvOnce();

export const log = winston.createLogger({
  level: 'info',
  exitOnError: false,
  format: format.json(),
  transports: [
    new winston.transports.Console(),
  ],
});
