import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import { pipeline } from 'stream/promises';
import { spawn, spawnSync } from 'child_process';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import {
  getBlockedEmailDomains,
  normalizeEmailDomain,
  RESERVED_EMAIL_DOMAINS,
  setBlockedEmailDomains,
} from '../src/utils/blockedEmailDomains';
import {
  getBlockedPhoneNumbers,
  isValidPhoneNumber,
  normalizePhoneNumber,
  setBlockedPhoneNumbers,
} from '../src/utils/blockedPhoneNumbers';
import { RolesIds } from '../src/routers/auth/interfaces/roles.interface';

type Command = 'backup' | 'audit' | 'quarantine' | 'purge';
type RiskTier = 'low' | 'medium' | 'high';
type ActionSuggestion = 'protect' | 'review' | 'quarantine_candidate' | 'keep';

interface CliOptions {
  apply: boolean;
  outDir: string;
  limit: number;
  graceDays: number;
  purgeDays: number;
  riskThreshold: number;
  ipThreshold: number;
  strengthenBlocklists: boolean;
  jsonOnly: boolean;
  envFile: string | null;
  databaseUrl: string | null;
}

interface CountRow {
  id: number;
  total: bigint | number;
}

interface IpCountRow {
  ip: string;
  total: bigint | number;
}

interface UserRiskRecord {
  id: number;
  email: string;
  phone: string | null;
  roleId: number | null;
  registeredOn: string;
  ageDays: number;
  ip: string | null;
  sharedIpCount: number;
  verified: boolean;
  blocked: boolean;
  active: number;
  orderCount: number;
  subscriptionCount: number;
  downloadCount: number;
  checkoutLogCount: number;
  productOrderCount: number;
  ftpAccountCount: number;
  hasBusinessSignals: boolean;
  riskScore: number;
  riskTier: RiskTier;
  reasons: string[];
  actionSuggestion: ActionSuggestion;
  purgeCandidate: boolean;
}

interface AuditResult {
  generatedAt: string;
  totalUsers: number;
  summary: {
    protectedUsers: number;
    keepUsers: number;
    reviewUsers: number;
    quarantineCandidates: number;
    purgeCandidates: number;
    highRisk: number;
    mediumRisk: number;
    lowRisk: number;
  };
  settings: {
    graceDays: number;
    purgeDays: number;
    riskThreshold: number;
    ipThreshold: number;
  };
  topSharedIps: Array<{ ip: string; users: number }>;
  candidates: {
    quarantine: UserRiskRecord[];
    purge: UserRiskRecord[];
  };
  users: UserRiskRecord[];
}

const DEFAULT_OPTIONS: CliOptions = {
  apply: false,
  outDir: path.join(process.cwd(), 'backups', 'db-hygiene'),
  limit: 500,
  graceDays: 14,
  purgeDays: 60,
  riskThreshold: 7,
  ipThreshold: 10,
  strengthenBlocklists: false,
  jsonOnly: false,
  envFile: null,
  databaseUrl: null,
};

const DISPOSABLE_DOMAIN_KEYWORDS = [
  'tempmail',
  'mailinator',
  'yopmail',
  'guerrillamail',
  '10minutemail',
  'trashmail',
  'sharklasers',
  'fakeinbox',
  'maildrop',
  'disposable',
  'throwaway',
  'tmpmail',
  'mailnesia',
  'spamgourmet',
];

const BACKUP_TABLES_FALLBACK = [
  'users',
  'orders',
  'descargas_user',
  'ftpuser',
  'download_history',
  'deleted_users',
  'config',
];

const resolveEnvPaths = (explicitEnvFile: string | null): string[] => {
  if (explicitEnvFile) {
    return [path.resolve(process.cwd(), explicitEnvFile)];
  }

  return [
    path.join(process.cwd(), '.env'),
    path.join(process.cwd(), '.env.local'),
    path.resolve(process.cwd(), '../.env'),
    path.resolve(process.cwd(), '../.env.local'),
  ];
};

