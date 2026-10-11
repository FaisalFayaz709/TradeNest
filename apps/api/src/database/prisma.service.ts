import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { parseApiEnvironment } from '@tradenest/config';
import { PrismaClient } from '../../generated/prisma/client.js';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleDestroy {
  constructor() {
    const environment = parseApiEnvironment(process.env);
    const adapter = new PrismaPg({
      connectionString: environment.DATABASE_URL,
      max: environment.DATABASE_POOL_MAX,
      connectionTimeoutMillis: environment.DATABASE_CONNECTION_TIMEOUT_MS,
      idleTimeoutMillis: environment.DATABASE_IDLE_TIMEOUT_MS,
    });

    super({ adapter });
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
