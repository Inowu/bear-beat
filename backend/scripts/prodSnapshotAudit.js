/* eslint-disable no-console */
/**
 * Audita un snapshot NDJSON.GZ generado por prodSnapshotExport.js y produce un reporte.
 *
 * Uso:
 *   node backend/scripts/prodSnapshotAudit.js <path-to-ndjson.gz>
 *
 * Si no se pasa path, intenta usar el snapshot mas reciente en backend/output/prod-snapshots/.
 *
 * Salida:
 *   backend/output/prod-snapshots/<same-stamp>.audit.json
 */

const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');
const readline = require('node:readline');

function isNonEmptyString(v) {
  return typeof v === 'string' && v.trim().length > 0;
}

function digitsOnly(v) {
  if (!isNonEmptyString(v)) return '';
  return v.replace(/[^\d]/g, '');
}

function safeDomain(email) {
  if (!isNonEmptyString(email)) return null;
  const at = email.lastIndexOf('@');
  if (at < 0) return null;
  return email.slice(at + 1).toLowerCase();
}

function topN(map, n) {
  return Array.from(map.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([key, count]) => ({ key, count }));
}

function latestSnapshotFile() {
  const dir = path.join(__dirname, '..', 'output', 'prod-snapshots');
  if (!fs.existsSync(dir)) return null;
  const files = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.ndjson.gz') && f.startsWith('prod-snapshot-'))
    .map((f) => path.join(dir, f))
    .sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);
  return files[0] || null;
}

