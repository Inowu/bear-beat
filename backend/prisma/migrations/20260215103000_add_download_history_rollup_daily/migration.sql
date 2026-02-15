-- Bear Beat: daily rollup for download_history (scale).
--
-- Purpose:
-- - Keep public "Top Downloads" fast at high volumes by aggregating per-day counts.
-- - Enable optional retention policies for raw download_history without losing aggregate trends.
--
-- Notes:
-- - Table is write-only from the app (best-effort) + optional backfill script.
-- - We avoid foreign keys on purpose (this is analytics, not critical-path).

CREATE TABLE IF NOT EXISTS `download_history_rollup_daily` (
  `category` VARCHAR(16) NOT NULL,
  `day` DATE NOT NULL,
  `fileName` VARCHAR(500) NOT NULL,
  `downloads` BIGINT UNSIGNED NOT NULL DEFAULT 0,
  `totalBytes` BIGINT UNSIGNED NOT NULL DEFAULT 0,
  `lastDownload` DATETIME(0) NOT NULL,

  PRIMARY KEY (`category`, `day`, `fileName`),
  INDEX `idx_dh_rollup_day`(`day`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
