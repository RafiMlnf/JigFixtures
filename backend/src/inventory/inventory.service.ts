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
      include: { line: true, process: true, vendor: true },
      orderBy: { noReg: 'asc' },
    });

    // Map properties for UI compatibility
    let items = rawItems.map((item) => ({
      ...item,
      lineProduct: item.line.lineName,
      process: item.process.name,
      indicator: this.getIndicator(item.actualStock, item.minimumStock),
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
      include: { line: true, process: true, vendor: true },
    });
    if (!item) {
      throw new NotFoundException(`Inventory item with ID ${id} not found`);
    }
    return {
      ...item,
      lineProduct: item.line.lineName,
      process: item.process.name,
      indicator: this.getIndicator(item.actualStock, item.minimumStock),
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
    const updated = await this.prisma.design.update({
      where: { id },
      data: {
        minimumStock: dto.minimumStock,
        actualStock: dto.actualStock,
        inventoryStatus: indicator,
        lifecycleStatus: dto.lifecycleStatus,
      },
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
