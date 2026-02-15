-- CreateTable
CREATE TABLE IF NOT EXISTS `products` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(250) NOT NULL,
    `stripe_product_test_id` VARCHAR(50) NOT NULL,
    `stripe_product_id` VARCHAR(50) NOT NULL,
    `amount` FLOAT NOT NULL,
    `price` FLOAT NULL DEFAULT 350,
    `moneda` VARCHAR(10) NULL DEFAULT 'MXN',

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE IF NOT EXISTS `product_orders` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `service` VARCHAR(100) NOT NULL,
    `product_id` INTEGER NOT NULL,
    `created_at` DATETIME(0) NULL,
    `status` INTEGER NOT NULL,
    `user_id` INTEGER NOT NULL,
    `payment_method` VARCHAR(250) NULL DEFAULT 'Stripe',
    `txn_id` VARCHAR(100) NULL DEFAULT '',

    INDEX `FK_products`(`product_id`),
    INDEX `fk_user`(`user_id`),
    PRIMARY KEY (`id`),
    CONSTRAINT `FK_products` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION,
    CONSTRAINT `fk_user` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
