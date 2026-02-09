import "./_loadEnv";
import bcrypt from "bcrypt";
import { PrismaClient } from "@prisma/client";

/**
 * Dev-only helper: creates/updates a local admin user for audits/e2e.
 * Guardrails:
 * - Requires AUDIT_SEED_PASSWORD to avoid accidental seeding into a non-local DB.
 * - Never prints the password.
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

async function main() {
  const dbUrl = process.env.DATABASE_URL || "";
  if (!looksLikeLocalDatabaseUrl(dbUrl) && process.env.AUDIT_SEED_ALLOW_NONLOCAL !== "1") {
    throw new Error(
      "Refusing to seed a non-local DATABASE_URL. Set AUDIT_SEED_ALLOW_NONLOCAL=1 to override (not recommended).",
    );
  }

  const email = (process.env.AUDIT_SEED_EMAIL || "audit-admin@local.test").trim().toLowerCase();
  const username = (process.env.AUDIT_SEED_USERNAME || "audit-admin").trim();
  const password = process.env.AUDIT_SEED_PASSWORD?.trim();

  if (!password || password.length < 10) {
    throw new Error("AUDIT_SEED_PASSWORD es requerido (min 10 chars) para crear el usuario de auditoría.");
  }

  const hash = await bcrypt.hash(password, 10);

  await prisma.users.upsert({
    where: { email },
    update: {
      username,
      password: hash,
      active: 1,
      role_id: 1, // ADMIN
      verified: true,
      blocked: false,
    },
    create: {
      username,
      password: hash,
      email,
      active: 1,
      role_id: 1, // ADMIN
      verified: true,
      blocked: false,
    },
  });

  // eslint-disable-next-line no-console
  console.log(`Audit user listo: ${email} (role=ADMIN).`);
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
