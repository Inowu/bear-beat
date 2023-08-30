import Client from 'ssh2-sftp-client';
import { IFileService, IFileStat } from './interfaces/fileService.interface';

export class SFTPFileService implements IFileService {
  private sftpClient: Client;

  constructor() {
    this.sftpClient = new Client();
  }

  init(): Promise<any> {
    return this.sftpClient.connect({
      host: process.env.FTP_HOST,
      port: Number(process.env.FTP_PORT),
      username: process.env.FTP_USERNAME,
      password: process.env.FTP_PASSWORD,
    });
  }

  async get(path: string): Promise<Buffer> {
    return this.sftpClient.get(path) as Promise<Buffer>;
  }

  async stat(path: string) {
    const fileStats = await this.sftpClient.stat(path);

    return { size: fileStats.size };
  }

  async exists(path: string): Promise<boolean> {
    const result = await this.sftpClient.exists(path);

    return Boolean(result);
  }

  async list(path: string) {
    const files = await this.sftpClient.list(
      path,
      (file) => !file.name.startsWith('.'),
    );

    return files
      .filter((file) => file.type === 'd' || file.type === '-')
      .map((file) => ({
        name: file.name,
        type: file.type as 'd' | '-',
        modification: file.modifyTime,
        size: file.size,
      }));
  }

  async end(): Promise<any> {
    return this.sftpClient.end();
  }
}
