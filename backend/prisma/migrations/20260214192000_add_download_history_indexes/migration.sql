/*
  Bear Beat: download_history indexes for scale.

  download_history grows quickly (every file/folder download). These indexes keep:
  - Per-user history pagination: WHERE userId = ? ORDER BY date DESC
  - Public top downloads: WHERE isFolder = 0 AND date >= ?
  fast even at large row counts.

  Written defensively to avoid failing when indexes already exist.
*/

SET @bb_has_download_history_table := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLES
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'download_history'
);

-- Index: (userId, date)
SET @bb_has_idx_download_history_user_date := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'download_history'
    AND INDEX_NAME = 'idx_download_history_user_date'
);
SET @bb_sql := IF(
  @bb_has_download_history_table = 1 AND @bb_has_idx_download_history_user_date = 0,
  'CREATE INDEX `idx_download_history_user_date` ON `download_history`(`userId`, `date`);',
  'SELECT 1;'
);
PREPARE stmt FROM @bb_sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Index: (isFolder, date)
SET @bb_has_idx_download_history_isfolder_date := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'download_history'
    AND INDEX_NAME = 'idx_download_history_isfolder_date'
);
SET @bb_sql := IF(
  @bb_has_download_history_table = 1 AND @bb_has_idx_download_history_isfolder_date = 0,
  'CREATE INDEX `idx_download_history_isfolder_date` ON `download_history`(`isFolder`, `date`);',
  'SELECT 1;'
);
PREPARE stmt FROM @bb_sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

