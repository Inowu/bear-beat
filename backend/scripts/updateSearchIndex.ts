import { MeiliSearch } from 'meilisearch';
import fastFolderSizeSync from 'fast-folder-size/sync';
import fs from 'fs';
import path from 'path';
import { v4 as uuid } from 'uuid';
import {
  inferTrackMetadataFromName,
  toCatalogRelativePath,
} from '../src/metadata/inferTrackMetadata';
import { IFileStat } from '../src/services/interfaces/fileService.interface';
import { config } from 'dotenv';

config();

export const fileIndexName = 'FILE_INDEX';

async function main() {
  const meiliSearch = new MeiliSearch({
    host: process.env.MEILISEARCH_HOST as string,
    apiKey: process.env.MEILISEARCH_KEY as string,
  });

  console.log(`[UPDATE_INDEX] Updating index ${fileIndexName}`);

  const index = await meiliSearch.getIndex(fileIndexName);

  const fileIndex = createFlatFileIndex(process.env.SONGS_PATH as string);

  const fileMap = new Map<string, IFileStat>();

  for (const file of fileIndex) {
    fileMap.set(file.path as string, file);
  }

  const documents = await index.getDocuments({
    limit: 1_000_000,
  });

  for (const doc of documents.results) {
    const file = doc as IFileStat;
    const filePath = file.path!;

    if (!fileMap.has(filePath)) {
      console.log(`[UPDATE_INDEX] Deleting ${filePath}`);
      await index.deleteDocument(file.id);
    }
  }

  for (const file of fileIndex) {
    const filePath = file.path as string;

    if (!documents.results.find((doc) => doc.path === filePath)) {
      console.log(`[UPDATE_INDEX] Adding ${filePath}`);
      await index.addDocuments([file]);
    }
  }
}

function createFlatFileIndex(dirPath: string, rootPath: string = dirPath): IFileStat[] {
  let fileIndex: IFileStat[] = [];
  const files = fs.readdirSync(dirPath);

  /* eslint-disable-next-line no-restricted-syntax */
  for (const file of files) {
    const filePath = path.join(dirPath, file);
    const stats = fs.statSync(filePath);

    /* eslint-disable-next-line no-continue */
    if (file.startsWith('.')) continue;

    if (stats.isDirectory()) {
      // If it's a directory, recursively index its contents
      const dirIndex = createFlatFileIndex(filePath, rootPath);

      fileIndex = fileIndex.concat([
        {
          id: uuid(),
          name: file,
          type: 'd',
          size: fastFolderSizeSync(filePath)!,
          modification: stats.mtime.getTime(),
          path: toCatalogRelativePath(filePath, rootPath),
        },
        ...dirIndex,
      ]);
    } else if (stats.isFile()) {
      const inferredMetadata = inferTrackMetadataFromName(file);
      // If it's a file, add it to the index
      fileIndex.push({
        id: uuid(),
        name: file,
        size: stats.size,
        type: '-',
        modification: stats.mtime.getTime(),
        path: toCatalogRelativePath(filePath, rootPath),
        ...(inferredMetadata ? { metadata: inferredMetadata } : {}),
      });
    }
  }

  return fileIndex;
}

main();
