import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import * as dotenv from 'dotenv';
import * as bcrypt from 'bcrypt';

dotenv.config();

const connectionString = process.env.DATABASE_URL;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('--- Seeding Roles, Users, Lines, and Processes only ---');
  console.log('NOTE: Master Jig / Fixture data is NOT seeded (kept empty).');

  // 1. Seed Roles
  const rolesData = [
    { name: 'PE_JIG_FIXTURE' },
    { name: 'PE_SECTION_HEAD' },
    { name: 'PE_DEPT_HEAD' },
    { name: 'TAMU' },
  ];

  const rolesMap: Record<string, string> = {};
  for (const r of rolesData) {
    const role = await prisma.role.upsert({
      where: { name: r.name },
      update: {},
      create: r,
    });
    rolesMap[r.name] = role.id;
  }
  console.log('✔ Roles verified / seeded.');

  // 2. Seed Default Users
  const passwordHash = bcrypt.hashSync('password', 10);
  const adminPasswordHash = bcrypt.hashSync('admin123', 10);

  const users = [
    {
      email: 'admin',
      name: 'PIC Jig Fixture',
      npk: 'NPK001',
      roleId: rolesMap['PE_JIG_FIXTURE'],
      password: adminPasswordHash,
    },
    {
      email: 'sec@example.com',
      name: 'M. Fariedl (Section Head)',
      npk: 'NPK002',
      roleId: rolesMap['PE_SECTION_HEAD'],
      password: passwordHash,
    },
    {
      email: 'dept@example.com',
      name: 'Rahmat K. (Dept Head)',
      npk: 'NPK003',
      roleId: rolesMap['PE_DEPT_HEAD'],
      password: passwordHash,
    },
    {
      email: 'guest@example.com',
      name: 'Tamu / Guest View Only',
      npk: 'NPK004',
      roleId: rolesMap['TAMU'],
      password: passwordHash,
    },
  ];

  for (const user of users) {
    await prisma.user.upsert({
      where: { email: user.email },
      update: {
        name: user.name,
        npk: user.npk,
        roleId: user.roleId,
        password: user.password,
      },
      create: user,
    });
  }
  console.log('✔ Default users verified / seeded.');

  // 3. Default Vendor
  await prisma.vendor.upsert({
    where: { id: 'default-vendor' },
    update: {},
    create: {
      id: 'default-vendor',
      name: 'Internal Workshop PE',
      code: 'VND001',
    },
  });
  console.log('✔ Default vendor verified / seeded.');

  // 4. Default Production Lines
  const defaultLines = [
    { lineName: 'Auto Assy Steering Stem', lineCode: 'AUTO_ASSY_STEERING_STEM' },
    { lineName: 'D38-Hub Clutch', lineCode: 'D38_HUB_CLUTCH' },
    { lineName: 'UB Robot', lineCode: 'UB_ROBOT' },
    { lineName: 'Machining Line 1', lineCode: 'MACHINING_LINE_1' },
    { lineName: 'Machining Line 2', lineCode: 'MACHINING_LINE_2' },
  ];

  for (const line of defaultLines) {
    const existing = await prisma.line.findFirst({ where: { lineCode: line.lineCode } });
    if (!existing) {
      await prisma.line.create({ data: line });
    }
  }
  console.log('✔ Production lines verified / seeded.');

  // 5. Default Processes
  const defaultProcesses = [
    { name: 'OP#1', code: 'OP1' },
    { name: 'OP#2', code: 'OP2' },
    { name: 'OP#3', code: 'OP3' },
    { name: 'OP#4', code: 'OP4' },
    { name: 'OP#5', code: 'OP5' },
    { name: 'Assembly', code: 'ASSY' },
    { name: 'Sub Assy', code: 'SUB_ASSY' },
  ];

  for (const proc of defaultProcesses) {
    const existing = await prisma.process.findFirst({ where: { code: proc.code } });
    if (!existing) {
      await prisma.process.create({ data: proc });
    }
  }
  console.log('✔ Production processes verified / seeded.');

  // 6. Ensure Master Jig (Design) is completely empty
  const designCount = await prisma.design.count();
  console.log(`\nStatus Master Data Jig saat ini: ${designCount} data.`);
}

main()
  .catch((e) => {
    console.error('Error in seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    pool.end();
  });
