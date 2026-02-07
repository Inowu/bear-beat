/* eslint-disable no-console */
/**
 * Exporta un snapshot de datos desde PRODUCCION via tRPC (https://thebearbeatapi.lat)
 * usando credenciales admin. Esto evita depender de SSH/DB directo.
 *
 * Salida: backend/output/prod-snapshots/<timestamp>.ndjson.gz
 * Cada linea es: { table: string, row: any }
 *
 * Requiere:
 *   BEARBEAT_PROD_ADMIN_EMAIL
 *   BEARBEAT_PROD_ADMIN_PASSWORD
 *
 * Opcionales:
 *   BEARBEAT_PROD_TRPC_URL (default: https://thebearbeatapi.lat/trpc)
 *   BEARBEAT_SNAPSHOT_TABLES (default: users,orders,plans,descargasuser,ftpuser,checkoutLogs,loginhistory)
 *   BEARBEAT_SNAPSHOT_PAGE_SIZE (default: 200)
 */

const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');

const { createTRPCProxyClient, httpBatchLink } = require('@trpc/client');
const superjson = require('superjson');

const DEFAULT_TRPC_URL = 'https://thebearbeatapi.lat/trpc';
const DEFAULT_TABLES = [
  'users',
  'orders',
  'plans',
  'descargasuser',
  'ftpuser',
  'loginhistory',
];

function nowStamp() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return (
    d.getFullYear() +
    pad(d.getMonth() + 1) +
    pad(d.getDate()) +
    '-' +
    pad(d.getHours()) +
    pad(d.getMinutes()) +
    pad(d.getSeconds())
  );
}

function requiredEnv(name) {
  const v = process.env[name];
  if (!v || !v.trim()) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return v.trim();
}

