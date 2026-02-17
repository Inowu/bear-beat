-- CreateTable
CREATE TABLE `admin_audit_logs` (
    `id` INT NOT NULL AUTO_INCREMENT,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `actor_user_id` INT NOT NULL,
    `action` VARCHAR(80) NOT NULL,
    `target_user_id` INT NULL,
    `metadata_json` JSON NULL,
    `ip` VARCHAR(120) NULL,
    `user_agent` VARCHAR(500) NULL,

    INDEX `idx_admin_audit_created_at`(`created_at`),
    INDEX `idx_admin_audit_action`(`action`),
    INDEX `idx_admin_audit_actor_user_id`(`actor_user_id`),
    INDEX `idx_admin_audit_target_user_id`(`target_user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
