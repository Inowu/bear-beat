import { config } from 'dotenv';
import { log, server } from './server';
import { connectFTP } from './ftp';

config();

async function main() {
  try {
    await server.listen({
      port: Number(process.env.PORT),
      host: process.env.HOST,
    });

    await connectFTP();
  } catch (e) {
    log.error(e);
    process.exit(1);
  }
}

main();
