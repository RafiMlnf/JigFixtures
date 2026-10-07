-- Migration: Add TPM fields and new TPM tables
-- Safe migration: only ADD columns, no data loss

-- AlterTable: Add missing columns to "design"
ALTER TABLE "design"
  ADD COLUMN IF NOT EXISTS "lifetime_type" TEXT NOT NULL DEFAULT 'DUAL',
  ADD COLUMN IF NOT EXISTS "max_usage" INTEGER NOT NULL DEFAULT 500,
  ADD COLUMN IF NOT EXISTS "current_usage" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "tpm_schedule_start" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "tpm_schedule_deadline" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "tpm_lifetime_set_at" TIMESTAMP(3);

-- AlterTable: Add missing columns to "cell_part"
ALTER TABLE "cell_part"
  ADD COLUMN IF NOT EXISTS "lifetime_type" TEXT NOT NULL DEFAULT 'DUAL',
  ADD COLUMN IF NOT EXISTS "max_usage" INTEGER NOT NULL DEFAULT 500,
  ADD COLUMN IF NOT EXISTS "current_usage" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "material" TEXT,
  ADD COLUMN IF NOT EXISTS "qty" TEXT DEFAULT '1',
  ADD COLUMN IF NOT EXISTS "tpm_schedule_start" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "tpm_schedule_deadline" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "tpm_lifetime_set_at" TIMESTAMP(3);

-- CreateTable: tpm_checklist
CREATE TABLE IF NOT EXISTS "tpm_checklist" (
  "id" TEXT NOT NULL,
  "design_id" TEXT NOT NULL,
  "cell_part_id" TEXT,
  "inspector_name" TEXT NOT NULL,
  "shift" TEXT NOT NULL DEFAULT 'Shift 1',
  "check_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "overall_result" TEXT NOT NULL DEFAULT 'OK',
  "cleaning_status" TEXT NOT NULL DEFAULT 'OK',
  "locator_pin_status" TEXT NOT NULL DEFAULT 'OK',
  "clamping_status" TEXT NOT NULL DEFAULT 'OK',
  "sensor_status" TEXT NOT NULL DEFAULT 'OK',
  "bolts_status" TEXT NOT NULL DEFAULT 'OK',
  "lubrication_status" TEXT NOT NULL DEFAULT 'OK',
  "notes" TEXT,
  "link_to_abnormality" BOOLEAN NOT NULL DEFAULT false,
  "abnormality_id" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "tpm_checklist_pkey" PRIMARY KEY ("id")
);

-- CreateTable: tpm_maintenance_log
CREATE TABLE IF NOT EXISTS "tpm_maintenance_log" (
  "id" TEXT NOT NULL,
  "design_id" TEXT NOT NULL,
  "cell_part_id" TEXT,
  "action_type" TEXT NOT NULL DEFAULT 'PREVENTIVE',
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "performed_by" TEXT NOT NULL,
  "performed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "duration_minutes" INTEGER DEFAULT 60,
  "parts_replaced" TEXT,
  "status" TEXT NOT NULL DEFAULT 'COMPLETED',
  "cost" DOUBLE PRECISION DEFAULT 0,
  "reset_lifetime" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "tpm_maintenance_log_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey: tpm_checklist -> design
ALTER TABLE "tpm_checklist" DROP CONSTRAINT IF EXISTS "tpm_checklist_design_id_fkey";
ALTER TABLE "tpm_checklist" ADD CONSTRAINT "tpm_checklist_design_id_fkey"
  FOREIGN KEY ("design_id") REFERENCES "design"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: tpm_checklist -> cell_part
ALTER TABLE "tpm_checklist" DROP CONSTRAINT IF EXISTS "tpm_checklist_cell_part_id_fkey";
ALTER TABLE "tpm_checklist" ADD CONSTRAINT "tpm_checklist_cell_part_id_fkey"
  FOREIGN KEY ("cell_part_id") REFERENCES "cell_part"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey: tpm_maintenance_log -> design
ALTER TABLE "tpm_maintenance_log" DROP CONSTRAINT IF EXISTS "tpm_maintenance_log_design_id_fkey";
ALTER TABLE "tpm_maintenance_log" ADD CONSTRAINT "tpm_maintenance_log_design_id_fkey"
  FOREIGN KEY ("design_id") REFERENCES "design"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: tpm_maintenance_log -> cell_part
ALTER TABLE "tpm_maintenance_log" DROP CONSTRAINT IF EXISTS "tpm_maintenance_log_cell_part_id_fkey";
ALTER TABLE "tpm_maintenance_log" ADD CONSTRAINT "tpm_maintenance_log_cell_part_id_fkey"
  FOREIGN KEY ("cell_part_id") REFERENCES "cell_part"("id") ON DELETE SET NULL ON UPDATE CASCADE;
