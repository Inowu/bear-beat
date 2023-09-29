import winston from 'winston';

export const log = winston.createLogger();

log.add(
  new winston.transports.Console({
    format: winston.format.prettyPrint(),
  }),
);
