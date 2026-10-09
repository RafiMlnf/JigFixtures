import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { StorageService } from '../upload/storage.service';
import { SubmitApprovalDto } from './dto/submit-approval.dto';
import { ProcessApprovalDto } from './dto/process-approval.dto';

@Injectable()
export class ApprovalService {
  constructor(
    private prisma: PrismaService,
    private storageService: StorageService,
  ) {}

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
      skipDuplicates: true,
    });

    return approval;
  }

  async findAll(userId: string, role: string) {
    const include = {
      design: { include: { line: true, process: true, vendor: true, documents: true } },
      submittedBy: true,
      sectionHead: true,
      deptHead: true,
    };

    // Return all submissions so Section Head, Dept Head, and PIC have full visibility
    // and can see the pipeline progress across sequential stages
    const approvals = await this.prisma.approval.findMany({
      include,
      orderBy: { createdAt: 'desc' },
    });

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
            documents: true,
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

  async process(id: string, dto: ProcessApprovalDto, userId: string, role: string) {
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
        const user = await this.prisma.user.findUnique({ where: { id: userId } });
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
          skipDuplicates: true,
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
        // REVISI (REJECT)
        if (!dto.comment) {
          throw new BadRequestException('Catatan revisi wajib diisi ketika meminta revisi');
        }

        let annotatedDocPath: string | undefined = undefined;
        if (dto.markupData && dto.markupData.startsWith('data:image')) {
          try {
            const base64Data = dto.markupData.replace(/^data:image\/\w+;base64,/, '');
            const buffer = Buffer.from(base64Data, 'base64');
            const filename = `markup_${id}_${Date.now()}.png`;
            annotatedDocPath = await this.storageService.saveBuffer(buffer, filename, 'image/png');
          } catch (e) {
            console.warn('Failed to save markup image buffer:', e);
          }
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
            annotatedDocPath: annotatedDocPath || undefined,
            markupData: dto.markupData || undefined,
          },
          include: { design: { include: { line: true, process: true, vendor: true } }, submittedBy: true, sectionHead: true, deptHead: true },
        });

        // Notify Submitter
        await this.prisma.notification.create({
          data: {
            type: 'REVISION_REQUESTED',
            title: '⚠️ Permintaan Revisi: Section Head',
            message: `Drawing ${approval.design.noReg} memerlukan revisi: "${comment}". Periksa catatan & coretan pada dokumen.`,
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
            revStatus: latestHistory?.revStatus || String(parseInt(approval.design.revStatus || '0', 10) + 1),
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
            type: 'WAITING_APPROVAL',
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
        // REVISI (REJECT)
        if (!dto.comment) {
          throw new BadRequestException('Catatan revisi wajib diisi ketika meminta revisi');
        }

        let annotatedDocPath: string | undefined = undefined;
        if (dto.markupData && dto.markupData.startsWith('data:image')) {
          try {
            const base64Data = dto.markupData.replace(/^data:image\/\w+;base64,/, '');
            const buffer = Buffer.from(base64Data, 'base64');
            const filename = `markup_${id}_${Date.now()}.png`;
            annotatedDocPath = await this.storageService.saveBuffer(buffer, filename, 'image/png');
          } catch (e) {
            console.warn('Failed to save markup image buffer:', e);
          }
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
            annotatedDocPath: annotatedDocPath || undefined,
            markupData: dto.markupData || undefined,
          },
          include: { design: { include: { line: true, process: true, vendor: true } }, submittedBy: true, sectionHead: true, deptHead: true },
        });

        // Notify Submitter
        await this.prisma.notification.create({
          data: {
            type: 'REVISION_REQUESTED',
            title: '⚠️ Permintaan Revisi: Dept Head',
            message: `Drawing ${approval.design.noReg} memerlukan revisi dari Dept Head: "${comment}". Periksa catatan & coretan pada dokumen.`,
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

  /**
   * Resubmit a revised drawing from the Drawer.
   * Archives the previous drawing into revisionHistory (accessible strictly in Version History),
   * replaces the active document, updates revStatus, and restarts the sequential approval pipeline.
   */
  async resubmitRevision(
    id: string,
    dto: {
      docLocation2D: string;
      docLocation3D?: string;
      revStatus?: string;
      revisionNote: string;
    },
    userId: string,
  ) {
    const approval = await this.prisma.approval.findUnique({
      where: { id },
      include: {
        design: {
          include: {
            documents: true,
            revisionHistories: { orderBy: { createdAt: 'desc' } },
          },
        },
        submittedBy: true,
      },
    });

    if (!approval) {
      throw new NotFoundException(`Approval with ID ${id} not found`);
    }

    // 1. Archive previous drawing into revisionHistory (strictly for Version History)
    const oldDoc = approval.design.documents.find((d) => d.loc2D) || approval.design.documents[0];
    await this.prisma.revisionHistory.create({
      data: {
        designId: approval.designId,
        revStatus: approval.design.revStatus || '0',
        description: `Arsip sebelum revisi: ${approval.finalComment || approval.revisionNote || 'Revisi sebelumnya'}`,
        changedById: userId,
        loc2D: oldDoc?.loc2D || null,
        path2D: oldDoc?.path2D || null,
        loc3D: approval.design.revisionHistories[0]?.loc3D || null,
        path3D: approval.design.revisionHistories[0]?.path3D || null,
      },
    });

    // 2. Overwrite / replace active document (delete old document records, insert new active one)
    await this.prisma.document.deleteMany({
      where: { designId: approval.designId },
    });

    await this.prisma.document.create({
      data: {
        designId: approval.designId,
        path2D: dto.docLocation2D,
        loc2D: dto.docLocation2D,
        approvalStatus: 'WAITING',
      },
    });

    // 3. Update design metadata
    const nextRev = dto.revStatus || String(parseInt(approval.design.revStatus || '0', 10) + 1);
    await this.prisma.design.update({
      where: { id: approval.designId },
      data: {
        revStatus: nextRev,
        designDateNew: new Date(),
      },
    });

    // 4. Reset approval record for new review cycle
    const updatedApproval = await this.prisma.approval.update({
      where: { id },
      data: {
        status: 'WAITING',
        sectionStatus: 'WAITING',
        sectionComment: null,
        sectionAt: null,
        deptStatus: 'WAITING',
        deptComment: null,
        deptAt: null,
        finalStatus: 'WAITING',
        finalComment: null,
        markupData: null,
        annotatedDocPath: null,
        revisionNote: dto.revisionNote || `Revisi baru — Rev ${nextRev}`,
        submittedAt: new Date(),
      },
      include: {
        design: {
          include: { line: true, process: true, vendor: true, documents: true },
        },
        submittedBy: true,
        sectionHead: true,
        deptHead: true,
      },
    });

    // 5. Notify Section Heads
    const sectionHeads = await this.prisma.user.findMany({
      where: { role: { name: 'PE_SECTION_HEAD' } },
    });

    await this.prisma.notification.createMany({
      data: sectionHeads.map((sh) => ({
        type: 'WAITING_APPROVAL',
        title: '📋 Drawing Revisi Menunggu Approval',
        message: `${approval.submittedBy?.name || 'Drawer'} telah mengunggah revisi baru (Rev ${nextRev}) untuk ${approval.design.noReg}.`,
        designId: approval.designId,
        userId: sh.id,
      })),
      skipDuplicates: true,
    });

    return {
      ...updatedApproval,
      item: {
        ...updatedApproval.design,
        lineProduct: updatedApproval.design.line.lineName,
        process: updatedApproval.design.process.name,
      },
    };
  }
}

