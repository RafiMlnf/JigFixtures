import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreateTpmChecklistDto } from './dto/create-tpm-checklist.dto';
import { CreateTpmLogDto } from './dto/create-tpm-log.dto';
import { UpdateTpmScheduleDto } from './dto/update-tpm-schedule.dto';

@Injectable()
export class TpmService {
  constructor(private readonly prisma: PrismaService) {}

  /** Helper to calculate Lifetime and Schedule status */
  private enrichLifetime(item: any, isChildPart: boolean = false) {
    const baseDate = item.lastRenewalDate || item.designDateNew || item.installDate || item.createdAt || new Date();
    const lifetimeDays = item.lifetimeDays ?? 180;
    const lifetimeDueDate = new Date(new Date(baseDate).getTime() + lifetimeDays * 86400000);
    const lifetimeDaysRemaining = Math.ceil((lifetimeDueDate.getTime() - Date.now()) / 86400000);

    // If a specific TPM schedule deadline is set, calculate its days remaining
    let scheduleDaysRemaining: number | null = null;
    if (item.tpmScheduleDeadline) {
      const deadDate = new Date(item.tpmScheduleDeadline);
      if (!isNaN(deadDate.getTime())) {
        scheduleDaysRemaining = Math.ceil((deadDate.getTime() - Date.now()) / 86400000);
      }
    }

    // Days remaining takes the closer/most urgent between lifetime and scheduled deadline
    const daysRemaining = scheduleDaysRemaining !== null
      ? Math.min(lifetimeDaysRemaining, scheduleDaysRemaining)
      : lifetimeDaysRemaining;

    const dueDate = scheduleDaysRemaining !== null && scheduleDaysRemaining < lifetimeDaysRemaining
      ? new Date(item.tpmScheduleDeadline)
      : lifetimeDueDate;

    // Status:
    // OVERDUE (Merah): <= 0 hari
    // WARNING (Kuning): masuk H-2 minggu (<= 14 hari)
    // SAFE (Hijau): > 14 hari
    let lifetimeStatus: 'OVERDUE' | 'WARNING' | 'SAFE';
    if (daysRemaining <= 0) {
      lifetimeStatus = 'OVERDUE';
    } else if (daysRemaining <= 14) {
      lifetimeStatus = 'WARNING';
    } else {
      lifetimeStatus = 'SAFE';
    }

    const dayStatus = lifetimeStatus;
    const triggerReason = lifetimeStatus !== 'SAFE' ? 'DAYS' : 'NONE';

    return {
      ...item,
      isChildPart,
      baseDate,
      dueDate,
      daysRemaining,
      dayStatus,
      lifetimeStatus,
      triggerReason,
    };
  }

  /** A design is TPM-eligible only when its latest document has been APPROVED */
  private isDesignApproved(documents?: { approvalStatus: string }[] | null): boolean {
    if (!documents || documents.length === 0) return false;
    return documents[documents.length - 1].approvalStatus === 'APPROVED';
  }

  /** Throw if the design has not been approved yet (blocks TPM actions) */
  private async assertDesignApproved(designId: string) {
    const design = await this.prisma.design.findUnique({
      where: { id: designId },
      select: {
        id: true,
        documents: { select: { approvalStatus: true }, orderBy: { createdAt: 'asc' } },
      },
    });
    if (!design) throw new NotFoundException(`Design ${designId} not found`);
    if (!this.isDesignApproved(design.documents)) {
      throw new BadRequestException(
        'Jig/Fixture belum di-approve. Selesaikan approval desain terlebih dahulu sebelum menggunakan TPM.',
      );
    }
  }

  /** Pastikan childPart (jika diisi) benar-benar milik design yang sama */
  private async assertChildPartInDesign(designId: string, childPartId?: string | null) {
    if (!childPartId) return;
    const cp = await this.prisma.childPart.findUnique({
      where: { id: childPartId },
      select: { designId: true },
    });
    if (!cp) throw new NotFoundException(`ChildPart ${childPartId} not found`);
    if (cp.designId !== designId) {
      throw new BadRequestException('ChildPart tidak termasuk dalam Jig/Fixture yang dipilih.');
    }
  }

