require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function seedMachines() {
  try {
    const dataset = JSON.parse(
      fs.readFileSync(path.join(__dirname, '../extracted_xlsx/complete_machines_dataset.json'), 'utf-8')
    );

    console.log(`Starting seed for ${dataset.length} machines from NEW MAPPING EUY.xlsx...`);

    // 1. Fetch or create Lines in DB
    const existingLines = await prisma.line.findMany();
    const lineMap = new Map();
    existingLines.forEach(l => {
      lineMap.set(l.lineName.toLowerCase().trim(), l);
      if (l.lineCode) lineMap.set(l.lineCode.toLowerCase().trim(), l);
    });

    // Ensure all unique lines in dataset exist in "line" table
    const uniqueLineNames = [...new Set(dataset.map(d => d.lineName))];
    for (const lineName of uniqueLineNames) {
      const key = lineName.toLowerCase().trim();
      if (!lineMap.has(key)) {
        const code = lineName.toUpperCase().replace(/[^A-Z0-9]/g, '_').replace(/_+/g, '_');
        const createdLine = await prisma.line.create({
          data: {
            lineName,
            lineCode: code,
          },
        });
        lineMap.set(key, createdLine);
        console.log(`Created new line: ${lineName} (code: ${code})`);
      }
    }

    // 2. Fetch existing designs to auto-link matching designs if possible
    const designs = await prisma.design.findMany();
    const designMap = new Map();
    designs.forEach(d => {
      if (d.lineProduct) designMap.set(d.lineProduct.toLowerCase().trim(), d.id);
      if (d.noReg) designMap.set(d.noReg.toLowerCase().trim(), d.id);
    });

    // 3. Insert or update machines into "machine" table
    let inserted = 0;
    let updated = 0;

    for (let i = 0; i < dataset.length; i++) {
      const item = dataset[i];
      const lineObj = lineMap.get(item.lineName.toLowerCase().trim()) || existingLines[0];
      const machineId = `mch-${item.code.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;

      // Check if machine already exists
      const existing = await prisma.$queryRawUnsafe(
        `SELECT id FROM "machine" WHERE "code" = $1 OR "id" = $2 LIMIT 1`,
        item.code,
        machineId
      );

      const matchedDesignId = designMap.get(item.lineName.toLowerCase().trim()) || null;

      if (existing.length === 0) {
        await prisma.$executeRawUnsafe(
          `INSERT INTO "machine" ("id", "name", "code", "line_id", "design_id", "location", "description", "status")
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          machineId,
          item.name,
          item.code,
          lineObj.id,
          matchedDesignId,
          item.location,
          `Mesin ${item.code} pada area ${item.location}`,
          item.status
        );
        inserted++;
      } else {
        await prisma.$executeRawUnsafe(
          `UPDATE "machine" 
           SET "name" = $1, "line_id" = $2, "location" = $3, "description" = $4, "status" = $5, "updated_at" = CURRENT_TIMESTAMP
           WHERE "id" = $6`,
          item.name,
          lineObj.id,
          item.location,
          `Mesin ${item.code} pada area ${item.location}`,
          item.status,
          existing[0].id
        );
        updated++;
      }
    }

    console.log(`\nDONE! Inserted: ${inserted}, Updated: ${updated}, Total: ${dataset.length}`);

    // Verify
    const finalCount = await prisma.$queryRawUnsafe('SELECT COUNT(*)::text as cnt FROM "machine"');
    console.log(`Current machines in DB: ${finalCount[0].cnt}`);
  } catch (err) {
    console.error('Error seeding machines:', err);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

seedMachines();
