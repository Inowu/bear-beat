export type CompressionJob = {
  songsRelativePath: string;
  songsAbsolutePath: string;
  userId: number;
  jobDbId: number; // The id of the job in the database (which is different from the job id in the queue)
  dirDownloadId: number;
  // The name of the ftp account used to download the directory
  // Thtis is necessary because the user can have a normal account or an extended account
  ftpAccountName: string;
  ftpTalliesId: number;
  dirSize: number;
};