  /** Get Overall TPM KPI summary */
  async getSummary() {
    const allDesigns = await this.prisma.design.findMany({
      select: {
        id: true,
        documents: { select: { approvalStatus: true }, orderBy: { createdAt: 'asc' } },
        lifetimeDays: true,
        designDateNew: true,
        createdAt: true,
        tpmScheduleStart: true,
        tpmScheduleDeadline: true,
        tpmLifetimeSetAt: true,
      },
    });

    const allCellParts = await this.prisma.childPart.findMany({
      select: {
        id: true,
        design: {
          select: {
            documents: { select: { approvalStatus: true }, orderBy: { createdAt: 'asc' } },
          },
        },
        lifetimeDays: true,
        installDate: true,
        lastRenewalDate: true,
        createdAt: true,
        tpmScheduleStart: true,
        tpmScheduleDeadline: true,
        tpmLifetimeSetAt: true,
      },
    });

    let safeCount = 0;
    let warningCount = 0;
    let overdueCount = 0;
    let unscheduledCount = 0;

    // Hanya desain yang sudah di-approve yang masuk ke TPM
    const designs = allDesigns.filter((d) => this.isDesignApproved(d.documents));
    const childParts = allCellParts.filter((cp) => this.isDesignApproved(cp.design?.documents));
    const pendingApprovalCount = allDesigns.length - designs.length;

    const allItems = [
      ...designs.map((d) => this.enrichLifetime(d, false)),
      ...childParts.map((cp) => this.enrichLifetime(cp, true)),
    ];

    for (const item of allItems) {
      if (item.lifetimeStatus === 'SAFE') safeCount++;
      else if (item.lifetimeStatus === 'WARNING') warningCount++;
      else if (item.lifetimeStatus === 'OVERDUE') overdueCount++;

      if (!item.tpmScheduleDeadline && !item.tpmLifetimeSetAt) {
        unscheduledCount++;
      }
    }

    const totalItems = allItems.length;
    const healthScore = totalItems > 0 ? Math.round((safeCount / totalItems) * 100) : 100;

    // Checklists today
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const checklistsToday = await this.prisma.tpmChecklist.findMany({
      where: {
        checkDate: { gte: startOfToday },
      },
      select: { overallResult: true },
    });

    const checklistTodayCount = checklistsToday.length;
    const checklistTodayOk = checklistsToday.filter((c) => c.overallResult === 'OK').length;
    const checklistTodayNg = checklistsToday.filter((c) => c.overallResult === 'NG').length;

    // Maintenance this month
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const maintenanceThisMonth = await this.prisma.tpmMaintenanceLog.count({
      where: {
        performedAt: { gte: startOfMonth },
      },
    });

    return {
      totalItems,
      totalDesigns: designs.length,
      totalChildParts: childParts.length,
      pendingApprovalCount,
      safeCount,
      warningCount,
      overdueCount,
      unscheduledCount,
      healthScore,
      checklistTodayCount,
      checklistTodayOk,
      checklistTodayNg,
      maintenanceThisMonth,
    };
  }

