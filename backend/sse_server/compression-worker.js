const fs = require('fs');
const { Worker } = require('bullmq');
const { addDays } = require('date-fns');
const path = require('path');
const pm2 = require('pm2');
const archiver = require('archiver');
const fastFolderSize = require('fast-folder-size/sync');
const crypto = require('crypto');
const { log } = require('./log');
const { sendEvent } = require('./send-event');
const { PrismaClient } = require('@prisma/client');
const { JobStatus } = require('./job-status');

const prisma = new PrismaClient({
  log: ['error'],
});

const parsedZipCompressionLevel = Number(process.env.ZIP_COMPRESSION_LEVEL);
const zipCompressionLevel =
  Number.isInteger(parsedZipCompressionLevel) &&
  parsedZipCompressionLevel >= 0 &&
  parsedZipCompressionLevel <= 9
    ? parsedZipCompressionLevel
    : 1;

const DEFAULT_HOT_TTL_DAYS = 90;
const DEFAULT_WARM_TTL_DAYS = 14;
const DEFAULT_PREWARM_TOP_WINDOW_DAYS = 30;
const DEFAULT_PREWARM_NEW_WINDOW_DAYS = 180;
const SHARED_ARTIFACTS_DIRNAME = 'shared';

const parsePositiveInt = (value, fallback) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.floor(parsed);
};

const getZipArtifactConfig = () => ({
  hotTtlDays: parsePositiveInt(
    process.env.ZIP_ARTIFACT_HOT_TTL_DAYS,
    DEFAULT_HOT_TTL_DAYS,
  ),
  warmTtlDays: parsePositiveInt(
    process.env.ZIP_ARTIFACT_WARM_TTL_DAYS,
    DEFAULT_WARM_TTL_DAYS,
  ),
  prewarmTopWindowDays: parsePositiveInt(
    process.env.ZIP_PREWARM_TOP_WINDOW_DAYS,
    DEFAULT_PREWARM_TOP_WINDOW_DAYS,
  ),
  prewarmNewWindowDays: parsePositiveInt(
    process.env.ZIP_PREWARM_NEW_WINDOW_DAYS,
    DEFAULT_PREWARM_NEW_WINDOW_DAYS,
  ),
});

const normalizeCatalogFolderPath = (value) => {
  const raw = `${value || ''}`.trim().replace(/\\/g, '/');
  const noDupSlashes = raw.replace(/\/{2,}/g, '/');
  const noLeading = noDupSlashes.replace(/^\/+/, '');
  const normalized = `/${noLeading}`;
  if (normalized === '/') return normalized;
  return normalized.replace(/\/+$/, '');
};

const stripLeadingSlash = (value) =>
  normalizeCatalogFolderPath(value).replace(/^\/+/, '');

const toBigIntBytes = (value) => {
  if (typeof value === 'bigint') return value >= BigInt(0) ? value : BigInt(0);
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return BigInt(0);
  return BigInt(Math.max(0, Math.floor(parsed)));
};

const getCompressedDirsRoot = () => {
  const configured = `${process.env.COMPRESSED_DIRS_NAME || ''}`.trim();
  const relative = configured || 'compressed_dirs';
  return path.isAbsolute(relative) ? relative : path.resolve(process.cwd(), relative);
};

const getSharedArtifactsRoot = () =>
  path.resolve(getCompressedDirsRoot(), SHARED_ARTIFACTS_DIRNAME);

const resolveSharedZipArtifactPath = (zipName) => {
  const trimmed = `${zipName || ''}`.trim();
  if (!trimmed || trimmed.includes('/') || trimmed.includes('\\')) return null;
  return path.resolve(getSharedArtifactsRoot(), trimmed);
};

