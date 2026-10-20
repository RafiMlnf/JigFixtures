import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreateChildPartDto } from './dto/create-child-part.dto';
import { UpdateChildPartDto } from './dto/update-child-part.dto';

@Injectable()
export class ChildPartService {
  constructor(private prisma: PrismaService) {}

  /** List all ChildParts for a given parent Design (Jig) */
  async findByDesign(designId: string) {
    const parts = await this.prisma.childPart.findMany({
      where: { designId },
      orderBy: { partNumber: 'asc' },
      include: { masterPart: { include: { _count: { select: { usages: true } } } } },
    });

    return parts.map((part) => this.enrichWithLifetime(this.mergeMaster(part)));
  }

  /** Stok & identitas diambil dari MasterPart (terpusat) bila ada */
  private mergeMaster(part: any) {
    const { masterPart, ...rest } = part;
    if (!masterPart) return rest;
    return {
      ...rest,
      name: masterPart.name,
      material: masterPart.material ?? rest.material,
      minimumStock: masterPart.minimumStock,
      actualStock: masterPart.actualStock,
      sharedJigCount: masterPart._count?.usages ?? 1,
    };
  }

  /** Katalog master part (untuk dipilih saat menambah child part ke Jig) */
  async findMasterParts(search?: string) {
    const q = search?.trim();
    const masters = await this.prisma.masterPart.findMany({
      where: q
        ? {
            OR: [
              { partNumber: { contains: q, mode: 'insensitive' } },
              { name: { contains: q, mode: 'insensitive' } },
            ],
          }
        : undefined,
      orderBy: { partNumber: 'asc' },
      include: {
        usages: {
          select: {
            id: true,
            qty: true,
            design: { select: { id: true, noReg: true, assyPartName: true } },
          },
        },
      },
    });
    return masters.map((m) => ({
      ...m,
      usedInJigs: m.usages.map((u) => ({ childPartId: u.id, qty: u.qty, ...u.design })),
      usageCount: m.usages.length,
      stockStatus:
        m.actualStock <= 0 ? 'RED' : m.actualStock <= m.minimumStock ? 'YELLOW' : 'GREEN',
    }));
  }