  /** Get All Maintenance Schedules and 2-way lifetime status */
  async getSchedules(query?: {
    search?: string;
    lineId?: string;
    processId?: string;
    status?: string;
    type?: 'ALL' | 'DESIGN' | 'CELL_PART';
  }) {
    const allDesigns = await this.prisma.design.findMany({
      where: {
        ...(query?.lineId ? { lineId: query.lineId } : {}),
        ...(query?.processId ? { processId: query.processId } : {}),
      },
      include: {
        line: { select: { id: true, lineName: true, lineCode: true } },
        process: { select: { id: true, name: true, code: true } },
        childParts: true,
        documents: { select: { approvalStatus: true }, orderBy: { createdAt: 'asc' } },
      },
      orderBy: { noReg: 'asc' },
    });

    // Hanya desain yang sudah di-approve yang masuk ke TPM
    const designs = allDesigns.filter((d) => this.isDesignApproved(d.documents));

    const enrichedDesigns = designs.map((d) => {
      const enriched = this.enrichLifetime(d, false);
      const enrichedCellParts = (d.childParts || []).map((cp) => this.enrichLifetime(cp, true));
      return {
        ...enriched,
        childParts: enrichedCellParts,
      };
    });

    // Flatten or separate list for unified schedule display
    let flatItems: any[] = [];
    const filterType = query?.type || 'ALL';

    for (const d of enrichedDesigns) {
      if (filterType === 'ALL' || filterType === 'DESIGN') {
        flatItems.push({
          id: d.id,
          isChildPart: false,
          noReg: d.noReg,
          partNumber: '-',
          name: d.assyPartName,
          type: d.type,
          lineName: d.line?.lineName || '-',
          processName: d.process?.name || '-',
          lineId: d.lineId,
          processId: d.processId,
          lifetimeDays: d.lifetimeDays,
          daysRemaining: d.daysRemaining,
          dueDate: d.dueDate,
          lifetimeStatus: d.lifetimeStatus,
          triggerReason: d.triggerReason,
          tpmScheduleStart: d.tpmScheduleStart,
          tpmScheduleDeadline: d.tpmScheduleDeadline,
          tpmLifetimeSetAt: d.tpmLifetimeSetAt,
          childPartsCount: (d.childParts || []).length,
        });
      }

      if (filterType === 'ALL' || filterType === 'CELL_PART') {
        for (const cp of d.childParts || []) {
          flatItems.push({
            id: cp.id,
            parentId: d.id,
            parentNoReg: d.noReg,
            parentName: d.assyPartName,
            isChildPart: true,
            noReg: d.noReg,
            partNumber: cp.partNumber,
            name: `${cp.name} (${d.noReg})`,
            type: 'CELL_PART',
            lineName: d.line?.lineName || '-',
            processName: d.process?.name || '-',
            lineId: d.lineId,
            processId: d.processId,
            lifetimeDays: cp.lifetimeDays,
            daysRemaining: cp.daysRemaining,
            dueDate: cp.dueDate,
            lifetimeStatus: cp.lifetimeStatus,
            triggerReason: cp.triggerReason,
            tpmScheduleStart: cp.tpmScheduleStart,
            tpmScheduleDeadline: cp.tpmScheduleDeadline,
            tpmLifetimeSetAt: cp.tpmLifetimeSetAt,
            childPartsCount: 0,
          });
        }
      }
    }

    // Apply status filter
    if (query?.status) {
      if (query.status === 'UNSCHEDULED') {
        flatItems = flatItems.filter((i) => !i.tpmScheduleDeadline && !i.tpmLifetimeSetAt);
      } else {
        flatItems = flatItems.filter((i) => i.lifetimeStatus === query.status);
      }
    }

    // Apply text search
    if (query?.search) {
      const q = query.search.toLowerCase();
      flatItems = flatItems.filter(
        (i) =>
          i.noReg.toLowerCase().includes(q) ||
          i.name.toLowerCase().includes(q) ||
          (i.partNumber && i.partNumber.toLowerCase().includes(q)) ||
          i.lineName.toLowerCase().includes(q) ||
          i.processName.toLowerCase().includes(q),
      );
    }

    return flatItems;
  }

  /** Update schedule and lifetime parameters */
  async updateSchedule(id: string, dto: UpdateTpmScheduleDto) {
    const isChildPart = dto.isChildPart === true;

    const dataToUpdate: any = {
      tpmLifetimeSetAt: new Date(),
    };

    if (dto.tpmScheduleStart !== undefined) {
      dataToUpdate.tpmScheduleStart = dto.tpmScheduleStart ? new Date(dto.tpmScheduleStart) : null;
    }
    if (dto.tpmScheduleDeadline !== undefined) {
      dataToUpdate.tpmScheduleDeadline = dto.tpmScheduleDeadline ? new Date(dto.tpmScheduleDeadline) : null;
    }
    if (dto.lifetimeDays !== undefined) {
      dataToUpdate.lifetimeDays = Number(dto.lifetimeDays);
    }

    if (isChildPart) {
      const cp = await this.prisma.childPart.findUnique({ where: { id } });
      if (!cp) throw new NotFoundException(`ChildPart ${id} not found`);
      await this.assertDesignApproved(cp.designId);
      const updated = await this.prisma.childPart.update({
        where: { id },
        data: dataToUpdate,
      });
      return this.enrichLifetime(updated, true);
    } else {
      const design = await this.prisma.design.findUnique({ where: { id } });
      if (!design) throw new NotFoundException(`Design ${id} not found`);
      await this.assertDesignApproved(id);
      const updated = await this.prisma.design.update({
        where: { id },
        data: dataToUpdate,
      });
      return this.enrichLifetime(updated, false);
    }
  }

