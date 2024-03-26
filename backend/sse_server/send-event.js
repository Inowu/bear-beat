const { default: axios } = require('axios');

const sendEvent = async (eventName, body) => {
  try {
    await axios(`${process.env.BACKEND_SSE_URL}/send-event`, {
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
