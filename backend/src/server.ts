import winston, { format } from 'winston';
import DatadogWinston from 'datadog-winston';
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
    ...(process.env.NODE_ENV === 'production'
      ? [
          new winston.transports.Http({
            host: 'http-intake.logs.us5.datadoghq.com',
            path: `/api/v2/logs?dd-api-key=${process.env.DD_API_KEY}&ddsource=nodejs&service=${process.env.DD_SERVICE}&hostname=${process.env.DD_HOSTNAME}&ddtags=instance:${process.env.DD_INSTANCE}`,
            ssl: true,
          }),
        ]
      : []),
  ],
});
