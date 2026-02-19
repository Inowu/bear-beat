import fs from 'fs/promises';
import type { PrismaClient } from '@prisma/client';
import { log } from '../server';
import { normalizeDownloadHistoryFileName } from './downloadHistoryRollup';

const CURSOR_CONFIG_NAME = 'ftp_transfer_log_sync_cursor_v1';
const DEFAULT_MAX_BYTES_PER_RUN = 512 * 1024;
const DEFAULT_MIN_INTERVAL_MS = 15_000;
const DEFAULT_DISCOVERY_CACHE_MS = 60_000;
const DOWNLOAD_DIRECTION = 'o';
const COMPLETED_STATUS = 'c';
const DEFAULT_TRANSFER_LOG_CANDIDATES = [
  '/var/log/xferlog',
  '/var/log/proftpd/xferlog',
  '/var/log/proftpd/xferlog.log',
];

type CursorState = {
  path: string;
  offset: number;
  inode?: number;
  device?: number;
};

type CursorConfigRecord = {
  id: number;
  value: string;
};

type ParsedFtpTransferLine = {
  username: string;
  rawPath: string;
  size: bigint;
  date: Date;
};

type TransferRow = {
  userId: number;
  fileName: string;
  size: bigint;
  date: Date;
};

let syncInFlight: Promise<void> | null = null;
let lastSyncAttemptAt = 0;
let hasWarnedMissingLogFile = false;
let discoveredTransferLogPath = '';
let discoveryCachedAt = 0;

const toPositiveInt = (value: string | undefined, fallback: number): number => {
  if (!value) return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return fallback;
  }
  return Math.floor(parsed);
};

const getConfiguredTransferLogPath = (): string =>
  `${process.env.FTP_TRANSFER_LOG_PATH ?? process.env.FTP_XFERLOG_PATH ?? ''}`.trim();

const isSyncEnabled = (): boolean => process.env.FTP_TRANSFER_LOG_SYNC_ENABLED !== '0';

const resolveTransferLogPath = async (): Promise<string> => {
  const configuredPath = getConfiguredTransferLogPath();
  if (configuredPath) {
    return configuredPath;
  }

  const cacheMs = toPositiveInt(
    process.env.FTP_TRANSFER_LOG_SYNC_DISCOVERY_CACHE_MS,
    DEFAULT_DISCOVERY_CACHE_MS,
  );
  const now = Date.now();
  if (now - discoveryCachedAt < cacheMs) {
    return discoveredTransferLogPath;
  }

  discoveryCachedAt = now;
  for (const candidate of DEFAULT_TRANSFER_LOG_CANDIDATES) {
    try {
      await fs.access(candidate);
      discoveredTransferLogPath = candidate;
      return candidate;
    } catch {
      // Try next candidate.
    }
  }

  discoveredTransferLogPath = '';
  return '';
};

const getBootstrapMode = (): 'start' | 'end' =>
  process.env.FTP_TRANSFER_LOG_SYNC_BOOTSTRAP === 'start' ? 'start' : 'end';

const normalizeSongsRoot = (value: string): string => {
  const normalized = `${value ?? ''}`.trim().replace(/\\/g, '/').replace(/\/{2,}/g, '/');
  if (!normalized) return '';
  const withLeadingSlash = normalized.startsWith('/') ? normalized : `/${normalized}`;
  if (withLeadingSlash !== '/' && withLeadingSlash.endsWith('/')) {
    return withLeadingSlash.slice(0, -1);
  }
  return withLeadingSlash;
};

const parseCursorState = (rawValue: string | null | undefined): CursorState | null => {
  if (!rawValue) return null;
  try {
    const parsed = JSON.parse(rawValue) as Partial<CursorState>;
    if (!parsed || typeof parsed !== 'object') return null;
    if (typeof parsed.path !== 'string') return null;
    if (typeof parsed.offset !== 'number' || !Number.isFinite(parsed.offset)) return null;

    return {
      path: parsed.path,
      offset: Math.max(0, Math.floor(parsed.offset)),
      inode: typeof parsed.inode === 'number' ? parsed.inode : undefined,
      device: typeof parsed.device === 'number' ? parsed.device : undefined,
    };
  } catch {
    return null;
  }
};

const getCursorConfig = async (
  prisma: PrismaClient,
): Promise<CursorConfigRecord | null> => {
  const record = await prisma.config.findFirst({
    where: {
      name: CURSOR_CONFIG_NAME,
    },
    select: {
      id: true,
      value: true,
    },
  });

  if (!record) return null;
  return record;
};

