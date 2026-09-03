import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { SubmitApprovalDto } from './dto/submit-approval.dto';
import { ProcessApprovalDto } from './dto/process-approval.dto';

@Injectable()
export class ApprovalService {
  constructor(private prisma: PrismaService) {}

  async submit(dto: SubmitApprovalDto, userId: string) {
    const item = await this.prisma.design.findUnique({
      where: { id: dto.itemId },
    });
    if (!item) {
      throw new NotFoundException(`Item with ID ${dto.itemId} not found`);
    }

    // Find section head and dept head
    const sectionHead = await this.prisma.user.findFirst({
      where: { role: { name: 'PE_SECTION_HEAD' } },
    });
    const deptHead = await this.prisma.user.findFirst({
      where: { role: { name: 'PE_DEPT_HEAD' } },
    });

    // 1. Create Approval record
    const approval = await this.prisma.approval.create({
      data: {
        type: dto.type,
        designId: dto.itemId,
        revisionNote: dto.revisionNote,
        submittedById: userId,
        sectionHeadId: sectionHead?.id,
        deptHeadId: deptHead?.id,
        status: 'WAITING',
        sectionStatus: 'WAITING',
        deptStatus: 'WAITING',
        finalStatus: 'WAITING',
      },
      include: {
        design: true,
        submittedBy: true,
      },
    });

    // 2. Notify Section Heads
    const sectionHeads = await this.prisma.user.findMany({
      where: { role: { name: 'PE_SECTION_HEAD' } },
    });
    await this.prisma.notification.createMany({
      data: sectionHeads.map((sh) => ({
        type: 'WAITING_APPROVAL',
        title: '📋 Approval Waiting: Section Head',
        message: `${approval.submittedBy.name} has submitted a new design revision for item ${item.noReg}.`,
        designId: dto.itemId,
        userId: sh.id,
      })),
    });

    return approval;
  }

  async findAll(userId: string, role: string) {
    const include = {
      design: { include: { line: true, process: true, vendor: true } },
      submittedBy: true,
      sectionHead: true,
      deptHead: true,
    };

    let approvals;

    if (role === 'PE_SECTION_HEAD') {
      approvals = await this.prisma.approval.findMany({
        where: {
          OR: [
            { sectionStatus: 'WAITING' },
            { sectionHeadId: userId },
          ],
        },
        include,
        orderBy: { createdAt: 'desc' },
      });
    } else if (role === 'PE_DEPT_HEAD') {
      approvals = await this.prisma.approval.findMany({
        where: {
          sectionStatus: 'APPROVED',
          OR: [
            { deptStatus: 'WAITING' },
            { deptHeadId: userId },
          ],
        },
        include,
        orderBy: { createdAt: 'desc' },
      });
    } else {
      // PIC or Tamu sees all submissions
      approvals = await this.prisma.approval.findMany({
        include,
        orderBy: { createdAt: 'desc' },
      });
    }

    // Map fields to match legacy design schema
    return approvals.map((appr) => ({
      ...appr,
      item: {
        ...appr.design,
        lineProduct: appr.design.line.lineName,
        process: appr.design.process.name,
      },
    }));
  }

  async findOne(id: string) {
    const approval = await this.prisma.approval.findUnique({
      where: { id },
      include: {
        design: {
          include: {
            line: true,
            process: true,
            vendor: true,
            revisionHistories: {
              orderBy: { createdAt: 'desc' },
            },
          },
        },
        submittedBy: true,
        sectionHead: true,
        deptHead: true,
      },
    });
    if (!approval) {
      throw new NotFoundException(`Approval with ID ${id} not found`);
    }

    return {
      ...approval,
      item: {
        ...approval.design,
        lineProduct: approval.design.line.lineName,
        process: approval.design.process.name,
      },
    };
  }

