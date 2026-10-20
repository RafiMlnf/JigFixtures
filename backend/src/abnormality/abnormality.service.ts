import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreateAbnormalityDto } from './dto/create-abnormality.dto';

@Injectable()
export class AbnormalityService {
  constructor(private prisma: PrismaService) {}

  /** Create a new abnormality report and notify Section Head / Dept Head */
  async create(dto: CreateAbnormalityDto, userId: string) {
    const item = await this.prisma.design.findUnique({ where: { id: dto.itemId } });
    if (!item) throw new NotFoundException(`Item ${dto.itemId} not found`);

    // Create the abnormality record
    const abnormality = await this.prisma.abnormality.create({
      data: {
        designId: dto.itemId,
        reportedById: userId,
        type: dto.type,
        description: dto.description,
        status: dto.status || 'OPEN',
        dateFound: dto.dateFound ? new Date(dto.dateFound) : new Date(),
        foundBy: dto.foundBy,
        rootCause: dto.rootCause,
        tempAction: dto.tempAction,
        correctiveAction: dto.correctiveAction,
        actionPic: dto.actionPic,
        linkToRevision: dto.linkToRevision ?? false,
        linkToSpare: dto.linkToSpare ?? false,
      },
      include: {
        design: { select: { noReg: true, assyPartName: true } },
        reportedBy: { select: { name: true } },
      },
    });

    // Send notifications to Section Head and Dept Head
    const approvers = await this.prisma.user.findMany({
      where: { role: { name: { in: ['PE_SECTION_HEAD', 'PE_DEPT_HEAD'] } } },
    });

    for (const approver of approvers) {
      await this.prisma.notification.create({
        data: {
          type: 'ABNORMALITY_OPEN',
          title: `Abnormality Dilaporkan: ${item.noReg}`,
          message: `[${dto.type}] ${dto.description.substring(0, 80)}...`,
          designId: dto.itemId,
          userId: approver.id,
        },
      });
    }

    // Update abnormalityStatus field in Design transactional data
    const designStatus = abnormality.status === 'CLOSED' ? 'RESOLVED' : abnormality.status === 'MONITORING' ? 'IN_PROGRESS' : 'OPEN';
    await this.prisma.design.update({
      where: { id: dto.itemId },
      data: { abnormalityStatus: designStatus },
    });

    return abnormality;
  }

