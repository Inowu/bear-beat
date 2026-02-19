import nodePath from 'path';
import { statSync, existsSync, promises as fs } from 'fs';
import fastFolderSizeSync from 'fast-folder-size/sync';
import { IFileService } from './interfaces/fileService.interface';

type CachedDirectorySize = {
  size: number;
  mtimeMs: number;
  expiresAt: number;
};

const LOCAL_DIR_SIZE_CACHE_TTL_MS = Number(
  process.env.LOCAL_DIR_SIZE_CACHE_TTL_MS ?? 3 * 60 * 1000,
);
const LOCAL_DIR_SIZE_CACHE_MAX_ENTRIES = Number(
  process.env.LOCAL_DIR_SIZE_CACHE_MAX_ENTRIES ?? 4_000,
);
const directorySizeCache = new Map<string, CachedDirectorySize>();

const sanitizePositiveInt = (value: number, fallback: number): number => {
  if (!Number.isFinite(value) || value <= 0) return fallback;
  return Math.floor(value);
};

const pruneDirectorySizeCache = (nowMs: number): void => {
  const maxEntries = sanitizePositiveInt(LOCAL_DIR_SIZE_CACHE_MAX_ENTRIES, 4_000);
  if (directorySizeCache.size <= maxEntries) {
    return;
  }

  for (const [dirPath, cached] of directorySizeCache.entries()) {
    if (cached.expiresAt <= nowMs) {
      directorySizeCache.delete(dirPath);
    }
    if (directorySizeCache.size <= maxEntries) {
      return;
    }
  }

  const overflow = directorySizeCache.size - maxEntries;
  if (overflow <= 0) return;

  let removed = 0;
  for (const dirPath of directorySizeCache.keys()) {
    directorySizeCache.delete(dirPath);
    removed += 1;
    if (removed >= overflow) {
      break;
    }
  }
};

const resolveDirectorySize = (
  dirPath: string,
  mtimeMs: number,
  fallbackSize: number,
): number => {
  const nowMs = Date.now();
  const ttlMs = sanitizePositiveInt(LOCAL_DIR_SIZE_CACHE_TTL_MS, 3 * 60 * 1000);
  const cached = directorySizeCache.get(dirPath);
  if (cached && cached.mtimeMs === mtimeMs && cached.expiresAt > nowMs) {
    return cached.size;
  }

  let size = fallbackSize;
  try {
    const computed = fastFolderSizeSync(dirPath);
    if (typeof computed === 'number' && Number.isFinite(computed) && computed >= 0) {
      size = computed;
    }
  } catch {
    size = fallbackSize;
  }

  directorySizeCache.set(dirPath, {
    size,
    mtimeMs,
    expiresAt: nowMs + ttlMs,
  });
  pruneDirectorySizeCache(nowMs);

  return size;
};

export class LocalFileService implements IFileService {
  init() {
    return Promise.resolve();
  }

  get(path: string) {
    return fs.readFile(path);
  }

  exists(path: string): Promise<boolean> {
    return Promise.resolve(existsSync(path));
  }

  stat(path: string) {
    return fs.stat(path);
  }

  async list(path: string) {
    const files = await fs.readdir(path);

    return files
      .filter((file) => !file.startsWith('.'))
      .map((file) => {
        const filePath = nodePath.join(path, file);
        const stat = statSync(filePath);
        const type = stat.isFile() ? ('-' as const) : ('d' as const);
        const mtimeMs = stat.mtime.getTime();

        return {
          name: file,
          type,
          modification: mtimeMs,
          size:
            type === 'd'
              ? resolveDirectorySize(filePath, mtimeMs, stat.size)
              : stat.size,
        };
      });
  }

  end(): Promise<any> {
    return Promise.resolve();
  }
}
