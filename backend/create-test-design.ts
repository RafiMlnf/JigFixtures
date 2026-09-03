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
  const line = await prisma.line.findFirst();
  const process = await prisma.process.findFirst();

  if (!line || !process) {
    console.error('Lines or Processes not found! Run the seed script first.');
    return;
  }

  const noReg = 'REG-TEST-999';
  const assyPartName = 'TEST DESIGN';
  const noItem = 'ITEM-TEST-999';

  const existing = await prisma.design.findFirst({
    where: { noReg }
  });

  if (existing) {
    console.log(`Test design already exists: ${existing.id}`);
    return;
  }

  const newDesign = await prisma.design.create({
    data: {
      noReg,
      assyPartName,
      noItem,
      qty: '1',
      type: 'JF',
      lineId: line.id,
      processId: process.id,
      minimumStock: 2,
      actualStock: 0,
      revStatus: 'N/A',
      lifecycleStatus: 'ACTIVE',
      documents: {
        create: [
          {
            path2D: null,
            loc2D: null,
            approvalStatus: 'APPROVED'
          }
        ]
      }
    }
  });

  console.log(`Successfully created test design: ${newDesign.assyPartName} (${newDesign.noReg}) ID: ${newDesign.id}`);
}

main()
  .catch((e) => {
    console.error(e);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
