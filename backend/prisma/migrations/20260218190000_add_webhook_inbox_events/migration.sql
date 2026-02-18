CREATE TABLE `webhook_inbox_events` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `provider` VARCHAR(32) NOT NULL,
  `event_id` VARCHAR(191) NOT NULL,
  `event_type` VARCHAR(120) NOT NULL,
  `livemode` TINYINT(1) NULL,
  `received_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
  `updated_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0) ON UPDATE CURRENT_TIMESTAMP(0),
  `status` VARCHAR(20) NOT NULL DEFAULT 'RECEIVED',
  `attempts` INT NOT NULL DEFAULT 0,
  `next_retry_at` DATETIME(0) NULL,
  `processed_at` DATETIME(0) NULL,
  `last_error` LONGTEXT NULL,
  `headers_json` JSON NULL,
  `payload_raw` LONGTEXT NOT NULL,
  `payload_hash` CHAR(64) NULL,
  `processing_started_at` DATETIME(0) NULL,

  PRIMARY KEY (`id`),
  UNIQUE INDEX `uniq_webhook_inbox_provider_event` (`provider`, `event_id`),
  INDEX `idx_webhook_inbox_status_next_retry_at` (`status`, `next_retry_at`),
  INDEX `idx_webhook_inbox_received_at` (`received_at`),
  INDEX `idx_webhook_inbox_provider_event_type` (`provider`, `event_type`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