  /** Get all abnormality reports, newest first */
  async findAll() {
    const list = await this.prisma.abnormality.findMany({
      include: {
        design: {
          select: {
            noReg: true,
            assyPartName: true,
            type: true,
            line: { select: { lineName: true } },
            process: { select: { name: true } },
          },
        },
        reportedBy: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return list.map((item) => ({
      id: item.id,
      type: item.type,
      description: item.description,
      status: item.status,
      dateFound: item.dateFound,
      foundBy: item.foundBy,
      rootCause: item.rootCause,
      tempAction: item.tempAction,
      correctiveAction: item.correctiveAction,
      actionPic: item.actionPic,
      linkToRevision: item.linkToRevision,
      linkToSpare: item.linkToSpare,
      createdAt: item.createdAt,
      reportedBy: item.reportedBy,
      item: {
        noReg: item.design.noReg,
        assyPartName: item.design.assyPartName,
        lineProduct: item.design.line.lineName,
        process: item.design.process.name,
        type: item.design.type,
      },
    }));
  }

  /** Update status of an abnormality */
  async updateStatus(id: string, status: 'OPEN' | 'MONITORING' | 'CLOSED') {
    const existing = await this.prisma.abnormality.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`Abnormality ${id} not found`);

    const updated = await this.prisma.abnormality.update({
      where: { id },
      data: {
        status,
        resolvedAt: status === 'CLOSED' ? new Date() : undefined,
      },
    });

    // Update abnormalityStatus in Design
    const designStatus = status === 'CLOSED' ? 'RESOLVED' : status === 'MONITORING' ? 'IN_PROGRESS' : 'OPEN';
    await this.prisma.design.update({
      where: { id: existing.designId },
      data: { abnormalityStatus: designStatus },
    });

    return updated;
  }

  /** Get all registered machines with enriched Jig condition and TPM schedule status */
  async getMachinesDashboard(lineFilter?: string) {
    // Ensure table exists safely and has manual status override columns
    try {
      await this.prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "machine" (
          "id" VARCHAR(64) PRIMARY KEY,
          "name" VARCHAR(255) NOT NULL,
          "code" VARCHAR(100) NOT NULL,
          "line_id" TEXT NOT NULL,
          "design_id" TEXT,
          "location" VARCHAR(255),
          "description" TEXT,
          "status" VARCHAR(50) DEFAULT 'ACTIVE',
          "manual_jig_status" VARCHAR(20),
          "manual_tpm_status" VARCHAR(20),
          "created_at" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
          "updated_at" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
        );
      `);
      // Add columns if table already existed without them
      await this.prisma.$executeRawUnsafe(`
        DO $$
        BEGIN
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='machine' AND column_name='manual_jig_status') THEN
            ALTER TABLE "machine" ADD COLUMN "manual_jig_status" VARCHAR(20);
          END IF;
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='machine' AND column_name='manual_tpm_status') THEN
            ALTER TABLE "machine" ADD COLUMN "manual_tpm_status" VARCHAR(20);
          END IF;
        END $$;
      `);
    } catch (_) {}

    const machinesRaw: any[] = await this.prisma.$queryRawUnsafe(`
      SELECT m.*, l.line_name, l.line_code
      FROM "machine" m
      LEFT JOIN "line" l ON m.line_id = l.id
      ORDER BY m.name ASC
    `);

    // Fetch designs to evaluate jig condition & TPM schedule
    const designs = await this.prisma.design.findMany({
      include: {
        line: true,
        childParts: true,
        tpmChecklists: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    // Helper to evaluate item lifetime status consistent with TPM Service
    const getLifetimeStatus = (item: any): 'SAFE' | 'WARNING' | 'OVERDUE' => {
      const baseDate = item.lastRenewalDate || item.designDateNew || item.installDate || item.createdAt || new Date();
      const lifetimeDays = item.lifetimeDays ?? 180;
      const dueDate = new Date(new Date(baseDate).getTime() + lifetimeDays * 86400000);
      const daysRemaining = Math.ceil((dueDate.getTime() - Date.now()) / 86400000);

      if (daysRemaining <= 0) {
        return 'OVERDUE';
      }
      if (daysRemaining <= 35) {
        return 'WARNING';
      }
      return 'SAFE';
    };

    // Function to calculate Jig Condition (Green = SAFE, Yellow = WARNING, Red = OVERDUE)
    const calcJigStatus = (design: any): 'SAFE' | 'WARNING' | 'OVERDUE' => {
      if (!design) return 'SAFE';
      const mainStatus = getLifetimeStatus(design);
      if (mainStatus === 'OVERDUE') return 'OVERDUE';

      let hasWarning = mainStatus === 'WARNING';
      if (design.childParts && design.childParts.length > 0) {
        for (const cp of design.childParts) {
          const cpStatus = getLifetimeStatus(cp);
          if (cpStatus === 'OVERDUE') return 'OVERDUE';
          if (cpStatus === 'WARNING') hasWarning = true;
        }
      }

      return hasWarning ? 'WARNING' : 'SAFE';
    };

    // Function to calculate TPM Schedule Status (Green, Yellow, Red)
    // Aturan: Hijau = SAFE, Kuning = WARNING (H-14 hari atau CP warning), Merah = OVERDUE (lewat due date / NG)
    const calcSingleItemTpmStatus = (item: any): 'SAFE' | 'WARNING' | 'OVERDUE' => {
      if (!item) return 'SAFE';
      // 1. Cek dari lifetimeStatus bawaan (2-Way Lifetime: Days & Usage)
      const lifetime = getLifetimeStatus(item);
      if (lifetime === 'OVERDUE') return 'OVERDUE';

      // 2. Cek deadline / due date jadwal TPM
      const deadlineDate = item.tpmScheduleDeadline
        ? new Date(item.tpmScheduleDeadline)
        : (() => {
            const baseDate = item.lastRenewalDate || item.designDateNew || item.installDate || item.createdAt;
            if (!baseDate) return null;
            const lifetimeDays = item.lifetimeDays ?? 180;
            return new Date(new Date(baseDate).getTime() + lifetimeDays * 86400000);
          })();

      if (deadlineDate) {
        const deadline = deadlineDate.getTime();
        const now = Date.now();
        const diffDays = Math.ceil((deadline - now) / 86400000);
        if (diffDays < 0) return 'OVERDUE'; // Lewat due date schedule TPM -> MERAH
        if (diffDays <= 14) return 'WARNING'; // Memasuki H-14 hari -> KUNING
      }

      return lifetime === 'WARNING' ? 'WARNING' : 'SAFE';
    };

    const calcTpmStatus = (design: any): 'SAFE' | 'WARNING' | 'OVERDUE' => {
      if (!design) return 'SAFE';

      // Check last checklist result
      const lastCheck = design.tpmChecklists?.[0];
      if (lastCheck && lastCheck.overallResult === 'NG') {
        return 'OVERDUE'; // Red status if last check failed
      }

      // Check induk jig status
      const mainStatus = calcSingleItemTpmStatus(design);
      if (mainStatus === 'OVERDUE') return 'OVERDUE';

      let hasWarning = mainStatus === 'WARNING';

      // Cek SEMUA Child Part (CP) milik Jig ini:
      // Kalo ada CP yang overdue -> 1 Lane langsung MERAH
      // Kalo ada CP yang warning (mendekati due date) -> 1 Lane jadi KUNING
      if (design.childParts && design.childParts.length > 0) {
        for (const cp of design.childParts) {
          const cpTpm = calcSingleItemTpmStatus(cp);
          if (cpTpm === 'OVERDUE') return 'OVERDUE';
          if (cpTpm === 'WARNING') hasWarning = true;
        }
      }

      return hasWarning ? 'WARNING' : 'SAFE';
    };

    // Pre-calculate status per Line/Lane (1 Jig applies to 1 Lane, all machines in the same lane share identical status)
    const lineTpmStatusMap = new Map<string, 'SAFE' | 'WARNING' | 'OVERDUE'>();
    const lineJigStatusMap = new Map<string, 'SAFE' | 'WARNING' | 'OVERDUE'>();
    const lineDesignMap = new Map<string, any>();

    for (const d of designs) {
      if (!d.lineId) continue;
      if (!lineDesignMap.has(d.lineId)) {
        lineDesignMap.set(d.lineId, d);
      }

      // Aggregate TPM Schedule status for the Lane (OVERDUE > WARNING > SAFE)
      const currentTpm = lineTpmStatusMap.get(d.lineId) || 'SAFE';
      const itemTpm = calcTpmStatus(d);
      if (itemTpm === 'OVERDUE' || currentTpm === 'OVERDUE') {
        lineTpmStatusMap.set(d.lineId, 'OVERDUE');
      } else if (itemTpm === 'WARNING' || currentTpm === 'WARNING') {
        lineTpmStatusMap.set(d.lineId, 'WARNING');
      } else if (!lineTpmStatusMap.has(d.lineId)) {
        lineTpmStatusMap.set(d.lineId, 'SAFE');
      }

      // Aggregate Jig Condition status for the Lane
      const currentJig = lineJigStatusMap.get(d.lineId) || 'SAFE';
      const itemJig = calcJigStatus(d);
      if (itemJig === 'OVERDUE' || currentJig === 'OVERDUE') {
        lineJigStatusMap.set(d.lineId, 'OVERDUE');
      } else if (itemJig === 'WARNING' || currentJig === 'WARNING') {
        lineJigStatusMap.set(d.lineId, 'WARNING');
      } else if (!lineJigStatusMap.has(d.lineId)) {
        lineJigStatusMap.set(d.lineId, 'SAFE');
      }
    }

    const dashboardCards = machinesRaw.map((m) => {
      // Find associated design: prioritize direct design_id, otherwise fallback to Lane's design
      let matchedDesign: any = null;
      if (m.design_id) {
        matchedDesign = designs.find((d) => d.id === m.design_id);
      }
      if (!matchedDesign && m.line_id) {
        matchedDesign = lineDesignMap.get(m.line_id);
      }

      // 1 Jig for 1 Lane: lane status applies to all machines in that lane
      const laneJigStatus = (m.line_id && lineJigStatusMap.get(m.line_id)) || (matchedDesign ? calcJigStatus(matchedDesign) : 'SAFE');
      const laneTpmStatus = (m.line_id && lineTpmStatusMap.get(m.line_id)) || (matchedDesign ? calcTpmStatus(matchedDesign) : 'SAFE');

      // Allow manual override if supervisor specified, otherwise use Lane status
      const jigCondition = (m.manual_jig_status && m.manual_jig_status !== 'AUTO') 
        ? m.manual_jig_status 
        : laneJigStatus;

      const tpmSchedule = (m.manual_tpm_status && m.manual_tpm_status !== 'AUTO') 
        ? m.manual_tpm_status 
        : laneTpmStatus;

      return {
        id: m.id,
        name: m.name,
        code: m.code,
        lineId: m.line_id,
        lineName: m.line_name || 'Line Tanpa Nama',
        lineCode: m.line_code || '',
        location: m.location || '',
        description: m.description || '',
        status: m.status || 'ACTIVE',
        designId: m.design_id || (matchedDesign ? matchedDesign.id : null),
        designNoReg: matchedDesign ? matchedDesign.noReg : null,
        designName: matchedDesign ? matchedDesign.assyPartName : null,
        // Status indicators strictly:
        // Top circle: Jig Condition (Lane-based)
        jigCondition, // 'SAFE' | 'WARNING' | 'OVERDUE'
        // Bottom circle: TPM Schedule (Lane-based)
        tpmSchedule,  // 'SAFE' | 'WARNING' | 'OVERDUE'
        manualJigStatus: m.manual_jig_status || null,
        manualTpmStatus: m.manual_tpm_status || null,
      };
    });

    if (lineFilter && lineFilter !== 'All') {
      return dashboardCards.filter((c) => c.lineName === lineFilter || c.lineId === lineFilter);
    }

    return dashboardCards;
  }

  /** Update manual indicator statuses for a machine */
  async updateMachineStatus(
    id: string,
    dto: {
      jigCondition?: 'SAFE' | 'WARNING' | 'OVERDUE' | 'AUTO';
      tpmSchedule?: 'SAFE' | 'WARNING' | 'OVERDUE' | 'AUTO';
    },
  ) {
    if (dto.jigCondition !== undefined) {
      const val = dto.jigCondition === 'AUTO' ? null : dto.jigCondition;
      await this.prisma.$executeRawUnsafe(
        `UPDATE "machine" SET "manual_jig_status" = $1, "updated_at" = CURRENT_TIMESTAMP WHERE "id" = $2`,
        val,
        id,
      );
    }
    if (dto.tpmSchedule !== undefined) {
      const val = dto.tpmSchedule === 'AUTO' ? null : dto.tpmSchedule;
      await this.prisma.$executeRawUnsafe(
        `UPDATE "machine" SET "manual_tpm_status" = $1, "updated_at" = CURRENT_TIMESTAMP WHERE "id" = $2`,
        val,
        id,
      );
    }
    return { success: true };
  }

  /** Register new machine */
  async createMachine(dto: {
    name: string;
    code: string;
    lineId: string;
    designId?: string;
    location?: string;
    description?: string;
  }) {
    const id = `MCH-${Date.now()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
    await this.prisma.$executeRawUnsafe(
      `INSERT INTO "machine" ("id", "name", "code", "line_id", "design_id", "location", "description", "status")
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'ACTIVE')`,
      id,
      dto.name,
      dto.code,
      dto.lineId,
      dto.designId || null,
      dto.location || null,
      dto.description || null,
    );
    return { success: true, id };
  }

  /** Delete machine */
  async deleteMachine(id: string) {
    await this.prisma.$executeRawUnsafe(`DELETE FROM "machine" WHERE "id" = $1`, id);
    return { success: true };
  }

  /** Set Jig to Lane (1 Jig applies to 1 Lane / Line) */
  async assignJigToLane(lineId: string, designId?: string | null) {
    const targetDesignId = designId && designId.trim() !== '' ? designId : null;

    if (targetDesignId) {
      // 1. Update design to point to this lineId if not yet
      await this.prisma.design.update({
        where: { id: targetDesignId },
        data: { lineId },
      });

      // 2. Update all machines in this line to point to this design_id
      await this.prisma.machine.updateMany({
        where: { lineId },
        data: {
          designId: targetDesignId,
          manualJigStatus: null,
          manualTpmStatus: null,
        },
      });
    } else {
      // Unlink jig from all machines in this line (Lepas Jig)
      await this.prisma.machine.updateMany({
        where: { lineId },
        data: {
          designId: null,
          manualJigStatus: null,
          manualTpmStatus: null,
        },
      });
    }

    return { success: true, lineId, designId: targetDesignId };
  }
}