  async findMySubmissions(userId: string) {
    const approvals = await this.prisma.approval.findMany({
      where: { submittedById: userId },
      include: {
        design: { include: { line: true, process: true, vendor: true } },
        submittedBy: true,
        sectionHead: true,
        deptHead: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return approvals.map((appr) => ({
      ...appr,
      item: {
        ...appr.design,
        lineProduct: appr.design.line.lineName,
        process: appr.design.process.name,
      },
    }));
  }

  async process(id: string, dto: { action: 'APPROVE' | 'REJECT'; comment?: string }, userId: string, role: string) {
    const approval = await this.prisma.approval.findUnique({
      where: { id },
      include: { design: true, submittedBy: true },
    });
    if (!approval) {
      throw new NotFoundException(`Approval with ID ${id} not found`);
    }

    if (approval.status !== 'WAITING') {
      throw new BadRequestException('This approval has already been completed');
    }

    const comment = dto.comment || '';

    if (role === 'PE_SECTION_HEAD') {
      if (dto.action === 'APPROVE') {
        const updated = await this.prisma.approval.update({
          where: { id },
          data: {
            sectionHeadId: userId,
            sectionStatus: 'APPROVED',
            sectionComment: comment,
            sectionAt: new Date(),
          },
          include: { design: { include: { line: true, process: true, vendor: true } }, submittedBy: true, sectionHead: true, deptHead: true },
        });

        // Notify Dept Heads
        const deptHeads = await this.prisma.user.findMany({
          where: { role: { name: 'PE_DEPT_HEAD' } },
        });
        await this.prisma.notification.createMany({
          data: deptHeads.map((dh) => ({
            type: 'WAITING_APPROVAL',
            title: '📋 Approval Waiting: Dept Head',
            message: `Section Head approved revision for ${approval.design.noReg}. Awaiting your final review.`,
            designId: approval.designId,
            userId: dh.id,
          })),
        });

        return {
          ...updated,
          item: {
            ...updated.design,
            lineProduct: updated.design.line.lineName,
            process: updated.design.process.name,
          },
        };
      } else {
        // REJECT
        if (!dto.comment) {
          throw new BadRequestException('Comment is mandatory when rejecting');
        }

        const updated = await this.prisma.approval.update({
          where: { id },
          data: {
            sectionHeadId: userId,
            sectionStatus: 'REJECTED',
            sectionComment: comment,
            sectionAt: new Date(),
            status: 'REJECTED',
            finalStatus: 'REJECTED',
            finalComment: comment,
          },
          include: { design: { include: { line: true, process: true, vendor: true } }, submittedBy: true, sectionHead: true, deptHead: true },
        });

        // Notify Submitter
        await this.prisma.notification.create({
          data: {
            type: 'INVENTORY_YELLOW',
            title: '❌ Revision Rejected by Section Head',
            message: `Your revision request for ${approval.design.noReg} was rejected: "${comment}"`,
            designId: approval.designId,
            userId: approval.submittedById,
          },
        });

        return {
          ...updated,
          item: {
            ...updated.design,
            lineProduct: updated.design.line.lineName,
            process: updated.design.process.name,
          },
        };
      }
    } else if (role === 'PE_DEPT_HEAD') {
      if (approval.sectionStatus !== 'APPROVED') {
        throw new BadRequestException('Section Head must approve this request before the Dept Head can review it.');
      }

      if (dto.action === 'APPROVE') {
        // Final Approval
        const updated = await this.prisma.approval.update({
          where: { id },
          data: {
            deptHeadId: userId,
            deptStatus: 'APPROVED',
            deptComment: comment,
            deptAt: new Date(),
            status: 'APPROVED',
            finalStatus: 'APPROVED',
            finalComment: comment,
          },
          include: { design: { include: { line: true, process: true, vendor: true } }, submittedBy: true, sectionHead: true, deptHead: true },
        });

        // Update the item revision status in the main master list
        const latestHistory = await this.prisma.revisionHistory.findFirst({
          where: { designId: approval.designId },
          orderBy: { createdAt: 'desc' },
        });

        if (latestHistory) {
          await this.prisma.revisionHistory.update({
            where: { id: latestHistory.id },
            data: { approvedByName: updated.deptHead?.name || 'Dept Head' },
          });
        }

        await this.prisma.design.update({
          where: { id: approval.designId },
          data: {
            revStatus: String(parseInt(approval.design.revStatus || '0', 10) + 1),
            designDateNew: new Date(),
            vendorId: latestHistory?.vendorId || undefined,
          },
        });

        // Update document status if any
        await this.prisma.document.updateMany({
          where: { designId: approval.designId, approvalStatus: 'WAITING' },
          data: { approvalStatus: 'APPROVED' },
        });

        // Notify Submitter
        await this.prisma.notification.create({
          data: {
            type: 'INVENTORY_GREEN',
            title: '✅ Revision Approved (Completed)',
            message: `Your revision request for ${approval.design.noReg} was fully approved and updated in the system.`,
            designId: approval.designId,
            userId: approval.submittedById,
          },
        });

        return {
          ...updated,
          item: {
            ...updated.design,
            lineProduct: updated.design.line.lineName,
            process: updated.design.process.name,
          },
        };
      } else {
        // REJECT
        if (!dto.comment) {
          throw new BadRequestException('Comment is mandatory when rejecting');
        }

        const updated = await this.prisma.approval.update({
          where: { id },
          data: {
            deptHeadId: userId,
            deptStatus: 'REJECTED',
            deptComment: comment,
            deptAt: new Date(),
            status: 'REJECTED',
            finalStatus: 'REJECTED',
            finalComment: comment,
          },
          include: { design: { include: { line: true, process: true, vendor: true } }, submittedBy: true, sectionHead: true, deptHead: true },
        });

        // Notify Submitter
        await this.prisma.notification.create({
          data: {
            type: 'INVENTORY_YELLOW',
            title: '❌ Revision Rejected by Dept Head',
            message: `Your revision request for ${approval.design.noReg} was rejected by Dept Head: "${comment}"`,
            designId: approval.designId,
            userId: approval.submittedById,
          },
        });

        return {
          ...updated,
          item: {
            ...updated.design,
            lineProduct: updated.design.line.lineName,
            process: updated.design.process.name,
          },
        };
      }
    } else {
      throw new BadRequestException('Only Section Heads or Dept Heads can approve/reject.');
    }
  }
}
