import { config } from 'dotenv';
import { log, server } from './server';
import { connectFTP } from './ftp';

config();

async function main() {
  try {
    await server.listen({
      port: 3000,
      host: '0.0.0.0',
    });

    await connectFTP();
  } catch (e) {
    log.error(e);
    process.exit(1);
  }
}

main();
