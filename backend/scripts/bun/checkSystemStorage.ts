import axios from 'axios';
import { WebClient } from '@slack/web-api';

try {
  const { usedStorage, availableStorage } = (
    await axios('http://localhost:8123')
  ).data;

  const slack = new WebClient(process.env.SLACK_TOKEN);

  const date = new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(new Date());

  if (availableStorage > 100) {
    console.log('Storage is fine');
    process.exit(0);
  }

  slack.chat.postMessage({
    channel: process.env.SLACK_CHANNEL as string,
    blocks: [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: '[BEARBEAT] LOW STORAGE SPACE WARNING :warning:',
        },
      },
      {
        type: 'context',
        elements: [
          {
            text: `*${date}*`,
            type: 'mrkdwn',
          },
        ],
      },
      {
        type: 'divider',
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Available space left: *\n ${availableStorage}GB`,
        },
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Used space: *\n ${usedStorage}GB`,
        },
      },
    ],
  });
} catch (error) {
  console.log(error);
}
