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
    const job = await prisma.jobs.findUnique({
      where: {
        id: dir.jobId,
      },
    });

    try {
      const dirPath = path.resolve(
        `${process.env.COMPRESSED_DIRS_NAME}/${dir.dirName}-${dir.userId}-${job.jobId}.zip`,
      );

      fs.unlinkSync(dirPath);
    } catch (e) {
      console.log(`Error removing compressed dir ${dir.id} ${e}`);
    }
  }
}

removeExpiredCompressedDirs().then(() => {
  console.log('Expired compressed dirs removed');
});
