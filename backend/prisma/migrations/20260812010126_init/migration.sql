/*
  Warnings:

  - You are about to drop the `Approval` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `InventoryLog` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `JigFixtureItem` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Notification` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `User` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "DesignType" AS ENUM ('JF', 'EQ');

-- CreateEnum
CREATE TYPE "AbnormalityStatus" AS ENUM ('OPEN', 'MONITORING', 'CLOSED');

-- CreateEnum
CREATE TYPE "LifecycleStatus" AS ENUM ('ACTIVE', 'UNDER_REPAIR', 'UNDER_IMPROVEMENT', 'OBSOLETE', 'SCRAP');

-- DropForeignKey
ALTER TABLE "Approval" DROP CONSTRAINT "Approval_deptHeadId_fkey";

-- DropForeignKey
ALTER TABLE "Approval" DROP CONSTRAINT "Approval_itemId_fkey";

-- DropForeignKey
ALTER TABLE "Approval" DROP CONSTRAINT "Approval_sectionHeadId_fkey";

-- DropForeignKey
ALTER TABLE "Approval" DROP CONSTRAINT "Approval_submittedById_fkey";

-- DropForeignKey
ALTER TABLE "InventoryLog" DROP CONSTRAINT "InventoryLog_changedById_fkey";

-- DropForeignKey
ALTER TABLE "InventoryLog" DROP CONSTRAINT "InventoryLog_itemId_fkey";

-- DropForeignKey
ALTER TABLE "Notification" DROP CONSTRAINT "Notification_itemId_fkey";

-- DropForeignKey
ALTER TABLE "Notification" DROP CONSTRAINT "Notification_userId_fkey";

-- DropTable
DROP TABLE "Approval";

-- DropTable
DROP TABLE "InventoryLog";

-- DropTable
DROP TABLE "JigFixtureItem";

-- DropTable
DROP TABLE "Notification";

-- DropTable
DROP TABLE "User";

-- DropEnum
DROP TYPE "UserRole";

-- CreateTable
CREATE TABLE "role" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "npk" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "role_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "line" (
    "id" TEXT NOT NULL,
    "line_name" TEXT NOT NULL,
    "line_code" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "line_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "process" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "process_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vendor" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vendor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "design" (
    "id" TEXT NOT NULL,
    "no_reg" TEXT NOT NULL,
    "type" "DesignType" NOT NULL DEFAULT 'JF',
    "no_item" TEXT NOT NULL,
    "qty" TEXT NOT NULL,
    "rev_status" TEXT,
    "line_id" TEXT NOT NULL,
    "process_id" TEXT NOT NULL,
    "vendor_id" TEXT,
    "inventory_status" TEXT NOT NULL DEFAULT 'GREEN',
    "abnormality_status" TEXT NOT NULL DEFAULT 'RESOLVED',
    "lifecycle_status" "LifecycleStatus" NOT NULL DEFAULT 'ACTIVE',
    "assy_part_name" TEXT NOT NULL,
    "minimum_stock" INTEGER NOT NULL DEFAULT 0,
    "actual_stock" INTEGER NOT NULL DEFAULT 0,
    "design_date_last" TIMESTAMP(3),
    "design_date_new" TIMESTAMP(3),
    "new_visual_design" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "design_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document" (
    "id" TEXT NOT NULL,
    "design_id" TEXT NOT NULL,
    "2d_path" TEXT,
    "2d_loc" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "approval_status" TEXT NOT NULL DEFAULT 'APPROVED',

    CONSTRAINT "document_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "revision_history" (
    "id" TEXT NOT NULL,
    "design_id" TEXT NOT NULL,
    "rev_status" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "changed_by_id" TEXT NOT NULL,
    "vendor_id" TEXT,
    "po_number" TEXT,
    "cost" DOUBLE PRECISION DEFAULT 0,
    "lead_time" INTEGER,
    "approved_by_name" TEXT,
    "3d_path" TEXT,
    "3d_loc" TEXT,
    "2d_path" TEXT,
    "2d_loc" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "revision_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "abnormality" (
    "id" TEXT NOT NULL,
    "design_id" TEXT NOT NULL,
    "reported_by_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "status" "AbnormalityStatus" NOT NULL DEFAULT 'OPEN',
    "date_found" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "found_by" TEXT NOT NULL,
    "root_cause" TEXT NOT NULL,
    "temp_action" TEXT NOT NULL,
    "corrective_action" TEXT NOT NULL,
    "action_pic" TEXT NOT NULL,
    "link_to_revision" BOOLEAN NOT NULL DEFAULT false,
    "link_to_spare" BOOLEAN NOT NULL DEFAULT false,
    "resolved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "abnormality_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_log" (
    "id" TEXT NOT NULL,
    "design_id" TEXT NOT NULL,
    "changed_by_id" TEXT NOT NULL,
    "prev_min_stock" INTEGER NOT NULL,
    "new_min_stock" INTEGER NOT NULL,
    "prev_act_stock" INTEGER NOT NULL,
    "new_act_stock" INTEGER NOT NULL,
    "indicator" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inventory_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "design_id" TEXT,
    "user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "approval" (
    "id" TEXT NOT NULL,
    "type" "ApprovalType" NOT NULL,
    "status" "ApprovalStatus" NOT NULL DEFAULT 'WAITING',
    "design_id" TEXT NOT NULL,
    "revision_note" TEXT,
    "submitted_by_id" TEXT NOT NULL,
    "submitted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "section_head_id" TEXT,
    "section_status" "ApprovalStatus" NOT NULL DEFAULT 'WAITING',
    "section_comment" TEXT,
    "section_at" TIMESTAMP(3),
    "dept_head_id" TEXT,
    "dept_status" "ApprovalStatus" NOT NULL DEFAULT 'WAITING',
    "dept_comment" TEXT,
    "dept_at" TIMESTAMP(3),
    "final_status" "ApprovalStatus" NOT NULL DEFAULT 'WAITING',
    "final_comment" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "approval_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "role_name_key" ON "role"("name");

-- CreateIndex
CREATE UNIQUE INDEX "user_npk_key" ON "user"("npk");

-- CreateIndex
CREATE UNIQUE INDEX "user_email_key" ON "user"("email");

-- CreateIndex
CREATE UNIQUE INDEX "design_no_reg_key" ON "design"("no_reg");

-- AddForeignKey
ALTER TABLE "user" ADD CONSTRAINT "user_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "role"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "design" ADD CONSTRAINT "design_line_id_fkey" FOREIGN KEY ("line_id") REFERENCES "line"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "design" ADD CONSTRAINT "design_process_id_fkey" FOREIGN KEY ("process_id") REFERENCES "process"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "design" ADD CONSTRAINT "design_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "vendor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document" ADD CONSTRAINT "document_design_id_fkey" FOREIGN KEY ("design_id") REFERENCES "design"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "revision_history" ADD CONSTRAINT "revision_history_design_id_fkey" FOREIGN KEY ("design_id") REFERENCES "design"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "revision_history" ADD CONSTRAINT "revision_history_changed_by_id_fkey" FOREIGN KEY ("changed_by_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "revision_history" ADD CONSTRAINT "revision_history_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "vendor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "abnormality" ADD CONSTRAINT "abnormality_design_id_fkey" FOREIGN KEY ("design_id") REFERENCES "design"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "abnormality" ADD CONSTRAINT "abnormality_reported_by_id_fkey" FOREIGN KEY ("reported_by_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_log" ADD CONSTRAINT "inventory_log_design_id_fkey" FOREIGN KEY ("design_id") REFERENCES "design"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_log" ADD CONSTRAINT "inventory_log_changed_by_id_fkey" FOREIGN KEY ("changed_by_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification" ADD CONSTRAINT "notification_design_id_fkey" FOREIGN KEY ("design_id") REFERENCES "design"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification" ADD CONSTRAINT "notification_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval" ADD CONSTRAINT "approval_design_id_fkey" FOREIGN KEY ("design_id") REFERENCES "design"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval" ADD CONSTRAINT "approval_submitted_by_id_fkey" FOREIGN KEY ("submitted_by_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval" ADD CONSTRAINT "approval_section_head_id_fkey" FOREIGN KEY ("section_head_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval" ADD CONSTRAINT "approval_dept_head_id_fkey" FOREIGN KEY ("dept_head_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
