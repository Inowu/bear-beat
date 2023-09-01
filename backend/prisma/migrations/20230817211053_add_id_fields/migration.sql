/*
  Warnings:

  - Added the required column `id` to the `ftpgroup` table without a default value. This is not possible if the table is not empty.
  - Added the required column `id` to the `ftpquotatallies` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
alter table ftpgroup add column `id` int(10) unsigned primary KEY AUTO_INCREMENT;

-- AlterTable
alter table ftpquotatallies add column `id` int(10) unsigned primary KEY AUTO_INCREMENT;
