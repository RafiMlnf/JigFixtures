import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import * as bcrypt from 'bcrypt';
import * as path from 'path';
import ExcelJS from 'exceljs';
import * as dotenv from 'dotenv';

dotenv.config();

const connectionString = process.env.DATABASE_URL;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('Seeding database with Master & Transactional architecture...');

  // 1. Create Default Roles
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
  console.log('Roles seeded successfully.');

  // 2. Create Default Users linked to Roles
  const passwordHash = bcrypt.hashSync('password', 10);
  const adminPasswordHash = bcrypt.hashSync('admin123', 10);

  const users = [
    {
      email: 'admin',
      name: 'PIC',
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
      name: 'Guest',
      npk: 'NPK004',
      roleId: rolesMap['TAMU'],
      password: passwordHash,
    },
  ];

  const seededUsersMap: Record<string, string> = {};
  for (const user of users) {
    const u = await prisma.user.upsert({
      where: { email: user.email },
      update: {
        npk: user.npk,
        roleId: user.roleId,
      },
      create: user,
    });
    seededUsersMap[user.email] = u.id;
  }
  console.log('Default users seeded successfully.');

  // 3. Create a Default Vendor
  const defaultVendor = await prisma.vendor.upsert({
    where: { id: 'default-vendor' },
    update: {},
    create: {
      id: 'default-vendor',
      name: 'Internal Workshop PE',
      code: 'VND001',
    },
  });
  console.log('Default vendor seeded.');

  // 4. Parse Excel Master List
  const excelPath = path.resolve(__dirname, '../../JIG & FIXTURE DESIGN MASTER LIST.xlsx');
  console.log(`Loading Excel from: ${excelPath}`);

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(excelPath);
  const sheet = workbook.getWorksheet('MASTER LIST');

  if (!sheet) {
    throw new Error('Sheet "MASTER LIST" not found in the excel file.');
  }

  // Gather rows
  const rows: any[] = [];
  sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber < 7) return; // skip header lines
    rows.push({
      lineProduct: (row.getCell('B').value?.toString() || '').trim(),
      processVal: (row.getCell('C').value?.toString() || '').trim(),
      typeVal: row.getCell('D').value?.toString() || 'JF',
      noItemAssy: row.getCell('E').value?.toString() || '',
      assyPartName: row.getCell('F').value?.toString() || '',
      noReg: row.getCell('H').value?.toString() || '',
      qty: row.getCell('J').value?.toString() || '1',
      dateLastVal: row.getCell('K').value,
      dateNewVal: row.getCell('L').value,
      revStatus: row.getCell('M').value?.toString() || '0',
      docLocation2D: row.getCell('N').value?.toString() || null,
      docLocation3D: row.getCell('O').value?.toString() || null,
    });
  });

  // Unique Lines & Processes to create Master Data
  const uniqueLines = Array.from(new Set(rows.map((r) => r.lineProduct).filter(Boolean)));
  const uniqueProcesses = Array.from(new Set(rows.map((r) => r.processVal).filter(Boolean)));

  const lineMap: Record<string, string> = {};
  for (const lName of uniqueLines) {
    const lineCode = lName.toUpperCase().replace(/\s+/g, '_');
    const line = await prisma.line.create({
      data: {
        lineName: lName,
        lineCode,
      },
    });
    lineMap[lName] = line.id;
  }

  const processMap: Record<string, string> = {};
  for (const pName of uniqueProcesses) {
    const pCode = pName.toUpperCase().replace(/\s+/g, '_');
    const proc = await prisma.process.create({
      data: {
        name: pName,
        code: pCode,
      },
    });
    processMap[pName] = proc.id;
  }

  console.log(`Seeded ${Object.keys(lineMap).length} Lines and ${Object.keys(processMap).length} Processes.`);

  let designsSeeded = 0;
  let imageIndex = 0;

  for (const r of rows) {
    const {
      lineProduct,
      processVal,
      typeVal,
      noItemAssy,
      assyPartName,
      noReg,
      qty,
      dateLastVal,
      dateNewVal,
      revStatus,
      docLocation2D,
      docLocation3D,
    } = r;

    if (!noReg || !lineProduct) {
      continue;
    }

    const designDateLast = dateLastVal instanceof Date ? dateLastVal : null;
    const designDateNew = dateNewVal instanceof Date ? dateNewVal : null;

    let newVisualDesign: string | null = null;
    if (typeVal === 'JF') {
      newVisualDesign = `http://localhost:3001/images/MASTER_LIST_img${imageIndex}.png`;
      imageIndex = (imageIndex + 1) % 65;
    }

    const minimumStock = typeVal === 'JF' ? 2 : 0;
    const actualStock = typeVal === 'JF' ? Math.floor(Math.random() * 4) + 1 : 0;

    const lineId = lineMap[lineProduct];
    const processId = processMap[processVal] || processMap[uniqueProcesses[0]]; // fallback to first process if empty

    const design = await prisma.design.upsert({
      where: { noReg },
      update: {
        type: typeVal === 'JF' ? 'JF' : 'EQ',
        noItem: noItemAssy,
        qty,
        revStatus,
        lineId,
        processId,
        vendorId: defaultVendor.id,
        assyPartName,
        minimumStock,
        actualStock,
        designDateLast,
        designDateNew,
        newVisualDesign,
      },
      create: {
        noReg,
        type: typeVal === 'JF' ? 'JF' : 'EQ',
        noItem: noItemAssy,
        qty,
        revStatus,
        lineId,
        processId,
        vendorId: defaultVendor.id,
        assyPartName,
        minimumStock,
        actualStock,
        designDateLast,
        designDateNew,
        newVisualDesign,
      },
    });

    // Create related document for design if docLocation2D is available
    if (docLocation2D) {
      await prisma.document.create({
        data: {
          designId: design.id,
          path2D: docLocation2D,
          loc2D: docLocation2D,
          approvalStatus: 'APPROVED',
        },
      });
    }

    designsSeeded++;
  }

  console.log(`Seeding complete. Seeded ${designsSeeded} Design records.`);

  // 5. Seed 5 Approval Requests for testing
  console.log('Seeding 5 Approval Requests for testing...');
  const testDesigns = await prisma.design.findMany({
    take: 5,
    orderBy: { noReg: 'asc' },
  });

  const creatorId = seededUsersMap['admin'];
  const secHeadId = seededUsersMap['sec@example.com'];
  const deptHeadId = seededUsersMap['dept@example.com'];

  if (testDesigns.length >= 5 && creatorId && secHeadId && deptHeadId) {
    const approvalNotes = [
      'Revisi diameter pin locator OP#1 PressFit agar presisi masuk ke bush.',
      'Penyesuaian limit stok minimal karena peningkatan volume produksi line stem.',
      'Modifikasi clamp bracket assembly untuk mencegah goresan pada part.',
      'Koreksi data aktual stok fisik bulanan.',
      'Perbaikan slider unit OP#4 Bending untuk mempermudah loading part.',
    ];

    for (let i = 0; i < 5; i++) {
      const design = testDesigns[i];
      const isDesign = i % 2 === 0;

      await prisma.approval.create({
        data: {
          type: isDesign ? 'DESIGN_REVISION' : 'INVENTORY_UPDATE',
          status: 'WAITING',
          designId: design.id,
          revisionNote: approvalNotes[i],
          submittedById: creatorId,
          sectionHeadId: secHeadId,
          deptHeadId: deptHeadId,
          sectionStatus: 'WAITING',
          deptStatus: 'WAITING',
          finalStatus: 'WAITING',
        },
      });
    }
    console.log('Seeded 5 test Approval requests successfully.');
  }
}

main()
  .catch((e) => {
    console.error('Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    pool.end();
  });