const buildZipArtifactVersionKey = ({
  folderPathNormalized,
  sourceSizeBytes,
  dirMtimeMs,
}) => {
  const normalized = normalizeCatalogFolderPath(folderPathNormalized);
  const sourceSize = toBigIntBytes(sourceSizeBytes);
  const mtime = Number.isFinite(dirMtimeMs) ? Math.floor(dirMtimeMs) : 0;
  const fingerprint = `${normalized}|${sourceSize.toString()}|${mtime}`;
  return crypto.createHash('sha256').update(fingerprint).digest('hex');
};

const buildZipArtifactZipName = (folderPathNormalized, versionKey) => {
  const normalized = normalizeCatalogFolderPath(folderPathNormalized);
  const baseSegment = path.posix.basename(normalized) || 'folder';
  const safeBase = baseSegment
    .normalize('NFKD')
    .replace(/[^\x20-\x7E]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120);
  const safeVersion = `${versionKey || ''}`
    .trim()
    .replace(/[^a-zA-Z0-9]/g, '')
    .slice(0, 24);
  const prefix = safeBase || 'folder';
  const suffix = safeVersion || 'version';
  return `${prefix}-${suffix}.zip`;
};

const getArtifactExpiresAt = (tier) => {
  const config = getZipArtifactConfig();
  const ttlDays = tier === 'hot' ? config.hotTtlDays : config.warmTtlDays;
  return addDays(new Date(), ttlDays);
};

const saveArtifactRow = async ({
  folderPathNormalized,
  versionKey,
  zipName,
  sourceSizeBytes,
  zipSizeBytes,
  tier,
  status,
  lastError,
}) => {
  const now = new Date();
  const expiresAt = getArtifactExpiresAt(tier);
  const existing = await prisma.compressed_dir_artifacts.findFirst({
    where: {
      folder_path_normalized: folderPathNormalized,
      version_key: versionKey,
    },
  });

  const data = {
    zip_name: zipName,
    source_size_bytes: toBigIntBytes(sourceSizeBytes),
    zip_size_bytes: toBigIntBytes(zipSizeBytes),
    tier,
    status,
    expires_at: expiresAt,
    last_error: lastError ? `${lastError}`.slice(0, 2048) : null,
    ...(status === 'ready' ? { last_accessed_at: now } : {}),
  };

  if (existing) {
    return prisma.compressed_dir_artifacts.update({
      where: { id: existing.id },
      data,
    });
  }

  try {
    return await prisma.compressed_dir_artifacts.create({
      data: {
        folder_path_normalized: folderPathNormalized,
        version_key: versionKey,
        hit_count: BigInt(0),
        last_accessed_at: now,
        ...data,
      },
    });
  } catch (error) {
    const afterConflict = await prisma.compressed_dir_artifacts.findFirst({
      where: {
        folder_path_normalized: folderPathNormalized,
        version_key: versionKey,
      },
    });
    if (!afterConflict) throw error;
    return prisma.compressed_dir_artifacts.update({
      where: { id: afterConflict.id },
      data,
    });
  }
};

const resolveArtifactTier = async (folderPathNormalized) => {
  const config = getZipArtifactConfig();
  const now = Date.now();
  const topStart = new Date(now - config.prewarmTopWindowDays * 24 * 60 * 60 * 1000);
  const newStart = new Date(now - config.prewarmNewWindowDays * 24 * 60 * 60 * 1000);
  const withoutLeading = stripLeadingSlash(folderPathNormalized);
  const folderVariants = [withoutLeading, normalizeCatalogFolderPath(folderPathNormalized)].filter(
    Boolean,
  );

  const topCount = await prisma.downloadHistory.count({
    where: {
      isFolder: true,
      date: { gte: topStart },
      fileName: { in: folderVariants },
    },
  });
  if (topCount > 0) return 'hot';

  const prefixes = [`${withoutLeading}/`, `/${withoutLeading}/`].filter(Boolean);
  if (prefixes.length === 0) return 'warm';
  const recent = await prisma.trackMetadata.findFirst({
    where: {
      updatedAt: { gte: newStart },
      OR: prefixes.map((prefix) => ({
        path: {
          startsWith: prefix,
        },
      })),
    },
    select: { id: true },
  });

  return recent ? 'hot' : 'warm';
};

