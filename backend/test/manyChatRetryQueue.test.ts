import {
  closeManyChatRetryQueue,
  enqueueManyChatRetryJob,
  initializeManyChatRetryQueue,
  manyChatRetryQueue,
} from '../src/queue/manyChat';

describe('ManyChat retry queue', () => {
  afterEach(async () => {
    await closeManyChatRetryQueue();
  });

  it('enqueues retry jobs when initialized', async () => {
    initializeManyChatRetryQueue(async () => {});

    expect(manyChatRetryQueue).toBeTruthy();

    const jobId = await enqueueManyChatRetryJob({
      action: 'add_tag',
      subscriberId: '123456',
      tag: 'SUCCESSFUL_PAYMENT',
      userId: 42,
    });

    expect(jobId).toBe('mock-job');
  });

  it('does not enqueue when queue is not initialized', async () => {
    const jobId = await enqueueManyChatRetryJob({
      action: 'set_custom_field',
      subscriberId: '123456',
      fieldKey: 'ultimo_plan_checkout',
      fieldValue: 'Oro',
      userId: 42,
    });

    expect(jobId).toBeNull();
  });

  it('is idempotent on initialization', () => {
    initializeManyChatRetryQueue(async () => {});
    const firstInstance = manyChatRetryQueue;

    initializeManyChatRetryQueue(async () => {});

    expect(manyChatRetryQueue).toBe(firstInstance);
  });
});
