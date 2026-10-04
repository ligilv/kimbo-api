import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client.js';

const logger = new Logger('PrismaService');

/**
 * Runtime client on the POOLED url (Supabase Supavisor, port 6543, transaction
 * mode). adapter-pg only names prepared statements when given a
 * statementNameGenerator, so the default is safe behind a transaction pooler.
 * Migrations use DIRECT_URL via prisma7.config.ts instead.
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleDestroy {
  constructor(config: ConfigService) {
    // ponytail: no $connect() on boot. The pg pool connects on the first query,
    // so the server (and /meals/parse) still boots when the DB is unreachable.
    super({
      adapter: new PrismaPg(
        { connectionString: config.get<string>('DATABASE_URL') },
        { onPoolError: (err) => logger.error(`pg pool error: ${err.message}`) },
      ),
    });
  }

  onModuleDestroy(): Promise<void> {
    return this.$disconnect();
  }
}
