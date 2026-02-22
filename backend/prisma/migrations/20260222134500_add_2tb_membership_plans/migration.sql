-- Seed premium 2TB monthly membership tiers (MXN + USD).
-- These plans are used for subscription upgrades and high-usage users.

INSERT INTO `plans` (
  `name`,
  `description`,
  `moneda`,
  `homedir`,
  `gigas`,
  `price`,
  `duration`,
  `activated`,
  `stripe_prod_id_test`
)
SELECT
  'Plan Pro 2 TB',
  'Membresía premium para DJs con 2 TB de descarga mensual.',
  'mxn',
  '',
  2000,
  700.00,
  '30',
  1,
  ''
WHERE NOT EXISTS (
  SELECT 1
  FROM `plans`
  WHERE LOWER(`moneda`) = 'mxn'
    AND `gigas` = 2000
    AND CAST(`price` AS DECIMAL(10, 2)) = 700.00
    AND `activated` = 1
);

INSERT INTO `plans` (
  `name`,
  `description`,
  `moneda`,
  `homedir`,
  `gigas`,
  `price`,
  `duration`,
  `activated`,
  `stripe_prod_id_test`
)
SELECT
  'Plan Pro 2 TB',
  'Premium membership for DJs with 2 TB monthly download quota.',
  'usd',
  '',
  2000,
  35.00,
  '30',
  1,
  ''
WHERE NOT EXISTS (
  SELECT 1
  FROM `plans`
  WHERE LOWER(`moneda`) = 'usd'
    AND `gigas` = 2000
    AND CAST(`price` AS DECIMAL(10, 2)) = 35.00
    AND `activated` = 1
);
