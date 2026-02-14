-- Add granular marketing preference categories (email).
ALTER TABLE `users`
  ADD COLUMN `email_marketing_news_opt_in` TINYINT(1) NOT NULL DEFAULT 1,
  ADD COLUMN `email_marketing_offers_opt_in` TINYINT(1) NOT NULL DEFAULT 1,
  ADD COLUMN `email_marketing_digest_opt_in` TINYINT(1) NOT NULL DEFAULT 1;

-- Keep initial state consistent for users who already opted out globally.
UPDATE `users`
SET
  `email_marketing_news_opt_in` = 0,
  `email_marketing_offers_opt_in` = 0,
  `email_marketing_digest_opt_in` = 0
WHERE `email_marketing_opt_in` = 0;

