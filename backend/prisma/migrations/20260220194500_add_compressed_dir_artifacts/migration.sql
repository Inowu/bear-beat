-- CreateTable
CREATE TABLE `compressed_dir_artifacts` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `folder_path_normalized` VARCHAR(500) NOT NULL,
  `version_key` VARCHAR(128) NOT NULL,
  `zip_name` VARCHAR(255) NOT NULL,
  `zip_size_bytes` BIGINT UNSIGNED NOT NULL DEFAULT 0,
  `source_size_bytes` BIGINT UNSIGNED NOT NULL DEFAULT 0,
  `tier` ENUM('hot', 'warm') NOT NULL DEFAULT 'warm',
  `status` ENUM('ready', 'building', 'failed') NOT NULL DEFAULT 'building',
  `hit_count` BIGINT UNSIGNED NOT NULL DEFAULT 0,
  `last_accessed_at` DATETIME(0) NULL,
  `expires_at` DATETIME(0) NOT NULL,
  `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `last_error` LONGTEXT NULL,

  UNIQUE INDEX `uniq_compressed_dir_artifacts_folder_version`(`folder_path_normalized`, `version_key`),
  INDEX `idx_compressed_dir_artifacts_status_expires_at`(`status`, `expires_at`),
  INDEX `idx_compressed_dir_artifacts_tier_last_accessed_at`(`tier`, `last_accessed_at`),
  INDEX `idx_compressed_dir_artifacts_expires_at`(`expires_at`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
