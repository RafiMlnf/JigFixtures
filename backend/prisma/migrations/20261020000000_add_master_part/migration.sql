-- CreateTable
CREATE TABLE "master_part" (
    "id" TEXT NOT NULL,
    "part_number" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "material" TEXT,
    "minimum_stock" INTEGER NOT NULL DEFAULT 0,
    "actual_stock" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "master_part_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "master_part_part_number_key" ON "master_part"("part_number");

-- AlterTable
ALTER TABLE "child_part" ADD COLUMN "master_part_id" TEXT;

-- AddForeignKey
ALTER TABLE "child_part" ADD CONSTRAINT "child_part_master_part_id_fkey" FOREIGN KEY ("master_part_id") REFERENCES "master_part"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill: satu master per part_number dari data child_part yang sudah ada
INSERT INTO "master_part" ("id", "part_number", "name", "description", "material", "minimum_stock", "actual_stock", "updated_at")
SELECT 'mp_' || md5("part_number"),
       "part_number",
       MIN("name"),
       MIN("description"),
       MIN("material"),
       MAX("minimum_stock"),
       MAX("actual_stock"),
       CURRENT_TIMESTAMP
FROM "child_part"
GROUP BY "part_number";

UPDATE "child_part" SET "master_part_id" = 'mp_' || md5("part_number");
