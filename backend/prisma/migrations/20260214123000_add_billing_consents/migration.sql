-- CreateTable
CREATE TABLE `billing_consents` (
    `id` INT NOT NULL AUTO_INCREMENT,
    `user_id` INT NOT NULL,
    `order_id` INT NULL,
    `plan_id` INT NOT NULL,
    `provider` VARCHAR(20) NOT NULL,
    `provider_ref` VARCHAR(120) NULL,
    `consent_type` VARCHAR(40) NOT NULL,
    `consent_version` VARCHAR(32) NOT NULL,
    `consent_text` TEXT NOT NULL,
    `accepted` TINYINT(1) NOT NULL DEFAULT 1,
    `ip_address` VARCHAR(120) NULL,
    `user_agent` TEXT NULL,
    `page_url` VARCHAR(1000) NULL,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    INDEX `idx_billing_consents_user_id`(`user_id`),
    INDEX `idx_billing_consents_order_id`(`order_id`),
    INDEX `idx_billing_consents_provider_ref`(`provider`, `provider_ref`),
    INDEX `idx_billing_consents_plan_id`(`plan_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
