import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { UpdateDesignDto } from './dto/update-design.dto';
import { DrawingStamperService } from '../upload/drawing-stamper.service';
import { join, extname, basename } from 'path';
import { existsSync, readFileSync, writeFileSync } from 'fs';

@Injectable()
export class DesignService {
  constructor(
    private prisma: PrismaService,
    private drawingStamperService: DrawingStamperService,
  ) {}

  /**
   * Generate a unique registration number.
   * Format: JF-YYYY-XXXX or EQ-YYYY-XXXX
   * XXXX = zero-padded sequential count among same type in same year.
   */
  private async generateNoReg(type: string): Promise<string> {
    const prefix = type === 'EQ' ? 'EQ' : 'JF';
    const year = new Date().getFullYear();

    // Count existing designs with same prefix this year
    const existing = await this.prisma.design.findMany({
      where: { noReg: { startsWith: `${prefix}-${year}-` } },
      select: { noReg: true },
    });

    // Find the highest sequence number in use
    let maxSeq = 0;
    for (const d of existing) {
      const parts = d.noReg.split('-');
      const seq = parseInt(parts[parts.length - 1], 10);
      if (!isNaN(seq) && seq > maxSeq) maxSeq = seq;
    }

    const nextSeq = String(maxSeq + 1).padStart(4, '0');
    return `${prefix}-${year}-${nextSeq}`;
  }

  /** Get all items (alias for inventory list) for the design form dropdown */
  async getAllItems() {
    const designs = await this.prisma.design.findMany({
      include: { line: true, documents: true, revisionHistories: { orderBy: { createdAt: 'desc' }, take: 1 }, cellParts: true },
      orderBy: { noReg: 'asc' },
    });

    return designs.map((d) => ({
      id: d.id,
      noReg: d.noReg,
      assyPartName: d.assyPartName,
      lineProduct: d.line.lineName,
      revStatus: d.revStatus,
      designDateNew: d.designDateNew,
      docLocation2D: d.documents[0]?.loc2D || null,
      docLocation3D: d.revisionHistories[0]?.loc3D || null,
      cellPartCount: d.cellParts?.length || 0,
    }));
  }

  /**
   * Update the design revision of a Design.
   * Also automatically creates an Approval record of type DESIGN_REVISION.
   */
  async updateDesignRevision(itemId: string, dto: UpdateDesignDto, userId: string) {
    // Check item exists
    const item = await this.prisma.design.findUnique({
      where: { id: itemId },
      include: { line: true },
    });
    if (!item) throw new NotFoundException(`Item ${itemId} not found`);

    // Update the item design fields (excluding document locations)
    const updated = await this.prisma.design.update({
      where: { id: itemId },
      data: {
        revStatus: dto.revStatus,
        designDateNew: dto.designDateNew ? new Date(dto.designDateNew) : undefined,
      },
    });

    // Handle document creation/update if location is updated
    if (dto.docLocation2D) {
      await this.prisma.document.create({
        data: {
          designId: itemId,
          path2D: dto.docLocation2D,
          loc2D: dto.docLocation2D,
          approvalStatus: 'WAITING',
        },
      });
    }

    // Find approver users based on Role model name
    const sectionHead = await this.prisma.user.findFirst({
      where: { role: { name: 'PE_SECTION_HEAD' } },
    });
    const deptHead = await this.prisma.user.findFirst({
      where: { role: { name: 'PE_DEPT_HEAD' } },
    });

    // Create approval request
    const approval = await this.prisma.approval.create({
      data: {
        type: 'DESIGN_REVISION',
        status: 'WAITING',
        designId: item.id,
        revisionNote: dto.revisionNote || `Revisi desain ${item.noReg} — Rev ${dto.revStatus}`,
        submittedById: userId,
        sectionHeadId: sectionHead?.id,
        deptHeadId: deptHead?.id,
        sectionStatus: 'WAITING',
        deptStatus: 'WAITING',
        finalStatus: 'WAITING',
      },
    });

    // Log revision history
    await this.prisma.revisionHistory.create({
      data: {
        designId: item.id,
        revStatus: dto.revStatus,
        description: dto.revisionNote || `Update Rev ${dto.revStatus}`,
        changedById: userId,
        vendorId: dto.vendorId || undefined,
        poNumber: dto.poNumber || undefined,
        cost: dto.cost ? parseFloat(String(dto.cost)) : 0,
        leadTime: dto.leadTime ? parseInt(String(dto.leadTime)) : undefined,
        loc3D: dto.docLocation3D || undefined,
        path3D: dto.docLocation3D || undefined,
        loc2D: dto.docLocation2D || undefined,
        path2D: dto.docLocation2D || undefined,
      },
    });

    return { updated, approval };
  }

