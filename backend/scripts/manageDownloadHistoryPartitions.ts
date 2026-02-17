import path from 'path';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import { log } from '../src/server';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

interface PartitionRow {
  partitionName: string | null;
  partitionDescription: string | null;
  partitionMethod: string | null;
  partitionExpression: string | null;
}

interface CountRow {
  total: bigint | number;
}

interface MinDateRow {
  minDate: Date | string | null;
}

interface PartitionPlan {
  name: string;
  lessThan: string;
  monthStart: Date;
}

const IDENTIFIER_PATTERN = /^[A-Za-z0-9_]+$/;

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

const parseStringOption = (
  args: string[],
  flag: string,
  fallback: string,
): string => {
  const index = args.indexOf(flag);
  if (index < 0 || index + 1 >= args.length) return fallback;
  const raw = args[index + 1];
  if (!raw || raw.startsWith('--')) return fallback;
  return raw.trim() || fallback;
};

const hasFlag = (args: string[], flag: string): boolean => args.includes(flag);

const toNumber = (value: bigint | number | null | undefined): number => {
  if (value == null) return 0;
  if (typeof value === 'bigint') return Number(value);
  return Number(value);
};

const sanitizeIdentifier = (value: string, label: string): string => {
  if (!IDENTIFIER_PATTERN.test(value)) {
    throw new Error(`Invalid ${label}: ${value}`);
  }
  return value;
};

const toUtcMonthStart = (value: Date): Date =>
  new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), 1));

const addUtcMonths = (value: Date, months: number): Date =>
  new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth() + months, 1));

const toDateString = (value: Date): string => value.toISOString().slice(0, 10);

const toMonthId = (value: Date): string => {
  const year = value.getUTCFullYear();
  const month = `${value.getUTCMonth() + 1}`.padStart(2, '0');
  return `${year}${month}`;
};