const linkOrCopyFile = async (sourcePath, targetPath) => {
  try {
    await fs.promises.link(sourcePath, targetPath);
    return;
  } catch (error) {
    const recoverable = new Set(['EXDEV', 'EEXIST', 'EPERM', 'EMLINK']);
    if (!recoverable.has(`${error?.code || ''}`)) {
      throw error;
    }
  }
  await fs.promises.copyFile(sourcePath, targetPath);
};

const publishSharedZipArtifact = async ({ sourceZipPath, zipName }) => {
  const targetZipPath = resolveSharedZipArtifactPath(zipName);
  if (!targetZipPath) throw new Error('invalid_shared_zip_target');

  await fs.promises.mkdir(getSharedArtifactsRoot(), { recursive: true });
  const tempPath = `${targetZipPath}.tmp-${process.pid}-${Date.now()}`;
  try {
    await fs.promises.rm(tempPath, { force: true });
    await linkOrCopyFile(sourceZipPath, tempPath);
    await fs.promises.rm(targetZipPath, { force: true });
    await fs.promises.rename(tempPath, targetZipPath);
  } catch (error) {
    await fs.promises.rm(tempPath, { force: true }).catch(() => {});
    throw error;
  }

  return targetZipPath;
};

const registerSharedArtifactFromJob = async (job) => {
  const folderPathNormalized = normalizeCatalogFolderPath(
    job?.data?.folderPathNormalized || job?.data?.songsRelativePath || '',
  );
  const userZipName = `${path.basename(job.data.songsRelativePath)}-${
    job.data.userId
  }-${job.id}.zip`;
  const sourceZipPath = path.resolve(
    __dirname,
    `../${process.env.COMPRESSED_DIRS_NAME}/${userZipName}`,
  );

  if (!fs.existsSync(sourceZipPath)) {
    return;
  }

  const sourceSizeBytes = Number(job?.data?.dirSize || 0) || fastFolderSize(job.data.songsAbsolutePath);
  const sourceDirMtimeMs =
    Number(job?.data?.sourceDirMtimeMs || 0) || fs.statSync(job.data.songsAbsolutePath).mtimeMs;
  const versionKey =
    `${job?.data?.sourceDirVersionKey || ''}`.trim() ||
    buildZipArtifactVersionKey({
      folderPathNormalized,
      sourceSizeBytes,
      dirMtimeMs: sourceDirMtimeMs,
    });
  const zipName = buildZipArtifactZipName(folderPathNormalized, versionKey);
  const tier = await resolveArtifactTier(folderPathNormalized);

  await saveArtifactRow({
    folderPathNormalized,
    versionKey,
    zipName,
    sourceSizeBytes,
    zipSizeBytes: BigInt(0),
    tier,
    status: 'building',
    lastError: null,
  });

  try {
    const sharedZipPath = await publishSharedZipArtifact({
      sourceZipPath,
      zipName,
    });
    const zipStats = fs.statSync(sharedZipPath);
    await saveArtifactRow({
      folderPathNormalized,
      versionKey,
      zipName,
      sourceSizeBytes,
      zipSizeBytes: zipStats.size,
      tier,
      status: 'ready',
      lastError: null,
    });
  } catch (error) {
    await saveArtifactRow({
      folderPathNormalized,
      versionKey,
      zipName,
      sourceSizeBytes,
      zipSizeBytes: BigInt(0),
      tier,
      status: 'failed',
      lastError: error?.message || error,
    });
    throw error;
  }
};

