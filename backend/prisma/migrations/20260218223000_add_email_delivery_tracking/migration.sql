ALTER TABLE `automation_action_logs`
  ADD COLUMN `delivery_status` VARCHAR(32) NULL AFTER `channel`;

CREATE TABLE `email_delivery_events` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `provider` VARCHAR(20) NOT NULL DEFAULT 'ses',
  `provider_event_id` VARCHAR(120) NOT NULL,
  `provider_message_id` VARCHAR(120) NOT NULL,
  `event_type` VARCHAR(32) NOT NULL,
  `event_ts` DATETIME(3) NOT NULL,
  `template_key` VARCHAR(120) NULL,
  `action_key` VARCHAR(80) NULL,
  `stage` INT NULL,
  `metadata_json` JSON NULL,
  `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (`id`),
  UNIQUE INDEX `uniq_email_delivery_events_provider_event`(`provider`, `provider_event_id`),
  INDEX `idx_email_delivery_events_provider_message_id`(`provider_message_id`),
  INDEX `idx_email_delivery_events_event_ts`(`event_ts`),
  INDEX `idx_email_delivery_events_template_key`(`template_key`),
  INDEX `idx_email_delivery_events_event_type`(`event_type`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
