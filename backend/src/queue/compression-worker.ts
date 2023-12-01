import fs from 'fs';
import path from 'path';
import archiver from 'archiver';
import { Job } from 'bullmq';
import fastFolderSize from 'fast-folder-size/sync';
import { CompressionJob } from './compression-job';

export default async function (job: Job<CompressionJob>) {
  const { songsAbsolutePath, songsRelativePath } = job.data;

  const dirName = `${songsRelativePath}-${job.data.userId}-${job.id}.zip`;

  const archive = archiver('zip');

  const zippedDirPath = path.resolve(
    __dirname,
    `../../${process.env.COMPRESSED_DIRS_NAME}/${dirName}`,
  );

  const output = fs.createWriteStream(zippedDirPath);

  const size = fastFolderSize(songsAbsolutePath)!;

  archive.on('progress', (progress) => {
    job.updateProgress(
      Math.min((progress.fs.processedBytes / size) * 100, 100.0),
    );
  });

  archive.directory(songsAbsolutePath, false);

  archive.pipe(output);

  await archive.finalize();
}
