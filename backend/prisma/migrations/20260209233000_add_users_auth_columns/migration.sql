/*
  Bear Beat: align Prisma schema with database for fresh installs.

  Production DBs may already have some of these columns (created historically outside migrations).
  This migration is written defensively to avoid failing when columns already exist.
*/

-- Add `refresh_token` (nullable)
SET @bb_has_refresh_token := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'users'
    AND COLUMN_NAME = 'refresh_token'
);
SET @bb_sql := IF(
  @bb_has_refresh_token = 0,
  'ALTER TABLE `users` ADD COLUMN `refresh_token` VARCHAR(250) NULL;',
  'SELECT 1;'
);
PREPARE stmt FROM @bb_sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add or widen `token_expiration` to DATETIME(0) (password reset / security)
SET @bb_token_expiration_type := (
  SELECT DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'users'
    AND COLUMN_NAME = 'token_expiration'
  LIMIT 1
);
SET @bb_sql := IF(
  @bb_token_expiration_type IS NULL,
  'ALTER TABLE `users` ADD COLUMN `token_expiration` DATETIME(0) NULL;',
  IF(
    @bb_token_expiration_type = 'date',
    'ALTER TABLE `users` MODIFY COLUMN `token_expiration` DATETIME(0) NULL;',
    'SELECT 1;'
  )
);
PREPARE stmt FROM @bb_sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add `blocked` (admin blocklist)
SET @bb_has_blocked := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'users'
    AND COLUMN_NAME = 'blocked'
);
SET @bb_sql := IF(
  @bb_has_blocked = 0,
  'ALTER TABLE `users` ADD COLUMN `blocked` TINYINT(1) NOT NULL DEFAULT 0;',
  'SELECT 1;'
);
PREPARE stmt FROM @bb_sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add `verified` (account verification flag)
SET @bb_has_verified := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'users'
    AND COLUMN_NAME = 'verified'
);
SET @bb_sql := IF(
  @bb_has_verified = 0,
  'ALTER TABLE `users` ADD COLUMN `verified` TINYINT(1) NOT NULL DEFAULT 1;',
  'SELECT 1;'
);
PREPARE stmt FROM @bb_sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

