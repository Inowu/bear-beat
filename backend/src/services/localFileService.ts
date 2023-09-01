import nodePath from 'path';
import { statSync, existsSync, promises as fs } from 'fs';
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
        const stat = statSync(nodePath.join(path, file));

        return {
          name: file,
          type: stat.isFile() ? ('-' as const) : ('d' as const),
          modification: stat.mtime.getTime(),
          size: stat.size,
        };
      });
  }

  end(): Promise<any> {
    return Promise.resolve();
  }
}
