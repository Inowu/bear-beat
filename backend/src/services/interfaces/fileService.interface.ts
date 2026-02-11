export interface ITrackMetadata {
  artist: string | null;
  title: string | null;
  displayName: string | null;
  bpm: number | null;
  camelot: string | null;
  format: string | null;
  version: string | null;
  coverUrl: string | null;
  durationSeconds: number | null;
  source: 'database' | 'inferred';
}

export interface IFileStat {
  // Apparently redis doesn't support indexing by anything other than strings
  [key: string]: any;
  name: string;
  type: 'd' | '-';
  modification: number;
  size: number;
  path?: string;
  metadata?: ITrackMetadata;
}

export interface IFileService {
  init(): Promise<any>;
  get(path: string): Promise<Buffer>;
  exists(path: string): Promise<boolean>;
  stat(path: string): Promise<{ size: number }>;
  list(path: string): Promise<IFileStat[]>;
  end(): Promise<any>;
}
