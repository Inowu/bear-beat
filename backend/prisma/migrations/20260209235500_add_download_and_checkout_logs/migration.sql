-- CreateTable
CREATE TABLE IF NOT EXISTS `checkout_logs` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `user_id` INTEGER NOT NULL,
    `last_checkout_date` DATETIME(0) NOT NULL,

    INDEX `user_id`(`user_id`),
    PRIMARY KEY (`id`),
    CONSTRAINT `checkout_logs_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE IF NOT EXISTS `dir_downloads` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userId` INTEGER NULL,
    `size` BIGINT NULL,
    `date` DATETIME(0) NULL,
    `dirName` VARCHAR(500) NOT NULL,
    `jobId` INTEGER NULL,
    `downloadUrl` VARCHAR(1000) NULL,
    `expirationDate` DATETIME(0) NULL,

    INDEX `userId`(`userId`),
    PRIMARY KEY (`id`),
    CONSTRAINT `dir_downloads_ibfk_1` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE IF NOT EXISTS `download_history` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userId` INTEGER NOT NULL,
    `size` BIGINT NOT NULL,
    `date` DATETIME(0) NOT NULL,
    `fileName` VARCHAR(500) NOT NULL,
    `isFolder` BOOLEAN NOT NULL,

    INDEX `download_history_userId_idx`(`userId`),
    PRIMARY KEY (`id`),
    CONSTRAINT `download_history_ibfk_1` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