const loadEnvFiles = (explicitEnvFile: string | null) => {
  for (const envPath of resolveEnvPaths(explicitEnvFile)) {
    if (!fs.existsSync(envPath)) {
      continue;
    }
    dotenv.config({
      path: envPath,
      override: false,
    });
  }
};

const parseNumberOption = (
  args: string[],
  flag: string,
  fallback: number,
): number => {
  const index = args.indexOf(flag);
  if (index < 0 || index + 1 >= args.length) {
    return fallback;
  }

  const parsed = Number(args[index + 1]);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return parsed;
};

function parseStringOption(
  args: string[],
  flag: string,
  fallback: string,
): string;
function parseStringOption(
  args: string[],
  flag: string,
  fallback: null,
): string | null;
function parseStringOption(
  args: string[],
  flag: string,
  fallback: string | null,
): string | null {
  const index = args.indexOf(flag);
  if (index < 0 || index + 1 >= args.length) {
    return fallback;
  }
  const next = args[index + 1];
  if (next.startsWith('--')) {
    return fallback;
  }
  return next;
}

const hasFlag = (args: string[], flag: string): boolean => args.includes(flag);

const toNumber = (value: bigint | number | null | undefined): number => {
  if (value == null) return 0;
  if (typeof value === 'bigint') return Number(value);
  return Number(value);
};

const nowStamp = (): string =>
  new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_').slice(0, 19);

const ensureDir = (dirPath: string) => {
  fs.mkdirSync(dirPath, { recursive: true });
};

const writeJson = (filePath: string, data: unknown) => {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
};

const writeGzipJson = (filePath: string, data: unknown) => {
  const serialized = JSON.stringify(data);
  const compressed = zlib.gzipSync(serialized, { level: 9 });
  fs.writeFileSync(filePath, compressed);
};

const chunkArray = <T>(items: T[], chunkSize: number): T[][] => {
  if (chunkSize <= 0) return [items];
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += chunkSize) {
    chunks.push(items.slice(i, i + chunkSize));
  }
  return chunks;
};

const getDbConnectionFromUrl = () => {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL no está definida en el entorno.');
  }
  const parsed = new URL(databaseUrl);
  const protocol = parsed.protocol.replace(':', '');
  if (!protocol.includes('mysql')) {
    throw new Error(
      `Este script espera MySQL y recibió protocolo "${parsed.protocol}".`,
    );
  }

  return {
    host: parsed.hostname,
    port: parsed.port || '3306',
    user: decodeURIComponent(parsed.username),
    password: decodeURIComponent(parsed.password),
    database: parsed.pathname.replace(/^\//, ''),
  };
};

const canUseMySqlDump = (): boolean => {
  const result = spawnSync('mysqldump', ['--version'], {
    stdio: 'ignore',
  });
  return result.status === 0;
};

