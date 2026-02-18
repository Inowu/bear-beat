ALTER TABLE `automation_action_logs`
  ADD COLUMN `context_key` VARCHAR(160) NOT NULL DEFAULT '' AFTER `action_key`;

ALTER TABLE `automation_action_logs`
  DROP INDEX `uniq_automation_action_user_key_stage`,
  ADD UNIQUE INDEX `uniq_automation_action_user_key_stage_context`(`user_id`, `action_key`, `stage`, `context_key`),
  ADD INDEX `idx_automation_action_context_key`(`context_key`);
