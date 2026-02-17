import './polyfills';
import { PrismaClient } from '@prisma/client';
import { runAutomationForever, runAutomationOnce } from './automation/runner';
import { log } from './server';
import {
  closeManyChatRetryQueue,
  initializeManyChatRetryQueue,
} from './queue/manyChat';
import { processManyChatRetryJob } from './many-chat';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const once = args.includes('--once') || (process.env.AUTOMATION_RUNNER_ONCE || '').trim() === '1';

  log.info('[AUTOMATION] Starting automation runner', {
    mode: once ? 'once' : 'forever',
  });

  initializeManyChatRetryQueue(processManyChatRetryJob);

  if (once) {
    await runAutomationOnce(prisma);
    return;
  }

  await runAutomationForever(prisma);
}

main()
  .catch((error) => {
    log.error('[AUTOMATION] Fatal runner error', {
      error: error instanceof Error ? error.message : error,
    });
    process.exitCode = 1;
  })
  .finally(async () => {
    try {
      await closeManyChatRetryQueue();
    } catch {
      // noop
    }
    try {
      await prisma.$disconnect();
    } catch {
      // noop
    }
  });
