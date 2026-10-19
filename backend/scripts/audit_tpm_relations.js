// Cross-check relasi flow TPM: cari "tali putus" (orphan / tidak konsisten)
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');
const prisma = new PrismaClient({ adapter: new PrismaPg(new Pool({ connectionString: process.env.DATABASE_URL })) });

(async () => {
  const [designs, cps, checklists, logs, repl, abns] = await Promise.all([
    prisma.design.findMany({ select: { id: true } }),
    prisma.childPart.findMany({ select: { id: true, designId: true } }),
    prisma.tpmChecklist.findMany(),
    prisma.tpmMaintenanceLog.findMany(),
    prisma.partReplacementLog.findMany(),
    prisma.abnormality.findMany({ select: { id: true, designId: true } }),
  ]);
  const dSet = new Set(designs.map((d) => d.id));
  const cpMap = new Map(cps.map((c) => [c.id, c.designId]));
  const aMap = new Map(abns.map((a) => [a.id, a.designId]));

  const report = {
    counts: { designs: designs.length, childParts: cps.length, checklists: checklists.length, logs: logs.length, replacements: repl.length, abnormalities: abns.length },
    checklist_abnormalityId_orphan: checklists.filter((c) => c.abnormalityId && !aMap.has(c.abnormalityId)).length,
    checklist_abnormality_design_mismatch: checklists.filter((c) => c.abnormalityId && aMap.has(c.abnormalityId) && aMap.get(c.abnormalityId) !== c.designId).length,
    checklist_childPart_not_in_design: checklists.filter((c) => c.childPartId && cpMap.get(c.childPartId) !== c.designId).length,
    checklist_ng_linked_but_no_abnormality: checklists.filter((c) => c.overallResult === 'NG' && c.linkToAbnormality && !c.abnormalityId).length,
    log_childPart_not_in_design: logs.filter((l) => l.childPartId && cpMap.get(l.childPartId) !== l.designId).length,
    log_childPart_nulled_by_delete: logs.filter((l) => !l.childPartId && /renew|part/i.test(l.title + ' ' + (l.partsReplaced || ''))).length,
    replacement_childPart_null: repl.filter((r) => !r.childPartId).length,
    replacement_childPart_not_in_design: repl.filter((r) => r.childPartId && cpMap.get(r.childPartId) !== r.designId).length,
    childPart_without_design: cps.filter((c) => !dSet.has(c.designId)).length,
  };
  console.log(JSON.stringify(report, null, 2));
  await prisma.$disconnect();
})().catch((e) => { console.error(e.message); process.exit(1); });
