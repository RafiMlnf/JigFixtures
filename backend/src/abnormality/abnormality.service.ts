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
}
