export interface IFiles {
  name: string;
  type: string;
  path?: string;
}
export interface IDownloads {
  dirName: string;
  date: Date;
  id: number;
  jobId: number;
  userId: number;
  size: bigint;
  downloadUrl: string;
  expirationDate: Date;
}
