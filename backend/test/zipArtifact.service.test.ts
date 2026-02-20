import {
  buildZipArtifactVersionKey,
  normalizeCatalogFolderPath,
  resolveZipArtifactTier,
  touchZipArtifactAccess,
} from '../src/utils/zipArtifact.service';

describe('zipArtifact.service', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('normalizes folder paths and generates deterministic version keys', () => {
    const normalized = normalizeCatalogFolderPath('Audios\\\\Salsa///Coleccion/');
    expect(normalized).toBe('/Audios/Salsa/Coleccion');

    const first = buildZipArtifactVersionKey({
      folderPathNormalized: normalized,
      sourceSizeBytes: 123456,
      dirMtimeMs: 1730000000123,
    });
    const second = buildZipArtifactVersionKey({
      folderPathNormalized: '/Audios/Salsa/Coleccion',
      sourceSizeBytes: 123456,
      dirMtimeMs: 1730000000123,
    });
    const changed = buildZipArtifactVersionKey({
      folderPathNormalized: '/Audios/Salsa/Coleccion',
      sourceSizeBytes: 123457,
      dirMtimeMs: 1730000000123,
    });

    expect(first).toBe(second);
    expect(changed).not.toBe(first);
  });

  it('resolves hot tier from top downloads or recent metadata and warm otherwise', async () => {
    const prismaFromTop = {
      downloadHistory: { count: jest.fn().mockResolvedValue(4) },
      trackMetadata: { findFirst: jest.fn() },
    } as any;
    await expect(
      resolveZipArtifactTier(prismaFromTop, '/Audios/Salsa'),
    ).resolves.toBe('hot');

    const prismaFromRecent = {
      downloadHistory: { count: jest.fn().mockResolvedValue(0) },
      trackMetadata: { findFirst: jest.fn().mockResolvedValue({ id: 10 }) },
    } as any;
    await expect(
      resolveZipArtifactTier(prismaFromRecent, '/Audios/Salsa'),
    ).resolves.toBe('hot');

    const prismaWarm = {
      downloadHistory: { count: jest.fn().mockResolvedValue(0) },
      trackMetadata: { findFirst: jest.fn().mockResolvedValue(null) },
    } as any;
    await expect(
      resolveZipArtifactTier(prismaWarm, '/Audios/Salsa'),
    ).resolves.toBe('warm');
  });

  it('touchZipArtifactAccess applies sliding TTL and increments hit_count', async () => {
    process.env.ZIP_ARTIFACT_HOT_TTL_DAYS = '90';
    const now = Date.now();
    const findUnique = jest.fn().mockResolvedValue({
      id: 77,
      tier: 'hot',
    });
    const update = jest.fn().mockImplementation(({ data }) => data);
    const prisma = {
      compressed_dir_artifacts: {
        findUnique,
        update,
      },
    } as any;

    const updated = await touchZipArtifactAccess(prisma, 77);
    expect(updated).toBeTruthy();
    expect(update).toHaveBeenCalledTimes(1);

    const updateArgs = update.mock.calls[0][0];
    expect(updateArgs.data.hit_count.increment).toBe(BigInt(1));
    const expiresAt = new Date(updateArgs.data.expires_at).getTime();
    const expectedMin = now + 89 * 24 * 60 * 60 * 1000;
    expect(expiresAt).toBeGreaterThan(expectedMin);
  });
});

