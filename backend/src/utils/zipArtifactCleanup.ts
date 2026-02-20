import fs from 'fs';
import type { PrismaClient } from '@prisma/client';
import {
  getSharedArtifactsRoot,
  getZipArtifactConfig,
  resolveSharedZipArtifactPath,
  withDbNamedLock,
} from './zipArtifact.service';

export type ZipArtifactCleanupSweepResult = {
  lockAcquired: boolean;
  expiredRows: number;
  expiredDeletedRows: number;
  expiredDeletedFiles: number;
  expiredMissingFiles: number;
  expiredErrors: number;
  evictedRows: number;
  evictedFiles: number;
  evictionErrors: number;
  diskBudgetBytes: bigint;
  diskUsedBytes: bigint;
};

const CLEANUP_LOCK_NAME = 'zip_artifact_cleanup_v1';
const DISK_FRACTION_PPM_SCALE = BigInt(1_000_000);

const toBigIntBytes = (value: unknown): bigint => {
  if (typeof value === 'bigint') return value;
  if (typeof value === 'number' && Number.isFinite(value)) {
    return BigInt(Math.max(0, Math.floor(value)));
  }
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return BigInt(Math.max(0, Math.floor(parsed)));
    }
  }
  return BigInt(0);
};

const calculateDiskBudgetBytes = (): bigint => {
  const fraction = getZipArtifactConfig().diskFraction;
  const fractionPpm = BigInt(
    Math.max(0, Math.min(1_000_000, Math.floor(fraction * 1_000_000))),
  );

  try {
    fs.mkdirSync(getSharedArtifactsRoot(), { recursive: true });
    const stats = fs.statfsSync(getSharedArtifactsRoot(), {
      bigint: true,
    } as unknown as fs.StatFsOptions);
    const blockSize = toBigIntBytes((stats as any).bsize);
    const blocks = toBigIntBytes((stats as any).blocks);
    if (blockSize <= 0 || blocks <= 0) return BigInt(0);
    return (blockSize * blocks * fractionPpm) / DISK_FRACTION_PPM_SCALE;
  } catch {
    return BigInt(0);
  }
};

const removeArtifactFile = (
  zipName: string,
): { removed: boolean; missing: boolean; failed: boolean } => {
  const zipPath = resolveSharedZipArtifactPath(zipName);
  if (!zipPath) {
    return { removed: false, missing: true, failed: false };
  }

  try {
    fs.unlinkSync(zipPath);
    return { removed: true, missing: false, failed: false };
  } catch (error: any) {
    if (`${error?.code ?? ''}` === 'ENOENT') {
      return { removed: false, missing: true, failed: false };
    }
    return { removed: false, missing: false, failed: true };
  }
};

const removeExpiredArtifacts = async (
  prisma: PrismaClient,
): Promise<Omit<ZipArtifactCleanupSweepResult, 'lockAcquired' | 'evictedRows' | 'evictedFiles' | 'evictionErrors' | 'diskBudgetBytes' | 'diskUsedBytes'>> => {
  const now = new Date();
  const expiredArtifacts = await prisma.compressed_dir_artifacts.findMany({
    where: {
      status: {
        in: ['ready', 'failed'],
      },
      expires_at: {
        lte: now,
      },
    },
    orderBy: {
      expires_at: 'asc',
    },
    take: 1000,
    select: {
      id: true,
      zip_name: true,
    },
  });

  if (expiredArtifacts.length === 0) {
    return {
      expiredRows: 0,
      expiredDeletedRows: 0,
      expiredDeletedFiles: 0,
      expiredMissingFiles: 0,
      expiredErrors: 0,
    };
  }

  let expiredDeletedRows = 0;
  let expiredDeletedFiles = 0;
  let expiredMissingFiles = 0;
  let expiredErrors = 0;

  for (const artifact of expiredArtifacts) {
    const fileResult = removeArtifactFile(artifact.zip_name);
    if (fileResult.removed) expiredDeletedFiles += 1;
    if (fileResult.missing) expiredMissingFiles += 1;
    if (fileResult.failed) {
      expiredErrors += 1;
      continue;
    }

    try {
      await prisma.compressed_dir_artifacts.delete({
        where: {
          id: artifact.id,
        },
      });
      expiredDeletedRows += 1;
    } catch {
      // noop
    }
  }

  return {
    expiredRows: expiredArtifacts.length,
    expiredDeletedRows,
    expiredDeletedFiles,
    expiredMissingFiles,
    expiredErrors,
  };
};