  /** Get design revision history (approvals) for a specific item */
  async getDesignHistory(itemId: string) {
    return this.prisma.approval.findMany({
      where: { designId: itemId, type: 'DESIGN_REVISION' },
      include: {
        submittedBy: {
          select: {
            name: true,
            role: { select: { name: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /** Get complete master list with all relations for View Data expander */
  async getMasterList() {
    const designs = await this.prisma.design.findMany({
      include: {
        line: true,
        process: true,
        vendor: true,
        documents: true,
        abnormalities: {
          include: { reportedBy: { select: { name: true } } },
          orderBy: { createdAt: 'desc' },
        },
        revisionHistories: {
          include: { changedBy: { select: { name: true } }, vendor: true },
          orderBy: { createdAt: 'desc' },
        },
        cellParts: {
          orderBy: { partNumber: 'asc' },
        },
      },
      orderBy: { noReg: 'asc' },
    });

    return designs.map((d) => ({
      id: d.id,
      noReg: d.noReg,
      assyPartName: d.assyPartName,
      qty: d.qty,
      noItem: d.noItem,
      type: d.type,
      lifecycleStatus: d.lifecycleStatus,
      inventoryStatus: d.inventoryStatus,
      abnormalityStatus: d.abnormalityStatus,
      minimumStock: d.minimumStock,
      actualStock: d.actualStock,
      designDateNew: d.designDateNew,
      revStatus: d.revStatus,
      lineProduct: d.line.lineName,
      process: d.process.name,
      vendor: d.vendor ? { id: d.vendor.id, name: d.vendor.name } : null,
      documents: d.documents.map((doc) => ({
        id: doc.id,
        path2D: doc.path2D,
        loc2D: doc.loc2D,
        approvalStatus: doc.approvalStatus,
        drawnSignature: (doc as any).drawnSignature,
        drawnByName: (doc as any).drawnByName,
        drawnAt: (doc as any).drawnAt,
        checkedSignature: (doc as any).checkedSignature,
        checkedByName: (doc as any).checkedByName,
        checkedAt: (doc as any).checkedAt,
        approvedSignature: (doc as any).approvedSignature,
        approvedByName: (doc as any).approvedByName,
        approvedAt: (doc as any).approvedAt,
        stampedPdfPath: (doc as any).stampedPdfPath,
      })),
      revisionHistories: d.revisionHistories.map((rev) => ({
        id: rev.id,
        revStatus: rev.revStatus,
        description: rev.description,
        poNumber: rev.poNumber,
        cost: rev.cost,
        leadTime: rev.leadTime,
        approvedByName: rev.approvedByName,
        createdAt: rev.createdAt,
        vendorName: rev.vendor?.name || 'N/A',
        changedBy: rev.changedBy.name,
        path2D: rev.path2D,
        loc2D: rev.loc2D,
        path3D: rev.path3D,
        loc3D: rev.loc3D,
      })),
      abnormalities: d.abnormalities.map((abn) => ({
        id: abn.id,
        type: abn.type,
        description: abn.description,
        status: abn.status,
        dateFound: abn.dateFound,
        foundBy: abn.foundBy,
        rootCause: abn.rootCause,
        tempAction: abn.tempAction,
        correctiveAction: abn.correctiveAction,
        actionPic: abn.actionPic,
        linkToRevision: abn.linkToRevision,
        createdAt: abn.createdAt,
        reportedBy: abn.reportedBy.name,
      })),
      cellParts: (d as any).cellParts?.map((cp: any) => {
        const baseDate = cp.lastRenewalDate || cp.installDate;
        const dueDate = new Date(new Date(baseDate).getTime() + cp.lifetimeDays * 86400000);
        const daysRemaining = Math.ceil((dueDate.getTime() - Date.now()) / 86400000);
        return {
          id: cp.id,
          partNumber: cp.partNumber,
          name: cp.name,
          description: cp.description,
          lifetimeDays: cp.lifetimeDays,
          installDate: cp.installDate,
          lastRenewalDate: cp.lastRenewalDate,
          dueDate: dueDate.toISOString(),
          daysRemaining,
          lifetimeStatus: daysRemaining <= 0 ? 'OVERDUE' : daysRemaining <= 35 ? 'WARNING' : 'SAFE',
          minimumStock: cp.minimumStock,
          actualStock: cp.actualStock,
          pdfPageIndex: cp.pdfPageIndex,
          material: cp.material,
          qty: cp.qty || '1',
        };
      }) || [],
    }));
  }

  async getVendors() {
    return this.prisma.vendor.findMany({
      orderBy: { name: 'asc' },
    });
  }

  async getLinesAndProcesses() {
    const [lines, processes] = await Promise.all([
      this.prisma.line.findMany({ orderBy: { lineName: 'asc' } }),
      this.prisma.process.findMany({ orderBy: { name: 'asc' } }),
    ]);
    return { lines, processes };
  }

  async createDesign(dto: any, userId: string) {
    let lineId = dto.lineId;
    if (!lineId && dto.lineName) {
      const lineName = dto.lineName.trim();
      const lineCode = lineName.toUpperCase().replace(/[^A-Z0-9]/g, '_');
      let line = await this.prisma.line.findFirst({
        where: { lineName: { equals: lineName, mode: 'insensitive' } },
      });
      if (!line) {
        line = await this.prisma.line.create({
          data: { lineName, lineCode },
        });
      }
      lineId = line.id;
    }
    if (!lineId) {
      const defaultLine = (await this.prisma.line.findFirst()) ||
        (await this.prisma.line.create({
          data: { lineName: 'Default Line', lineCode: 'DEFAULT_LINE' },
        }));
      lineId = defaultLine.id;
    }

    let processId = dto.processId;
    if (!processId && dto.processName) {
      const name = dto.processName.trim();
      const code = name.toUpperCase().replace(/[^A-Z0-9]/g, '_');
      let proc = await this.prisma.process.findFirst({
        where: { name: { equals: name, mode: 'insensitive' } },
      });
      if (!proc) {
        proc = await this.prisma.process.create({
          data: { name, code },
        });
      }
      processId = proc.id;
    }
    if (!processId) {
      const defaultProc = (await this.prisma.process.findFirst()) ||
        (await this.prisma.process.create({
          data: { name: 'OP - General', code: 'OP_GENERAL' },
        }));
      processId = defaultProc.id;
    }

    // Auto-generate noReg if not provided
    const noReg = dto.noReg?.trim() || await this.generateNoReg(dto.type || 'JF');

    const design = await this.prisma.design.create({
      data: {
        noReg,
        assyPartName: dto.assyPartName,
        noItem: dto.noItem || '',
        qty: dto.qty || '1',
        type: dto.type || 'JF',
        lineId,
        processId,
        minimumStock: dto.minimumStock ? parseInt(String(dto.minimumStock), 10) : 0,
        actualStock: dto.actualStock ? parseInt(String(dto.actualStock), 10) : 0,
        lifetimeDays: dto.lifetimeDays ? parseInt(String(dto.lifetimeDays), 10) : 180,
        revStatus: dto.revStatus || '0',
        lifecycleStatus: dto.lifecycleStatus || 'ACTIVE',
        vendorId: dto.vendorId || undefined,
        designDateNew: dto.designDateNew ? new Date(dto.designDateNew) : new Date(),
      },
    });

    if (dto.docLocation2D) {
      const user = await this.prisma.user.findUnique({ where: { id: userId } });
      const doc = await this.prisma.document.create({
        data: {
          designId: design.id,
          path2D: dto.docLocation2D,
          loc2D: dto.docLocation2D,
          approvalStatus: 'APPROVED',
          drawnSignature: dto.drawnSignature || null,
          drawnByName: dto.drawnSignature ? (user?.name || dto.drawnByName || 'Drafter') : null,
          drawnAt: dto.drawnSignature ? new Date() : null,
        },
      });

      if (dto.drawnSignature) {
        await this.stampDocumentPdf(doc.id, design.id, userId);
      }
    }

    // Bulk create CellParts if provided from drawing extraction
    if (Array.isArray(dto.cellParts) && dto.cellParts.length > 0) {
      for (const cp of dto.cellParts) {
        if (!cp.partNumber || !cp.name) continue;
        try {
          await this.prisma.cellPart.create({
            data: {
              designId: design.id,
              partNumber: cp.partNumber.trim(),
              name: cp.name.trim(),
              description: cp.description || null,
              material: cp.material || null,
              qty: String(cp.qty || '1'),
              lifetimeDays: cp.lifetimeDays ? parseInt(String(cp.lifetimeDays), 10) : 180,
              installDate: cp.installDate ? new Date(cp.installDate) : new Date(),
              minimumStock: cp.minimumStock ? parseInt(String(cp.minimumStock), 10) : 0,
              actualStock: cp.actualStock ? parseInt(String(cp.actualStock), 10) : (cp.qty ? parseInt(String(cp.qty), 10) || 1 : 1),
              pdfPageIndex: cp.pdfPageIndex ? parseInt(String(cp.pdfPageIndex), 10) : null,
            },
          });
        } catch (cpErr) {
          console.warn(`Could not auto-create cellpart ${cp.partNumber}:`, cpErr);
        }
      }
    }

    await this.prisma.revisionHistory.create({
      data: {
        designId: design.id,
        revStatus: dto.revStatus || '0',
        description: dto.revisionNote || 'Initial Release',
        changedById: userId,
        vendorId: dto.vendorId || undefined,
        poNumber: dto.poNumber || undefined,
        cost: dto.cost ? parseFloat(String(dto.cost)) : 0,
        leadTime: dto.leadTime ? parseInt(String(dto.leadTime), 10) : undefined,
        loc3D: dto.docLocation3D || undefined,
        path3D: dto.docLocation3D || undefined,
        loc2D: dto.docLocation2D || undefined,
        path2D: dto.docLocation2D || undefined,
        approvedByName: 'System PIC',
      },
    });

    return design;
  }

  async deleteDesign(id: string) {
    // Atomically delete all relations followed by the design item
    return this.prisma.$transaction([
      this.prisma.document.deleteMany({ where: { designId: id } }),
      this.prisma.revisionHistory.deleteMany({ where: { designId: id } }),
      this.prisma.abnormality.deleteMany({ where: { designId: id } }),
      this.prisma.inventoryLog.deleteMany({ where: { designId: id } }),
      this.prisma.approval.deleteMany({ where: { designId: id } }),
      this.prisma.notification.deleteMany({ where: { designId: id } }),
      this.prisma.design.delete({ where: { id } }),
    ]);
  }

  /**
   * PIC signature on released document
   */
  async signDocumentDrawn(designId: string, signatureData: string, userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    const doc = await this.prisma.document.findFirst({
      where: { designId },
      orderBy: { createdAt: 'desc' },
    });
    if (!doc) throw new NotFoundException('Dokumen 2D drawing tidak ditemukan untuk desain ini');

    const updated = await this.prisma.document.update({
      where: { id: doc.id },
      data: {
        drawnSignature: signatureData,
        drawnByName: user?.name || 'Drafter',
        drawnAt: new Date(),
      },
    });

    await this.stampDocumentPdf(doc.id, designId, userId);
    return updated;
  }

  private async stampDocumentPdf(docId: string, designId: string, userId: string) {
    try {
      const doc = await this.prisma.document.findUnique({ where: { id: docId } });
      if (!doc || !doc.loc2D) return;

      const rawPath = doc.loc2D.startsWith('/uploads/') ? doc.loc2D.replace('/uploads/', '') : doc.loc2D;
      const originalFilePath = join(process.cwd(), 'uploads', rawPath);
      if (!existsSync(originalFilePath)) return;

      const pdfBuffer = readFileSync(originalFilePath);
      const user = await this.prisma.user.findUnique({ where: { id: userId } });

      const stampedBuffer = await this.drawingStamperService.stampSignatures(pdfBuffer, {
        drawn: (doc.drawnByName || doc.drawnSignature)
          ? {
              name: doc.drawnByName || user?.name || 'Drafter',
              date: (doc.drawnAt || new Date()).toISOString(),
              signatureData: doc.drawnSignature || undefined,
              npk: user?.npk,
            }
          : undefined,
        checked: (doc.checkedByName || doc.checkedSignature)
          ? {
              name: doc.checkedByName || 'Section Head',
              date: (doc.checkedAt || new Date()).toISOString(),
              signatureData: doc.checkedSignature || undefined,
            }
          : undefined,
        approved: (doc.approvedByName || doc.approvedSignature)
          ? {
              name: doc.approvedByName || 'Dept Head',
              date: (doc.approvedAt || new Date()).toISOString(),
              signatureData: doc.approvedSignature || undefined,
            }
          : undefined,
      });

      const ext = extname(rawPath);
      const baseName = basename(rawPath, ext);
      const stampedFilename = `${baseName}_signed${ext}`;
      const stampedFilePath = join(process.cwd(), 'uploads', stampedFilename);
      writeFileSync(stampedFilePath, stampedBuffer);

      await this.prisma.document.update({
        where: { id: docId },
        data: { stampedPdfPath: `/uploads/${stampedFilename}` },
      });
    } catch (err) {
      console.error('Failed to stamp PDF in design service:', err);
    }
  }
}