  /** Update data/stok master (berlaku untuk semua Jig yang memakainya) */
  async updateMasterPart(
    id: string,
    dto: { name?: string; description?: string; material?: string; minimumStock?: number; actualStock?: number },
  ) {
    const existing = await this.prisma.masterPart.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`MasterPart ${id} not found`);
    return this.prisma.masterPart.update({ where: { id }, data: dto });
  }

  /** Cari master berdasarkan partNumber, buat jika belum ada */
  private async resolveMaster(dto: {
    partNumber: string;
    name: string;
    description?: string | null;
    minimumStock?: number;
    actualStock?: number;
  }) {
    const found = await this.prisma.masterPart.findUnique({ where: { partNumber: dto.partNumber } });
    if (found) {
      // Part sudah ada di katalog: stok hanya diubah bila diisi eksplisit
      if (dto.minimumStock !== undefined || dto.actualStock !== undefined) {
        return this.prisma.masterPart.update({
          where: { id: found.id },
          data: { minimumStock: dto.minimumStock, actualStock: dto.actualStock },
        });
      }
      return found;
    }
    return this.prisma.masterPart.create({
      data: {
        partNumber: dto.partNumber,
        name: dto.name,
        description: dto.description || null,
        minimumStock: dto.minimumStock ?? 0,
        actualStock: dto.actualStock ?? 0,
      },
    });
  }

  /** Get all ChildParts that are OVERDUE or WARNING (≤35 days to due date) */
  async getReminders() {
    const allParts = await this.prisma.childPart.findMany({
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

  /** Create a new ChildPart under a parent Design */
  async create(dto: CreateChildPartDto) {
    // Verify parent design exists
    const design = await this.prisma.design.findUnique({
      where: { id: dto.designId },
    });
    if (!design) {
      throw new NotFoundException(`Design ${dto.designId} not found`);
    }

    // Check for duplicate partNumber under the same parent
    const existing = await this.prisma.childPart.findFirst({
      where: { designId: dto.designId, partNumber: dto.partNumber },
    });
    if (existing) {
      throw new ConflictException(
        `Part number "${dto.partNumber}" already exists under this Jig`,
      );
    }

    const master = await this.resolveMaster(dto);

    const childPart = await this.prisma.childPart.create({
      data: {
        designId: dto.designId,
        masterPartId: master.id,
        partNumber: master.partNumber,
        name: master.name,
        description: dto.description || master.description || null,
        qty: (dto as any).qty ? String((dto as any).qty) : undefined,
        lifetimeDays: dto.lifetimeDays || 180,
        installDate: dto.installDate ? new Date(dto.installDate) : new Date(),
        minimumStock: master.minimumStock,
        actualStock: master.actualStock,
        pdfPageIndex: dto.pdfPageIndex ?? null,
      },
      include: { masterPart: { include: { _count: { select: { usages: true } } } } },
    });

    return this.enrichWithLifetime(this.mergeMaster(childPart));
  }

  /** Update an existing ChildPart */
  async update(id: string, dto: UpdateChildPartDto) {
    const existing = await this.prisma.childPart.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`ChildPart ${id} not found`);
    }

    // If partNumber is being changed, check uniqueness under the same parent
    if (dto.partNumber && dto.partNumber !== existing.partNumber) {
      const dup = await this.prisma.childPart.findFirst({
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

    // Stok & nama bersifat terpusat -> tulis ke MasterPart (berlaku untuk semua Jig)
    if (
      existing.masterPartId &&
      (dto.minimumStock !== undefined || dto.actualStock !== undefined || dto.name !== undefined)
    ) {
      await this.prisma.masterPart.update({
        where: { id: existing.masterPartId },
        data: {
          name: dto.name,
          minimumStock: dto.minimumStock,
          actualStock: dto.actualStock,
        },
      });
    }

    const updated = await this.prisma.childPart.update({
      where: { id },
      data: {
        partNumber: dto.partNumber,
        name: dto.name,
        description: dto.description,
        lifetimeDays: dto.lifetimeDays,
        installDate: dto.installDate ? new Date(dto.installDate) : undefined,
        pdfPageIndex: dto.pdfPageIndex,
      },
      include: { masterPart: { include: { _count: { select: { usages: true } } } } },
    });

    return this.enrichWithLifetime(this.mergeMaster(updated));
  }

  /** Log or set usage for a ChildPart (stubbed or no-op) */
  async logUsage(id: string, amount: number, mode: 'ADD' | 'SET' = 'ADD') {
    const existing = await this.prisma.childPart.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`ChildPart ${id} not found`);
    }
    return this.enrichWithLifetime(existing);
  }

  /** Renew a ChildPart's lifetime — reset installDate/lastRenewalDate */
  async renew(id: string, options: { resetDays?: boolean } = {}) {
    const existing = await this.prisma.childPart.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`ChildPart ${id} not found`);
    }

    const resetDays = options.resetDays !== false; // default true

    const dataToUpdate: any = {
      reminderSent: false,
    };

    if (resetDays) {
      dataToUpdate.lastRenewalDate = new Date();
    }

    const updated = await this.prisma.childPart.update({
      where: { id },
      data: dataToUpdate,
    });

    return this.enrichWithLifetime(updated);
  }

  /** Delete a ChildPart */
  async remove(id: string) {
    const existing = await this.prisma.childPart.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`ChildPart ${id} not found`);
    }

    return this.prisma.childPart.delete({ where: { id } });
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
    const cp = await this.prisma.childPart.findUnique({
      where: { id },
      include: { design: true },
    });
    if (!cp) throw new NotFoundException(`ChildPart ${id} not found`);

    const replacedAt = dto.replacedAt ? new Date(dto.replacedAt) : new Date();
    const baseDate = cp.lastRenewalDate || cp.installDate || cp.createdAt;
    const daysUsed = Math.max(
      0,
      Math.ceil((replacedAt.getTime() - new Date(baseDate).getTime()) / 86400000),
    );

    // 1. Create entry in PartReplacementLog
    const replacementLog = await this.prisma.partReplacementLog.create({
      data: {
        designId: cp.designId,
        childPartId: cp.id,
        partNumber: cp.partNumber,
        partName: cp.name,
        replacedAt,
        replacedBy: dto.replacedBy || 'PIC Jig Fixture',
        reason: dto.reason || 'Pencegahan / Aus Rutin',
        notes: dto.notes || null,
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
        childPart: { select: { id: true, partNumber: true, name: true } },
      },
    });

    // 2. Also log to TpmMaintenanceLog for unified TPM reporting
    await this.prisma.tpmMaintenanceLog
      .create({
        data: {
          designId: cp.designId,
          childPartId: cp.id,
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

    // 3. Update ChildPart dates + kurangi stok master (1 unit terpakai, min 0)
    const updated = await this.prisma.childPart.update({
      where: { id },
      data: {
        lastRenewalDate: replacedAt,
        reminderSent: false,
      },
    });
    if (cp.masterPartId) {
      await this.prisma.masterPart
        .updateMany({
          where: { id: cp.masterPartId, actualStock: { gt: 0 } },
          data: { actualStock: { decrement: 1 } },
        })
        .catch(() => {});
    }

    return {
      childPart: this.enrichWithLifetime(updated),
      replacementLog,
    };
  }

  /** Get replacement history logs with optional search & filters */
  async getReplacementHistory(query?: {
    designId?: string;
    childPartId?: string;
    search?: string;
  }) {
    const where: any = {};
    if (query?.designId) where.designId = query.designId;
    if (query?.childPartId) where.childPartId = query.childPartId;

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
        childPart: {
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

  /** Enrich a ChildPart record with computed lifetime fields by days */
  public enrichWithLifetime(part: any) {
    const baseDate = part.lastRenewalDate || part.installDate || new Date();
    const lifetimeDays = part.lifetimeDays ?? 180;
    const dueDate = new Date(
      new Date(baseDate).getTime() + lifetimeDays * 86400000,
    );
    const daysRemaining = Math.ceil(
      (dueDate.getTime() - Date.now()) / 86400000,
    );

    let lifetimeStatus: 'OVERDUE' | 'WARNING' | 'SAFE';
    if (daysRemaining <= 0) {
      lifetimeStatus = 'OVERDUE';
    } else if (daysRemaining <= 35) {
      lifetimeStatus = 'WARNING';
    } else {
      lifetimeStatus = 'SAFE';
    }

    return {
      ...part,
      dueDate: dueDate.toISOString(),
      daysRemaining,
      dayStatus: lifetimeStatus,
      lifetimeStatus,
      triggerReason: lifetimeStatus !== 'SAFE' ? 'DAYS' : 'NONE',
    };
  }
}
