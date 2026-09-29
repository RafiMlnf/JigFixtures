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
    // Ensure table exists safely
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
          "created_at" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
          "updated_at" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
        );
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
        cellParts: true,
        tpmChecklists: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    // Function to calculate Jig Condition (Green = SAFE, Yellow = WARNING, Red = OVERDUE)
    const calcJigStatus = (design: any): 'SAFE' | 'WARNING' | 'OVERDUE' => {
      if (!design) return 'SAFE';
      const baseDate = design.designDateNew || design.createdAt || new Date();
      const lifetimeDays = design.lifetimeDays ?? 180;
      const dueDate = new Date(new Date(baseDate).getTime() + lifetimeDays * 86400000);
      const daysRemaining = Math.ceil((dueDate.getTime() - Date.now()) / 86400000);

      const maxUsage = design.maxUsage ?? 500;
      const currentUsage = design.currentUsage ?? 0;
      const usageRemaining = Math.max(0, maxUsage - currentUsage);
      const usagePercent = maxUsage > 0 ? (currentUsage / maxUsage) * 100 : 0;

      let isOverdue = daysRemaining <= 0 || currentUsage >= maxUsage;
      let isWarning = (!isOverdue) && (daysRemaining <= 35 || usagePercent >= 85 || usageRemaining <= 50);

      // Check cellParts as well
      if (design.cellParts && design.cellParts.length > 0) {
        for (const cp of design.cellParts) {
          const cpBase = cp.lastRenewalDate || cp.installDate || cp.createdAt || new Date();
          const cpDaysRemaining = Math.ceil((new Date(new Date(cpBase).getTime() + (cp.lifetimeDays ?? 180) * 86400000).getTime() - Date.now()) / 86400000);
          const cpMaxUsage = cp.maxUsage ?? 500;
          const cpCurUsage = cp.currentUsage ?? 0;
          const cpUsagePercent = cpMaxUsage > 0 ? (cpCurUsage / cpMaxUsage) * 100 : 0;

          if (cpDaysRemaining <= 0 || cpCurUsage >= cpMaxUsage) {
            isOverdue = true;
          } else if (cpDaysRemaining <= 35 || cpUsagePercent >= 85 || (cpMaxUsage - cpCurUsage) <= 50) {
            isWarning = true;
          }
        }
      }

      if (isOverdue) return 'OVERDUE';
      if (isWarning) return 'WARNING';
      return 'SAFE';
    };

    // Function to calculate TPM Schedule Status (Green, Yellow, Red)
    const calcTpmStatus = (design: any): 'SAFE' | 'WARNING' | 'OVERDUE' => {
      if (!design) return 'SAFE';
      // Check last checklist result
      const lastCheck = design.tpmChecklists?.[0];
      if (lastCheck && lastCheck.overallResult === 'NG') {
        return 'OVERDUE'; // Red status if last check failed
      }

      // Check deadline
      if (design.tpmScheduleDeadline) {
        const deadline = new Date(design.tpmScheduleDeadline).getTime();
        const now = Date.now();
        const diffDays = Math.ceil((deadline - now) / 86400000);
        if (diffDays < 0) return 'OVERDUE'; // Overdue deadline
        if (diffDays <= 7) return 'WARNING'; // Approaching deadline within 7 days
      }

      return 'SAFE';
    };

    const dashboardCards = machinesRaw.map((m) => {
      // Find associated design or line designs
      let matchedDesign = null;
      if (m.design_id) {
        matchedDesign = designs.find((d) => d.id === m.design_id);
      }
      if (!matchedDesign) {
        // Fallback match by line
        matchedDesign = designs.find((d) => d.lineId === m.line_id);
      }

      const jigCondition = calcJigStatus(matchedDesign);
      const tpmSchedule = calcTpmStatus(matchedDesign);

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
        designId: m.design_id || null,
        designNoReg: matchedDesign ? matchedDesign.noReg : null,
        designName: matchedDesign ? matchedDesign.assyPartName : null,
        // Status indicators strictly:
        // Top circle: Jig Condition
        jigCondition, // 'SAFE' | 'WARNING' | 'OVERDUE'
        // Bottom circle: TPM Schedule
        tpmSchedule,  // 'SAFE' | 'WARNING' | 'OVERDUE'
      };
    });

    if (lineFilter && lineFilter !== 'All') {
      return dashboardCards.filter((c) => c.lineName === lineFilter || c.lineId === lineFilter);
    }

    return dashboardCards;
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
}
