-- CreateTable
CREATE TABLE `config` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` TEXT NOT NULL,
    `value` TEXT NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `countries` (
    `id` SMALLINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(255) NOT NULL,
    `code` VARCHAR(10) NOT NULL,

    UNIQUE INDEX `name`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `cupons` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `code` VARCHAR(15) NOT NULL,
    `discount` INTEGER NOT NULL,
    `type` INTEGER NOT NULL,
    `cupon_condition` VARCHAR(10) NULL,
    `parameter` INTEGER NULL,
    `description` TEXT NULL,
    `active` INTEGER NOT NULL DEFAULT 1,

    UNIQUE INDEX `code`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `cupons_used` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `user_id` INTEGER NOT NULL,
    `cupon_id` INTEGER NOT NULL,
    `date_cupon` DATETIME(0) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `descargas_user` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `user_id` INTEGER NOT NULL,
    `order_id` INTEGER NULL,
    `available` FLOAT NOT NULL,
    `ilimitado` INTEGER NOT NULL DEFAULT 0,
    `date_end` DATE NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ftpgroup` (
    `groupname` VARCHAR(16) NOT NULL,
    `gid` SMALLINT NOT NULL DEFAULT 5500,
    `members` VARCHAR(16) NOT NULL,

    INDEX `groupname`(`groupname`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ftpquotalimits` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(30) NULL,
    `quota_type` ENUM('user', 'group', 'class', 'all') NOT NULL DEFAULT 'user',
    `per_session` ENUM('false', 'true') NOT NULL DEFAULT 'false',
    `limit_type` ENUM('soft', 'hard') NOT NULL DEFAULT 'soft',
    `bytes_in_avail` BIGINT UNSIGNED NOT NULL DEFAULT 0,
    `bytes_out_avail` BIGINT UNSIGNED NOT NULL DEFAULT 0,
    `bytes_xfer_avail` BIGINT UNSIGNED NOT NULL DEFAULT 0,
    `files_in_avail` INTEGER UNSIGNED NOT NULL DEFAULT 0,
    `files_out_avail` INTEGER UNSIGNED NOT NULL DEFAULT 0,
    `files_xfer_avail` INTEGER UNSIGNED NOT NULL DEFAULT 0,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ftpuser` (
    `id` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
    `userid` VARCHAR(32) NOT NULL DEFAULT '',
    `passwd` VARCHAR(32) NOT NULL DEFAULT '',
    `uid` SMALLINT NOT NULL DEFAULT 5500,
    `gid` SMALLINT NOT NULL DEFAULT 5500,
    `homedir` VARCHAR(255) NOT NULL DEFAULT '',
    `shell` VARCHAR(16) NOT NULL DEFAULT '/sbin/nologin',
    `count` INTEGER NOT NULL DEFAULT 0,
    `accessed` DATETIME(0) NOT NULL DEFAULT '1999-01-01 00:00:00',
    `modified` DATETIME(0) NOT NULL DEFAULT '1999-01-01 00:00:00',
    `user_id` INTEGER NULL,
    `order_id` INTEGER NULL,
    `expiration` DATE NULL,

    UNIQUE INDEX `userid`(`userid`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `login_history` (
    `id` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
    `user` VARCHAR(50) NOT NULL,
    `client_ip` VARCHAR(100) NOT NULL,
    `server_ip` VARCHAR(100) NOT NULL,
    `protocol` TEXT NOT NULL,
    `when` VARCHAR(150) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `orders` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `date_order` DATETIME(0) NOT NULL,
    `payment_id` INTEGER NULL,
    `user_id` INTEGER NOT NULL,
    `total_price` FLOAT NOT NULL,
    `status` INTEGER NOT NULL DEFAULT 0,
    `discount` INTEGER NOT NULL DEFAULT 0,
    `total_discount` FLOAT NULL,
    `cupon_id` INTEGER NULL,
    `is_plan` INTEGER NOT NULL DEFAULT 0,
    `plan_id` INTEGER NULL,
    `txn_id` VARCHAR(100) NULL,
    `payment_method` TEXT NULL,
    `invoice_id` TEXT NULL,
    `is_canceled` INTEGER NULL DEFAULT 0,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `plans` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(100) NOT NULL,
    `description` TEXT NOT NULL,
    `moneda` VARCHAR(200) NOT NULL DEFAULT 'usd',
    `homedir` TEXT NOT NULL,
    `gigas` BIGINT NOT NULL DEFAULT 0,
    `price` DECIMAL(10, 2) NOT NULL,
    `duration` VARCHAR(100) NOT NULL,
    `activated` INTEGER NOT NULL DEFAULT 0,
    `tokens` INTEGER NULL,
    `audio_ilimitado` INTEGER NULL,
    `tokens_video` INTEGER NULL,
    `video_ilimitado` INTEGER NULL,
    `tokens_karaoke` INTEGER NULL,
    `karaoke_ilimitado` INTEGER NULL,
    `ilimitado_activo` INTEGER NULL,
    `ilimitado_dias` INTEGER NULL,
    `stripe_prod_id` TEXT NULL,
    `stripe_prod_id_test` TEXT NOT NULL,
    `vip_activo` INTEGER NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `roles` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(255) NOT NULL,

    UNIQUE INDEX `name`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `user_files` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `product_id` VARCHAR(200) NOT NULL,
    `downloads_left` INTEGER NOT NULL,
    `order_id` INTEGER NOT NULL,
    `user_id` INTEGER NOT NULL,
    `since` DATE NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `users` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `registered_on` DATE NOT NULL DEFAULT '2018-01-01',
    `username` VARCHAR(255) NOT NULL,
    `password` LONGTEXT NOT NULL,
    `first_name` VARCHAR(255) NULL,
    `last_name` VARCHAR(255) NULL,
    `address` VARCHAR(255) NULL,
    `birthdate` DATE NULL,
    `email` VARCHAR(255) NOT NULL,
    `stripe_cusid` VARCHAR(200) NULL,
    `conekta_cusid` VARCHAR(255) NULL,
    `phone` VARCHAR(15) NULL,
    `city` VARCHAR(100) NULL,
    `role_id` INTEGER NULL DEFAULT 1,
    `country_id` VARCHAR(2) NULL,
    `profile_img` VARCHAR(100) NULL,
    `active` INTEGER NOT NULL DEFAULT 0,
    `activationcode` TEXT NULL,
    `mc_id` INTEGER NULL,
    `ip_registro` TEXT NULL,

    UNIQUE INDEX `username`(`username`),
    UNIQUE INDEX `email`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ftpquotatallies` (
    `name` VARCHAR(30) NOT NULL DEFAULT '',
    `quota_type` ENUM('user', 'group', 'class', 'all') NOT NULL DEFAULT 'user',
    `bytes_in_used` BIGINT UNSIGNED NOT NULL DEFAULT 0,
    `bytes_out_used` BIGINT UNSIGNED NOT NULL DEFAULT 0,
    `bytes_xfer_used` BIGINT UNSIGNED NOT NULL DEFAULT 0,
    `files_in_used` INTEGER UNSIGNED NOT NULL DEFAULT 0,
    `files_out_used` INTEGER UNSIGNED NOT NULL DEFAULT 0,
    `files_xfer_used` INTEGER UNSIGNED NOT NULL DEFAULT 0
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ftpquotatallies_history` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(30) NOT NULL,
    `quota_type` ENUM('user', 'group', 'class', 'all') NOT NULL DEFAULT 'user',
    `bytes_in_used` BIGINT UNSIGNED NOT NULL DEFAULT 0,
    `bytes_out_used` BIGINT UNSIGNED NOT NULL DEFAULT 0,
    `bytes_xfer_used` BIGINT UNSIGNED NOT NULL DEFAULT 0,
    `files_in_used` INTEGER UNSIGNED NOT NULL DEFAULT 0,
    `files_out_used` INTEGER UNSIGNED NOT NULL DEFAULT 0,
    `files_xfer_used` INTEGER UNSIGNED NOT NULL DEFAULT 0,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

