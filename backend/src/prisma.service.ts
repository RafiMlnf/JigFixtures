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
        ALTER TABLE "design" ADD COLUMN IF NOT EXISTS "tpm_schedule_start" TIMESTAMPTZ;
        ALTER TABLE "design" ADD COLUMN IF NOT EXISTS "tpm_schedule_deadline" TIMESTAMPTZ;
        ALTER TABLE "design" ADD COLUMN IF NOT EXISTS "tpm_lifetime_set_at" TIMESTAMPTZ;
        ALTER TABLE "cell_part" ADD COLUMN IF NOT EXISTS "lifetime_type" VARCHAR(20) DEFAULT 'DUAL';
        ALTER TABLE "cell_part" ADD COLUMN IF NOT EXISTS "max_usage" INTEGER DEFAULT 500;
        ALTER TABLE "cell_part" ADD COLUMN IF NOT EXISTS "current_usage" INTEGER DEFAULT 0;
        ALTER TABLE "cell_part" ADD COLUMN IF NOT EXISTS "tpm_schedule_start" TIMESTAMPTZ;
        ALTER TABLE "cell_part" ADD COLUMN IF NOT EXISTS "tpm_schedule_deadline" TIMESTAMPTZ;
        ALTER TABLE "cell_part" ADD COLUMN IF NOT EXISTS "tpm_lifetime_set_at" TIMESTAMPTZ;

        CREATE TABLE IF NOT EXISTS "machine" (
          "id" VARCHAR(64) PRIMARY KEY,
          "name" VARCHAR(255) NOT NULL,
          "code" VARCHAR(100) NOT NULL,
          "line_id" TEXT NOT NULL,
          "design_id" TEXT,
          "location" VARCHAR(255),
          "description" TEXT,
          "status" VARCHAR(50) DEFAULT 'ACTIVE',
          "created_at" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
          "updated_at" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
        );

        ALTER TABLE "approval" ADD COLUMN IF NOT EXISTS "annotated_doc_path" TEXT;
        ALTER TABLE "approval" ADD COLUMN IF NOT EXISTS "markup_data" TEXT;
      `);
      console.log('Lifetime, TPM, Machine, and Approval markup columns/tables verified successfully.');
    } catch (err) {
      console.warn('Could not run raw migration for lifetime/TPM/machine:', err);
    }
  }
}
