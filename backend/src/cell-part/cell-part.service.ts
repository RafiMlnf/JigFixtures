import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreateCellPartDto } from './dto/create-cell-part.dto';
import { UpdateCellPartDto } from './dto/update-cell-part.dto';

@Injectable()
export class CellPartService {
  constructor(private prisma: PrismaService) {}

  /** List all CellParts for a given parent Design (Jig) */
  async findByDesign(designId: string) {
    const parts = await this.prisma.cellPart.findMany({
      where: { designId },
      orderBy: { partNumber: 'asc' },
    });

    return parts.map((part) => this.enrichWithLifetime(part));
  }

  /** Get all CellParts that are OVERDUE or WARNING (≤35 days to due date) */
  async getReminders() {
    const allParts = await this.prisma.cellPart.findMany({
      include: {
        design: { select: { id: true, noReg: true, assyPartName: true } },
      },
    });

    return allParts
      .map((part) => {
        const enriched = this.enrichWithLifetime(part);
        return {
          ...enriched,
          parentNoReg: part.design.noReg,
          parentName: part.design.assyPartName,
          parentId: part.design.id,
        };
      })
      .filter((p) => p.lifetimeStatus !== 'SAFE')
      .sort((a, b) => a.daysRemaining - b.daysRemaining);
  }

  /** Create a new CellPart under a parent Design */
  async create(dto: CreateCellPartDto) {
    // Verify parent design exists
    const design = await this.prisma.design.findUnique({
      where: { id: dto.designId },
    });
    if (!design) {
      throw new NotFoundException(`Design ${dto.designId} not found`);
    }

    // Check for duplicate partNumber under the same parent
    const existing = await this.prisma.cellPart.findFirst({
      where: { designId: dto.designId, partNumber: dto.partNumber },
    });
    if (existing) {
      throw new ConflictException(
        `Part number "${dto.partNumber}" already exists under this Jig`,
      );
    }

    const cellPart = await this.prisma.cellPart.create({
      data: {
        designId: dto.designId,
        partNumber: dto.partNumber,
        name: dto.name,
        description: dto.description || null,
        lifetimeDays: dto.lifetimeDays || 180,
        lifetimeType: dto.lifetimeType || 'DUAL',
        maxUsage: dto.maxUsage ?? 500,
        currentUsage: dto.currentUsage ?? 0,
        installDate: dto.installDate ? new Date(dto.installDate) : new Date(),
        minimumStock: dto.minimumStock ?? 0,
        actualStock: dto.actualStock ?? 0,
        pdfPageIndex: dto.pdfPageIndex ?? null,
      },
    });

    return this.enrichWithLifetime(cellPart);
  }

