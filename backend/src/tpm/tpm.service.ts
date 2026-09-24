import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreateTpmChecklistDto } from './dto/create-tpm-checklist.dto';
import { CreateTpmLogDto } from './dto/create-tpm-log.dto';
import { UpdateTpmScheduleDto } from './dto/update-tpm-schedule.dto';

@Injectable()
export class TpmService {
  constructor(private readonly prisma: PrismaService) {}

  /** Helper to calculate 2-Way Lifetime status */
  private enrichLifetime(item: any, isCellPart: boolean = false) {
    const baseDate = item.lastRenewalDate || item.designDateNew || item.installDate || item.createdAt || new Date();
    const lifetimeDays = item.lifetimeDays ?? 180;
    const dueDate = new Date(new Date(baseDate).getTime() + lifetimeDays * 86400000);
    const daysRemaining = Math.ceil((dueDate.getTime() - Date.now()) / 86400000);

    let dayStatus: 'OVERDUE' | 'WARNING' | 'SAFE';
    if (daysRemaining <= 0) {
      dayStatus = 'OVERDUE';
    } else if (daysRemaining <= 35) {
      dayStatus = 'WARNING';
    } else {
      dayStatus = 'SAFE';
    }

    const maxUsage = item.maxUsage ?? 500;
    const currentUsage = item.currentUsage ?? 0;
    const usageRemaining = Math.max(0, maxUsage - currentUsage);
    const usagePercent = maxUsage > 0 ? Math.round((currentUsage / maxUsage) * 100) : 0;

    let usageStatus: 'OVERDUE' | 'WARNING' | 'SAFE';
    if (currentUsage >= maxUsage) {
      usageStatus = 'OVERDUE';
    } else if (usagePercent >= 85 || (maxUsage - currentUsage) <= 50) {
      usageStatus = 'WARNING';
    } else {
      usageStatus = 'SAFE';
    }

    const lifetimeType: 'DUAL' | 'USAGE' | 'DAYS' = item.lifetimeType || 'DUAL';
    let lifetimeStatus: 'OVERDUE' | 'WARNING' | 'SAFE';
    let triggerReason: 'DAYS' | 'USAGE' | 'BOTH' | 'NONE' = 'NONE';

    if (lifetimeType === 'DAYS') {
      lifetimeStatus = dayStatus;
      triggerReason = dayStatus !== 'SAFE' ? 'DAYS' : 'NONE';
    } else if (lifetimeType === 'USAGE') {
      lifetimeStatus = usageStatus;
      triggerReason = usageStatus !== 'SAFE' ? 'USAGE' : 'NONE';
    } else {
      if (dayStatus === 'OVERDUE' || usageStatus === 'OVERDUE') {
        lifetimeStatus = 'OVERDUE';
        triggerReason =
          dayStatus === 'OVERDUE' && usageStatus === 'OVERDUE'
            ? 'BOTH'
            : dayStatus === 'OVERDUE'
            ? 'DAYS'
            : 'USAGE';
      } else if (dayStatus === 'WARNING' || usageStatus === 'WARNING') {
        lifetimeStatus = 'WARNING';
        triggerReason =
          dayStatus === 'WARNING' && usageStatus === 'WARNING'
            ? 'BOTH'
            : dayStatus === 'WARNING'
            ? 'DAYS'
            : 'USAGE';
      } else {
        lifetimeStatus = 'SAFE';
        triggerReason = 'NONE';
      }
    }

    return {
      ...item,
      isCellPart,
      baseDate,
      dueDate,
      daysRemaining,
      dayStatus,
      usageRemaining,
      usagePercent,
      usageStatus,
      lifetimeStatus,
      triggerReason,
    };
  }

