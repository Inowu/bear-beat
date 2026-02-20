import { Job, Worker } from 'bullmq';
import { addDays } from 'date-fns';
import path from 'path';
import fs from 'fs';
import archiver from 'archiver';
import fastFolderSize from 'fast-folder-size/sync';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { log } = require('./log');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { prisma } = require('./db');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { JobStatus } = require('./job-status');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { sse } = require('./');
import {
  buildZipArtifactVersionKey,
  buildZipArtifactZipName,
  markZipArtifactBuilding,
  markZipArtifactFailed,
  normalizeCatalogFolderPath,
  publishSharedZipArtifactFile,
  resolveZipArtifactTier,
  upsertZipArtifactReady,
} from '../src/utils/zipArtifact.service';

export const MAX_CONCURRENT_DOWNLOADS = 25;
const DEFAULT_BACKEND_URL = 'https://thebearbeatapi.lat';
const parsedZipCompressionLevel = Number(process.env.ZIP_COMPRESSION_LEVEL);
const ZIP_COMPRESSION_LEVEL =
  Number.isInteger(parsedZipCompressionLevel) &&
  parsedZipCompressionLevel >= 0 &&
  parsedZipCompressionLevel <= 9
    ? parsedZipCompressionLevel
    : 1;

const publishSharedArtifactFromJob = async (job: Job): Promise<void> => {
  const folderPathNormalized = normalizeCatalogFolderPath(
    `${job?.data?.folderPathNormalized ?? job?.data?.songsRelativePath ?? ''}`,
  );
  const sourceZipName = `${path.basename(job.data.songsRelativePath)}-${
    job.data.userId
  }-${job.id}.zip`;
  const sourceZipPath = path.resolve(
    __dirname,
    `../${process.env.COMPRESSED_DIRS_NAME}/${sourceZipName}`,
  );

  if (!fs.existsSync(sourceZipPath)) {
    return;
  }

  const sourceSizeBytes =
    Number(job?.data?.dirSize ?? 0) ||
    Number(fastFolderSize(job.data.songsAbsolutePath) ?? 0);
  const sourceDirMtimeMs =
    Number(job?.data?.sourceDirMtimeMs ?? 0) ||
    fs.statSync(job.data.songsAbsolutePath).mtimeMs;
  const versionKey =
    `${job?.data?.sourceDirVersionKey ?? ''}`.trim() ||
    buildZipArtifactVersionKey({
      folderPathNormalized,
      sourceSizeBytes,
      dirMtimeMs: sourceDirMtimeMs,
    });
  const zipName = buildZipArtifactZipName(folderPathNormalized, versionKey);
  const tier = await resolveZipArtifactTier(prisma as any, folderPathNormalized);

  await markZipArtifactBuilding(prisma as any, {
    folderPathNormalized,
    versionKey,
    zipName,
    sourceSizeBytes,
    tier,
  });

  try {
    const sharedZipPath = await publishSharedZipArtifactFile({
      sourceZipPath,
      targetZipName: zipName,
    });
    const zipStats = fs.statSync(sharedZipPath);

    await upsertZipArtifactReady(prisma as any, {
      folderPathNormalized,
      versionKey,
      zipName,
      zipSizeBytes: zipStats.size,
      sourceSizeBytes,
      tier,
    });
  } catch (error: any) {
    await markZipArtifactFailed(prisma as any, {
      folderPathNormalized,
      versionKey,
      zipName,
      sourceSizeBytes,
      tier,
      error: `${error?.message ?? error}`,
    });
    throw error;
  }
};

export const createCompressionWorker = () => {
  const lastProgressByJob = new Map<string, number>();
  const compressionWorker = new Worker(
    process.env.COMPRESSION_QUEUE_NAME as string,
    // Spawn a new process for each job
    // DOES NOT WORK WITH PM2
    // `${__dirname}/compression-worker.js`,
    async function (job) {
      const { songsAbsolutePath, songsRelativePath } = job.data;

      const dirName = `${path.basename(songsRelativePath)}-${job.data.userId}-${
        job.id
      }.zip`;

      const archive = archiver('zip', {
        zlib: { level: ZIP_COMPRESSION_LEVEL },
      });

      log.info(
        `[COMPRESSION:START] Compressing ${songsAbsolutePath} to ${dirName} (zip level=${ZIP_COMPRESSION_LEVEL})`,
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
    // compression,
    {
      lockDuration: 1000 * 60 * 60 * 10,
      useWorkerThreads: true,
      removeOnComplete: {
        count: 0,
      },
      removeOnFail: {
        count: 0,
      },
      connection: {
        host: process.env.REDIS_HOST,
        port: parseInt(process.env.REDIS_PORT as string, 10),
      },
      concurrency: MAX_CONCURRENT_DOWNLOADS,
    },
  );

  compressionWorker.on('paused', () => {
    log.info('[WORKER:COMPRESSION] Worker paused');
  });

  compressionWorker.on('completed', async (job: Job) => {
    log.info(`[WORKER:COMPRESSION:COMPLETED] Job ${job.id} completed`);
    // Save the download URL in the database in case the user wants to download it later
    const dirName = encodeURIComponent(
      `${path.basename(job.data.songsRelativePath)}-${job.data.userId}-${
        job.id
      }`,
    );
    const backendUrl =
      `${process.env.BACKEND_URL ?? ''}`.trim() || DEFAULT_BACKEND_URL;
    const downloadUrl = `${backendUrl}/download-dir?dirName=${dirName}.zip&jobId=${job.id}`;

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
          id: dirDownload.jobId!,
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
        `[WORKER:COMPRESSION:COMPLETED] Error updating job status: ${
          (e as Error).message
        }`,
      );
    }

    try {
      await publishSharedArtifactFromJob(job);
    } catch (error: any) {
      log.warn(
        `[WORKER:COMPRESSION:COMPLETED] Error publishing shared artifact for job ${job.id}: ${error?.message ?? error}`,
      );
    }

    sse.send(
      JSON.stringify({
        jobId: job.id,
        url: downloadUrl,
      }),
      `compression:completed:${job.data.userId}`,
    );

    lastProgressByJob.delete(`${job.id}`);
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
            id: dirDownload.jobId!,
          },
          data: {
            status: JobStatus.FAILED,
            finishedAt: new Date(),
          },
        });
      } catch (e: unknown) {
        log.error(
          `[WORKER:COMPRESSION:FAILED] Error updating job status: ${
            (e as Error).message
          }`,
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

    sse.send(
      JSON.stringify({
        jobId: job?.id,
      }),
      `compression:failed:${job?.data.userId}`,
    );

    lastProgressByJob.delete(`${job?.id ?? ''}`);
  });

  compressionWorker.on('stalled', (job) => {
    log.warn(`[WORKER:COMPRESSION] Job ${job} stalled`);
  });

  compressionWorker.on('error', (error) => {
    log.error(`[WORKER:COMPRESSION] Error: ${error}`);
  });

  compressionWorker.on('progress', (job) => {
    const progress = Math.round(job.progress as number);

    if (progress <= 0) return;
    const progressKey = `${job.id}`;
    const previousProgress = Number(lastProgressByJob.get(progressKey) || 0);
    if (progress <= previousProgress) return;
    lastProgressByJob.set(progressKey, progress);

    sse.send(
      JSON.stringify({
        progress,
        jobId: job.id,
      }),
      `compression:progress:${job.data.userId}`,
    );
  });

  return compressionWorker;
};
