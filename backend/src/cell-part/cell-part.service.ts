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
        installDate: dto.installDate ? new Date(dto.installDate) : undefined,
        minimumStock: dto.minimumStock,
        actualStock: dto.actualStock,
        pdfPageIndex: dto.pdfPageIndex,
      },
    });

    return this.enrichWithLifetime(updated);
  }

  /** Renew a CellPart's lifetime — reset installDate to now */
  async renew(id: string) {
    const existing = await this.prisma.cellPart.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`CellPart ${id} not found`);
    }

    const updated = await this.prisma.cellPart.update({
      where: { id },
      data: {
        lastRenewalDate: new Date(),
        reminderSent: false,
      },
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

  /** Enrich a CellPart record with computed lifetime fields */
  private enrichWithLifetime(part: any) {
    const baseDate = part.lastRenewalDate || part.installDate;
    const dueDate = new Date(
      new Date(baseDate).getTime() + part.lifetimeDays * 86400000,
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
      lifetimeStatus,
    };
  }
}
