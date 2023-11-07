import { MeiliSearch } from 'meilisearch';
import { createFlatFileIndex, fileIndexName } from '../src/search/index';
import { IFileStat } from '../src/services/interfaces/fileService.interface';
import { config } from 'dotenv';
import { log } from '../src/server';

config();

async function main() {
  const meiliSearch = new MeiliSearch({
    host: process.env.MEILISEARCH_HOST as string,
    apiKey: process.env.MEILISEARCH_KEY as string,
  });

  log.info(`[UPDATE_INDEX] Updating index ${fileIndexName}`);

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
      log.info(`[UPDATE_INDEX] Deleting ${filePath}`);
      await index.deleteDocument(file.id);
    }
  }

  for (const file of fileIndex) {
    const filePath = file.path as string;

    if (!documents.results.find((doc) => doc.path === filePath)) {
      log.info(`[UPDATE_INDEX] Adding ${filePath}`);
      await index.addDocuments([file]);
    }
  }
}

main();
