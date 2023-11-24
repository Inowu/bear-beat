const fs = require('fs');
const path = require('path');
const archiver = require('archiver');
const fastFolderSize = require('fast-folder-size/sync');

module.exports = async function (job) {
  const { songsAbsolutePath, songsRelativePath, userId } = job.data;
  console.log(job.data);

  const dirName = `${songsRelativePath}-${userId}-${job.id}.zip`;

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

  archive.directory(songsAbsolutePath, false);

  archive.pipe(output);

  await archive.finalize();
};
