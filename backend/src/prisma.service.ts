import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  constructor() {
    const connectionString = process.env.DATABASE_URL;
    const pool = new Pool({
      connectionString,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });
    const adapter = new PrismaPg(pool);
    super({ adapter });
  }

  async onModuleInit() {
    await this.$connect();
    try {
      await this.$executeRawUnsafe(`
        ALTER TABLE "design" ADD COLUMN IF NOT EXISTS "lifetime_type" VARCHAR(20) DEFAULT 'DUAL';
        ALTER TABLE "design" ADD COLUMN IF NOT EXISTS "max_usage" INTEGER DEFAULT 500;
        ALTER TABLE "design" ADD COLUMN IF NOT EXISTS "current_usage" INTEGER DEFAULT 0;
        ALTER TABLE "cell_part" ADD COLUMN IF NOT EXISTS "lifetime_type" VARCHAR(20) DEFAULT 'DUAL';
        ALTER TABLE "cell_part" ADD COLUMN IF NOT EXISTS "max_usage" INTEGER DEFAULT 500;
        ALTER TABLE "cell_part" ADD COLUMN IF NOT EXISTS "current_usage" INTEGER DEFAULT 0;
      `);
      console.log('2-Way lifetime columns verified / migrated successfully.');
    } catch (err) {
      console.warn('Could not run raw migration for 2-way lifetime columns:', err);
    }
  }
}
