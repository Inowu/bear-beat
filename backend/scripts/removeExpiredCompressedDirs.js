const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');
const { config } = require('dotenv');

config();

const prisma = new PrismaClient();

async function removeExpiredCompressedDirs() {
  const expiredCompressedDirs = await prisma.dir_downloads.findMany({
    where: {
      expirationDate: {
        lte: new Date(),
      },
    },
  });

  for (const dir of expiredCompressedDirs) {
    console.log(`Removing compressed dir ${dir.id}`);
    const dirPath = path.resolve(
      `${process.env.COMPRESSED_DIRS_NAME}/${dir.dirName}-${dir.userId}-${dir.jobId}.zip`,
    );

    fs.unlinkSync(dirPath);
  }
}

removeExpiredCompressedDirs().then(() => {
  console.log('Expired compressed dirs removed');
});
