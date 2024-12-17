import winston, { format } from 'winston';
import { config } from 'dotenv';
import path from 'path';

config({
  path: path.resolve(__dirname, '../.env'),
});

export const log = winston.createLogger({
  level: 'info',
  exitOnError: false,
  format: format.json(),
  transports: [
    new winston.transports.Console(),
  ],
});
