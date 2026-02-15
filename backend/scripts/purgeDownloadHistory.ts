import path from 'path';
import dotenv from 'dotenv';
import { Prisma, PrismaClient } from '@prisma/client';
import { log } from '../src/server';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const DAY_MS = 24 * 60 * 60 * 1000;

const parseNumberOption = (
  args: string[],
  flag: string,
  fallback: number,
): number => {
  const index = args.indexOf(flag);
  if (index < 0 || index + 1 >= args.length) return fallback;
  const raw = args[index + 1];
  if (!raw || raw.startsWith('--')) return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const hasFlag = (args: string[], flag: string): boolean => args.includes(flag);

const toNumber = (value: bigint | number | null | undefined): number => {
  if (value == null) return 0;
  if (typeof value === 'bigint') return Number(value);
  return Number(value);
};

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

interface CountRow {
  total: bigint | number;
}

async function purgeLoop(
  prisma: PrismaClient,
  isFolder: 0 | 1,
  cutoff: Date,
  batchSize: number,
  sleepMs: number,
): Promise<number> {
  let deletedTotal = 0;

  // Use the (isFolder, date) index to keep scans bounded.
  while (true) {
    const deleted = await prisma.$executeRaw(Prisma.sql`
      DELETE FROM download_history
      WHERE isFolder = ${isFolder}
        AND date < ${cutoff}
      LIMIT ${batchSize};
    `);

    const deletedCount = typeof deleted === 'number' ? deleted : Number(deleted ?? 0);
    if (!deletedCount) break;

    deletedTotal += deletedCount;

    // Avoid hammering the DB during big purges.
    if (sleepMs > 0) {
      await sleep(sleepMs);
    }
  }

  return deletedTotal;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const apply = hasFlag(args, '--apply');

  const keepDays = Math.max(
    30,
    Math.min(3650, Math.floor(parseNumberOption(args, '--keep-days', 365))),
  );
  const batchSize = Math.max(
    100,
    Math.min(50_000, Math.floor(parseNumberOption(args, '--batch', 5000))),
  );
  const sleepMs = Math.max(
    0,
    Math.min(5000, Math.floor(parseNumberOption(args, '--sleep-ms', 50))),
  );

  if (!process.env.DATABASE_URL) {
    log.warn('[DH_PURGE] DATABASE_URL not configured. Skipping.');
    return;
  }

  const cutoff = new Date(Date.now() - keepDays * DAY_MS);

  const prisma = new PrismaClient();
  try {
    const [filesCount] = await prisma.$queryRaw<CountRow[]>(
      Prisma.sql`SELECT COUNT(*) AS total FROM download_history WHERE isFolder = 0 AND date < ${cutoff};`,
    );
    const [foldersCount] = await prisma.$queryRaw<CountRow[]>(
      Prisma.sql`SELECT COUNT(*) AS total FROM download_history WHERE isFolder = 1 AND date < ${cutoff};`,
    );

    const filesToDelete = toNumber(filesCount?.total);
    const foldersToDelete = toNumber(foldersCount?.total);
    const totalToDelete = filesToDelete + foldersToDelete;

    log.info('[DH_PURGE] Candidate rows before cutoff.', {
      keepDays,
      cutoff: cutoff.toISOString(),
      filesToDelete,
      foldersToDelete,
      totalToDelete,
      batchSize,
      sleepMs,
    });

    if (!apply) {
      log.info('[DH_PURGE] Dry-run. Pass --apply to delete rows.');
      return;
    }

    if (totalToDelete === 0) {
      log.info('[DH_PURGE] Nothing to delete.');
      return;
    }

    const deletedFiles = await purgeLoop(prisma, 0, cutoff, batchSize, sleepMs);
    const deletedFolders = await purgeLoop(prisma, 1, cutoff, batchSize, sleepMs);

    log.info('[DH_PURGE] Purge completed.', {
      keepDays,
      cutoff: cutoff.toISOString(),
      deletedFiles,
      deletedFolders,
      deletedTotal: deletedFiles + deletedFolders,
    });
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  log.error('[DH_PURGE] Script failed.', {
    error: error instanceof Error ? error.message : error,
  });
  process.exitCode = 1;
});

