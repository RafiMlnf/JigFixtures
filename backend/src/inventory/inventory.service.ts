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

  private enrichChildPart(cp: any) {
    const baseDate = cp.lastRenewalDate || cp.installDate || new Date();
    const lifetimeDays = cp.lifetimeDays ?? 180;
    const dueDate = new Date(new Date(baseDate).getTime() + lifetimeDays * 86400000);
    const daysRemaining = Math.ceil((dueDate.getTime() - Date.now()) / 86400000);
    const dayStatus: 'OVERDUE' | 'WARNING' | 'SAFE' =
      daysRemaining <= 0 ? 'OVERDUE' : daysRemaining <= 35 ? 'WARNING' : 'SAFE';

    return {
      ...cp,
      indicator: this.getIndicator(cp.actualStock, cp.minimumStock),
      dueDate: dueDate.toISOString(),
      daysRemaining,
      dayStatus,
      lifetimeStatus: dayStatus,
      triggerReason: dayStatus !== 'SAFE' ? 'DAYS' : 'NONE',
    };
  }

  private enrichDesignLifetime(item: any) {
    const baseDate = item.designDateNew || item.createdAt || new Date();
    const lifetimeDays = item.lifetimeDays ?? 180;
    const dueDate = new Date(new Date(baseDate).getTime() + lifetimeDays * 86400000);
    const daysRemaining = Math.ceil((dueDate.getTime() - Date.now()) / 86400000);
    const dayStatus: 'OVERDUE' | 'WARNING' | 'SAFE' =
      daysRemaining <= 0 ? 'OVERDUE' : daysRemaining <= 35 ? 'WARNING' : 'SAFE';

    return {
      dueDate: dueDate.toISOString(),
      daysRemaining,
      dayStatus,
      lifetimeStatus: dayStatus,
      triggerReason: dayStatus !== 'SAFE' ? 'DAYS' : 'NONE',
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
      include: { line: true, process: true, vendor: true, childParts: { orderBy: { partNumber: 'asc' } } },
      orderBy: { noReg: 'asc' },
    });

    // Map properties for UI compatibility
    let items = rawItems.map((item) => ({
      ...item,
      lineProduct: item.line.lineName,
      process: item.process.name,
      indicator: this.getIndicator(item.actualStock, item.minimumStock),
      ...this.enrichDesignLifetime(item),
      childParts: (item as any).childParts?.map((cp: any) => this.enrichChildPart(cp)) || [],
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
      include: { line: true, process: true, vendor: true, childParts: { orderBy: { partNumber: 'asc' } } },
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
      childParts: (item as any).childParts?.map((cp: any) => this.enrichChildPart(cp)) || [],
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
    const rawItems = await this.prisma.childPart.findMany();
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
    // 1. Red items (childpart actual stock is 0, grouped per Jig)
    const redChildParts = await this.prisma.childPart.findMany({
      where: { actualStock: 0, minimumStock: { gt: 0 } },
      select: { design: { select: { id: true, noReg: true, assyPartName: true } }, partNumber: true, name: true },
    });
    const redMap = new Map<string, { id: string; noReg: string; assyPartName: string }>();
    redChildParts.forEach((cp: any) => {
      if (cp.design) {
        redMap.set(cp.design.id, {
          id: cp.design.id,
          noReg: cp.design.noReg,
          assyPartName: `${cp.design.assyPartName} - ${cp.partNumber} ${cp.name || ''}`.trim(),
        });
      }
    });
    const redItems = Array.from(redMap.values());

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