const evictTierByLru = async (
  prisma: PrismaClient,
  tier: 'warm' | 'hot',
  state: {
    diskUsedBytes: bigint;
    diskBudgetBytes: bigint;
    evictedRows: number;
    evictedFiles: number;
    evictionErrors: number;
  },
): Promise<void> => {
  while (
    state.diskBudgetBytes > BigInt(0) &&
    state.diskUsedBytes > state.diskBudgetBytes
  ) {
    const candidates = await prisma.compressed_dir_artifacts.findMany({
      where: {
        status: 'ready',
        tier,
      },
      orderBy: [
        {
          last_accessed_at: 'asc',
        },
        {
          id: 'asc',
        },
      ],
      take: 100,
      select: {
        id: true,
        zip_name: true,
        zip_size_bytes: true,
      },
    });

    if (candidates.length === 0) {
      return;
    }

    for (const candidate of candidates) {
      if (state.diskUsedBytes <= state.diskBudgetBytes) {
        return;
      }

      const fileResult = removeArtifactFile(candidate.zip_name);
      if (fileResult.failed) {
        state.evictionErrors += 1;
        continue;
      }

      if (fileResult.removed || fileResult.missing) {
        try {
          await prisma.compressed_dir_artifacts.delete({
            where: {
              id: candidate.id,
            },
          });
          state.evictedRows += 1;
          if (fileResult.removed) {
            state.evictedFiles += 1;
          }
          state.diskUsedBytes -= toBigIntBytes(candidate.zip_size_bytes);
          if (state.diskUsedBytes < BigInt(0)) {
            state.diskUsedBytes = BigInt(0);
          }
        } catch {
          // noop
        }
      }
    }
  }
};

export const runZipArtifactCleanupSweep = async (
  prisma: PrismaClient,
): Promise<ZipArtifactCleanupSweepResult> => {
  const emptyResult: ZipArtifactCleanupSweepResult = {
    lockAcquired: false,
    expiredRows: 0,
    expiredDeletedRows: 0,
    expiredDeletedFiles: 0,
    expiredMissingFiles: 0,
    expiredErrors: 0,
    evictedRows: 0,
    evictedFiles: 0,
    evictionErrors: 0,
    diskBudgetBytes: BigInt(0),
    diskUsedBytes: BigInt(0),
  };

  const lock = await withDbNamedLock(prisma, CLEANUP_LOCK_NAME, async () => {
    const expired = await removeExpiredArtifacts(prisma);

    const aggregate = await prisma.compressed_dir_artifacts.aggregate({
      where: {
        status: 'ready',
      },
      _sum: {
        zip_size_bytes: true,
      },
    });

    const state = {
      diskUsedBytes: toBigIntBytes(aggregate._sum.zip_size_bytes),
      diskBudgetBytes: calculateDiskBudgetBytes(),
      evictedRows: 0,
      evictedFiles: 0,
      evictionErrors: 0,
    };

    await evictTierByLru(prisma, 'warm', state);
    await evictTierByLru(prisma, 'hot', state);

    return {
      lockAcquired: true,
      ...expired,
      evictedRows: state.evictedRows,
      evictedFiles: state.evictedFiles,
      evictionErrors: state.evictionErrors,
      diskBudgetBytes: state.diskBudgetBytes,
      diskUsedBytes: state.diskUsedBytes,
    };
  });

  if (!lock.acquired || !lock.result) {
    return emptyResult;
  }

  return lock.result;
};

