import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { parseApiEnvironment } from '@tradenest/config';
import { PrismaClient } from '../generated/prisma/client.js';

const environment = parseApiEnvironment(process.env);
const adapter = new PrismaPg({
  connectionString: environment.DATABASE_URL,
  max: 1,
  connectionTimeoutMillis: environment.DATABASE_CONNECTION_TIMEOUT_MS,
  idleTimeoutMillis: environment.DATABASE_IDLE_TIMEOUT_MS,
});
const prisma = new PrismaClient({ adapter });

try {
  await prisma.$queryRaw`SELECT 1`;
  console.log('TradeNest PostgreSQL connectivity: OK');
} finally {
  await prisma.$disconnect();
}
