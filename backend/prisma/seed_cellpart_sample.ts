import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const connectionString = process.env.DATABASE_URL;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  let designs = await prisma.design.findMany({ take: 5 });
  console.log(`Found ${designs.length} designs.`);

  if (designs.length === 0) {
    let line = await prisma.line.findFirst();
    if (!line) {
      line = await prisma.line.create({
        data: { lineName: 'Line 1 - Main Assy', lineCode: 'L1' },
      });
    }

    let process = await prisma.process.findFirst();
    if (!process) {
      process = await prisma.process.create({
        data: { name: 'OP10 - Welding', code: 'OP10' },
      });
    }

    let vendor = await prisma.vendor.findFirst();

    const sampleDesign = await prisma.design.create({
      data: {
        noReg: 'JF-SAMPLE-001',
        assyPartName: 'Jig Fixture Welding Frame A',
        qty: '1',
        noItem: 'ITEM-WF01',
        type: 'JF',
        lineId: line.id,
        processId: process.id,
        minimumStock: 2,
        actualStock: 2,
        lifetimeDays: 180,
        revStatus: '0',
        lifecycleStatus: 'ACTIVE',
        vendorId: vendor ? vendor.id : undefined,
      },
    });
    designs.push(sampleDesign);
    console.log('Created sample design:', sampleDesign.noReg);
  }

  for (const d of designs) {
    const existing = await prisma.cellPart.findMany({ where: { designId: d.id } });
    if (existing.length === 0) {
      const now = new Date();
      // 1. SAFE (~150d left)
      const safeInstall = new Date(now.getTime() - 30 * 86400000);
      await prisma.cellPart.create({
        data: {
          designId: d.id,
          partNumber: `CP-${d.noReg.replace(/[^a-zA-Z0-9]/g, '')}-01`,
          name: 'Guide Pin Locator High Carbon',
          description: 'Material SKD11 Hardened 58-60 HRC',
          lifetimeDays: 180,
          installDate: safeInstall,
          minimumStock: 2,
          actualStock: 3,
          pdfPageIndex: 2,
        },
      });

      // 2. WARNING (≤35 days left, e.g. 15 days left)
      const warningInstall = new Date(now.getTime() - 165 * 86400000);
      await prisma.cellPart.create({
        data: {
          designId: d.id,
          partNumber: `CP-${d.noReg.replace(/[^a-zA-Z0-9]/g, '')}-02`,
          name: 'Clamp Jaw Bushing Bronze',
          description: 'Phosphor Bronze Bushing with self-lubrication',
          lifetimeDays: 180,
          installDate: warningInstall,
          minimumStock: 4,
          actualStock: 1,
          pdfPageIndex: 3,
        },
      });

      // 3. OVERDUE (-15 days left)
      const overdueInstall = new Date(now.getTime() - 195 * 86400000);
      await prisma.cellPart.create({
        data: {
          designId: d.id,
          partNumber: `CP-${d.noReg.replace(/[^a-zA-Z0-9]/g, '')}-03`,
          name: 'Wear Plate Stopper Bottom',
          description: 'Tough pitch copper backing plate',
          lifetimeDays: 180,
          installDate: overdueInstall,
          minimumStock: 2,
          actualStock: 0,
          pdfPageIndex: 4,
        },
      });

      console.log(`Seeded 3 sample CellParts for ${d.noReg}`);
    }
  }

  console.log('Sample CellParts seeded successfully.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
