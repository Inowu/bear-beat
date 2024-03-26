const fs = require('fs');
const { Worker } = require('bullmq');
const { addDays } = require('date-fns');
const path = require('path');
const pm2 = require('pm2');
const archiver = require('archiver');
const fastFolderSize = require('fast-folder-size/sync');
const { log } = require('./log');
const { sendEvent } = require('./send-event');
const { PrismaClient } = require('@prisma/client');
const { JobStatus } = require('./job-status');

const prisma = new PrismaClient({
  log: ['error'],
});

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
      zlib: { level: 5 },
    });

    log.info(
      `[COMPRESSION:START] Compressing ${songsAbsolutePath} to ${dirName}`,
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