const parseDbDate = (value: Date | string | null): Date | null => {
  if (!value) return null;
  const parsed = value instanceof Date ? value : new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const buildPartitionPlan = (fromMonth: Date, endExclusive: Date): PartitionPlan[] => {
  const partitions: PartitionPlan[] = [];
  for (
    let cursor = toUtcMonthStart(fromMonth);
    cursor.getTime() < endExclusive.getTime();
    cursor = addUtcMonths(cursor, 1)
  ) {
    const next = addUtcMonths(cursor, 1);
    partitions.push({
      name: `p${toMonthId(cursor)}`,
      lessThan: toDateString(next),
      monthStart: cursor,
    });
  }
  return partitions;
};

const isMaxValueDescription = (description: string | null): boolean =>
  (description ?? '').replace(/'/g, '').trim().toUpperCase() === 'MAXVALUE';

const parsePartitionDescriptionDate = (description: string | null): Date | null => {
  if (!description || isMaxValueDescription(description)) return null;
  const clean = description.replace(/'/g, '').trim();
  const parsed = new Date(`${clean}T00:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const parsePartitionBoundaryFromName = (partitionName: string | null): Date | null => {
  if (!partitionName || partitionName === 'pmax') return null;
  const match = partitionName.match(/^p(\d{6})$/);
  if (!match) return null;
  const year = Number(match[1].slice(0, 4));
  const month = Number(match[1].slice(4, 6));
  if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) {
    return null;
  }

  const monthStart = new Date(Date.UTC(year, month - 1, 1));
  return addUtcMonths(monthStart, 1);
};

const monthsBetween = (fromMonth: Date, toMonth: Date): number => {
  const years = toMonth.getUTCFullYear() - fromMonth.getUTCFullYear();
  const months = toMonth.getUTCMonth() - fromMonth.getUTCMonth();
  return years * 12 + months;
};

const toPartitionName = (value: string): string => sanitizeIdentifier(value, 'partition name');

const buildBootstrapSql = (table: string, partitions: PartitionPlan[]): string => {
  if (!partitions.length) {
    throw new Error('No partitions generated for bootstrap.');
  }

  const lines = partitions.map(
    (partition) =>
      `PARTITION \`${toPartitionName(partition.name)}\` VALUES LESS THAN ('${partition.lessThan}')`,
  );
  lines.push('PARTITION `pmax` VALUES LESS THAN (MAXVALUE)');

  return `ALTER TABLE \`${table}\`\nPARTITION BY RANGE COLUMNS(date) (\n  ${lines.join(',\n  ')}\n);`;
};

const buildAddPartitionSql = (table: string, partition: PartitionPlan): string =>
  `ALTER TABLE \`${table}\`\nREORGANIZE PARTITION \`pmax\` INTO (\n  PARTITION \`${toPartitionName(partition.name)}\` VALUES LESS THAN ('${partition.lessThan}'),\n  PARTITION \`pmax\` VALUES LESS THAN (MAXVALUE)\n);`;

const buildDropPartitionsSql = (table: string, partitions: string[]): string => {
  const names = partitions.map((name) => `\`${toPartitionName(name)}\``).join(', ');
  return `ALTER TABLE \`${table}\` DROP PARTITION ${names};`;
};

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const apply = hasFlag(args, '--apply');
  const bootstrap = hasFlag(args, '--bootstrap');

  const table = sanitizeIdentifier(
    parseStringOption(args, '--table', 'download_history_archive'),
    'table name',
  );
  const monthsAhead = Math.max(
    1,
    Math.min(36, Math.floor(parseNumberOption(args, '--months-ahead', 6))),
  );
  const monthsHistory = Math.max(
    0,
    Math.min(36, Math.floor(parseNumberOption(args, '--months-history', 2))),
  );
  const dropOlderThanMonths = Math.max(
    0,
    Math.min(120, Math.floor(parseNumberOption(args, '--drop-older-than-months', 0))),
  );
  const maxBootstrapMonths = Math.max(
    12,
    Math.min(360, Math.floor(parseNumberOption(args, '--max-bootstrap-months', 120))),
  );

  if (!process.env.DATABASE_URL) {
    log.warn('[DH_PARTITIONS] DATABASE_URL not configured. Skipping.');
    return;
  }

  const nowMonth = toUtcMonthStart(new Date());
  const targetStartMonth = addUtcMonths(nowMonth, -monthsHistory);
  const targetEndExclusive = addUtcMonths(nowMonth, monthsAhead + 1);

  const prisma = new PrismaClient();

  try {
    const [tableExists] = await prisma.$queryRaw<CountRow[]>`
      SELECT COUNT(*) AS total
      FROM information_schema.TABLES
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = ${table};
    `;

    if (!toNumber(tableExists?.total)) {
      throw new Error(`Table ${table} does not exist in current database.`);
    }

    const partitionRows = await prisma.$queryRaw<PartitionRow[]>`
      SELECT
        PARTITION_NAME AS partitionName,
        PARTITION_DESCRIPTION AS partitionDescription,
        PARTITION_METHOD AS partitionMethod,
        PARTITION_EXPRESSION AS partitionExpression
      FROM information_schema.PARTITIONS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = ${table}
      ORDER BY PARTITION_ORDINAL_POSITION ASC;
    `;

    const existingPartitionNames = partitionRows
      .map((row) => row.partitionName)
      .filter((value): value is string => Boolean(value));
    const isPartitioned = existingPartitionNames.length > 0;
    const hasPmax = existingPartitionNames.includes('pmax');

    const statements: string[] = [];

    if (!isPartitioned) {
      if (!bootstrap) {
        log.info('[DH_PARTITIONS] Table is not partitioned. Use --bootstrap to prepare SQL.', {
          table,
        });
      } else {
        const [minDateRow] = await prisma.$queryRawUnsafe<MinDateRow[]>(
          `SELECT MIN(date) AS minDate FROM \`${table}\`;`,
        );

        const minDate = parseDbDate(minDateRow?.minDate ?? null);
        const bootstrapStart = minDate
          ? toUtcMonthStart(minDate)
          : targetStartMonth;

        const bootstrapMonths = monthsBetween(bootstrapStart, targetEndExclusive);
        if (bootstrapMonths > maxBootstrapMonths) {
          throw new Error(
            `Bootstrap requires ${bootstrapMonths} months but max is ${maxBootstrapMonths}. Increase --max-bootstrap-months after review.`,
          );
        }

        const bootstrapPlan = buildPartitionPlan(bootstrapStart, targetEndExclusive);
        statements.push(buildBootstrapSql(table, bootstrapPlan));
      }
    } else {
      if (!hasPmax) {
        throw new Error(
          `Table ${table} is partitioned but missing pmax partition. Manual intervention required.`,
        );
      }

      const desiredPlan = buildPartitionPlan(targetStartMonth, targetEndExclusive);
      const existingSet = new Set(existingPartitionNames);

      const existingBoundaries = partitionRows
        .map(
          (row) =>
            parsePartitionDescriptionDate(row.partitionDescription) ||
            parsePartitionBoundaryFromName(row.partitionName),
        )
        .filter((value): value is Date => Boolean(value));

      const maxExistingBoundary = existingBoundaries.length
        ? existingBoundaries.reduce((max, current) =>
            current.getTime() > max.getTime() ? current : max,
          )
        : null;

      const partitionsToAdd = desiredPlan.filter((partition) => {
        if (existingSet.has(partition.name)) {
          return false;
        }
        if (!maxExistingBoundary) {
          return true;
        }
        const partitionBoundary = new Date(`${partition.lessThan}T00:00:00.000Z`);
        return partitionBoundary.getTime() > maxExistingBoundary.getTime();
      });

      for (const partition of partitionsToAdd) {
        statements.push(buildAddPartitionSql(table, partition));
      }

      if (dropOlderThanMonths > 0) {
        const dropBefore = addUtcMonths(nowMonth, -dropOlderThanMonths);
        const dropCandidates = partitionRows
          .map((row) => {
            if (!row.partitionName || row.partitionName === 'pmax') return null;
            const match = row.partitionName.match(/^p(\d{6})$/);
            if (!match) return null;

            const year = Number(match[1].slice(0, 4));
            const month = Number(match[1].slice(4, 6));
            if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) {
              return null;
            }

            const monthStart = new Date(Date.UTC(year, month - 1, 1));
            const monthEnd = addUtcMonths(monthStart, 1);
            if (monthEnd.getTime() > dropBefore.getTime()) {
              return null;
            }

            return row.partitionName;
          })
          .filter((value): value is string => Boolean(value));

        if (dropCandidates.length > 0) {
          statements.push(buildDropPartitionsSql(table, dropCandidates));
        }
      }
    }

    log.info('[DH_PARTITIONS] Plan ready.', {
      table,
      apply,
      bootstrap,
      monthsAhead,
      monthsHistory,
      dropOlderThanMonths,
      currentPartitionCount: existingPartitionNames.length,
      statements: statements.length,
    });

    if (statements.length === 0) {
      log.info('[DH_PARTITIONS] Nothing to change.');
      return;
    }

    for (const statement of statements) {
      log.info('[DH_PARTITIONS] SQL statement', { statement });
      if (apply) {
        await prisma.$executeRawUnsafe(statement);
      }
    }

    if (!apply) {
      log.info('[DH_PARTITIONS] Dry-run. Pass --apply to execute statements.');
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  log.error('[DH_PARTITIONS] Script failed.', {
    error: error instanceof Error ? error.message : error,
  });
  process.exitCode = 1;
});