  /** Get Checklists with filters */
  async getChecklists(query?: {
    designId?: string;
    result?: string;
    search?: string;
  }) {
    const where: any = {};
    if (query?.designId) {
      where.designId = query.designId;
    }
    if (query?.result) {
      where.overallResult = query.result;
    }

    const list = await this.prisma.tpmChecklist.findMany({
      where,
      include: {
        design: {
          select: {
            id: true,
            noReg: true,
            assyPartName: true,
            line: { select: { lineName: true } },
            process: { select: { name: true } },
          },
        },
        childPart: {
          select: {
            id: true,
            partNumber: true,
            name: true,
          },
        },
      },
      orderBy: { checkDate: 'desc' },
    });

    if (query?.search) {
      const q = query.search.toLowerCase();
      return list.filter(
        (c) =>
          c.inspectorName.toLowerCase().includes(q) ||
          c.design?.noReg.toLowerCase().includes(q) ||
          c.design?.assyPartName.toLowerCase().includes(q) ||
          (c.notes && c.notes.toLowerCase().includes(q)),
      );
    }

    return list;
  }

  /** Create Checklist inspection report */
  async createChecklist(dto: CreateTpmChecklistDto, userId?: string) {
    await this.assertDesignApproved(dto.designId);
    await this.assertChildPartInDesign(dto.designId, dto.childPartId);

    const checkDate = dto.checkDate ? new Date(dto.checkDate) : new Date();

    let createdAbnormalityId: string | null = null;

    // If NG and linkToAbnormality is true, automatically create an Abnormality report!
    if (dto.overallResult === 'NG' && dto.linkToAbnormality) {
      let reportedById = userId;
      if (!reportedById) {
        const fallbackUser = await this.prisma.user.findFirst();
        reportedById = fallbackUser?.id || '';
      }

      if (reportedById) {
        const abn = await this.prisma.abnormality.create({
          data: {
            designId: dto.designId,
            reportedById,
            type: 'AUS',
            description: `[Temuan TPM NG] Inspeksi oleh ${dto.inspectorName}: ${dto.notes || 'Parameter inspeksi tidak memenuhi standar'}`,
            foundBy: dto.inspectorName,
            rootCause: 'Terdeteksi saat pelaksanaan TPM Checklist berkala',
            tempAction: 'Tandai Jig / Cell Part untuk evaluasi dan tindakan pemeliharaan',
            correctiveAction: 'Lakukan perbaikan, pembersihan menyeluruh, atau kalibrasi ulang oleh tim maintenance',
            actionPic: dto.inspectorName,
            status: 'OPEN',
            dateFound: checkDate,
          },
        });
        createdAbnormalityId = abn.id;

        await this.prisma.design.update({
          where: { id: dto.designId },
          data: { abnormalityStatus: 'OPEN' },
        });
      }
    }

    const checklist = await this.prisma.tpmChecklist.create({
      data: {
        designId: dto.designId,
        childPartId: dto.childPartId || null,
        inspectorName: dto.inspectorName,
        shift: dto.shift || 'Shift 1',
        checkDate,
        overallResult: dto.overallResult,
        cleaningStatus: dto.cleaningStatus || 'OK',
        locatorPinStatus: dto.locatorPinStatus || 'OK',
        clampingStatus: dto.clampingStatus || 'OK',
        sensorStatus: dto.sensorStatus || 'OK',
        boltsStatus: dto.boltsStatus || 'OK',
        lubricationStatus: dto.lubricationStatus || 'OK',
        notes: dto.notes || null,
        linkToAbnormality: dto.linkToAbnormality || false,
        abnormalityId: createdAbnormalityId,
      },
      include: {
        design: {
          select: {
            noReg: true,
            assyPartName: true,
          },
        },
        childPart: {
          select: {
            partNumber: true,
            name: true,
          },
        },
      },
    });

    return checklist;
  }

