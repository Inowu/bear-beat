const fs = require('fs');
const path = require('path');
const archiver = require('archiver');
const fastFolderSize = require('fast-folder-size/sync');

module.exports = async function (job) {
  const { songsAbsolutePath, songsRelativePath } = job.data;

  const dirName = `${songsRelativePath}-${job.data.userId}-${job.id}.zip`;

  const archive = archiver('zip', {
    zlib: { level: 9 },
  });

  console.log(
    `[COMPRESSION:START] Compressing ${songsAbsolutePath} to ${dirName}`,
  );

  const zippedDirPath = path.resolve(
    __dirname,
    `../../../${process.env.COMPRESSED_DIRS_NAME}/${dirName}`,
  );

  const output = fs.createWriteStream(zippedDirPath);

  const size = fastFolderSize(songsAbsolutePath);

  archive.on('warning', function (err) {
    if (err.code === 'ENOENT') {
      console.log(`[COMPRESSION:WARNING] ${err}`);
    } else {
      console.log(`[COMPRESSION:ERROR] ${err}`);
    }
  });

  output.on('end', function () {
    console.log('[COMPRESSION:END] Data has been drained');
  });

  output.on('close', function () {
    console.log(
      `[COMPRESSION:CLOSE] Archiver has been finalized and the output file descriptor has closed. ${archive.pointer()} total bytes`,
    );
  });

  // archive.on('entry', (entry) => {
  //   console.log(`[COMPRESSION:DATA] Entry: ${entry.name}`);
  // });

  archive.pipe(output);
  archive.directory(songsAbsolutePath, false);

  archive.on('error', (error) => {
    console.log(
      `[COMPRESSION:ERROR] Error while zipping ${songsAbsolutePath}: ${error.message}, code: ${error.code}, ${error.data}`,
    );

    throw error;
  });

  archive.on('finish', () => {
    console.log(`[COMPRESSION:FINISH] Finished zipping ${songsAbsolutePath}`);
  });

  archive.on('progress', (progress) => {
    job.updateProgress(
      Math.min((progress.fs.processedBytes / size) * 100, 100.0),
    );
  });

  await archive.finalize();
};