const runMySqlDumpBackup = async (outputFile: string) => {
  const { host, port, user, password, database } = getDbConnectionFromUrl();
  const args = [
    '--single-transaction',
    '--quick',
    '--skip-lock-tables',
    `--host=${host}`,
    `--port=${port}`,
    `--user=${user}`,
    database,
  ];

  const dump = spawn('mysqldump', args, {
    env: { ...process.env, MYSQL_PWD: password },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  let stderr = '';
  dump.stderr.on('data', (chunk) => {
    stderr += chunk.toString();
  });

  await pipeline(
    dump.stdout,
    zlib.createGzip({ level: 9 }),
    fs.createWriteStream(outputFile),
  );

  await new Promise<void>((resolve, reject) => {
    dump.on('error', reject);
    dump.on('close', (code) => {
      if (code !== 0) {
        reject(
          new Error(
            `mysqldump terminó con código ${code}. Detalle: ${stderr.trim()}`,
          ),
        );
        return;
      }
      resolve();
    });
  });
};

const runFallbackSnapshotBackup = async (prisma: PrismaClient, outputFile: string) => {
  const snapshot: Record<string, unknown> = {
    generatedAt: new Date().toISOString(),
    fallback: true,
    reason:
      'mysqldump no disponible. Este respaldo es parcial (tablas críticas) para auditoría/limpieza.',
    tables: {} as Record<string, unknown>,
  };

  for (const tableName of BACKUP_TABLES_FALLBACK) {
    const rows = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
      `SELECT * FROM ${tableName}`,
    );
    (snapshot.tables as Record<string, unknown>)[tableName] = rows;
  }

  writeGzipJson(outputFile, snapshot);
};

const mapCountsById = (rows: CountRow[]): Map<number, number> => {
  const map = new Map<number, number>();
  for (const row of rows) {
    map.set(Number(row.id), toNumber(row.total));
  }
  return map;
};

const getRiskTier = (score: number): RiskTier => {
  if (score >= 7) return 'high';
  if (score >= 4) return 'medium';
  return 'low';
};

const getActionSuggestion = (
  hasBusinessSignals: boolean,
  riskScore: number,
  ageDays: number,
  graceDays: number,
): ActionSuggestion => {
  if (hasBusinessSignals) return 'protect';
  if (riskScore >= 7 && ageDays >= graceDays) return 'quarantine_candidate';
  if (riskScore >= 4) return 'review';
  return 'keep';
};

const buildAudit = async (
  prisma: PrismaClient,
  options: CliOptions,
): Promise<AuditResult> => {
  const [
    users,
    orderCountRows,
    subscriptionCountRows,
    downloadCountRows,
    checkoutCountRows,
    productOrderCountRows,
    ftpAccountCountRows,
    ipCountRows,
    blockedEmailDomains,
    blockedPhoneNumbers,
  ] = await Promise.all([
    prisma.users.findMany({
      select: {
        id: true,
        role_id: true,
        email: true,
        phone: true,
        registered_on: true,
        ip_registro: true,
        blocked: true,
        verified: true,
        active: true,
      },
      orderBy: {
        id: 'asc',
      },
    }),
    prisma.$queryRaw<CountRow[]>`
      SELECT user_id AS id, COUNT(*) AS total FROM orders GROUP BY user_id
    `,
    prisma.$queryRaw<CountRow[]>`
      SELECT user_id AS id, COUNT(*) AS total FROM descargas_user GROUP BY user_id
    `,
    prisma.$queryRaw<CountRow[]>`
      SELECT userId AS id, COUNT(*) AS total FROM download_history GROUP BY userId
    `,
    prisma.$queryRaw<CountRow[]>`
      SELECT user_id AS id, COUNT(*) AS total FROM checkout_logs GROUP BY user_id
    `,
    prisma.$queryRaw<CountRow[]>`
      SELECT user_id AS id, COUNT(*) AS total FROM product_orders GROUP BY user_id
    `,
    prisma.$queryRaw<CountRow[]>`
      SELECT user_id AS id, COUNT(*) AS total FROM ftpuser WHERE user_id IS NOT NULL GROUP BY user_id
    `,
    prisma.$queryRaw<IpCountRow[]>`
      SELECT ip_registro AS ip, COUNT(*) AS total
      FROM users
      WHERE ip_registro IS NOT NULL AND ip_registro <> ''
      GROUP BY ip_registro
    `,
    getBlockedEmailDomains(prisma),
    getBlockedPhoneNumbers(prisma),
  ]);

  const orderCountMap = mapCountsById(orderCountRows);
  const subscriptionCountMap = mapCountsById(subscriptionCountRows);
  const downloadCountMap = mapCountsById(downloadCountRows);
  const checkoutCountMap = mapCountsById(checkoutCountRows);
  const productOrderCountMap = mapCountsById(productOrderCountRows);
  const ftpCountMap = mapCountsById(ftpAccountCountRows);
  const blockedEmailDomainSet = new Set(blockedEmailDomains);
  const blockedPhoneSet = new Set(blockedPhoneNumbers);
  const sharedIpMap = new Map<string, number>();

  for (const row of ipCountRows) {
    const ip = row.ip?.trim();
    if (!ip) continue;
    sharedIpMap.set(ip, toNumber(row.total));
  }

  const now = Date.now();
  const userRiskRows: UserRiskRecord[] = users.map((user) => {
    const emailDomain = normalizeEmailDomain(user.email) ?? '';
    const phoneNormalized = user.phone ? normalizePhoneNumber(user.phone) : null;
    const phoneIsValid = Boolean(user.phone && isValidPhoneNumber(user.phone));
    const ip = user.ip_registro?.trim() || null;
    const sharedIpCount = ip ? sharedIpMap.get(ip) ?? 0 : 0;
    const orderCount = orderCountMap.get(user.id) ?? 0;
    const subscriptionCount = subscriptionCountMap.get(user.id) ?? 0;
    const downloadCount = downloadCountMap.get(user.id) ?? 0;
    const checkoutLogCount = checkoutCountMap.get(user.id) ?? 0;
    const productOrderCount = productOrderCountMap.get(user.id) ?? 0;
    const ftpAccountCount = ftpCountMap.get(user.id) ?? 0;
    const hasBusinessSignals =
      orderCount > 0 || subscriptionCount > 0 || downloadCount > 0 || productOrderCount > 0;
    const registeredAt = new Date(user.registered_on);
    const ageDays = Math.max(
      0,
      Math.floor((now - registeredAt.getTime()) / (1000 * 60 * 60 * 24)),
    );

    let score = 0;
    const reasons: string[] = [];
    const isAdminRole = user.role_id != null && user.role_id !== RolesIds.normal;

    if (isAdminRole) {
      reasons.push('usuario protegido por rol administrativo/editor');
    }

    if (user.blocked) {
      score += 4;
      reasons.push('usuario ya bloqueado');
    }
    if (!user.verified) {
      score += 3;
      reasons.push('teléfono no verificado');
    }
    if (emailDomain && blockedEmailDomainSet.has(emailDomain)) {
      score += 3;
      reasons.push('dominio de email en blocklist');
    }
    if (
      emailDomain &&
      DISPOSABLE_DOMAIN_KEYWORDS.some((keyword) => emailDomain.includes(keyword))
    ) {
      score += 3;
      reasons.push('dominio de email temporal/sospechoso');
    }
    if (!user.phone || !phoneIsValid) {
      score += 2;
      reasons.push('teléfono faltante o formato inválido');
    }
    if (phoneNormalized && blockedPhoneSet.has(phoneNormalized)) {
      score += 2;
      reasons.push('teléfono en blocklist');
    }
    if (sharedIpCount >= options.ipThreshold) {
      score += 2;
      reasons.push(
        `IP con alta densidad (${sharedIpCount} cuentas desde la misma IP)`,
      );
    }
    if (!hasBusinessSignals && ageDays >= 30) {
      score += 2;
      reasons.push('sin actividad de negocio por más de 30 días');
    }
    if (!hasBusinessSignals && user.active === 0) {
      score += 1;
      reasons.push('cuenta inactiva y sin actividad');
    }

    if (hasBusinessSignals) {
      reasons.push('tiene señales de negocio (protegido)');
    }

    const riskTier = getRiskTier(score);
    const actionSuggestion = isAdminRole
      ? 'protect'
      : getActionSuggestion(hasBusinessSignals, score, ageDays, options.graceDays);
    const purgeCandidate =
      !isAdminRole &&
      user.blocked &&
      !hasBusinessSignals &&
      score >= options.riskThreshold &&
      ageDays >= options.purgeDays;

    return {
      id: user.id,
      email: user.email,
      phone: user.phone,
      roleId: user.role_id,
      registeredOn: registeredAt.toISOString(),
      ageDays,
      ip,
      sharedIpCount,
      verified: Boolean(user.verified),
      blocked: Boolean(user.blocked),
      active: user.active,
      orderCount,
      subscriptionCount,
      downloadCount,
      checkoutLogCount,
      productOrderCount,
      ftpAccountCount,
      hasBusinessSignals,
      riskScore: score,
      riskTier,
      reasons,
      actionSuggestion,
      purgeCandidate,
    };
  });

  const quarantineCandidates = userRiskRows.filter(
    (user) =>
      user.actionSuggestion === 'quarantine_candidate' &&
      !user.blocked &&
      user.riskScore >= options.riskThreshold,
  );
  const purgeCandidates = userRiskRows.filter((user) => user.purgeCandidate);
  const reviewUsers = userRiskRows.filter(
    (user) => user.actionSuggestion === 'review',
  );
  const keepUsers = userRiskRows.filter((user) => user.actionSuggestion === 'keep');
  const protectedUsers = userRiskRows.filter(
    (user) => user.actionSuggestion === 'protect',
  );
  const highRiskUsers = userRiskRows.filter((user) => user.riskTier === 'high');
  const mediumRiskUsers = userRiskRows.filter((user) => user.riskTier === 'medium');
  const lowRiskUsers = userRiskRows.filter((user) => user.riskTier === 'low');
  const topSharedIps = [...sharedIpMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([ip, usersWithIp]) => ({ ip, users: usersWithIp }));

  return {
    generatedAt: new Date().toISOString(),
    totalUsers: userRiskRows.length,
    summary: {
      protectedUsers: protectedUsers.length,
      keepUsers: keepUsers.length,
      reviewUsers: reviewUsers.length,
      quarantineCandidates: quarantineCandidates.length,
      purgeCandidates: purgeCandidates.length,
      highRisk: highRiskUsers.length,
      mediumRisk: mediumRiskUsers.length,
      lowRisk: lowRiskUsers.length,
    },
    settings: {
      graceDays: options.graceDays,
      purgeDays: options.purgeDays,
      riskThreshold: options.riskThreshold,
      ipThreshold: options.ipThreshold,
    },
    topSharedIps,
    candidates: {
      quarantine: quarantineCandidates.slice(0, options.limit),
      purge: purgeCandidates.slice(0, options.limit),
    },
    users: userRiskRows,
  };
};

const runBackup = async (prisma: PrismaClient, options: CliOptions) => {
  ensureDir(options.outDir);
  const stamp = nowStamp();
  const backupFile = path.join(options.outDir, `backup-${stamp}.sql.gz`);
  const fallbackFile = path.join(options.outDir, `backup-${stamp}.fallback.json.gz`);

  if (!options.jsonOnly && canUseMySqlDump()) {
    await runMySqlDumpBackup(backupFile);
    console.log(`✅ Respaldo SQL generado: ${backupFile}`);
    return;
  }

  await runFallbackSnapshotBackup(prisma, fallbackFile);
  console.log(`⚠️ Respaldo fallback generado: ${fallbackFile}`);
  console.log(
    '⚠️ Instala mysqldump para respaldo SQL completo antes de limpieza definitiva.',
  );
};

const runAudit = async (prisma: PrismaClient, options: CliOptions) => {
  ensureDir(options.outDir);
  const report = await buildAudit(prisma, options);
  const stamp = nowStamp();
  const reportPath = path.join(options.outDir, `audit-${stamp}.json`);
  writeJson(reportPath, report);

  console.log('✅ Auditoría completada.');
  console.log(`📄 Reporte: ${reportPath}`);
  console.log(
    `📊 Usuarios: ${report.totalUsers} | Cuarentena sugerida: ${report.summary.quarantineCandidates} | Purga sugerida: ${report.summary.purgeCandidates}`,
  );
};

const runQuarantine = async (prisma: PrismaClient, options: CliOptions) => {
  ensureDir(options.outDir);
  const audit = await buildAudit(prisma, options);
  const candidates = audit.users.filter(
    (user) =>
      user.actionSuggestion === 'quarantine_candidate' &&
      !user.blocked &&
      user.riskScore >= options.riskThreshold,
  );
  const stamp = nowStamp();
  const planPath = path.join(options.outDir, `quarantine-plan-${stamp}.json`);
  writeJson(planPath, {
    generatedAt: new Date().toISOString(),
    apply: options.apply,
    totalCandidates: candidates.length,
    candidates,
  });

  if (!options.apply) {
    console.log(`✅ Plan de cuarentena generado (dry-run): ${planPath}`);
    console.log(
      `🔎 Ejecuta con --apply para bloquear ${candidates.length} cuentas candidatas.`,
    );
    return;
  }

  if (candidates.length === 0) {
    console.log('✅ No hay candidatos para cuarentena con las reglas actuales.');
    return;
  }

  const userIds = candidates.map((user) => user.id);
  const beforeState = await prisma.users.findMany({
    where: { id: { in: userIds } },
    select: {
      id: true,
      email: true,
      blocked: true,
      active: true,
      refresh_token: true,
      verified: true,
      phone: true,
    },
  });

  const snapshotPath = path.join(options.outDir, `quarantine-before-${stamp}.json`);
  writeJson(snapshotPath, {
    generatedAt: new Date().toISOString(),
    users: beforeState,
  });

  await prisma.users.updateMany({
    where: { id: { in: userIds } },
    data: {
      blocked: true,
      active: 0,
      refresh_token: null,
    },
  });

  if (options.strengthenBlocklists) {
    const currentBlockedDomains = await getBlockedEmailDomains(prisma);
    const currentBlockedPhones = await getBlockedPhoneNumbers(prisma);
    const blockedDomainSet = new Set(currentBlockedDomains);
    const blockedPhoneSet = new Set(currentBlockedPhones);

    for (const user of candidates) {
      const domain = normalizeEmailDomain(user.email);
      if (
        domain &&
        !RESERVED_EMAIL_DOMAINS.includes(domain) &&
        DISPOSABLE_DOMAIN_KEYWORDS.some((keyword) => domain.includes(keyword))
      ) {
        blockedDomainSet.add(domain);
      }
      const normalizedPhone = user.phone ? normalizePhoneNumber(user.phone) : null;
      if (normalizedPhone) {
        blockedPhoneSet.add(normalizedPhone);
      }
    }

    await setBlockedEmailDomains(prisma, [...blockedDomainSet]);
    await setBlockedPhoneNumbers(prisma, [...blockedPhoneSet]);
  }

  console.log(`✅ Cuarentena aplicada a ${candidates.length} usuarios.`);
  console.log(`🧾 Snapshot previo: ${snapshotPath}`);
};

const runPurge = async (prisma: PrismaClient, options: CliOptions) => {
  ensureDir(options.outDir);
  const audit = await buildAudit(prisma, options);
  const candidates = audit.users.filter((user) => user.purgeCandidate);
  const stamp = nowStamp();
  const planPath = path.join(options.outDir, `purge-plan-${stamp}.json`);
  writeJson(planPath, {
    generatedAt: new Date().toISOString(),
    apply: options.apply,
    totalCandidates: candidates.length,
    candidates,
  });

  if (!options.apply) {
    console.log(`✅ Plan de purga generado (dry-run): ${planPath}`);
    console.log(
      `🔎 Ejecuta con --apply para borrar ${candidates.length} cuentas en cuarentena.`,
    );
    return;
  }

  if (candidates.length === 0) {
    console.log('✅ No hay usuarios elegibles para purga definitiva.');
    return;
  }

  const candidateIds = candidates.map((user) => user.id);
  const usersBeforePurge = await prisma.users.findMany({
    where: { id: { in: candidateIds } },
  });
  const snapshotPath = path.join(options.outDir, `purge-before-${stamp}.json.gz`);
  writeGzipJson(snapshotPath, {
    generatedAt: new Date().toISOString(),
    users: usersBeforePurge,
    candidates,
  });

  for (const chunk of chunkArray(candidateIds, 200)) {
    const chunkUsers = usersBeforePurge.filter((user) => chunk.includes(user.id));
    await prisma.$transaction([
      prisma.jobs.deleteMany({ where: { user_id: { in: chunk } } }),
      prisma.dir_downloads.deleteMany({ where: { userId: { in: chunk } } }),
      prisma.checkout_logs.deleteMany({ where: { user_id: { in: chunk } } }),
      prisma.product_orders.deleteMany({ where: { user_id: { in: chunk } } }),
      prisma.userFiles.deleteMany({ where: { user_id: { in: chunk } } }),
      prisma.cuponsUsed.deleteMany({ where: { user_id: { in: chunk } } }),
      prisma.descargasUser.deleteMany({ where: { user_id: { in: chunk } } }),
      prisma.ftpUser.deleteMany({ where: { user_id: { in: chunk } } }),
      prisma.orders.deleteMany({ where: { user_id: { in: chunk } } }),
      prisma.downloadHistory.deleteMany({ where: { userId: { in: chunk } } }),
      prisma.deletedUsers.createMany({
        data: chunkUsers.map((user) => ({
          email: user.email,
          deletionDate: new Date(),
          reactivated: false,
        })),
      }),
      prisma.users.deleteMany({ where: { id: { in: chunk } } }),
    ]);
  }

  console.log(`✅ Purga aplicada a ${candidates.length} usuarios.`);
  console.log(`🧾 Snapshot previo: ${snapshotPath}`);
};

const printUsage = () => {
  console.log(`
Uso:
  node -r ts-node/register scripts/dbHygiene.ts <comando> [opciones]

Comandos:
  backup       Genera respaldo previo a limpieza
  audit        Audita usuarios y crea reporte de riesgo
  quarantine   Bloquea candidatos de alto riesgo (requiere --apply)
  purge        Borra cuentas en cuarentena elegibles (requiere --apply)

Opciones:
  --apply                   Ejecuta cambios (sin esto es dry-run)
  --out-dir <ruta>          Carpeta de reportes/respaldos
  --limit <n>               Máximo de candidatos visibles en plan (default: 500)
  --grace-days <n>          Días mínimos para cuarentena (default: 14)
  --purge-days <n>          Días mínimos para purga (default: 60)
  --risk-threshold <n>      Score mínimo de riesgo (default: 7)
  --ip-threshold <n>        Umbral de cuentas por IP para señal (default: 10)
  --strengthen-blocklists   Agrega dominios/teléfonos sospechosos a blocklist al cuarentenar
  --json-only               Fuerza backup fallback JSON (sin mysqldump)
  --env-file <ruta>         Ruta específica de .env para cargar variables
  --database-url <url>      Sobrescribe DATABASE_URL solo para esta ejecución
`);
};

const main = async () => {
  const command = process.argv[2] as Command | '--help' | undefined;
  const args = process.argv.slice(3);

  if (!command || command === '--help') {
    printUsage();
    process.exit(0);
  }

  const options: CliOptions = {
    ...DEFAULT_OPTIONS,
    apply: hasFlag(args, '--apply'),
    outDir: parseStringOption(args, '--out-dir', DEFAULT_OPTIONS.outDir),
    limit: parseNumberOption(args, '--limit', DEFAULT_OPTIONS.limit),
    graceDays: parseNumberOption(args, '--grace-days', DEFAULT_OPTIONS.graceDays),
    purgeDays: parseNumberOption(args, '--purge-days', DEFAULT_OPTIONS.purgeDays),
    riskThreshold: parseNumberOption(
      args,
      '--risk-threshold',
      DEFAULT_OPTIONS.riskThreshold,
    ),
    ipThreshold: parseNumberOption(
      args,
      '--ip-threshold',
      DEFAULT_OPTIONS.ipThreshold,
    ),
    strengthenBlocklists: hasFlag(args, '--strengthen-blocklists'),
    jsonOnly: hasFlag(args, '--json-only'),
    envFile: parseStringOption(args, '--env-file', null),
    databaseUrl: parseStringOption(args, '--database-url', null),
  };

  loadEnvFiles(options.envFile);
  if (options.databaseUrl) {
    process.env.DATABASE_URL = options.databaseUrl;
  }
  if (!process.env.DATABASE_URL) {
    throw new Error(
      'DATABASE_URL no está definida. Usa --env-file <ruta> o --database-url <url>.',
    );
  }

  const prisma = new PrismaClient();

  try {
    switch (command) {
      case 'backup':
        await runBackup(prisma, options);
        break;
      case 'audit':
        await runAudit(prisma, options);
        break;
      case 'quarantine':
        await runQuarantine(prisma, options);
        break;
      case 'purge':
        await runPurge(prisma, options);
        break;
      default:
        printUsage();
        process.exit(1);
    }
  } finally {
    await prisma.$disconnect();
  }
};

main().catch((error) => {
  console.error('❌ Error en dbHygiene:', error instanceof Error ? error.message : error);
  process.exit(1);
});
