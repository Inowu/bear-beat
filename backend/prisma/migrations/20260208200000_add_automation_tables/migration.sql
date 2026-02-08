-- CreateTable
CREATE TABLE `automation_run_logs` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `started_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `finished_at` DATETIME(0) NULL,
    `status` VARCHAR(20) NOT NULL,
    `error` TEXT NULL,

    INDEX `idx_automation_runs_started_at`(`started_at`),
    INDEX `idx_automation_runs_status`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `automation_action_logs` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `user_id` INTEGER NOT NULL,
    `action_key` VARCHAR(80) NOT NULL,
    `stage` INTEGER NOT NULL DEFAULT 0,
    `channel` VARCHAR(20) NOT NULL,
    `provider_message_id` VARCHAR(120) NULL,
    `sent_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `metadata_json` JSON NULL,

    INDEX `idx_automation_action_user_id`(`user_id`),
    INDEX `idx_automation_action_sent_at`(`sent_at`),
    UNIQUE INDEX `uniq_automation_action_user_key_stage`(`user_id`, `action_key`, `stage`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `user_offers` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `user_id` INTEGER NOT NULL,
    `offer_key` VARCHAR(80) NOT NULL,
    `stage` INTEGER NOT NULL DEFAULT 0,
    `percent_off` INTEGER NOT NULL,
    `coupon_code` VARCHAR(15) NULL,
    `expires_at` DATETIME(0) NOT NULL,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `redeemed_at` DATETIME(0) NULL,
    `metadata_json` JSON NULL,

    INDEX `idx_user_offer_expires_at`(`expires_at`),
    INDEX `idx_user_offer_user_id`(`user_id`),
    UNIQUE INDEX `uniq_user_offer_user_key_stage`(`user_id`, `offer_key`, `stage`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