  /** Get Overall TPM KPI summary */
  async getSummary() {
    const designs = await this.prisma.design.findMany({
      select: {
        id: true,
        lifetimeDays: true,
        lifetimeType: true,
        maxUsage: true,
        currentUsage: true,
        designDateNew: true,
        createdAt: true,
        tpmScheduleStart: true,
        tpmScheduleDeadline: true,
        tpmLifetimeSetAt: true,
      },
    });

    const cellParts = await this.prisma.cellPart.findMany({
      select: {
        id: true,
        lifetimeDays: true,
        lifetimeType: true,
        maxUsage: true,
        currentUsage: true,
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

    const allItems = [
      ...designs.map((d) => this.enrichLifetime(d, false)),
      ...cellParts.map((cp) => this.enrichLifetime(cp, true)),
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
      totalCellParts: cellParts.length,
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
    const designs = await this.prisma.design.findMany({
      where: {
        ...(query?.lineId ? { lineId: query.lineId } : {}),
        ...(query?.processId ? { processId: query.processId } : {}),
      },
      include: {
        line: { select: { id: true, lineName: true, lineCode: true } },
        process: { select: { id: true, name: true, code: true } },
        cellParts: true,
      },
      orderBy: { noReg: 'asc' },
    });

    const enrichedDesigns = designs.map((d) => {
      const enriched = this.enrichLifetime(d, false);
      const enrichedCellParts = (d.cellParts || []).map((cp) => this.enrichLifetime(cp, true));
      return {
        ...enriched,
        cellParts: enrichedCellParts,
      };
    });

    // Flatten or separate list for unified schedule display
    let flatItems: any[] = [];
    const filterType = query?.type || 'ALL';

    for (const d of enrichedDesigns) {
      if (filterType === 'ALL' || filterType === 'DESIGN') {
        flatItems.push({
          id: d.id,
          isCellPart: false,
          noReg: d.noReg,
          partNumber: '-',
          name: d.assyPartName,
          type: d.type,
          lineName: d.line?.lineName || '-',
          processName: d.process?.name || '-',
          lineId: d.lineId,
          processId: d.processId,
          lifetimeDays: d.lifetimeDays,
          lifetimeType: d.lifetimeType,
          maxUsage: d.maxUsage,
          currentUsage: d.currentUsage,
          daysRemaining: d.daysRemaining,
          dueDate: d.dueDate,
          lifetimeStatus: d.lifetimeStatus,
          triggerReason: d.triggerReason,
          tpmScheduleStart: d.tpmScheduleStart,
          tpmScheduleDeadline: d.tpmScheduleDeadline,
          tpmLifetimeSetAt: d.tpmLifetimeSetAt,
          cellPartsCount: (d.cellParts || []).length,
        });
      }

      if (filterType === 'ALL' || filterType === 'CELL_PART') {
        for (const cp of d.cellParts || []) {
          flatItems.push({
            id: cp.id,
            parentId: d.id,
            parentNoReg: d.noReg,
            parentName: d.assyPartName,
            isCellPart: true,
            noReg: d.noReg,
            partNumber: cp.partNumber,
            name: `${cp.name} (${d.noReg})`,
            type: 'CELL_PART',
            lineName: d.line?.lineName || '-',
            processName: d.process?.name || '-',
            lineId: d.lineId,
            processId: d.processId,
            lifetimeDays: cp.lifetimeDays,
            lifetimeType: cp.lifetimeType,
            maxUsage: cp.maxUsage,
            currentUsage: cp.currentUsage,
            daysRemaining: cp.daysRemaining,
            dueDate: cp.dueDate,
            lifetimeStatus: cp.lifetimeStatus,
            triggerReason: cp.triggerReason,
            tpmScheduleStart: cp.tpmScheduleStart,
            tpmScheduleDeadline: cp.tpmScheduleDeadline,
            tpmLifetimeSetAt: cp.tpmLifetimeSetAt,
            cellPartsCount: 0,
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
    const isCellPart = dto.isCellPart === true;

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
    if (dto.lifetimeType !== undefined) {
      dataToUpdate.lifetimeType = dto.lifetimeType;
    }
    if (dto.maxUsage !== undefined) {
      dataToUpdate.maxUsage = Number(dto.maxUsage);
    }
    if (dto.currentUsage !== undefined) {
      dataToUpdate.currentUsage = Number(dto.currentUsage);
    }

    if (isCellPart) {
      const cp = await this.prisma.cellPart.findUnique({ where: { id } });
      if (!cp) throw new NotFoundException(`CellPart ${id} not found`);
      const updated = await this.prisma.cellPart.update({
        where: { id },
        data: dataToUpdate,
      });
      return this.enrichLifetime(updated, true);
    } else {
      const design = await this.prisma.design.findUnique({ where: { id } });
      if (!design) throw new NotFoundException(`Design ${id} not found`);
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
        cellPart: {
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
        cellPartId: dto.cellPartId || null,
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
        cellPart: {
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
        cellPart: {
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
    const performedAt = dto.performedAt ? new Date(dto.performedAt) : new Date();

    const log = await this.prisma.tpmMaintenanceLog.create({
      data: {
        designId: dto.designId,
        cellPartId: dto.cellPartId || null,
        actionType: dto.actionType,
        title: dto.title,
        description: dto.description,
        performedBy: dto.performedBy,
        performedAt,
        durationMinutes: dto.durationMinutes ?? 60,
        partsReplaced: dto.partsReplaced || null,
        status: dto.status || 'COMPLETED',
        cost: dto.cost ?? 0,
        resetLifetime: dto.resetLifetime || false,
      },
      include: {
        design: {
          select: {
            noReg: true,
            assyPartName: true,
          },
        },
        cellPart: {
          select: {
            partNumber: true,
            name: true,
          },
        },
      },
    });

    // If resetLifetime is checked, reset the lifetime counters!
    if (dto.resetLifetime) {
      if (dto.cellPartId) {
        await this.prisma.cellPart.update({
          where: { id: dto.cellPartId },
          data: {
            installDate: new Date(),
            lastRenewalDate: new Date(),
            currentUsage: 0,
            reminderSent: false,
          },
        });
      } else if (dto.designId) {
        await this.prisma.design.update({
          where: { id: dto.designId },
          data: {
            designDateNew: new Date(),
            currentUsage: 0,
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
