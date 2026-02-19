/*
  Bear Beat: speed up `ftp.ls` already_downloaded lookup.

  Query pattern:
  WHERE userId = ? AND isFolder = 0 AND fileName IN (...)

  Add composite index to avoid scanning by date-focused indexes.
  Written defensively so reruns won't fail.
*/

SET @bb_has_download_history_table := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLES
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'download_history'
);

SET @bb_has_idx_download_history_user_folder_file := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'download_history'
    AND INDEX_NAME = 'idx_download_history_user_folder_file'
);

SET @bb_sql := IF(
  @bb_has_download_history_table = 1 AND @bb_has_idx_download_history_user_folder_file = 0,
  'CREATE INDEX `idx_download_history_user_folder_file` ON `download_history`(`userId`, `isFolder`, `fileName`);',
  'SELECT 1;'
);

PREPARE stmt FROM @bb_sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
