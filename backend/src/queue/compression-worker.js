const fs = require('fs');
const path = require('path');
const archiver = require('archiver');
const fastFolderSize = require('fast-folder-size/sync');

module.exports = async function (job) {
  const { songsAbsolutePath, songsRelativePath, userId } = job.data;

  const dirName = `${songsRelativePath.slice(1)}-${userId}-${
    job.id
  }.zip`.replace(/\//g, '_');

  const archive = archiver('zip');

  const zippedDirPath = path.resolve(
    __dirname,
    `../../${process.env.COMPRESSED_DIRS_NAME}/${dirName}`,
  );

  const output = fs.createWriteStream(zippedDirPath);

  const size = fastFolderSize(songsAbsolutePath);

  archive.on('progress', (progress) => {
    job.updateProgress(
      Math.min((progress.fs.processedBytes / size) * 100, 100.0),
    );
  });

  archive.on('error', (error) => {
    log.error(
      `[COMPRESSION:ERROR] Error while zipping ${songsAbsolutePath}: ${error.message}, code: ${error.code}, ${error.data}`,
    );

    throw error;
  });

  archive.directory(songsAbsolutePath, false);

  archive.pipe(output);

  await archive.finalize();
};
