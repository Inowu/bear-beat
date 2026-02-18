-- CreateTable
CREATE TABLE `ad_spend_monthly` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `month_key` VARCHAR(7) NOT NULL,
  `channel` VARCHAR(80) NOT NULL,
  `currency` VARCHAR(8) NOT NULL DEFAULT 'MXN',
  `amount` DECIMAL(12, 2) NOT NULL DEFAULT 0,
  `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (`id`),
  UNIQUE INDEX `uniq_ad_spend_monthly_month_channel_currency`(`month_key`, `channel`, `currency`),
  INDEX `idx_ad_spend_monthly_month_key`(`month_key`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