const saveCursorState = async (
  prisma: PrismaClient,
  recordId: number | null,
  state: CursorState,
): Promise<void> => {
  const payload = JSON.stringify(state);
  if (recordId != null) {
    await prisma.config.update({
      where: { id: recordId },
      data: { value: payload },
    });
    return;
  }

  await prisma.config.create({
    data: {
      name: CURSOR_CONFIG_NAME,
      value: payload,
    },
  });
};

const parseFtpTransferLine = (line: string): ParsedFtpTransferLine | null => {
  const trimmed = line.trim();
  if (!trimmed) return null;

  const tokens = trimmed.split(/\s+/);
  // xferlog has: 5 date tokens + transfer-time + remote-host + size + filename + 9 trailing fields.
  if (tokens.length < 18) return null;

  const fileTokensEnd = tokens.length - 9;
  if (fileTokensEnd <= 8) return null;

  const direction = `${tokens[tokens.length - 7] ?? ''}`.toLowerCase();
  if (direction !== DOWNLOAD_DIRECTION) return null;

  const completion = `${tokens[tokens.length - 1] ?? ''}`.toLowerCase();
  if (completion !== COMPLETED_STATUS) return null;

  const username = `${tokens[tokens.length - 5] ?? ''}`.trim();
  if (!username || username === '-') return null;

  const sizeToken = `${tokens[7] ?? ''}`;
  if (!/^\d+$/.test(sizeToken)) return null;
  const size = BigInt(sizeToken);
  if (size <= BigInt(0)) return null;

  const rawPath = tokens.slice(8, fileTokensEnd).join(' ').trim();
  if (!rawPath) return null;

  const parsedDate = new Date(tokens.slice(0, 5).join(' '));
  const date = Number.isNaN(parsedDate.getTime()) ? new Date() : parsedDate;

  return {
    username,
    rawPath,
    size,
    date,
  };
};

const normalizeTransferFileName = (rawPath: string, songsRoot: string): string | null => {
  const normalizedPath = rawPath.trim().replace(/\\/g, '/').replace(/\/{2,}/g, '/');
  if (!normalizedPath) return null;

  const normalizedRoot = normalizeSongsRoot(songsRoot);
  let candidate = normalizedPath;
  if (normalizedRoot) {
    if (candidate === normalizedRoot) return null;
    if (candidate.startsWith(`${normalizedRoot}/`)) {
      candidate = candidate.slice(normalizedRoot.length + 1);
    }
  }

  candidate = candidate.replace(/^\/+/, '');
  const normalized = normalizeDownloadHistoryFileName(candidate);
  if (!normalized) return null;
  if (
    normalized.includes('/../')
    || normalized.startsWith('../')
    || normalized.includes('/..')
    || normalized.endsWith('/..')
  ) {
    return null;
  }
  return normalized;
};

const readNewChunk = async (
  file: fs.FileHandle,
  offset: number,
  size: number,
  maxBytes: number,
): Promise<{ text: string; consumedBytes: number }> => {
  if (offset >= size || maxBytes <= 0) {
    return { text: '', consumedBytes: 0 };
  }

  const remaining = size - offset;
  const readLength = Math.min(remaining, maxBytes);
  const buffer = Buffer.alloc(readLength);
  const { bytesRead } = await file.read(buffer, 0, readLength, offset);
  if (bytesRead <= 0) {
    return { text: '', consumedBytes: 0 };
  }

  const chunk = buffer.toString('utf8', 0, bytesRead);
  const lastNewline = chunk.lastIndexOf('\n');
  if (lastNewline === -1) {
    if (offset + bytesRead >= size) {
      return {
        text: chunk,
        consumedBytes: bytesRead,
      };
    }
    return {
      text: '',
      consumedBytes: 0,
    };
  }

  const completeChunk = chunk.slice(0, lastNewline + 1);
  return {
    text: completeChunk,
    consumedBytes: Buffer.byteLength(completeChunk, 'utf8'),
  };
};

const buildTransferRows = async (
  prisma: PrismaClient,
  lines: ParsedFtpTransferLine[],
): Promise<TransferRow[]> => {
  const usernames = Array.from(
    new Set(lines.map((line) => line.username).filter((value) => Boolean(value))),
  );
  if (!usernames.length) return [];

  const ftpUsers = await prisma.ftpUser.findMany({
    where: {
      userid: {
        in: usernames,
      },
      user_id: {
        not: null,
      },
    },
    select: {
      userid: true,
      user_id: true,
    },
  });

  const userByFtpUsername = new Map<string, number>();
  ftpUsers.forEach((row) => {
    if (typeof row.user_id === 'number') {
      userByFtpUsername.set(row.userid, row.user_id);
    }
  });

  return lines.reduce<TransferRow[]>((acc, line) => {
    const userId = userByFtpUsername.get(line.username);
    if (!userId) return acc;
    acc.push({
      userId,
      fileName: line.rawPath,
      size: line.size,
      date: line.date,
    });
    return acc;
  }, []);
};

