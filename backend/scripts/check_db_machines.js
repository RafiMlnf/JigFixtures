require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function run() {
  try {
    const machines = await prisma.$queryRawUnsafe('SELECT COUNT(*)::text as cnt FROM "machine"');
    console.log('Machine count in DB:', machines[0].cnt);
    const sample = await prisma.$queryRawUnsafe('SELECT * FROM "machine" LIMIT 5');
    console.log('Sample machines:', sample);
    const lines = await prisma.line.findMany();
    console.log('Lines in DB:', lines.map(l => ({ id: l.id, name: l.lineName, code: l.lineCode })));
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

run();
