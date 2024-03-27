const winston = require('winston');

const log = winston.createLogger();

log.add(
  new winston.transports.Console({
    format: winston.format.json(),
  }),
);

module.exports = { log };
