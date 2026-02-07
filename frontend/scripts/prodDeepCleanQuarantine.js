/* eslint-disable no-console */
/**
 * Limpieza profunda (SEGURA) en producción via API (tRPC):
 * - Bloquea dominios desechables (mailinator/yopmail) para evitar bots futuros.
 * - Pone en cuarentena (blocked=true) cuentas bot obvias:
 *   dominio desechable + NO verificado + sin ordenes + sin FTP + sin cuota.
 *
 * Importante:
 * - NO borra nada.
 * - Es reversible: usar MODE=unblock con el reporte generado.
 *
 * Requiere variables de entorno:
 *   BEARBEAT_PROD_ADMIN_EMAIL
 *   BEARBEAT_PROD_ADMIN_PASSWORD
 *
 * Opcionales:
 *   BEARBEAT_PROD_TRPC_URL (default: https://thebearbeatapi.lat/trpc)
 *   BEARBEAT_SNAPSHOT_FILE (default: ultimo snapshot en ../backend/output/prod-snapshots/)
 *   BEARBEAT_DISPOSABLE_DOMAINS (default: mailinator.com,yopmail.com)
 *   MODE=quarantine|unblock
 *   DRY_RUN=1
 *   REPORT_FILE=<path> (para MODE=unblock)
 */

const fs = require("node:fs");
const path = require("node:path");
const zlib = require("node:zlib");
const readline = require("node:readline");

const { createTRPCProxyClient, httpBatchLink } = require("@trpc/client");
const superjson = require("superjson");

const DEFAULT_TRPC_URL = "https://thebearbeatapi.lat/trpc";

function requiredEnv(name) {
  const v = process.env[name];
  if (!v || !v.trim()) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return v.trim();
}

function nowStamp() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return (
    d.getFullYear() +
    pad(d.getMonth() + 1) +
    pad(d.getDate()) +
    "-" +
    pad(d.getHours()) +
    pad(d.getMinutes()) +
    pad(d.getSeconds())
  );
}

function parseCsvEnv(name, fallback) {
  const v = process.env[name];
  if (!v || !v.trim()) return fallback;
  return v
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

function emailDomain(email) {
  if (!email || typeof email !== "string") return null;
  const at = email.lastIndexOf("@");
  if (at < 0) return null;
  return email.slice(at + 1).toLowerCase().trim();
}

function latestSnapshotFile() {
  const dir = path.resolve(__dirname, "..", "..", "backend", "output", "prod-snapshots");
  if (!fs.existsSync(dir)) return null;
  const files = fs
    .readdirSync(dir)
    .filter((f) => f.startsWith("prod-snapshot-") && f.endsWith(".ndjson.gz"))
    .map((f) => path.join(dir, f))
    .sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);
  return files[0] || null;
}

async function loadCandidatesFromSnapshot(snapshotFile, disposableDomains) {
  const users = new Map(); // id -> { id, email, role_id, blocked, verified }
  const usersWithOrders = new Set();
  const usersWithFtp = new Set();
  const usersWithQuota = new Set();

  const gunzip = zlib.createGunzip();
  fs.createReadStream(snapshotFile).pipe(gunzip);
  const rl = readline.createInterface({ input: gunzip, crlfDelay: Infinity });

  for await (const line of rl) {
    if (!line.trim()) continue;
    let parsed;
    try {
      parsed = JSON.parse(line);
    } catch {
      continue;
    }

    const t = parsed.table;
    const row = parsed.row;
    if (!t || !row) continue;

    if (t === "users") {
      users.set(row.id, {
        id: row.id,
        email: row.email,
        role_id: row.role_id,
        blocked: Boolean(row.blocked),
        verified: Boolean(row.verified),
      });
    } else if (t === "orders") {
      if (row.user_id != null) usersWithOrders.add(row.user_id);
    } else if (t === "ftpuser") {
      if (row.user_id != null) usersWithFtp.add(row.user_id);
    } else if (t === "descargasuser") {
      if (row.user_id != null) usersWithQuota.add(row.user_id);
    }
  }

  const candidates = [];
  for (const u of users.values()) {
    const dom = emailDomain(u.email);
    if (!dom) continue;
    if (!disposableDomains.includes(dom)) continue;

    // Seguridad: solo usuarios normales, no bloqueados, no verificados, y sin señales de negocio.
    if (u.role_id !== 4) continue;
    if (u.blocked) continue;
    if (u.verified) continue;
    if (usersWithOrders.has(u.id)) continue;
    if (usersWithFtp.has(u.id)) continue;
    if (usersWithQuota.has(u.id)) continue;

    candidates.push({ id: u.id, email: u.email, domain: dom });
  }

  candidates.sort((a, b) => a.id - b.id);

  return {
    candidates,
    stats: {
      users: users.size,
      usersWithOrders: usersWithOrders.size,
      usersWithFtp: usersWithFtp.size,
      usersWithQuota: usersWithQuota.size,
      candidates: candidates.length,
    },
  };
}

