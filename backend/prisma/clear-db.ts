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
  console.log('Clearing database records...');

  // Delete in order to satisfy foreign key constraints
  const abnormalityCount = await prisma.abnormality.deleteMany({});
  console.log(`Deleted ${abnormalityCount.count} abnormality records.`);

  const approvalCount = await prisma.approval.deleteMany({});
  console.log(`Deleted ${approvalCount.count} approval records.`);

  const notificationCount = await prisma.notification.deleteMany({});
  console.log(`Deleted ${notificationCount.count} notification records.`);

  const inventoryLogCount = await prisma.inventoryLog.deleteMany({});
  console.log(`Deleted ${inventoryLogCount.count} inventoryLog records.`);

  const docCount = await prisma.document.deleteMany({});
  console.log(`Deleted ${docCount.count} document records.`);

  const revHistCount = await prisma.revisionHistory.deleteMany({});
  console.log(`Deleted ${revHistCount.count} revisionHistory records.`);

  const jigCount = await prisma.design.deleteMany({});
  console.log(`Deleted ${jigCount.count} design records.`);

  const userCount = await prisma.user.deleteMany({});
  console.log(`Deleted ${userCount.count} user records.`);

  console.log('Database successfully cleared.');
}

main()
  .catch((e) => {
    console.error('Error during database clear:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    pool.end();
  });