  /** Update an existing CellPart */
  async update(id: string, dto: UpdateCellPartDto) {
    const existing = await this.prisma.cellPart.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`CellPart ${id} not found`);
    }

    // If partNumber is being changed, check uniqueness under the same parent
    if (dto.partNumber && dto.partNumber !== existing.partNumber) {
      const dup = await this.prisma.cellPart.findFirst({
        where: {
          designId: existing.designId,
          partNumber: dto.partNumber,
          id: { not: id },
        },
      });
      if (dup) {
        throw new ConflictException(
          `Part number "${dto.partNumber}" already exists under this Jig`,
        );
      }
    }

    const updated = await this.prisma.cellPart.update({
      where: { id },
      data: {
        partNumber: dto.partNumber,
        name: dto.name,
        description: dto.description,
        lifetimeDays: dto.lifetimeDays,
        lifetimeType: dto.lifetimeType,
        maxUsage: dto.maxUsage,
        currentUsage: dto.currentUsage,
        installDate: dto.installDate ? new Date(dto.installDate) : undefined,
        minimumStock: dto.minimumStock,
        actualStock: dto.actualStock,
        pdfPageIndex: dto.pdfPageIndex,
      },
    });

    return this.enrichWithLifetime(updated);
  }

  /** Log or set usage for a CellPart */
  async logUsage(id: string, amount: number, mode: 'ADD' | 'SET' = 'ADD') {
    const existing = await this.prisma.cellPart.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`CellPart ${id} not found`);
    }

    const current = (existing as any).currentUsage ?? 0;
    const newUsage = mode === 'ADD' ? Math.max(0, current + amount) : Math.max(0, amount);

    const updated = await this.prisma.cellPart.update({
      where: { id },
      data: {
        currentUsage: newUsage,
      },
    });

    return this.enrichWithLifetime(updated);
  }

  /** Renew a CellPart's lifetime — reset installDate and/or currentUsage to 0 */
  async renew(id: string, options: { resetDays?: boolean; resetUsage?: boolean } = {}) {
    const existing = await this.prisma.cellPart.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`CellPart ${id} not found`);
    }

    const resetDays = options.resetDays !== false; // default true
    const resetUsage = options.resetUsage !== false; // default true

    const dataToUpdate: any = {
      reminderSent: false,
    };

    if (resetDays) {
      dataToUpdate.lastRenewalDate = new Date();
    }
    if (resetUsage) {
      dataToUpdate.currentUsage = 0;
    }

    const updated = await this.prisma.cellPart.update({
      where: { id },
      data: dataToUpdate,
    });

    return this.enrichWithLifetime(updated);
  }

  /** Delete a CellPart */
  async remove(id: string) {
    const existing = await this.prisma.cellPart.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`CellPart ${id} not found`);
    }

    return this.prisma.cellPart.delete({ where: { id } });
  }

  /** Record a part replacement with full historical logging */
  async recordReplacement(
    id: string,
    dto: {
      replacedAt?: string;
      replacedBy: string;
      reason: string;
      notes?: string;
      resetUsage?: boolean;
    },
  ) {
    const cp = await this.prisma.cellPart.findUnique({
      where: { id },
      include: { design: true },
    });
    if (!cp) throw new NotFoundException(`CellPart ${id} not found`);

    const replacedAt = dto.replacedAt ? new Date(dto.replacedAt) : new Date();
    const baseDate = cp.lastRenewalDate || cp.installDate || cp.createdAt;
    const daysUsed = Math.max(
      0,
      Math.ceil((replacedAt.getTime() - new Date(baseDate).getTime()) / 86400000),
    );
    const usageAtReplace = cp.currentUsage;

    // 1. Create entry in PartReplacementLog
    const replacementLog = await this.prisma.partReplacementLog.create({
      data: {
        designId: cp.designId,
        cellPartId: cp.id,
        partNumber: cp.partNumber,
        partName: cp.name,
        replacedAt,
        replacedBy: dto.replacedBy || 'PIC Jig Fixture',
        reason: dto.reason || 'Pencegahan / Aus Rutin',
        notes: dto.notes || null,
        usageAtReplace,
        daysUsed,
      },
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
        cellPart: { select: { id: true, partNumber: true, name: true } },
      },
    });

    // 2. Also log to TpmMaintenanceLog for unified TPM reporting
    await this.prisma.tpmMaintenanceLog
      .create({
        data: {
          designId: cp.designId,
          cellPartId: cp.id,
          actionType: 'RENEWAL',
          title: `Penggantian Komponen ${cp.partNumber}`,
          description: `Penggantian part ${cp.name}. Alasan: ${dto.reason || 'Penggantian rutin'}. Catatan: ${dto.notes || '-'}`,
          performedBy: dto.replacedBy || 'PIC Jig Fixture',
          performedAt: replacedAt,
          partsReplaced: cp.partNumber,
          status: 'COMPLETED',
          resetLifetime: true,
        },
      })
      .catch(() => {});

    // 3. Update CellPart dates and reset counter
    const updated = await this.prisma.cellPart.update({
      where: { id },
      data: {
        lastRenewalDate: replacedAt,
        currentUsage: dto.resetUsage !== false ? 0 : cp.currentUsage,
        reminderSent: false,
      },
    });

    return {
      cellPart: this.enrichWithLifetime(updated),
      replacementLog,
    };
  }

  /** Get replacement history logs with optional search & filters */
  async getReplacementHistory(query?: {
    designId?: string;
    cellPartId?: string;
    search?: string;
  }) {
    const where: any = {};
    if (query?.designId) where.designId = query.designId;
    if (query?.cellPartId) where.cellPartId = query.cellPartId;

    const logs = await this.prisma.partReplacementLog.findMany({
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
      orderBy: { replacedAt: 'desc' },
    });

    if (query?.search) {
      const q = query.search.toLowerCase();
      return logs.filter(
        (l) =>
          l.partNumber.toLowerCase().includes(q) ||
          l.partName.toLowerCase().includes(q) ||
          l.replacedBy.toLowerCase().includes(q) ||
          l.reason.toLowerCase().includes(q) ||
          (l.notes && l.notes.toLowerCase().includes(q)) ||
          l.design.noReg.toLowerCase().includes(q) ||
          l.design.assyPartName.toLowerCase().includes(q),
      );
    }

    return logs;
  }

  /** Delete a replacement log entry */
  async deleteReplacementLog(id: string) {
    const existing = await this.prisma.partReplacementLog.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`Replacement log ${id} not found`);
    return this.prisma.partReplacementLog.delete({ where: { id } });
  }

  /** Enrich a CellPart record with computed 2-way lifetime fields */
  public enrichWithLifetime(part: any) {
    const baseDate = part.lastRenewalDate || part.installDate || new Date();
    const lifetimeDays = part.lifetimeDays ?? 180;
    const dueDate = new Date(
      new Date(baseDate).getTime() + lifetimeDays * 86400000,
    );
    const daysRemaining = Math.ceil(
      (dueDate.getTime() - Date.now()) / 86400000,
    );

    // Day status
    let dayStatus: 'OVERDUE' | 'WARNING' | 'SAFE';
    if (daysRemaining <= 0) {
      dayStatus = 'OVERDUE';
    } else if (daysRemaining <= 35) {
      dayStatus = 'WARNING';
    } else {
      dayStatus = 'SAFE';
    }

    // Usage status
    const maxUsage = part.maxUsage ?? 500;
    const currentUsage = part.currentUsage ?? 0;
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

    // Combined 2-Way Evaluation
    const lifetimeType: 'DUAL' | 'USAGE' | 'DAYS' = part.lifetimeType || 'DUAL';
    let lifetimeStatus: 'OVERDUE' | 'WARNING' | 'SAFE';
    let triggerReason: 'DAYS' | 'USAGE' | 'BOTH' | 'NONE' = 'NONE';

    if (lifetimeType === 'DAYS') {
      lifetimeStatus = dayStatus;
      triggerReason = dayStatus !== 'SAFE' ? 'DAYS' : 'NONE';
    } else if (lifetimeType === 'USAGE') {
      lifetimeStatus = usageStatus;
      triggerReason = usageStatus !== 'SAFE' ? 'USAGE' : 'NONE';
    } else {
      // DUAL (2-Way: whichever limit is reached first)
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
      ...part,
      lifetimeType,
      maxUsage,
      currentUsage,
      usageRemaining,
      usagePercent,
      dueDate: dueDate.toISOString(),
      daysRemaining,
      dayStatus,
      usageStatus,
      lifetimeStatus,
      triggerReason,
    };
  }
}
