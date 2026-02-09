import { PrismaClient } from "@prisma/client";

/**
 * Dev-only helper: creates/updates minimal Plans rows so /planes + /comprar are testable locally.
 *
 * Guardrails:
 * - Refuses to run unless DATABASE_URL looks local (localhost/127.0.0.1/etc).
 * - Requires AUDIT_SEED_PASSWORD as a "human confirmation" env var (we don't use it).
 *
 * IMPORTANT:
 * - Stripe price IDs are mocked as `price_*` to avoid "plan sin Stripe" client-side blocks.
 * - This does NOT create real Stripe products/prices; checkout should not be completed with these.
 */

const prisma = new PrismaClient();

function looksLikeLocalDatabaseUrl(dbUrl: string): boolean {
  const raw = (dbUrl || "").trim();
  if (!raw) return false;
  try {
    const parsed = new URL(raw);
    const host = parsed.hostname;
    if (!host) return false;
    return (
      host === "localhost" ||
      host === "127.0.0.1" ||
      host === "0.0.0.0" ||
      host.endsWith(".local") ||
      host === "bearbeat-db"
    );
  } catch {
    return /localhost|127\.0\.0\.1|0\.0\.0\.0/.test(raw);
  }
}

async function ensurePlan(opts: {
  name: string;
  moneda: "mxn" | "usd";
  price: string;
  gigas: bigint;
  stripePriceId: string;
}) {
  const { name, moneda, price, gigas, stripePriceId } = opts;

  const existing = await prisma.plans.findFirst({
    where: {
      name,
      moneda,
    },
  });

  const baseData = {
    name,
    moneda,
    price,
    gigas,
    description:
      moneda === "mxn"
        ? "Plan de auditoría (local). Acceso al catálogo + 500 GB/mes."
        : "Audit plan (local). Catalog access + 500 GB/month.",
    duration: "30 días",
    activated: 1,
    homedir: "/",
    stripe_prod_id: stripePriceId,
    stripe_prod_id_test: stripePriceId,
  } as const;

  if (existing) {
    await prisma.plans.update({
      where: { id: existing.id },
      data: baseData,
    });
    return existing.id;
  }

  const created = await prisma.plans.create({
    data: baseData,
  });
  return created.id;
}

async function main() {
  const dbUrl = process.env.DATABASE_URL || "";
  if (!looksLikeLocalDatabaseUrl(dbUrl) && process.env.AUDIT_SEED_ALLOW_NONLOCAL !== "1") {
    throw new Error(
      "Refusing to seed a non-local DATABASE_URL. Set AUDIT_SEED_ALLOW_NONLOCAL=1 to override (not recommended).",
    );
  }

  const confirmation = process.env.AUDIT_SEED_PASSWORD?.trim();
  if (!confirmation) {
    throw new Error("AUDIT_SEED_PASSWORD es requerido como confirmación para seed:audit-plan.");
  }

  const mxnId = await ensurePlan({
    name: "Audit Plan MXN",
    moneda: "mxn",
    price: "350.00",
    gigas: BigInt(500),
    stripePriceId: "price_audit_mxn_500gb",
  });

  const usdId = await ensurePlan({
    name: "Audit Plan USD",
    moneda: "usd",
    price: "19.99",
    gigas: BigInt(500),
    stripePriceId: "price_audit_usd_500gb",
  });

  // eslint-disable-next-line no-console
  console.log(`Audit plans listos: mxn(id=${mxnId}), usd(id=${usdId}).`);
}

main()
  .catch((err) => {
    // eslint-disable-next-line no-console
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect().catch(() => null);
  });

