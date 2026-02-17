CREATE TABLE `download_history_archive` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `date` DATETIME(0) NOT NULL,
  `sourceId` INTEGER NOT NULL,
  `userId` INTEGER NOT NULL,
  `size` BIGINT NOT NULL,
  `fileName` VARCHAR(500) NOT NULL,
  `isFolder` BOOLEAN NOT NULL,
  `archivedAt` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

  UNIQUE INDEX `uniq_dha_source_date`(`sourceId`, `date`),
  INDEX `idx_dha_date`(`date`),
  INDEX `idx_dha_source_id`(`sourceId`),
  INDEX `idx_dha_archived_at`(`archivedAt`),
  INDEX `idx_dha_user_date`(`userId`, `date`),
  INDEX `idx_dha_isfolder_date`(`isFolder`, `date`),
  PRIMARY KEY (`id`, `date`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
