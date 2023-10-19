import path from 'path';
import fs from 'fs';
import fastFolderSizeSync from 'fast-folder-size/sync';
import chokidar from 'chokidar';
import { SchemaFieldTypes } from 'redis';
import { IFileStat } from '../services/interfaces/fileService.interface';
import { redis, redisFileIndexKey, redisFileIndexName } from '../redis';
import { log } from '../server';

export async function initializeSearch() {
  const fileIndex = await redis.keys(`${redisFileIndexKey}:*`);

  if (!fileIndex.length) {
    log.info('[CACHE:MISS] Creating file index...');

    await createAndUpdateFileIndex(process.env.SONGS_PATH as string);
  }

  // eslint-disable-next-line no-underscore-dangle
  const redisFtList = await redis.ft._list();

  if (!redisFtList.includes(redisFileIndexName)) {
    log.info('[CACHE] Creating search index...');
    await redis.ft.create(
      redisFileIndexName,
      {
        '$.name': {
          AS: 'name',
          type: SchemaFieldTypes.TEXT,
        },
      },
      {
        ON: 'JSON',
        PREFIX: `${redisFileIndexKey}:`,
      },
    );

    log.info('[CACHE] Search index created');
  }
}

export async function createAndUpdateFileIndex(dirPath: string) {
  log.info('[FILE INDEX] Generating new file index...');
  const fileIndex = createFlatFileIndex(dirPath);

  log.info('[CACHE] Updating file index cache...');
  await Promise.all(
    fileIndex.map((file) =>
      redis.json.set(`${redisFileIndexKey}:${file.name}`, '$', file),
    ),
  );
}

export function createFlatFileIndex(dirPath: string): IFileStat[] {
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
      const dirIndex = createFlatFileIndex(filePath);

      fileIndex = fileIndex.concat([
        {
          name: file,
          type: 'd',
          size: fastFolderSizeSync(filePath)!,
          modification: stats.mtime.getTime(),
        },
        ...dirIndex,
      ]);
    } else if (stats.isFile()) {
      // If it's a file, add it to the index
      fileIndex.push({
        name: file,
        size: stats.size,
        type: '-',
        modification: stats.mtime.getTime(),
      });
    }
  }

  return fileIndex;
}

async function addFileToIndex(file: IFileStat) {
  return redis.json.set(`${redisFileIndexKey}:${file.name}`, '$', file);
}

async function removeFileFromIndex(fileName: string) {
  return redis.json.del(`${redisFileIndexKey}:${fileName}`);
}

const watcher = chokidar.watch(process.env.SONGS_PATH as string, {
  alwaysStat: true,
});

watcher
  .on('add', async (filePath, stats) => {
    const redisEntry = await redis.json.get(
      `${redisFileIndexKey}:${path.basename(filePath)}`,
    );

    if (!redisEntry) {
      log.info(`[FILE INDEX] New file added: ${path.basename(filePath)}`);

      log.info(`[CACHE] Add file to index: ${path.basename(filePath)}`);

      const fileStats = stats as fs.Stats;

      await addFileToIndex({
        name: path.basename(filePath),
        size: fileStats.size,
        type: '-',
        modification: fileStats.mtime.getTime(),
      });
    }
  })
  .on('unlink', async (filePath) => {
    log.info(`[FILE INDEX] File removed: ${path.basename(filePath)}`);
    log.info(
      `[CACHE] Removing file from file index: ${path.basename(filePath)}`,
    );

    await removeFileFromIndex(path.basename(filePath));
  })
  .on('change', async (filePath, stats) => {
    log.info(`[FILE INDEX] File changed: ${path.basename(filePath)}`);
    log.info(`[CACHE] Updating file in index: ${path.basename(filePath)}`);

    const fileStats = stats as fs.Stats;

    await addFileToIndex({
      name: path.basename(filePath),
      size: fileStats.size,
      type: '-',
      modification: fileStats.mtime.getTime(),
    });
  });
