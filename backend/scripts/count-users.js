/**
 * Imprime el total de usuarios registrados en la base de datos.
 * Ejecutar desde la carpeta backend (donde está .env):
 *   node scripts/count-users.js
 */
const { PrismaClient } = require('@prisma/client');
const { config } = require('dotenv');

config();

const prisma = new PrismaClient();

async function main() {
  const total = await prisma.users.count();
  console.log('Usuarios registrados:', total);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