function createClient({ trpcUrl, token }) {
  return createTRPCProxyClient({
    transformer: superjson,
    links: [
      httpBatchLink({
        url: trpcUrl,
        headers() {
          if (!token) return {};
          return { authorization: `Bearer ${token}` };
        },
      }),
    ],
  });
}

async function main() {
  const mode = (process.env.MODE || "quarantine").trim();
  const dryRun = (process.env.DRY_RUN || "").trim() === "1";

  const trpcUrl = (process.env.BEARBEAT_PROD_TRPC_URL || DEFAULT_TRPC_URL).trim();
  const disposableDomains = parseCsvEnv("BEARBEAT_DISPOSABLE_DOMAINS", [
    "mailinator.com",
    "yopmail.com",
  ]);

  if (mode === "unblock") {
    const reportFile = requiredEnv("REPORT_FILE");
    const report = JSON.parse(fs.readFileSync(reportFile, "utf-8"));
    const ids = Array.isArray(report?.blockedUserIds) ? report.blockedUserIds : [];

    console.log(`[clean] MODE=unblock ids=${ids.length}`);
    if (dryRun) {
      console.log("[clean] DRY_RUN=1, no changes applied");
      return;
    }

    const email = requiredEnv("BEARBEAT_PROD_ADMIN_EMAIL");
    const password = requiredEnv("BEARBEAT_PROD_ADMIN_PASSWORD");

    const anon = createClient({ trpcUrl });
    const login = await anon.auth.login.query({ username: email, password });
    if (!login?.token) throw new Error("Login failed: missing token.");
    const authed = createClient({ trpcUrl, token: login.token });

    const unblocked = [];
    const errors = [];
    for (const userId of ids) {
      try {
        // eslint-disable-next-line no-await-in-loop
        await authed.users.unblockUser.mutate({ userId });
        unblocked.push(userId);
      } catch (e) {
        errors.push({ userId, message: e?.message || String(e) });
      }
    }

    console.log(`[clean] unblocked=${unblocked.length} errors=${errors.length}`);
    return;
  }

  // MODE=quarantine
  const snapshotFile =
    (process.env.BEARBEAT_SNAPSHOT_FILE && process.env.BEARBEAT_SNAPSHOT_FILE.trim()) ||
    latestSnapshotFile();
  if (!snapshotFile) throw new Error("No snapshot file found.");
  if (!fs.existsSync(snapshotFile)) throw new Error(`Snapshot not found: ${snapshotFile}`);

  const { candidates, stats } = await loadCandidatesFromSnapshot(snapshotFile, disposableDomains);

  console.log(`[clean] snapshot=${snapshotFile}`);
  console.log(`[clean] users=${stats.users} ordersUsers=${stats.usersWithOrders} ftpUsers=${stats.usersWithFtp} quotaUsers=${stats.usersWithQuota}`);
  console.log(`[clean] disposableDomains=${disposableDomains.join(",")}`);
  console.log(`[clean] candidates=${stats.candidates}`);

  if (dryRun) {
    console.log("[clean] DRY_RUN=1, no changes applied");
    return;
  }

  const email = requiredEnv("BEARBEAT_PROD_ADMIN_EMAIL");
  const password = requiredEnv("BEARBEAT_PROD_ADMIN_PASSWORD");

  const anon = createClient({ trpcUrl });
  const login = await anon.auth.login.query({ username: email, password });
  if (!login?.token) throw new Error("Login failed: missing token.");
  const authed = createClient({ trpcUrl, token: login.token });

  const blockedDomainsAdded = [];
  const blockedDomainsSkipped = [];
  for (const dom of disposableDomains) {
    try {
      // eslint-disable-next-line no-await-in-loop
      await authed.blockedEmailDomains.addBlockedEmailDomain.mutate({ domain: dom });
      blockedDomainsAdded.push(dom);
    } catch (e) {
      // Si ya existe o no permitido, lo registramos y seguimos.
      blockedDomainsSkipped.push({ domain: dom, message: e?.message || String(e) });
    }
  }

  const blockedUserIds = [];
  const errors = [];

  for (const c of candidates) {
    try {
      // eslint-disable-next-line no-await-in-loop
      await authed.users.blockUser.mutate({ userId: c.id });
      blockedUserIds.push(c.id);
      if (blockedUserIds.length % 25 === 0) {
        console.log(`[clean] blocked ${blockedUserIds.length}/${candidates.length}...`);
      }
    } catch (e) {
      errors.push({ userId: c.id, email: c.email, message: e?.message || String(e) });
    }
  }

  const report = {
    createdAt: new Date().toISOString(),
    mode: "quarantine",
    trpcUrl,
    snapshotFile,
    disposableDomains,
    stats,
    blockedDomainsAdded,
    blockedDomainsSkipped,
    candidateCount: candidates.length,
    blockedUserIds,
    errors,
  };

  const outDir = path.resolve(__dirname, "..", "tmp");
  fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, `prod-deep-clean-${nowStamp()}.json`);
  fs.writeFileSync(outFile, JSON.stringify(report, null, 2), { mode: 0o600 });

  console.log(`[clean] done blocked=${blockedUserIds.length} errors=${errors.length}`);
  console.log(`[clean] report=${outFile}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