function parseListEnv(name, fallback) {
  const v = process.env[name];
  if (!v || !v.trim()) {
    return fallback;
  }
  return v
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function parseIntEnv(name, fallback) {
  const v = process.env[name];
  if (!v || !v.trim()) {
    return fallback;
  }
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function createClient({ trpcUrl, token }) {
  return createTRPCProxyClient({
    transformer: superjson,
    links: [
      httpBatchLink({
        url: trpcUrl,
        headers() {
          if (!token) {
            return {};
          }
          return { authorization: `Bearer ${token}` };
        },
      }),
    ],
  });
}

/**
 * Define como paginar cada "tabla" usando procedures existentes.
 * Nota: en tu backend hay procedimientos tipo findManyXxx que aceptan input prisma (take/skip/orderBy).
 */
const TABLE_SPECS = {
  users: {
    procedure: (c) => c.users.findManyUsers,
    orderBy: { id: 'asc' },
  },
  orders: {
    procedure: (c) => c.orders.findManyOrders,
    orderBy: { id: 'asc' },
  },
  plans: {
    procedure: (c) => c.plans.findManyPlans,
    orderBy: { id: 'asc' },
  },
  descargasuser: {
    procedure: (c) => c.descargasuser.findManyDescargasUser,
    orderBy: { id: 'asc' },
  },
  ftpuser: {
    procedure: (c) => c.ftpuser.findManyFtpUser,
    orderBy: { id: 'asc' },
  },
  checkoutLogs: {
    // Router expone getCheckoutLogs (incluye users). Requiere where/select en input.
    procedure: (c) => c.checkoutLogs.getCheckoutLogs,
    orderBy: { id: 'asc' },
    inputBase: { where: {}, select: {} },
  },
  loginhistory: {
    procedure: (c) => c.loginhistory.findManyLoginHistory,
    orderBy: { id: 'asc' },
  },
};

async function exportTable({ client, table, pageSize, writeLine }) {
  const spec = TABLE_SPECS[table];
  if (!spec) {
    throw new Error(`Unknown table "${table}". Supported: ${Object.keys(TABLE_SPECS).join(', ')}`);
  }

  const proc = spec.procedure(client);
  let skip = 0;
  let total = 0;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const input = { ...(spec.inputBase || {}), take: pageSize, skip, orderBy: spec.orderBy };
    // Each router uses `.query(...)` because procedures are queries.
    // We call dynamic: proc.query(input)
    // eslint-disable-next-line no-await-in-loop
    const rows = await proc.query(input);
    if (!Array.isArray(rows) || rows.length === 0) {
      break;
    }

    for (const row of rows) {
      writeLine({ table, row });
      total += 1;
    }

    skip += rows.length;
    if (rows.length < pageSize) {
      break;
    }
  }

  return total;
}

async function main() {
  const adminEmail = requiredEnv('BEARBEAT_PROD_ADMIN_EMAIL');
  const adminPassword = requiredEnv('BEARBEAT_PROD_ADMIN_PASSWORD');
  const trpcUrl = (process.env.BEARBEAT_PROD_TRPC_URL || DEFAULT_TRPC_URL).trim();
  const tables = parseListEnv('BEARBEAT_SNAPSHOT_TABLES', DEFAULT_TABLES);
  const pageSize = parseIntEnv('BEARBEAT_SNAPSHOT_PAGE_SIZE', 200);

  const outDir = path.join(__dirname, '..', 'output', 'prod-snapshots');
  fs.mkdirSync(outDir, { recursive: true });

  const stamp = nowStamp();
  const outFile = path.join(outDir, `prod-snapshot-${stamp}.ndjson.gz`);
  const outMetaFile = path.join(outDir, `prod-snapshot-${stamp}.meta.json`);

  console.log(`[snapshot] trpc: ${trpcUrl}`);
  console.log(`[snapshot] tables: ${tables.join(', ')}`);
  console.log(`[snapshot] pageSize: ${pageSize}`);
  console.log(`[snapshot] out: ${outFile}`);

  const anon = createClient({ trpcUrl });
  const login = await anon.auth.login.query({
    username: adminEmail,
    password: adminPassword,
  });

  if (!login?.token) {
    throw new Error('Login succeeded but token is missing.');
  }

  const authed = createClient({ trpcUrl, token: login.token });

  const gzip = zlib.createGzip({ level: 9 });
  const out = fs.createWriteStream(outFile, { flags: 'wx', mode: 0o600 });
  gzip.pipe(out);

  const counts = {};
  const errors = [];
  const startedAt = new Date().toISOString();

  function writeLine(obj) {
    // BigInt appears in prisma results (e.g. gigas/quota fields). JSON doesn't support it.
    gzip.write(
      JSON.stringify(obj, (_k, v) => (typeof v === 'bigint' ? v.toString() : v)) +
        '\n',
    );
  }

  // Header line
  writeLine({
    table: '__meta__',
    row: {
      startedAt,
      trpcUrl,
      tables,
      pageSize,
    },
  });

  for (const table of tables) {
    console.log(`[snapshot] exporting ${table}...`);
    try {
      // eslint-disable-next-line no-await-in-loop
      const n = await exportTable({ client: authed, table, pageSize, writeLine });
      counts[table] = n;
      console.log(`[snapshot] exported ${table}: ${n.toLocaleString('en-US')} rows`);
    } catch (e) {
      const message = e?.message || String(e);
      errors.push({ table, message });
      console.error(`[snapshot] FAILED ${table}: ${message}`);
    }
  }

  const finishedAt = new Date().toISOString();
  gzip.end();

  await new Promise((resolve, reject) => {
    out.on('finish', resolve);
    out.on('error', reject);
    gzip.on('error', reject);
  });

  const meta = {
    startedAt,
    finishedAt,
    trpcUrl,
    tables,
    pageSize,
    counts,
    errors,
    outFile,
  };

  fs.writeFileSync(outMetaFile, JSON.stringify(meta, null, 2), { mode: 0o600 });

  console.log('[snapshot] done');
  console.log(`[snapshot] meta: ${outMetaFile}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
