export interface IFileStat {
  // Apparently redis doesn't support indexing by anything other than strings
  [key: string]: any;
  name: string;
  type: 'd' | '-';
  modification: number;
  size: number;
  path?: string;
}

export interface IFileService {
  init(): Promise<any>;
  get(path: string): Promise<Buffer>;
  exists(path: string): Promise<boolean>;
  stat(path: string): Promise<{ size: number }>;
  list(path: string): Promise<IFileStat[]>;
  end(): Promise<any>;
}
