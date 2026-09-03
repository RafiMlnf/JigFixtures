-- AlterTable
ALTER TABLE "design" ADD COLUMN     "lifetime_days" INTEGER NOT NULL DEFAULT 180;

-- CreateTable
CREATE TABLE "cell_part" (
    "id" TEXT NOT NULL,
    "design_id" TEXT NOT NULL,
    "part_number" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "lifetime_days" INTEGER NOT NULL DEFAULT 180,
    "install_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_renewal_date" TIMESTAMP(3),
    "reminder_sent" BOOLEAN NOT NULL DEFAULT false,
    "minimum_stock" INTEGER NOT NULL DEFAULT 0,
    "actual_stock" INTEGER NOT NULL DEFAULT 0,
    "pdf_page_index" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cell_part_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "cell_part" ADD CONSTRAINT "cell_part_design_id_fkey" FOREIGN KEY ("design_id") REFERENCES "design"("id") ON DELETE CASCADE ON UPDATE CASCADE;
