import path from 'path';
import dotenv from 'dotenv';
import { Prisma, PrismaClient } from '@prisma/client';
import { log } from '../src/server';
import { toUtcDay } from '../src/utils/downloadHistoryRollup';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const DAY_MS = 24 * 60 * 60 * 1000;

const AUDIO_EXTENSIONS = [
  '.mp3',
  '.aac',
  '.m4a',
  '.flac',
  '.ogg',
  '.aiff',
  '.alac',
];

const VIDEO_EXTENSIONS = [
  '.mp4',
  '.mov',
  '.mkv',
  '.avi',
  '.wmv',
  '.webm',
  '.m4v',
];

const getAllMediaExtensions = (): string[] => [
  ...AUDIO_EXTENSIONS,
  ...VIDEO_EXTENSIONS,
];

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

const toDayString = (value: Date): string => value.toISOString().slice(0, 10);

const buildExtensionFilterSql = (
  normalizedLowerExpr: Prisma.Sql,
  extensions: string[],
): Prisma.Sql =>
  Prisma.sql`AND (${Prisma.join(
    extensions.map(
      (extension) => Prisma.sql`${normalizedLowerExpr} LIKE ${`%${extension}`}`,
    ),
    ' OR ',
  )})`;

const buildBackfillQuery = ({
  category,
  day,
  dayStart,
  dayEnd,
  normalizedExpr,
  filters,
}: {
  category: 'audio' | 'video' | 'karaoke';
  day: string;
  dayStart: Date;
  dayEnd: Date;
  normalizedExpr: Prisma.Sql;
  filters: Prisma.Sql;
}): Prisma.Sql => Prisma.sql`
  INSERT INTO download_history_rollup_daily (
    category,
    day,
    fileName,
    downloads,
    totalBytes,
    lastDownload
  )
  SELECT
    ${category},
    ${day},
    ${normalizedExpr} AS fileName,
    COUNT(*) AS downloads,
    SUM(dh.size) AS totalBytes,
    MAX(dh.date) AS lastDownload
  FROM download_history dh
  WHERE dh.isFolder = 0
    AND dh.fileName IS NOT NULL
    AND dh.fileName <> ''
    AND dh.date >= ${dayStart}
    AND dh.date < ${dayEnd}
    AND ${normalizedExpr} <> ''
    ${filters}
  GROUP BY ${normalizedExpr};
`;

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const apply = hasFlag(args, '--apply');
  const days = Math.max(
    1,
    Math.min(3650, Math.floor(parseNumberOption(args, '--days', 180))),
  );

  if (!process.env.DATABASE_URL) {
    log.warn('[DH_ROLLUP_BACKFILL] DATABASE_URL not configured. Skipping.');
    return;
  }

  if (!apply) {
    log.info(
      `[DH_ROLLUP_BACKFILL] Dry-run. Pass --apply to backfill last ${days} day(s).`,
    );
    return;
  }

  const prisma = new PrismaClient();
  try {
    // Best-effort existence check (avoid noisy stack traces if migration isn't applied yet).
    await prisma.$queryRaw(Prisma.sql`SELECT 1 FROM download_history_rollup_daily LIMIT 1;`);

    const normalizedExpr = Prisma.sql`TRIM(TRIM(LEADING '/' FROM REPLACE(dh.fileName, '\\\\', '/')))`;
    const normalizedLowerExpr = Prisma.sql`LOWER(${normalizedExpr})`;

    const karaokePathSql = Prisma.sql`AND (
      ${normalizedLowerExpr} LIKE ${'%/karaoke/%'}
      OR ${normalizedLowerExpr} LIKE ${'%/karaokes/%'}
      OR ${normalizedLowerExpr} LIKE ${'karaoke/%'}
      OR ${normalizedLowerExpr} LIKE ${'karaokes/%'}
    )`;

    const today = toUtcDay(new Date());
    const firstDay = new Date(today.getTime() - (days - 1) * DAY_MS);

    for (let offset = 0; offset < days; offset += 1) {
      const dayStart = new Date(firstDay.getTime() + offset * DAY_MS);
      const dayEnd = new Date(dayStart.getTime() + DAY_MS);
      const day = toDayString(dayStart);

      log.info(`[DH_ROLLUP_BACKFILL] Backfilling ${day}...`);

      const tasks: Array<{
        category: 'audio' | 'video' | 'karaoke';
        filters: Prisma.Sql;
      }> = [
        {
          category: 'audio',
          filters: buildExtensionFilterSql(normalizedLowerExpr, AUDIO_EXTENSIONS),
        },
        {
          category: 'video',
          filters: buildExtensionFilterSql(normalizedLowerExpr, VIDEO_EXTENSIONS),
        },
        {
          category: 'karaoke',
          filters: Prisma.sql`${buildExtensionFilterSql(
            normalizedLowerExpr,
            getAllMediaExtensions(),
          )} ${karaokePathSql}`,
        },
      ];

      for (const task of tasks) {
        const deleted = await prisma.$executeRaw(Prisma.sql`
          DELETE FROM download_history_rollup_daily
          WHERE category = ${task.category} AND day = ${day};
        `);

        const inserted = await prisma.$executeRaw(
          buildBackfillQuery({
            category: task.category,
            day,
            dayStart,
            dayEnd,
            normalizedExpr,
            filters: task.filters,
          }),
        );

        log.info(`[DH_ROLLUP_BACKFILL] ${day} ${task.category} done.`, {
          deleted,
          inserted,
        });
      }
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  log.error('[DH_ROLLUP_BACKFILL] Script failed.', {
    error: error instanceof Error ? error.message : error,
  });
  process.exitCode = 1;
});
