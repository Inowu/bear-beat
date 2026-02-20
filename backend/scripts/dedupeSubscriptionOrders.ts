import './_loadEnv';
import { Prisma, PrismaClient } from '@prisma/client';

interface CandidateOrderRow {
  id: number;
  user_id: number;
  payment_method_norm: string;
  txn_id_norm: string;
  plan_id: number | null;
  status: number;
  amount_rounded: number | string | bigint;
  day_key: string | Date;
}

interface DuplicateGroup {
  key: string;
  keepId: number;
  duplicateIds: number[];
  size: number;
  paymentMethod: string;
  dayKey: string;
}

const ORDER_STATUS_PAID = 1;
const APPLY_FLAG = '--apply';
const MAX_GROUPS_FLAG = '--max-groups';

const toNumber = (value: number | string | bigint | null | undefined): number => {
  if (value == null) return 0;
  if (typeof value === 'bigint') return Number(value);
  if (typeof value === 'number') return value;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

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
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.floor(parsed);
};

const hasFlag = (args: string[], flag: string): boolean => args.includes(flag);

const toDayKey = (value: string | Date): string => {
  if (typeof value === 'string') return value;
  return value.toISOString().slice(0, 10);
};

const toAmountKey = (value: number | string | bigint): string =>
  toNumber(value).toFixed(2);

const buildGroupKey = (row: CandidateOrderRow): string =>
  [
    row.user_id,
    row.payment_method_norm,
    row.txn_id_norm,
    row.plan_id ?? 'null',
    row.status,
    toAmountKey(row.amount_rounded),
    toDayKey(row.day_key),
  ].join('|');

async function main() {
  const args = process.argv.slice(2);
  const apply = hasFlag(args, APPLY_FLAG);
  const maxGroups = parseNumberOption(args, MAX_GROUPS_FLAG, Number.MAX_SAFE_INTEGER);
  const prisma = new PrismaClient();

  try {
    const candidateRows = await prisma.$queryRaw<CandidateOrderRow[]>(Prisma.sql`
      SELECT
        o.id,
        o.user_id,
        LOWER(COALESCE(TRIM(o.payment_method), '')) AS payment_method_norm,
        LOWER(COALESCE(TRIM(o.txn_id), '')) AS txn_id_norm,
        o.plan_id,
        o.status,
        ROUND(o.total_price, 2) AS amount_rounded,
        DATE(o.date_order) AS day_key
      FROM orders o
      WHERE o.is_plan = 1
        AND o.status = ${ORDER_STATUS_PAID}
        AND LOWER(COALESCE(TRIM(o.payment_method), '')) IN ('stripe', 'paypal')
        AND COALESCE(TRIM(o.txn_id), '') <> ''
      ORDER BY o.id ASC;
    `);

    const grouped = new Map<string, CandidateOrderRow[]>();
    for (const row of candidateRows) {
      const key = buildGroupKey(row);
      const current = grouped.get(key) ?? [];
      current.push(row);
      grouped.set(key, current);
    }

    const duplicateGroups: DuplicateGroup[] = [];
    for (const [key, rows] of grouped.entries()) {
      if (rows.length <= 1) continue;
      duplicateGroups.push({
        key,
        keepId: rows[0].id,
        duplicateIds: rows.slice(1).map((row) => row.id),
        size: rows.length,
        paymentMethod: rows[0].payment_method_norm,
        dayKey: toDayKey(rows[0].day_key),
      });
    }

    const limitedGroups = duplicateGroups.slice(0, maxGroups);
    const totalDuplicateRows = limitedGroups.reduce(
      (acc, group) => acc + group.duplicateIds.length,
      0,
    );

    console.log(
      `[orders:dedupe] duplicate_groups=${duplicateGroups.length} groups_selected=${limitedGroups.length} duplicate_rows=${totalDuplicateRows}`,
    );

    if (!limitedGroups.length) {
      console.log('[orders:dedupe] No duplicated subscription orders found.');
      return;
    }

    if (!apply) {
      console.log('[orders:dedupe] Dry-run mode. Use --apply to execute cleanup.');
      for (const group of limitedGroups.slice(0, 20)) {
        console.log(
          `[orders:dedupe] group keep_id=${group.keepId} duplicate_ids=${group.duplicateIds.join(',')} size=${group.size} provider=${group.paymentMethod} day=${group.dayKey}`,
        );
      }
      return;
    }

    let reassignedDescargas = 0;
    let reassignedFtpUser = 0;
    let reassignedCancellationFeedback = 0;
    let reassignedBillingConsents = 0;
    let reassignedUserFiles = 0;
    let deletedOrders = 0;

    for (const group of limitedGroups) {
      const idsSql = Prisma.join(group.duplicateIds);
      const keepId = group.keepId;

      await prisma.$transaction(async (tx) => {
        reassignedDescargas += toNumber(
          await tx.$executeRaw(
            Prisma.sql`UPDATE descargas_user SET order_id = ${keepId} WHERE order_id IN (${idsSql})`,
          ),
        );
        reassignedFtpUser += toNumber(
          await tx.$executeRaw(
            Prisma.sql`UPDATE ftpuser SET order_id = ${keepId} WHERE order_id IN (${idsSql})`,
          ),
        );
        reassignedCancellationFeedback += toNumber(
          await tx.$executeRaw(
            Prisma.sql`UPDATE subscription_cancellation_feedback SET order_id = ${keepId} WHERE order_id IN (${idsSql})`,
          ),
        );
        reassignedBillingConsents += toNumber(
          await tx.$executeRaw(
            Prisma.sql`UPDATE billing_consents SET order_id = ${keepId} WHERE order_id IN (${idsSql})`,
          ),
        );
        reassignedUserFiles += toNumber(
          await tx.$executeRaw(
            Prisma.sql`UPDATE user_files SET order_id = ${keepId} WHERE order_id IN (${idsSql})`,
          ),
        );
        deletedOrders += toNumber(
          await tx.$executeRaw(
            Prisma.sql`DELETE FROM orders WHERE id IN (${idsSql})`,
          ),
        );
      });
    }

    console.log(`[orders:dedupe] Done.`);
    console.log(`[orders:dedupe] reassigned_descargas=${reassignedDescargas}`);
    console.log(`[orders:dedupe] reassigned_ftpuser=${reassignedFtpUser}`);
    console.log(
      `[orders:dedupe] reassigned_subscription_cancellation_feedback=${reassignedCancellationFeedback}`,
    );
    console.log(`[orders:dedupe] reassigned_billing_consents=${reassignedBillingConsents}`);
    console.log(`[orders:dedupe] reassigned_user_files=${reassignedUserFiles}`);
    console.log(`[orders:dedupe] deleted_orders=${deletedOrders}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[orders:dedupe] failed: ${message}`);
  process.exit(1);
});
