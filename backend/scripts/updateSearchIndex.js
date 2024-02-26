const { MeiliSearch } = require('meilisearch');
const fastFolderSizeSync = require('fast-folder-size/sync');
const fs = require('fs');
const path = require('path');
const { v4: uuid } = require('uuid');
const { config } = require('dotenv');

config();

const fileIndexName = 'FILE_INDEX';

async function main() {
  const meiliSearch = new MeiliSearch({
    host: process.env.MEILISEARCH_HOST,
    apiKey: process.env.MEILISEARCH_KEY,
  });

  console.log(`[UPDATE_INDEX] Updating index ${fileIndexName}`);

  const index = await meiliSearch.getIndex(fileIndexName);

  const fileIndex = createFlatFileIndex(process.env.SONGS_PATH);

  const fileMap = new Map();

  for (const file of fileIndex) {
    fileMap.set(file.path, file);
  }

  const documents = await index.getDocuments({
    limit: 1_000_000,
  });

  for (const doc of documents.results) {
    const file = doc;
    const filePath = file.path;

    if (!fileMap.has(filePath)) {
      console.log(`[UPDATE_INDEX] Deleting ${filePath}`);
      await index.deleteDocument(file.id);
    }
  }

  for (const file of fileIndex) {
    const filePath = file.path;

    if (!documents.results.find((doc) => doc.path === filePath)) {
      console.log(`[UPDATE_INDEX] Adding ${filePath}`);
      await index.addDocuments([file]);
    }
  }
}

function createFlatFileIndex(dirPath) {
  let fileIndex = [];
  const files = fs.readdirSync(dirPath);

  /* eslint-disable-next-line no-restricted-syntax */
  for (const file of files) {
    const filePath = path.join(dirPath, file);
    const stats = fs.statSync(filePath);

    /* eslint-disable-next-line no-continue */
    if (file.startsWith('.')) continue;

    if (stats.isDirectory()) {
      // If it's a directory, recursively index its contents
      const dirIndex = createFlatFileIndex(filePath);

      fileIndex = fileIndex.concat([
        {
          id: uuid(),
          name: file,
          type: 'd',
          size: fastFolderSizeSync(filePath),
          modification: stats.mtime.getTime(),
          path: filePath.replace('/home/products', ''),
        },
        ...dirIndex,
      ]);
    } else if (stats.isFile()) {
      // If it's a file, add it to the index
      fileIndex.push({
        id: uuid(),
        name: file,
        size: stats.size,
        type: '-',
        modification: stats.mtime.getTime(),
        path: filePath.replace('/home/products', ''),
      });
    }
  }

  return fileIndex;
}

main();
