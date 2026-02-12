export interface ITrackMetadata {
  artist: string | null;
  title: string | null;
  displayName: string | null;
  bpm: number | null;
  camelot: string | null;
  energyLevel: number | null;
  format: string | null;
  version: string | null;
  coverUrl: string | null;
  durationSeconds: number | null;
  source: 'database' | 'inferred' | string;
}

export interface IFiles {
  name: string;
  type: string;
  path?: string;
  size: number;
  metadata?: ITrackMetadata | null;
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
