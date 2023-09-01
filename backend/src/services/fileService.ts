import { IFileService } from './interfaces/fileService.interface';
import { LocalFileService } from './localFileService';
import { SFTPFileService } from './sftpService';
import { log } from '../server';

export class FileService implements IFileService {
  private fileService: IFileService;

  constructor(private readonly type: 'local' | 'ftp') {
    this.fileService =
      type === 'local' ? new LocalFileService() : new SFTPFileService();
  }

  init(): Promise<any> {
    log.info(`Initializing ${this.type} file service`);
    return this.fileService.init();
  }

  get(path: string): Promise<Buffer> {
    return this.fileService.get(path);
  }

  exists(path: string): Promise<boolean> {
    return this.fileService.exists(path);
  }

  stat(path: string): Promise<{ size: number }> {
    return this.fileService.stat(path);
  }

  list(path: string) {
    return this.fileService.list(path);
  }

  end(): Promise<any> {
    return this.fileService.end();
  }
}
