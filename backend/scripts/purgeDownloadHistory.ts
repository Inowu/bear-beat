import path from 'path';
import dotenv from 'dotenv';
import { Prisma, PrismaClient } from '@prisma/client';
import { log } from '../src/server';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const DAY_MS = 24 * 60 * 60 * 1000;

type PurgeMode = 'archive-delete' | 'archive-only' | 'delete-only';

interface CountRow {
  total: bigint | number;
}

interface LoopResult {
  affectedRows: number;
  batches: number;
  reachedMaxBatches: boolean;
}

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

const parseStringOption = (args: string[], flag: string): string | null => {
  const index = args.indexOf(flag);
  if (index < 0 || index + 1 >= args.length) return null;
  const raw = args[index + 1];
  if (!raw || raw.startsWith('--')) return null;
  return raw.trim();
};

const hasFlag = (args: string[], flag: string): boolean => args.includes(flag);

const parseModeOption = (args: string[]): PurgeMode => {
  const raw = parseStringOption(args, '--mode');
  if (!raw) return 'archive-delete';
  if (raw === 'archive-delete' || raw === 'archive-only' || raw === 'delete-only') {
    return raw;
  }
  throw new Error(
    `Invalid --mode value "${raw}". Use: archive-delete | archive-only | delete-only`,
  );
};

const toNumber = (value: bigint | number | null | undefined): number => {
  if (value == null) return 0;
  if (typeof value === 'bigint') return Number(value);
  return Number(value);
};

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

const runLoop = async ({
  executeBatch,
  sleepMs,
  maxBatches,
}: {
  executeBatch: () => Promise<number>;
  sleepMs: number;
  maxBatches: number;
}): Promise<LoopResult> => {
  let affectedRows = 0;
  let batches = 0;

  while (true) {
    if (maxBatches > 0 && batches >= maxBatches) {
      return {
        affectedRows,
        batches,
        reachedMaxBatches: true,
      };
    }

    const affected = await executeBatch();
    if (!affected) {
      return {
        affectedRows,
        batches,
        reachedMaxBatches: false,
      };
    }

    affectedRows += affected;
    batches += 1;

    if (sleepMs > 0) {
      await sleep(sleepMs);
    }
  }
};

const countSourceRows = async (
  prisma: PrismaClient,
  isFolder: 0 | 1,
  cutoff: Date,
): Promise<number> => {
  const [row] = await prisma.$queryRaw<CountRow[]>(Prisma.sql`
    SELECT COUNT(*) AS total
    FROM download_history dh
    WHERE dh.isFolder = ${isFolder}
      AND dh.date < ${cutoff};
  `);
  return toNumber(row?.total);
};

const countPendingArchiveRows = async (
  prisma: PrismaClient,
  isFolder: 0 | 1,
  cutoff: Date,
): Promise<number> => {
  const [row] = await prisma.$queryRaw<CountRow[]>(Prisma.sql`
    SELECT COUNT(*) AS total
    FROM download_history dh
    LEFT JOIN download_history_archive dha
      ON dha.sourceId = dh.id AND dha.date = dh.date
    WHERE dh.isFolder = ${isFolder}
      AND dh.date < ${cutoff}
      AND dha.sourceId IS NULL;
  `);
  return toNumber(row?.total);
};

const ensureArchiveTableExists = async (prisma: PrismaClient): Promise<void> => {
  try {
    await prisma.$queryRaw(
      Prisma.sql`SELECT 1 FROM download_history_archive LIMIT 1;`,
    );
  } catch {
    throw new Error(
      'Table download_history_archive is missing. Run DB migrations before archive modes.',
    );
  }
};

async function archiveLoop(
  prisma: PrismaClient,
  isFolder: 0 | 1,
  cutoff: Date,
  batchSize: number,
  sleepMs: number,
  maxBatches: number,
): Promise<LoopResult> {
  return runLoop({
    executeBatch: async () => {
      const inserted = await prisma.$executeRaw(Prisma.sql`
        INSERT INTO download_history_archive (
          sourceId,
          userId,
          size,
          date,
          fileName,
          isFolder,
          archivedAt
        )
        SELECT
          dh.id,
          dh.userId,
          dh.size,
          dh.date,
          dh.fileName,
          dh.isFolder,
          UTC_TIMESTAMP(0)
        FROM download_history dh
        LEFT JOIN download_history_archive dha
          ON dha.sourceId = dh.id AND dha.date = dh.date
        WHERE dh.isFolder = ${isFolder}
          AND dh.date < ${cutoff}
          AND dha.sourceId IS NULL
        ORDER BY dh.date ASC, dh.id ASC
        LIMIT ${batchSize};
      `);

      return toNumber(inserted as number | bigint | null | undefined);
    },
    sleepMs,
    maxBatches,
  });
}

async function deleteArchivedLoop(
  prisma: PrismaClient,
  isFolder: 0 | 1,
  cutoff: Date,
  batchSize: number,
  sleepMs: number,
  maxBatches: number,
): Promise<LoopResult> {
  return runLoop({
    executeBatch: async () => {
      const deleted = await prisma.$executeRaw(Prisma.sql`
        DELETE FROM download_history
        WHERE id IN (
          SELECT id
          FROM (
            SELECT dh.id
            FROM download_history dh
            INNER JOIN download_history_archive dha
              ON dha.sourceId = dh.id AND dha.date = dh.date
            WHERE dh.isFolder = ${isFolder}
              AND dh.date < ${cutoff}
            ORDER BY dh.date ASC, dh.id ASC
            LIMIT ${batchSize}
          ) AS batched
        );
      `);

      return toNumber(deleted as number | bigint | null | undefined);
    },
    sleepMs,
    maxBatches,
  });
}

