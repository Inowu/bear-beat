export interface IFileStat {
  name: string;
  type: 'd' | '-';
  modification: number;
  size: number;
}

export interface IFileService {
  init(): Promise<any>;
  get(path: string): Promise<Buffer>;
  exists(path: string): Promise<boolean>;
  stat(path: string): Promise<{ size: number }>;
  list(path: string): Promise<IFileStat[]>;
  end(): Promise<any>;
}
