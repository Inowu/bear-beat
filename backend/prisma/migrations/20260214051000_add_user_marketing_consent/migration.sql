ALTER TABLE `users`
  ADD COLUMN `email_marketing_opt_in` TINYINT(1) NOT NULL DEFAULT 1,
  ADD COLUMN `whatsapp_marketing_opt_in` TINYINT(1) NOT NULL DEFAULT 0,
  ADD COLUMN `sms_marketing_opt_in` TINYINT(1) NOT NULL DEFAULT 0,
  ADD COLUMN `marketing_opt_in_updated_at` DATETIME(0) NULL;
