import winston, { format } from 'winston';
import DatadogWinston from 'datadog-winston';

export const log = winston.createLogger({
  level: 'info',
  exitOnError: false,
  format: format.json(),
});

log.add(new winston.transports.Console());

log.add(
  new DatadogWinston({
    apiKey: process.env.DD_API_KEY as string,
    hostname: process.env.DD_HOSTNAME as string,
    ddsource: 'nodejs',
    ddtags: 'env:prod',
    intakeRegion: 'us5',
  }),
);