async function deleteDirectLoop(
  prisma: PrismaClient,
  isFolder: 0 | 1,
  cutoff: Date,
  batchSize: number,
  sleepMs: number,
  maxBatches: number,
): Promise<LoopResult> {
  return runLoop({
    executeBatch: async () => {
      const deleted = await prisma.$executeRaw(Prisma.sql`
        DELETE FROM download_history
        WHERE isFolder = ${isFolder}
          AND date < ${cutoff}
        ORDER BY date ASC, id ASC
        LIMIT ${batchSize};
      `);

      return toNumber(deleted as number | bigint | null | undefined);
    },
    sleepMs,
    maxBatches,
  });
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const apply = hasFlag(args, '--apply');
  const mode = parseModeOption(args);

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
  const maxBatches = Math.max(
    0,
    Math.min(2_000_000, Math.floor(parseNumberOption(args, '--max-batches', 0))),
  );

  if (!process.env.DATABASE_URL) {
    log.warn('[DH_PURGE] DATABASE_URL not configured. Skipping.');
    return;
  }

  const cutoff = new Date(Date.now() - keepDays * DAY_MS);
  const needsArchive = mode !== 'delete-only';
  const needsDelete = mode !== 'archive-only';

  const prisma = new PrismaClient();
  try {
    if (needsArchive) {
      await ensureArchiveTableExists(prisma);
    }

    const [filesInSource, foldersInSource] = await Promise.all([
      countSourceRows(prisma, 0, cutoff),
      countSourceRows(prisma, 1, cutoff),
    ]);

    const sourceTotal = filesInSource + foldersInSource;

    let filesPendingArchive = 0;
    let foldersPendingArchive = 0;

    if (needsArchive) {
      [filesPendingArchive, foldersPendingArchive] = await Promise.all([
        countPendingArchiveRows(prisma, 0, cutoff),
        countPendingArchiveRows(prisma, 1, cutoff),
      ]);
    }

    log.info('[DH_PURGE] Candidate rows before cutoff.', {
      mode,
      keepDays,
      cutoff: cutoff.toISOString(),
      batchSize,
      sleepMs,
      maxBatches,
      filesInSource,
      foldersInSource,
      sourceTotal,
      filesPendingArchive,
      foldersPendingArchive,
      pendingArchiveTotal: filesPendingArchive + foldersPendingArchive,
    });

    if (!apply) {
      log.info(
        '[DH_PURGE] Dry-run. Pass --apply to execute. Optional: --mode archive-delete|archive-only|delete-only',
      );
      return;
    }

    if (!sourceTotal) {
      log.info('[DH_PURGE] Nothing to process.');
      return;
    }

    let archiveFilesResult: LoopResult = {
      affectedRows: 0,
      batches: 0,
      reachedMaxBatches: false,
    };
    let archiveFoldersResult: LoopResult = {
      affectedRows: 0,
      batches: 0,
      reachedMaxBatches: false,
    };
    let deleteFilesResult: LoopResult = {
      affectedRows: 0,
      batches: 0,
      reachedMaxBatches: false,
    };
    let deleteFoldersResult: LoopResult = {
      affectedRows: 0,
      batches: 0,
      reachedMaxBatches: false,
    };

    if (needsArchive) {
      archiveFilesResult = await archiveLoop(
        prisma,
        0,
        cutoff,
        batchSize,
        sleepMs,
        maxBatches,
      );
      archiveFoldersResult = await archiveLoop(
        prisma,
        1,
        cutoff,
        batchSize,
        sleepMs,
        maxBatches,
      );
    }

    if (needsDelete) {
      if (mode === 'delete-only') {
        deleteFilesResult = await deleteDirectLoop(
          prisma,
          0,
          cutoff,
          batchSize,
          sleepMs,
          maxBatches,
        );
        deleteFoldersResult = await deleteDirectLoop(
          prisma,
          1,
          cutoff,
          batchSize,
          sleepMs,
          maxBatches,
        );
      } else {
        deleteFilesResult = await deleteArchivedLoop(
          prisma,
          0,
          cutoff,
          batchSize,
          sleepMs,
          maxBatches,
        );
        deleteFoldersResult = await deleteArchivedLoop(
          prisma,
          1,
          cutoff,
          batchSize,
          sleepMs,
          maxBatches,
        );
      }
    }

    log.info('[DH_PURGE] Run completed.', {
      mode,
      keepDays,
      cutoff: cutoff.toISOString(),
      archivedFiles: archiveFilesResult.affectedRows,
      archivedFolders: archiveFoldersResult.affectedRows,
      archivedTotal:
        archiveFilesResult.affectedRows + archiveFoldersResult.affectedRows,
      archiveFileBatches: archiveFilesResult.batches,
      archiveFolderBatches: archiveFoldersResult.batches,
      archiveReachedBatchLimit:
        archiveFilesResult.reachedMaxBatches ||
        archiveFoldersResult.reachedMaxBatches,
      deletedFiles: deleteFilesResult.affectedRows,
      deletedFolders: deleteFoldersResult.affectedRows,
      deletedTotal: deleteFilesResult.affectedRows + deleteFoldersResult.affectedRows,
      deleteFileBatches: deleteFilesResult.batches,
      deleteFolderBatches: deleteFoldersResult.batches,
      deleteReachedBatchLimit:
        deleteFilesResult.reachedMaxBatches ||
        deleteFoldersResult.reachedMaxBatches,
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
