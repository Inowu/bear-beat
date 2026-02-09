-- Add PayPal-related columns to `plans` if missing (defensive migration).
-- Some environments were created from older migrations that didn't include these fields,
-- but the Prisma schema and runtime expect them to exist.

SET @bb_db := DATABASE();

-- paypal_plan_id
SET @bb_has_paypal_plan_id := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = @bb_db AND TABLE_NAME = 'plans' AND COLUMN_NAME = 'paypal_plan_id'
);
SET @bb_stmt := IF(
  @bb_has_paypal_plan_id = 0,
  'ALTER TABLE `plans` ADD COLUMN `paypal_plan_id` TEXT NULL',
  'SELECT 1'
);
PREPARE bb_s FROM @bb_stmt;
EXECUTE bb_s;
DEALLOCATE PREPARE bb_s;

-- paypal_plan_id_test
SET @bb_has_paypal_plan_id_test := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = @bb_db AND TABLE_NAME = 'plans' AND COLUMN_NAME = 'paypal_plan_id_test'
);
SET @bb_stmt := IF(
  @bb_has_paypal_plan_id_test = 0,
  'ALTER TABLE `plans` ADD COLUMN `paypal_plan_id_test` TEXT NULL',
  'SELECT 1'
);
PREPARE bb_s FROM @bb_stmt;
EXECUTE bb_s;
DEALLOCATE PREPARE bb_s;

-- paypal_product_id
SET @bb_has_paypal_product_id := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = @bb_db AND TABLE_NAME = 'plans' AND COLUMN_NAME = 'paypal_product_id'
);
SET @bb_stmt := IF(
  @bb_has_paypal_product_id = 0,
  'ALTER TABLE `plans` ADD COLUMN `paypal_product_id` TEXT NULL',
  'SELECT 1'
);
PREPARE bb_s FROM @bb_stmt;
EXECUTE bb_s;
DEALLOCATE PREPARE bb_s;

