const { default: axios } = require('axios');
const { log } = require('./log');

const sendEvent = async (eventName, body) => {
  const backendSseUrl = `${process.env.BACKEND_SSE_URL || ''}`.trim();
  if (!backendSseUrl) {
    log.warn(
      `[WORKER:COMPRESSION] BACKEND_SSE_URL is not configured. Event ${eventName} skipped.`,
    );
    return;
  }

  try {
    await axios(`${backendSseUrl}/send-event`, {
      method: 'post',
      data: {
        eventName,
        ...body,
      },
    });
  } catch (e) {
    log.error(
      `[WORKER:COMPRESSION] Error sending event ${JSON.stringify(
        body,
      )}, error: ${e.response?.data?.message || e.message}`,
    );
  }
};

module.exports = { sendEvent };
