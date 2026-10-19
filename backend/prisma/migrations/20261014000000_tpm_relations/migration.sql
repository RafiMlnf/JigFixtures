-- Hubungkan checklist TPM ke abnormality (sebelumnya hanya string tanpa FK)
UPDATE "tpm_checklist" SET "abnormality_id" = NULL
WHERE "abnormality_id" IS NOT NULL
  AND "abnormality_id" NOT IN (SELECT "id" FROM "abnormality");

ALTER TABLE "tpm_checklist"
  ADD CONSTRAINT "tpm_checklist_abnormality_id_fkey"
  FOREIGN KEY ("abnormality_id") REFERENCES "abnormality"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- Hubungkan log ACT dengan deadline PLAN
ALTER TABLE "tpm_maintenance_log" ADD COLUMN IF NOT EXISTS "planned_for" TIMESTAMPTZ;
