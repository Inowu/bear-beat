import winston from 'winston';

export const log = winston.createLogger();

const options =
  process.env.NODE_ENV === 'production'
    ? {}
    : {
        format: winston.format.prettyPrint(),
      };

log.add(new winston.transports.Console(options));
