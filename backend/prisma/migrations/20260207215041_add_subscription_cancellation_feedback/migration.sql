-- CreateTable
CREATE TABLE `subscription_cancellation_feedback` (
    `id` INT NOT NULL AUTO_INCREMENT,
    `user_id` INT NOT NULL,
    `order_id` INT NULL,
    `payment_method` VARCHAR(50) NULL,
    `reason_code` VARCHAR(60) NOT NULL,
    `reason_text` VARCHAR(500) NULL,
    `utm_source` VARCHAR(120) NULL,
    `utm_medium` VARCHAR(120) NULL,
    `utm_campaign` VARCHAR(180) NULL,
    `gclid` VARCHAR(255) NULL,
    `fbclid` VARCHAR(255) NULL,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    INDEX `idx_scf_user_id`(`user_id`),
    INDEX `idx_scf_order_id`(`order_id`),
    INDEX `idx_scf_reason_code`(`reason_code`),
    INDEX `idx_scf_created_at`(`created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

