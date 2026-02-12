-- CreateTable
CREATE TABLE `manychat_handoff_tokens` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `token` VARCHAR(80) NOT NULL,
    `contact_id` VARCHAR(64) NULL,
    `channel` VARCHAR(24) NULL,
    `payload_json` JSON NULL,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `expires_at` DATETIME(0) NOT NULL,
    `resolved_at` DATETIME(0) NULL,
    `claimed_at` DATETIME(0) NULL,
    `claimed_user_id` INTEGER NULL,

    UNIQUE INDEX `uniq_mch_token`(`token`),
    INDEX `idx_mch_created_at`(`created_at`),
    INDEX `idx_mch_claimed_user_id`(`claimed_user_id`),
    PRIMARY KEY (`id`),
    CONSTRAINT `manychat_handoff_tokens_ibfk_1` FOREIGN KEY (`claimed_user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE NO ACTION
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
