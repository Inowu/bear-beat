import nodePath from 'path';
import { statSync, existsSync, promises as fs } from 'fs';
import fastFolderSizeSync from 'fast-folder-size/sync';
import { IFileService } from './interfaces/fileService.interface';

export class LocalFileService implements IFileService {
  init() {
    return Promise.resolve();
  }

  get(path: string) {
    return fs.readFile(path);
  }

  exists(path: string): Promise<boolean> {
    return Promise.resolve(existsSync(path));
  }

  stat(path: string) {
    return fs.stat(path);
  }

  async list(path: string) {
    const files = await fs.readdir(path);

    return files
      .filter((file) => !file.startsWith('.'))
      .map((file) => {
        const filePath = nodePath.join(path, file);
        const stat = statSync(filePath);
        const type = stat.isFile() ? ('-' as const) : ('d' as const);

        return {
          name: file,
          type,
          modification: stat.mtime.getTime(),
          size: type === 'd' ? fastFolderSizeSync(filePath)! : stat.size,
        };
      });
  }

  end(): Promise<any> {
    return Promise.resolve();
  }
}
