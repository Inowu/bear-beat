import path from 'path';
import { config } from 'dotenv';
import { log, server } from './server';
import { initializeFileService } from './ftp';

config({
  path: path.resolve(__dirname, '../.env'),
});

async function main() {
  try {
    await server.listen({
      port: Number(process.env.PORT),
      host: process.env.HOST,
    });

    await initializeFileService();
  } catch (e) {
    log.error(e);
    process.exit(1);
  }
}

main();