const runSync = async (prisma: PrismaClient): Promise<void> => {
  const transferLogPath = await resolveTransferLogPath();
  if (!transferLogPath) {
    if (!hasWarnedMissingLogFile) {
      hasWarnedMissingLogFile = true;
      log.warn('[FTP_TRANSFER_SYNC] No transfer log path configured or discovered.');
    }
    return;
  }

  const maxBytes = toPositiveInt(
    process.env.FTP_TRANSFER_LOG_SYNC_MAX_BYTES_PER_RUN,
    DEFAULT_MAX_BYTES_PER_RUN,
  );
  const bootstrapMode = getBootstrapMode();
  const songsRoot = `${process.env.SONGS_PATH ?? ''}`;

  const cursorConfig = await getCursorConfig(prisma);
  const persistedState = parseCursorState(cursorConfig?.value);

  let file: fs.FileHandle | null = null;
  try {
    file = await fs.open(transferLogPath, 'r');
  } catch (error: any) {
    if (!hasWarnedMissingLogFile) {
      hasWarnedMissingLogFile = true;
      log.warn(
        `[FTP_TRANSFER_SYNC] Transfer log not available: ${error?.code ?? 'unknown'}`,
      );
    }
    return;
  }

  hasWarnedMissingLogFile = false;
  try {
    const stat = await file.stat();
    const inode = Number.isFinite(stat.ino) ? stat.ino : undefined;
    const device = Number.isFinite(stat.dev) ? stat.dev : undefined;

    let offset = persistedState?.offset ?? 0;
    let shouldSkipRead = false;

    const stateChangedPath = !persistedState || persistedState.path !== transferLogPath;
    const rotatedByInode =
      Boolean(persistedState?.inode)
      && Boolean(inode)
      && persistedState?.inode !== inode;
    const rotatedByDevice =
      Boolean(persistedState?.device)
      && Boolean(device)
      && persistedState?.device !== device;
    const truncated = stat.size < offset;

    if (stateChangedPath) {
      offset = bootstrapMode === 'start' ? 0 : stat.size;
      shouldSkipRead = bootstrapMode === 'end';
    } else if (rotatedByInode || rotatedByDevice || truncated) {
      offset = 0;
    }

    const { text, consumedBytes } = await readNewChunk(file, offset, stat.size, maxBytes);
    const lines = text
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    const parsedTransfers: ParsedFtpTransferLine[] = [];
    lines.forEach((line) => {
      const parsed = parseFtpTransferLine(line);
      if (!parsed) return;

      const normalizedFileName = normalizeTransferFileName(parsed.rawPath, songsRoot);
      if (!normalizedFileName) return;

      parsedTransfers.push({
        ...parsed,
        rawPath: normalizedFileName,
      });
    });

    const transferRows = shouldSkipRead ? [] : await buildTransferRows(prisma, parsedTransfers);
    if (transferRows.length > 0) {
      await prisma.downloadHistory.createMany({
        data: transferRows.map((row) => ({
          userId: row.userId,
          size: row.size,
          date: row.date,
          fileName: row.fileName,
          isFolder: false,
        })),
      });
    }

    const nextOffset = shouldSkipRead ? offset : offset + consumedBytes;
    const safeOffset = Math.max(0, Math.min(nextOffset, stat.size));
    await saveCursorState(prisma, cursorConfig?.id ?? null, {
      path: transferLogPath,
      offset: safeOffset,
      inode,
      device,
    });
  } finally {
    await file.close();
  }
};

export const syncFtpTransferDownloadsBestEffort = async (
  prisma: PrismaClient,
): Promise<void> => {
  if (!isSyncEnabled()) return;

  const minIntervalMs = toPositiveInt(
    process.env.FTP_TRANSFER_LOG_SYNC_MIN_INTERVAL_MS,
    DEFAULT_MIN_INTERVAL_MS,
  );
  const now = Date.now();

  if (syncInFlight) {
    await syncInFlight;
    return;
  }

  if (now - lastSyncAttemptAt < minIntervalMs) {
    return;
  }

  lastSyncAttemptAt = now;
  syncInFlight = runSync(prisma)
    .catch((error: any) => {
      log.warn(
        `[FTP_TRANSFER_SYNC] Sync failed: ${error?.message ?? 'unknown error'}`,
      );
    })
    .finally(() => {
      syncInFlight = null;
    });

  await syncInFlight;
};
