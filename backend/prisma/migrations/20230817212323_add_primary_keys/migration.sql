/*
  Warnings:

  - The primary key for the `ftpgroup` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to alter the column `id` on the `ftpgroup` table. The data in that column could be lost. The data in that column will be cast from `UnsignedInt` to `Int`.
  - The primary key for the `ftpquotatallies` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to alter the column `id` on the `ftpquotatallies` table. The data in that column could be lost. The data in that column will be cast from `UnsignedInt` to `Int`.

*/
-- AlterTable
ALTER TABLE `ftpgroup` DROP PRIMARY KEY,
    MODIFY `id` INTEGER NOT NULL AUTO_INCREMENT,
    ADD PRIMARY KEY (`id`);

-- AlterTable
ALTER TABLE `ftpquotatallies` DROP PRIMARY KEY,
    MODIFY `id` INTEGER NOT NULL AUTO_INCREMENT,
    ADD PRIMARY KEY (`id`);
