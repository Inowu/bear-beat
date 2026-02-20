export type CompressionJob = {
  songsRelativePath: string;
  songsAbsolutePath: string;
  folderPathNormalized: string;
  sourceDirMtimeMs: number;
  sourceDirVersionKey: string;
  userId: number;
  dirDownloadId: number;
  // The name of the ftp account used to download the directory
  // Thtis is necessary because the user can have a normal account or an extended account
  ftpAccountName: string;
  ftpTalliesId: number;
  dirSize: number;
  // If the job gets cancelled we need to update the bytes used back
  quotaTalliesId: number;
};