  /** Delete a checklist entry */
  async deleteChecklist(id: string) {
    const existing = await this.prisma.tpmChecklist.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`Checklist ${id} not found`);
    return this.prisma.tpmChecklist.delete({ where: { id } });
  }

  /** Get Maintenance Logs */
  async getLogs(query?: {
    designId?: string;
    actionType?: string;
    status?: string;
    search?: string;
  }) {
    const where: any = {};
    if (query?.designId) where.designId = query.designId;
    if (query?.actionType) where.actionType = query.actionType;
    if (query?.status) where.status = query.status;

    const list = await this.prisma.tpmMaintenanceLog.findMany({
      where,
      include: {
        design: {
          select: {
            id: true,
            noReg: true,
            assyPartName: true,
            line: { select: { lineName: true } },
            process: { select: { name: true } },
          },
        },
        childPart: {
          select: {
            id: true,
            partNumber: true,
            name: true,
          },
        },
      },
      orderBy: { performedAt: 'desc' },
    });

    if (query?.search) {
      const q = query.search.toLowerCase();
      return list.filter(
        (l) =>
          l.title.toLowerCase().includes(q) ||
          l.description.toLowerCase().includes(q) ||
          l.performedBy.toLowerCase().includes(q) ||
          l.design?.noReg.toLowerCase().includes(q) ||
          l.design?.assyPartName.toLowerCase().includes(q) ||
          (l.partsReplaced && l.partsReplaced.toLowerCase().includes(q)),
      );
    }

    return list;
  }

  /** Create Maintenance Log entry */
  async createLog(dto: CreateTpmLogDto) {
    await this.assertDesignApproved(dto.designId);
    await this.assertChildPartInDesign(dto.designId, dto.childPartId);

    const performedAt = dto.performedAt ? new Date(dto.performedAt) : new Date();

    // Hubungkan ACT dengan PLAN: ambil deadline jadwal item (childpart atau jig) saat ini
    const target: any = dto.childPartId
      ? await this.prisma.childPart.findUnique({ where: { id: dto.childPartId } })
      : await this.prisma.design.findUnique({ where: { id: dto.designId } });
    const plannedFor = target?.tpmScheduleDeadline ?? null;

    const log = await this.prisma.tpmMaintenanceLog.create({
      data: {
        designId: dto.designId,
        childPartId: dto.childPartId || null,
        actionType: dto.actionType,
        title: dto.title,
        description: dto.description,
        performedBy: dto.performedBy,
        performedAt,
        durationMinutes: dto.durationMinutes ?? 60,
        partsReplaced: dto.partsReplaced || null,
        status: dto.status || 'COMPLETED',
        resetLifetime: dto.resetLifetime || false,
        plannedFor,
      },
      include: {
        design: {
          select: {
            noReg: true,
            assyPartName: true,
          },
        },
        childPart: {
          select: {
            partNumber: true,
            name: true,
          },
        },
      },
    });

    // If resetLifetime is checked, reset the lifetime counters!
    if (dto.resetLifetime) {
      if (dto.childPartId) {
        const cp = await this.prisma.childPart.findUnique({ where: { id: dto.childPartId } });
        await this.prisma.childPart.update({
          where: { id: dto.childPartId },
          data: {
            installDate: new Date(),
            lastRenewalDate: new Date(),
            reminderSent: false,
          },
        });
        // Jejak penggantian part agar riwayat TPM tidak putus dari riwayat part
        if (cp) {
          const base = cp.lastRenewalDate || cp.installDate;
          await this.prisma.partReplacementLog.create({
            data: {
              designId: cp.designId,
              childPartId: cp.id,
              partNumber: cp.partNumber,
              partName: cp.name,
              replacedAt: performedAt,
              replacedBy: dto.performedBy,
              reason: `TPM: ${dto.title}`,
              daysUsed: base ? Math.max(0, Math.round((performedAt.getTime() - new Date(base).getTime()) / 86400000)) : null,
            },
          });
        }
      } else if (dto.designId) {
        await this.prisma.design.update({
          where: { id: dto.designId },
          data: {
            designDateNew: new Date(),
          },
        });
      }
    }

    return log;
  }

  /** Delete Maintenance Log entry */
  async deleteLog(id: string) {
    const existing = await this.prisma.tpmMaintenanceLog.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`Maintenance Log ${id} not found`);
    return this.prisma.tpmMaintenanceLog.delete({ where: { id } });
  }
}