const compressionWorker = new Worker(
  process.env.COMPRESSION_QUEUE_NAME,
  // Spawn a new process for each job
  // DOES NOT WORK WITH PM2
  // `${__dirname}/compression-worker.js`,
  async function (job) {
    const { songsAbsolutePath, songsRelativePath } = job.data;

    const dirName = `${path.basename(songsRelativePath)}-${job.data.userId}-${
      job.id
    }.zip`;

    const archive = archiver('zip', {
      zlib: { level: zipCompressionLevel },
    });

    log.info(
      `[COMPRESSION:START] Compressing ${songsAbsolutePath} to ${dirName} (zip level=${zipCompressionLevel})`,
    );

    const zippedDirPath = path.resolve(
      __dirname,
      `../${process.env.COMPRESSED_DIRS_NAME}/${dirName}`,
    );

    const output = fs.createWriteStream(zippedDirPath);

    const size = fastFolderSize(songsAbsolutePath);

    if (!size) {
      throw new Error('Could not calculate directory size');
    }

    archive.on('warning', function (err) {
      if (err.code === 'ENOENT') {
        log.info(`[COMPRESSION:WARNING] ${err}`);
      } else {
        log.info(`[COMPRESSION:ERROR] ${err}`);
      }
    });

    output.on('end', function () {
      log.info('[COMPRESSION:END] Data has been drained');
    });

    output.on('close', function () {
      log.info(
        `[COMPRESSION:CLOSE] Archiver has been finalized and the output file descriptor has closed. ${archive.pointer()} total bytes`,
      );
    });

    // archive.on('entry', (entry) => {
    //   log.info(`[COMPRESSION:DATA] Entry: ${entry.name}`);
    // });

    archive.pipe(output);
    archive.directory(songsAbsolutePath, false);

    archive.on('error', (error) => {
      log.info(
        `[COMPRESSION:ERROR] Error while zipping ${songsAbsolutePath}: ${error.message}, code: ${error.code}, ${error.data}`,
      );

      throw error;
    });

    archive.on('finish', () => {
      log.info(`[COMPRESSION:FINISH] Finished zipping ${songsAbsolutePath}`);
    });

    archive.on('progress', (progress) => {
      job.updateProgress(
        Math.min((progress.fs.processedBytes / size) * 100, 100.0),
      );
    });

    await archive.finalize();
  },
  {
    lockDuration: 1000 * 60 * 60 * 24, // 24 hours
    useWorkerThreads: true,
    removeOnComplete: {
      count: 0,
    },
    removeOnFail: {
      count: 0,
    },
    connection: {
      host: process.env.REDIS_HOST,
      port: parseInt(process.env.REDIS_PORT, 10),
    },
    concurrency: 1,
  },
);

compressionWorker.on('active', (job) => {
  process.on('SIGINT', async () => {
    try {
      log.info('[WORKER:COMPRESSION] Closing Worker');
      await compressionWorker.close(true);
    } catch (e) {
      log.error(
        `[WORKER:COMPRESSION:FAILED] Could not remove job ${job.id}. Error: ${e.message}`,
      );
    } finally {
      process.exit(0);
    }
  });
});

compressionWorker.on('paused', () => {
  log.info('[WORKER:COMPRESSION] Worker paused');
});

