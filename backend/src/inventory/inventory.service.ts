import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { FilterInventoryDto } from './dto/filter-inventory.dto';
import { UpdateInventoryDto } from './dto/update-inventory.dto';

@Injectable()
export class InventoryService {
  constructor(private prisma: PrismaService) {}

  private getIndicator(actual: number, minimum: number): 'RED' | 'YELLOW' | 'GREEN' {
    if (minimum === 0) return 'GREEN';
    const percentage = (actual / minimum) * 100;
    if (percentage >= 100) return 'GREEN';
    if (percentage >= 50) return 'YELLOW';
    return 'RED';
  }

  private enrichCellPart(cp: any) {
    const baseDate = cp.lastRenewalDate || cp.installDate || new Date();
    const lifetimeDays = cp.lifetimeDays ?? 180;
    const dueDate = new Date(new Date(baseDate).getTime() + lifetimeDays * 86400000);
    const daysRemaining = Math.ceil((dueDate.getTime() - Date.now()) / 86400000);
    const dayStatus: 'OVERDUE' | 'WARNING' | 'SAFE' =
      daysRemaining <= 0 ? 'OVERDUE' : daysRemaining <= 35 ? 'WARNING' : 'SAFE';

    const maxUsage = cp.maxUsage ?? 500;
    const currentUsage = cp.currentUsage ?? 0;
    const usageRemaining = Math.max(0, maxUsage - currentUsage);
    const usagePercent = maxUsage > 0 ? Math.round((currentUsage / maxUsage) * 100) : 0;
    const usageStatus: 'OVERDUE' | 'WARNING' | 'SAFE' =
      currentUsage >= maxUsage ? 'OVERDUE' : usagePercent >= 85 || (maxUsage - currentUsage) <= 50 ? 'WARNING' : 'SAFE';

    const lifetimeType: 'DUAL' | 'USAGE' | 'DAYS' = cp.lifetimeType || 'DUAL';
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
        triggerReason = dayStatus === 'OVERDUE' && usageStatus === 'OVERDUE' ? 'BOTH' : dayStatus === 'OVERDUE' ? 'DAYS' : 'USAGE';
      } else if (dayStatus === 'WARNING' || usageStatus === 'WARNING') {
        lifetimeStatus = 'WARNING';
        triggerReason = dayStatus === 'WARNING' && usageStatus === 'WARNING' ? 'BOTH' : dayStatus === 'WARNING' ? 'DAYS' : 'USAGE';
      } else {
        lifetimeStatus = 'SAFE';
        triggerReason = 'NONE';
      }
    }

    return {
      ...cp,
      indicator: this.getIndicator(cp.actualStock, cp.minimumStock),
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

  private enrichDesignLifetime(item: any) {
    const baseDate = item.designDateNew || item.createdAt || new Date();
    const lifetimeDays = item.lifetimeDays ?? 180;
    const dueDate = new Date(new Date(baseDate).getTime() + lifetimeDays * 86400000);
    const daysRemaining = Math.ceil((dueDate.getTime() - Date.now()) / 86400000);
    const dayStatus: 'OVERDUE' | 'WARNING' | 'SAFE' =
      daysRemaining <= 0 ? 'OVERDUE' : daysRemaining <= 35 ? 'WARNING' : 'SAFE';

    const maxUsage = item.maxUsage ?? 500;
    const currentUsage = item.currentUsage ?? 0;
    const usageRemaining = Math.max(0, maxUsage - currentUsage);
    const usagePercent = maxUsage > 0 ? Math.round((currentUsage / maxUsage) * 100) : 0;
    const usageStatus: 'OVERDUE' | 'WARNING' | 'SAFE' =
      currentUsage >= maxUsage ? 'OVERDUE' : usagePercent >= 85 || (maxUsage - currentUsage) <= 50 ? 'WARNING' : 'SAFE';

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
        triggerReason = dayStatus === 'OVERDUE' && usageStatus === 'OVERDUE' ? 'BOTH' : dayStatus === 'OVERDUE' ? 'DAYS' : 'USAGE';
      } else if (dayStatus === 'WARNING' || usageStatus === 'WARNING') {
        lifetimeStatus = 'WARNING';
        triggerReason = dayStatus === 'WARNING' && usageStatus === 'WARNING' ? 'BOTH' : dayStatus === 'WARNING' ? 'DAYS' : 'USAGE';
      } else {
        lifetimeStatus = 'SAFE';
        triggerReason = 'NONE';
      }
    }

    return {
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

  async findAll(query: FilterInventoryDto) {
    const where: any = {};

    if (query.lineProduct) {
      where.line = { lineName: query.lineProduct };
    }
    if (query.process) {
      where.process = { name: query.process };
    }
    if (query.type) {
      where.type = query.type === 'JF' ? 'JF' : 'EQ';
    }
    if (query.search) {
      where.OR = [
        { noReg: { contains: query.search, mode: 'insensitive' } },
        { assyPartName: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    // Fetch all designs matching criteria
    const rawItems = await this.prisma.design.findMany({
      where,
      include: { line: true, process: true, vendor: true, cellParts: { orderBy: { partNumber: 'asc' } } },
      orderBy: { noReg: 'asc' },
    });

    // Map properties for UI compatibility
    let items = rawItems.map((item) => ({
      ...item,
      lineProduct: item.line.lineName,
      process: item.process.name,
      indicator: this.getIndicator(item.actualStock, item.minimumStock),
      ...this.enrichDesignLifetime(item),
      cellParts: (item as any).cellParts?.map((cp: any) => this.enrichCellPart(cp)) || [],
    }));

    if (query.indicator) {
      items = items.filter((item) => item.indicator === query.indicator);
    }

    // Paginate in-memory
    const page = parseInt(query.page || '1', 10);
    const limit = parseInt(query.limit || '20', 10);
    const total = items.length;
    const totalPages = Math.ceil(total / limit);
    const paginatedItems = items.slice((page - 1) * limit, page * limit);

    return {
      data: paginatedItems,
      meta: {
        total,
        page,
        limit,
        totalPages,
      },
    };
  }

  async findOne(id: string) {
    const item = await this.prisma.design.findUnique({
      where: { id },
      include: { line: true, process: true, vendor: true, cellParts: { orderBy: { partNumber: 'asc' } } },
    });
    if (!item) {
      throw new NotFoundException(`Inventory item with ID ${id} not found`);
    }
    return {
      ...item,
      lineProduct: item.line.lineName,
      process: item.process.name,
      indicator: this.getIndicator(item.actualStock, item.minimumStock),
      ...this.enrichDesignLifetime(item),
      cellParts: (item as any).cellParts?.map((cp: any) => this.enrichCellPart(cp)) || [],
    };
  }

  async update(id: string, dto: UpdateInventoryDto, userId: string) {
    const item = await this.prisma.design.findUnique({
      where: { id },
    });
    if (!item) {
      throw new NotFoundException(`Inventory item with ID ${id} not found`);
    }

    const indicator = this.getIndicator(dto.actualStock, dto.minimumStock);

    // 1. Log inventory change
    await this.prisma.inventoryLog.create({
      data: {
        designId: id,
        changedById: userId,
        prevMinStock: item.minimumStock,
        newMinStock: dto.minimumStock,
        prevActStock: item.actualStock,
        newActStock: dto.actualStock,
        indicator,
      },
    });

    // 2. Update stock values and status field
    const dataToUpdate: any = {
      minimumStock: dto.minimumStock,
      actualStock: dto.actualStock,
      inventoryStatus: indicator,
      lifecycleStatus: dto.lifecycleStatus,
    };
    if (dto.lifetimeDays !== undefined) dataToUpdate.lifetimeDays = dto.lifetimeDays;
    if (dto.lifetimeType !== undefined) dataToUpdate.lifetimeType = dto.lifetimeType;
    if (dto.maxUsage !== undefined) dataToUpdate.maxUsage = dto.maxUsage;
    if (dto.currentUsage !== undefined) dataToUpdate.currentUsage = dto.currentUsage;

    const updated = await this.prisma.design.update({
      where: { id },
      data: dataToUpdate,
      include: { line: true, process: true, vendor: true },
    });

    // 3. Trigger Notification if RED
    if (indicator === 'RED') {
      const users = await this.prisma.user.findMany();
      await this.prisma.notification.createMany({
        data: users.map((u) => ({
          type: 'INVENTORY_RED',
          title: '🚨 CRITICAL: Stock Empty!',
          message: `Item ${item.noReg} (${item.assyPartName}) has reached 0 actual stock!`,
          designId: id,
          userId: u.id,
        })),
      });
    }

    return {
      ...updated,
      lineProduct: updated.line.lineName,
      process: updated.process.name,
      indicator,
    };
  }

  async getSummary() {
    const rawItems = await this.prisma.design.findMany();
    let red = 0;
    let yellow = 0;
    let green = 0;

    rawItems.forEach((item) => {
      const ind = this.getIndicator(item.actualStock, item.minimumStock);
      if (ind === 'RED') red++;
      else if (ind === 'YELLOW') yellow++;
      else green++;
    });

    return {
      red,
      yellow,
      green,
      total: rawItems.length,
    };
  }

  async getAlerts() {
    // 1. Red items (actual stock is 0)
    const redItems = await this.prisma.design.findMany({
      where: { actualStock: 0 },
      select: { id: true, noReg: true, assyPartName: true },
    });

    // 2. Abnormality Open > 2 days (48 hours ago)
    const twoDaysAgo = new Date();
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);

    const delayedAbnormalities = await this.prisma.abnormality.findMany({
      where: {
        status: 'OPEN',
        createdAt: { lt: twoDaysAgo },
      },
      include: {
        design: { select: { noReg: true, assyPartName: true } },
      },
    });

    // 3. Waiting approvals count
    const waitingApprovalsCount = await this.prisma.approval.count({
      where: { status: 'WAITING' },
    });

    return {
      redItems,
      delayedAbnormalities,
      waitingApprovalsCount,
    };
  }
}
