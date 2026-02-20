import fs from 'fs';

jest.mock('../src/utils/zipArtifact.service', () => ({
  getSharedArtifactsRoot: jest.fn(() => '/tmp/compressed/shared'),
  getZipArtifactConfig: jest.fn(() => ({
    diskFraction: 0.25,
  })),
  resolveSharedZipArtifactPath: jest.fn((zipName: string) => `/tmp/compressed/shared/${zipName}`),
  withDbNamedLock: jest.fn(async (_prisma: unknown, _lock: string, task: () => Promise<unknown>) => ({
    acquired: true,
    result: await task(),
  })),
}));

import { runZipArtifactCleanupSweep } from '../src/utils/zipArtifactCleanup';

describe('zipArtifactCleanup', () => {
  afterEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });

  it('evicts warm artifacts before hot artifacts using LRU order', async () => {
    jest.spyOn(fs, 'mkdirSync').mockImplementation(() => undefined as any);
    jest.spyOn(fs, 'statfsSync').mockReturnValue({
      bsize: BigInt(1),
      blocks: BigInt(1000),
    } as any);
    jest.spyOn(fs, 'unlinkSync').mockImplementation(() => undefined as any);

    const deletedOrder: number[] = [];
    const findMany = jest
      .fn()
      // Expired artifacts query
      .mockResolvedValueOnce([])
      // Warm tier eviction batch 1
      .mockResolvedValueOnce([
        {
          id: 1,
          zip_name: 'warm-old.zip',
          zip_size_bytes: BigInt(200),
        },
        {
          id: 2,
          zip_name: 'warm-new.zip',
          zip_size_bytes: BigInt(100),
        },
      ])
      // Warm tier eviction batch 2 (empty -> stop warm)
      .mockResolvedValueOnce([])
      // Hot tier eviction batch 1
      .mockResolvedValueOnce([
        {
          id: 3,
          zip_name: 'hot-old.zip',
          zip_size_bytes: BigInt(200),
        },
      ]);

    const prisma = {
      compressed_dir_artifacts: {
        findMany,
        aggregate: jest.fn().mockResolvedValue({
          _sum: { zip_size_bytes: BigInt(700) },
        }),
        delete: jest.fn().mockImplementation(async ({ where }: any) => {
          deletedOrder.push(where.id);
          return { id: where.id };
        }),
      },
    } as any;

    const result = await runZipArtifactCleanupSweep(prisma);

    expect(result.lockAcquired).toBe(true);
    expect(result.evictedRows).toBe(3);
    expect(deletedOrder).toEqual([1, 2, 3]);
    expect(findMany.mock.calls[1][0].where.tier).toBe('warm');
    expect(findMany.mock.calls[3][0].where.tier).toBe('hot');
  });
});

