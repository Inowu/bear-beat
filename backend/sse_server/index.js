const express = require('express');
const expressWinston = require('express-winston');
const SSE = require('express-sse-ts');
const bodyParser = require('body-parser');
const cors = require('cors');
const winston = require('winston');
const { config } = require('dotenv');
const { log } = require('./log');

config();

const sse = new SSE.default();

const app = express();

// app.use(
//   expressWinston.logger({
//     transports: [new winston.transports.Console()],
//     format: winston.format.json(),
//   }),
// );

app.use(bodyParser.json());

app.use(cors({ origin: '*' }));

app.get('/sse', sse.init);

app.post('/send-event', (req, res) => {
  const { eventName, ...rest } = req.body;

  sse.send(JSON.stringify(rest), eventName);

  return res.send();
});

app.listen(8001, () => {
  log.info('SSE server listening on port 8001');
});
