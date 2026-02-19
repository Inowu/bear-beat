-- CreateTable
CREATE TABLE `email_template_overrides` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `template_key` VARCHAR(120) NOT NULL,
  `enabled` BOOLEAN NOT NULL DEFAULT true,
  `subject` VARCHAR(191) NULL,
  `html` LONGTEXT NULL,
  `text` LONGTEXT NULL,
  `updated_by_user_id` INTEGER NULL,
  `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  UNIQUE INDEX `uniq_email_template_overrides_template_key`(`template_key`),
  INDEX `idx_email_template_overrides_enabled`(`enabled`),
  INDEX `idx_email_template_overrides_updated_at`(`updated_at`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