compressionWorker.on('completed', async (job) => {
  log.info(`[WORKER:COMPRESSION:COMPLETED] Job ${job.id} completed`);
  // Save the download URL in the database in case the user wants to download it later
  const dirName = encodeURIComponent(
    `${path.basename(job.data.songsRelativePath)}-${job.data.userId}-${job.id}`,
  );
  const downloadUrl = `${process.env.BACKEND_URL}/download-dir?dirName=${dirName}.zip&jobId=${job.id}`;

  try {
    const dirDownload = await prisma.dir_downloads.update({
      where: {
        id: job.data.dirDownloadId,
      },
      data: {
        // Note: The client has to append the token to the URL. &token=<token>
        downloadUrl,
        // The URL is valid for 24 hours
        expirationDate: addDays(new Date(), 1),
      },
    });

    const dbJob = await prisma.jobs.findFirst({
      where: {
        id: dirDownload.jobId,
      },
    });

    if (!dbJob) {
      log.error(
        `[WORKER:COMPRESSION:COMPLETED] Job ${job.id} not found in the database`,
      );
      return;
    }

    await prisma.jobs.update({
      where: {
        id: dbJob.id,
      },
      data: {
        status: JobStatus.COMPLETED,
        finishedAt: new Date(),
      },
    });
  } catch (e) {
    log.error(
      `[WORKER:COMPRESSION:COMPLETED] Error updating job status: ${e.message}`,
    );
  }

  try {
    await registerSharedArtifactFromJob(job);
  } catch (error) {
    log.warn(
      `[WORKER:COMPRESSION:COMPLETED] Error publishing shared artifact for job ${job.id}: ${error?.message || error}`,
    );
  }

  await sendEvent(`${process.env.BACKEND_SSE_URL}/send-event`, {
    jobId: job.id,
    url: downloadUrl,
    eventName: `compression:completed:${job.data.userId}`,
  });

  pm2.delete(`compress-${job.data.userId}-${job.id}`, (err) => {
    if (err) {
      log.error(
        `[WORKER:COMPRESSION:COMPLETED] Could not delete process ${err.message}`,
      );
    }
  });
});

compressionWorker.on('failed', async (job, error) => {
  log.error(
    `[WORKER:COMPRESSION:FAILED] Job ${job?.id}, error: ${error.message}`,
  );

  if (job?.id) {
    try {
      const dirDownload = await prisma.dir_downloads.findFirst({
        where: {
          id: job.data.dirDownloadId,
        },
      });

      if (!dirDownload) {
        log.error(
          `[WORKER:COMPRESSION:FAILED] Could not find dir download for job ${job?.id}`,
        );
        return;
      }

      await prisma.jobs.update({
        where: {
          id: dirDownload.jobId,
        },
        data: {
          status: JobStatus.FAILED,
          finishedAt: new Date(),
        },
      });
    } catch (e) {
      log.error(
        `[WORKER:COMPRESSION:FAILED] Error updating job status: ${e.message}`,
      );
    }

    const currentTallies = await prisma.ftpquotatallies.findFirst({
      where: {
        id: job?.data.ftpTalliesId,
      },
    });

    if (currentTallies) {
      log.info(
        `[WORKER:COMPRESSION:FAILED] Updating tallies back for user ${job.data.userId} after failed job ${job?.id}`,
      );

      await prisma.ftpquotatallies.update({
        where: {
          id: job?.data.ftpTalliesId,
        },
        data: {
          bytes_out_used:
            currentTallies.bytes_out_used - BigInt(job?.data.dirSize) < 0
              ? 0
              : currentTallies.bytes_out_used - BigInt(job?.data.dirSize),
        },
      });
    } else {
      log.warn(
        `[WORKER:COMPRESSION:FAILED] Could not find tallies for job ${job?.id}, job: ${job?.data}`,
      );
    }
  }

  await sendEvent(`${process.env.BACKEND_SSE_URL}/send-event`, {
    jobId: job.id,
    eventName: `compression:failed:${job.data.userId}`,
  });

  pm2.delete(`compress-${job.data.userId}-${job.id}`, (err) => {
    if (err) {
      log.error(
        `[WORKER:COMPRESSION:COMPLETED] Could not delete process ${err.message}`,
      );
    }
  });
});

compressionWorker.on('stalled', (job) => {
  log.warn(`[WORKER:COMPRESSION] Job ${job} stalled`);
});

compressionWorker.on('error', (error) => {
  log.error(`[WORKER:COMPRESSION] Error: ${error}`);
});

compressionWorker.on('progress', async (job) => {
  const progress = Math.round(job.progress);

  if (progress % 5 !== 0 || progress === 0) return;

  await sendEvent(`${process.env.BACKEND_SSE_URL}/send-event`, {
    jobId: job.id,
    eventName: `compression:progress:${job.data.userId}`,
    progress,
  });
});