async function main() {
  const inputFile = process.argv[2] ? path.resolve(process.argv[2]) : latestSnapshotFile();
  if (!inputFile) {
    throw new Error('No snapshot file found. Run prodSnapshotExport.js first.');
  }
  if (!fs.existsSync(inputFile)) {
    throw new Error(`Snapshot file not found: ${inputFile}`);
  }

  const outFile = inputFile.replace(/\.ndjson\.gz$/i, '.audit.json');
  console.log(`[audit] input: ${inputFile}`);
  console.log(`[audit] out:   ${outFile}`);

  const startedAt = new Date().toISOString();

  const tableCounts = new Map();

  const userStats = {
    total: 0,
    role_id: new Map(),
    active: new Map(),
    verified: new Map(),
    blocked: new Map(),
    emailDomains: new Map(),
    ip: new Map(),
    phone: {
      missing: 0,
      invalidLen: 0,
      repeated: 0,
      totalWithPhone: 0,
    },
    registeredOn: {
      min: null,
      max: null,
    },
    suspiciousUserIds: [],
  };

  const orderStats = {
    total: 0,
    status: new Map(),
    payment_method: new Map(),
    moneda: new Map(),
    total_price_sum: 0,
  };

  const dlStats = {
    total: 0,
    available_sum: 0,
    ilimitado_true: 0,
  };

  const ftpStats = {
    total: 0,
    withExpiration: 0,
  };

  const loginHistoryStats = {
    total: 0,
    protocols: new Map(),
    client_ip: new Map(),
  };

  const gunzip = zlib.createGunzip();
  const input = fs.createReadStream(inputFile);
  input.pipe(gunzip);

  const rl = readline.createInterface({ input: gunzip, crlfDelay: Infinity });

  for await (const line of rl) {
    if (!line.trim()) continue;
    let parsed;
    try {
      parsed = JSON.parse(line);
    } catch {
      continue;
    }

    const table = parsed.table;
    const row = parsed.row;
    if (!isNonEmptyString(table) || row == null) continue;

    tableCounts.set(table, (tableCounts.get(table) || 0) + 1);

    if (table === 'users') {
      userStats.total += 1;
      const role = row.role_id ?? null;
      userStats.role_id.set(String(role), (userStats.role_id.get(String(role)) || 0) + 1);
      userStats.active.set(String(row.active), (userStats.active.get(String(row.active)) || 0) + 1);
      userStats.verified.set(String(row.verified), (userStats.verified.get(String(row.verified)) || 0) + 1);
      userStats.blocked.set(String(row.blocked), (userStats.blocked.get(String(row.blocked)) || 0) + 1);

      const dom = safeDomain(row.email);
      if (dom) userStats.emailDomains.set(dom, (userStats.emailDomains.get(dom) || 0) + 1);

      const ip = isNonEmptyString(row.ip_registro) ? row.ip_registro.trim() : null;
      if (ip) userStats.ip.set(ip, (userStats.ip.get(ip) || 0) + 1);

      const reg = row.registered_on ? String(row.registered_on) : null;
      if (reg) {
        if (!userStats.registeredOn.min || reg < userStats.registeredOn.min) userStats.registeredOn.min = reg;
        if (!userStats.registeredOn.max || reg > userStats.registeredOn.max) userStats.registeredOn.max = reg;
      }

      const phoneDigits = digitsOnly(row.phone);
      if (!phoneDigits) {
        userStats.phone.missing += 1;
      } else {
        userStats.phone.totalWithPhone += 1;
        // E.164: 7..15 (aprox). Para MX sin country code suele ser 10. Mantenemos heuristica amplia.
        if (phoneDigits.length < 7 || phoneDigits.length > 15) userStats.phone.invalidLen += 1;
        if (/^(\d)\1+$/.test(phoneDigits)) userStats.phone.repeated += 1;
      }

      // Heuristica "soft" de bots (para revisar, NO auto-borra):
      // - sin phone
      // - o phone con longitud invalida/repetido
      // - o ip compartida por demasiados usuarios (se evalua al final)
      if (!phoneDigits || phoneDigits.length < 7 || phoneDigits.length > 15 || /^(\d)\1+$/.test(phoneDigits)) {
        userStats.suspiciousUserIds.push(row.id);
      }
    } else if (table === 'orders') {
      orderStats.total += 1;
      orderStats.status.set(String(row.status), (orderStats.status.get(String(row.status)) || 0) + 1);
      const pm = isNonEmptyString(row.payment_method) ? row.payment_method : 'null';
      orderStats.payment_method.set(pm, (orderStats.payment_method.get(pm) || 0) + 1);
      const moneda = isNonEmptyString(row?.plans?.moneda) ? row.plans.moneda : null;
      if (moneda) orderStats.moneda.set(moneda, (orderStats.moneda.get(moneda) || 0) + 1);
      const tp = Number(row.total_price);
      if (Number.isFinite(tp)) orderStats.total_price_sum += tp;
    } else if (table === 'descargasuser') {
      dlStats.total += 1;
      const avail = Number(row.available);
      if (Number.isFinite(avail)) dlStats.available_sum += avail;
      if (Number(row.ilimitado) === 1) dlStats.ilimitado_true += 1;
    } else if (table === 'ftpuser') {
      ftpStats.total += 1;
      if (row.expiration) ftpStats.withExpiration += 1;
    } else if (table === 'loginhistory') {
      loginHistoryStats.total += 1;
      const proto = isNonEmptyString(row.protocol) ? row.protocol : 'null';
      loginHistoryStats.protocols.set(proto, (loginHistoryStats.protocols.get(proto) || 0) + 1);
      const cip = isNonEmptyString(row.client_ip) ? row.client_ip : 'null';
      loginHistoryStats.client_ip.set(cip, (loginHistoryStats.client_ip.get(cip) || 0) + 1);
    }
  }

  // Refinar: top IPs con mas usuarios.
  const topIps = topN(userStats.ip, 20);
  const ipSuspicious = new Set(topIps.filter((x) => x.count >= 25).map((x) => x.key));

  // Mark user IDs from heavy-IP as suspicious? (We don't have row->ip mapping stored to avoid memory).
  // We only report the IPs; accion manual recomendada.

  const finishedAt = new Date().toISOString();
  const report = {
    startedAt,
    finishedAt,
    inputFile,
    tables: topN(tableCounts, 50),
    users: {
      total: userStats.total,
      role_id: topN(userStats.role_id, 10),
      active: topN(userStats.active, 10),
      verified: topN(userStats.verified, 10),
      blocked: topN(userStats.blocked, 10),
      emailDomainsTop: topN(userStats.emailDomains, 25),
      ipTop: topIps,
      ipLikelyBots: Array.from(ipSuspicious),
      phone: userStats.phone,
      registeredOn: userStats.registeredOn,
      suspiciousUserIdsCount: userStats.suspiciousUserIds.length,
    },
    orders: {
      total: orderStats.total,
      status: topN(orderStats.status, 25),
      payment_method: topN(orderStats.payment_method, 25),
      total_price_sum: Number(orderStats.total_price_sum.toFixed(2)),
    },
    descargasuser: dlStats,
    ftpuser: ftpStats,
    loginhistory: {
      total: loginHistoryStats.total,
      protocols: topN(loginHistoryStats.protocols, 25),
      client_ip_top: topN(loginHistoryStats.client_ip, 10),
    },
    notes: [
      'Este reporte es diagnostico. No borra ni bloquea nada.',
      'Para limpieza segura: generar reglas + revisar una muestra antes de aplicar purge en produccion.',
    ],
  };

  fs.writeFileSync(outFile, JSON.stringify(report, null, 2), { mode: 0o600 });
  console.log('[audit] done');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

