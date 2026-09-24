import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import * as dotenv from 'dotenv';

dotenv.config();

const connectionString = process.env.DATABASE_URL;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('--- Clearing Master Jig & Fixture Data ---');
  console.log('Keeping: User, Role, Line, Process, Vendor intact.');

  // 1. Delete TPM records
  try {
    const tpmChecklistCount = await prisma.tpmChecklist.deleteMany({});
    console.log(`Deleted ${tpmChecklistCount.count} TPM checklist records.`);
  } catch (e: any) {
    console.log('Skipped TPM checklist (table might not exist yet).');
  }

  try {
    const tpmLogCount = await prisma.tpmMaintenanceLog.deleteMany({});
    console.log(`Deleted ${tpmLogCount.count} TPM maintenance log records.`);
  } catch (e: any) {
    console.log('Skipped TPM log (table might not exist yet).');
  }

  // 2. Delete CellPart records
  const cellPartCount = await prisma.cellPart.deleteMany({});
  console.log(`Deleted ${cellPartCount.count} CellPart records.`);

  // 3. Delete Abnormality records
  const abnormalityCount = await prisma.abnormality.deleteMany({});
  console.log(`Deleted ${abnormalityCount.count} abnormality records.`);

  // 4. Delete Approval records
  const approvalCount = await prisma.approval.deleteMany({});
  console.log(`Deleted ${approvalCount.count} approval records.`);

  // 5. Delete Notification records
  const notificationCount = await prisma.notification.deleteMany({});
  console.log(`Deleted ${notificationCount.count} notification records.`);

  // 6. Delete InventoryLog records
  const inventoryLogCount = await prisma.inventoryLog.deleteMany({});
  console.log(`Deleted ${inventoryLogCount.count} inventoryLog records.`);

  // 7. Delete Document records
  const docCount = await prisma.document.deleteMany({});
  console.log(`Deleted ${docCount.count} document records.`);

  // 8. Delete RevisionHistory records
  const revHistCount = await prisma.revisionHistory.deleteMany({});
  console.log(`Deleted ${revHistCount.count} revisionHistory records.`);

  // 9. Delete Design (Master Jig & Fixture) records
  const jigCount = await prisma.design.deleteMany({});
  console.log(`Deleted ${jigCount.count} master design/jig records.`);

  console.log('Master Jig data successfully cleared without affecting Users & Roles.');
}

main()
  .catch((e) => {
    console.error('Error clearing master jig data:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    pool.end();
  });
