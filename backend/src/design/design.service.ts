import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { UpdateDesignDto } from './dto/update-design.dto';
import { DrawingStamperService } from '../upload/drawing-stamper.service';
import { join, extname, basename } from 'path';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { PDFDocument } from 'pdf-lib';

import { StorageService } from '../upload/storage.service';


@Injectable()
export class DesignService {
  constructor(
    private prisma: PrismaService,
    private drawingStamperService: DrawingStamperService,
    private storageService: StorageService,
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
      include: { line: true, documents: true, revisionHistories: { orderBy: { createdAt: 'desc' }, take: 1 }, childParts: true },
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
      childPartCount: d.childParts?.length || 0,
    }));
  }

  /**
   * Update the design revision of a Design.
   * Also automatically creates an Approval record of type DESIGN_REVISION.
   */
  async updateDesignRevision(itemId: string, dto: UpdateDesignDto, userId: string) {
    // Check item exists with relations
    const item = await this.prisma.design.findUnique({
      where: { id: itemId },
      include: {
        line: true,
        documents: true,
        revisionHistories: { orderBy: { createdAt: 'desc' } },
      },
    });
    if (!item) throw new NotFoundException(`Item ${itemId} not found`);

    const nextRev = dto.revStatus || String(parseInt(item.revStatus || '0', 10) + 1);

    // 1. Archive previous drawing into revisionHistory if a new 2D drawing is uploaded
    if (dto.docLocation2D) {
      const oldDoc = item.documents.find((d) => d.loc2D) || item.documents[0];
      const old2D = oldDoc?.loc2D || item.revisionHistories.find((r) => r.loc2D)?.loc2D || null;
      const oldPath2D = oldDoc?.path2D || oldDoc?.loc2D || item.revisionHistories.find((r) => r.path2D)?.path2D || null;

      if (old2D && old2D !== dto.docLocation2D) {
        await this.prisma.revisionHistory.create({
          data: {
            designId: item.id,
            revStatus: item.revStatus || '0',
            description: `Arsip drawing sebelum revisi ke Rev ${nextRev}`,
            changedById: userId,
            loc2D: old2D,
            path2D: oldPath2D,
            loc3D: item.revisionHistories[0]?.loc3D || null,
            path3D: item.revisionHistories[0]?.path3D || null,
          },
        });
      }

      // 2. Overwrite / delete old documents for this design so master drawing is replaced cleanly
      await this.prisma.document.deleteMany({
        where: { designId: itemId },
      });

      // 3. Create the new active document (WAITING approval)
      await this.prisma.document.create({
        data: {
          designId: itemId,
          path2D: dto.docLocation2D,
          loc2D: dto.docLocation2D,
          approvalStatus: 'WAITING',
        },
      });
    }

    // Update the item design fields
    const updated = await this.prisma.design.update({
      where: { id: itemId },
      data: {
        revStatus: nextRev,
        designDateNew: dto.designDateNew ? new Date(dto.designDateNew) : new Date(),
        lifetimeDays: dto.lifetimeDays !== undefined ? parseInt(String(dto.lifetimeDays), 10) : undefined,
      },
    });

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
        revisionNote: dto.revisionNote || `Revisi desain ${item.noReg} — Rev ${nextRev}`,
        submittedById: userId,
        sectionHeadId: sectionHead?.id,
        deptHeadId: deptHead?.id,
        sectionStatus: 'WAITING',
        deptStatus: 'WAITING',
        finalStatus: 'WAITING',
      },
    });

    // Log new revision entry in history
    await this.prisma.revisionHistory.create({
      data: {
        designId: item.id,
        revStatus: nextRev,
        description: dto.revisionNote || `Update Rev ${nextRev}`,
        changedById: userId,
        vendorId: dto.vendorId || undefined,
        poNumber: dto.poNumber || undefined,
        leadTime: dto.leadTime ? parseInt(String(dto.leadTime)) : undefined,
        loc3D: dto.docLocation3D || item.revisionHistories[0]?.loc3D || undefined,
        path3D: dto.docLocation3D || item.revisionHistories[0]?.path3D || undefined,
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
        childParts: {
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
      ...this.calculateLifetime({
        installDate: d.designDateNew || d.createdAt,
        lifetimeDays: d.lifetimeDays,
      }),
      tpmScheduleStart: (d as any).tpmScheduleStart ? (d as any).tpmScheduleStart.toISOString() : null,
      tpmScheduleDeadline: (d as any).tpmScheduleDeadline ? (d as any).tpmScheduleDeadline.toISOString() : null,
      tpmLifetimeSetAt: (d as any).tpmLifetimeSetAt ? (d as any).tpmLifetimeSetAt.toISOString() : null,
      lineProduct: d.line.lineName,
      process: d.process.name,
      vendor: d.vendor ? { id: d.vendor.id, name: d.vendor.name } : null,
      documents: d.documents.map((doc) => ({
        id: doc.id,
        path2D: doc.path2D,
        loc2D: doc.loc2D,
        approvalStatus: doc.approvalStatus,
      })),
      revisionHistories: d.revisionHistories.map((rev) => ({
        id: rev.id,
        revStatus: rev.revStatus,
        description: rev.description,
        poNumber: rev.poNumber,
        leadTime: rev.leadTime,
        approvedByName: rev.approvedByName,
        createdAt: rev.createdAt,
        vendorName: rev.vendor?.name || 'N/A',
        changedBy: rev.changedBy.name,
        path2D: rev.path2D,
        loc2D: rev.loc2D,
        path3D: rev.path3D,
        loc3D: rev.loc3D,
        annotatedDocPath: (rev as any).annotatedDocPath || null,
        markupData: (rev as any).markupData || null,
        requestedByName: (rev as any).requestedByName || null,
        requestedAt: (rev as any).requestedAt ? (rev as any).requestedAt.toISOString() : null,
        revisionNote: (rev as any).revisionNote || null,
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
      childParts: (d as any).childParts?.map((cp: any) => {
        const lifetime = this.calculateLifetime({
          installDate: cp.installDate,
          lastRenewalDate: cp.lastRenewalDate,
          lifetimeDays: cp.lifetimeDays,
        });
        return {
          id: cp.id,
          partNumber: cp.partNumber,
          name: cp.name,
          description: cp.description,
          installDate: cp.installDate,
          lastRenewalDate: cp.lastRenewalDate,
          ...lifetime,
          minimumStock: cp.minimumStock,
          actualStock: cp.actualStock,
          pdfPageIndex: cp.pdfPageIndex,
          material: cp.material,
          qty: cp.qty || '1',
          tpmScheduleStart: cp.tpmScheduleStart ? cp.tpmScheduleStart.toISOString() : null,
          tpmScheduleDeadline: cp.tpmScheduleDeadline ? cp.tpmScheduleDeadline.toISOString() : null,
          tpmLifetimeSetAt: cp.tpmLifetimeSetAt ? cp.tpmLifetimeSetAt.toISOString() : null,
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
        // Jadwal TPM baru bisa di-set setelah desain di-approve (lewat halaman TPM)
      },
    });

    const user = await this.prisma.user.findUnique({ where: { id: userId } });

    // Find approver users based on Role model name
    const sectionHead = await this.prisma.user.findFirst({
      where: { role: { name: 'PE_SECTION_HEAD' } },
    });
    const deptHead = await this.prisma.user.findFirst({
      where: { role: { name: 'PE_DEPT_HEAD' } },
    });

    // 1. Create Document if 2D drawing provided (status WAITING for approval)
    let docId: string | null = null;
    if (dto.docLocation2D) {
      const doc = await this.prisma.document.create({
        data: {
          designId: design.id,
          path2D: dto.docLocation2D,
          loc2D: dto.docLocation2D,
          approvalStatus: 'WAITING',
        },
      });
      docId = doc.id;
    }

    // 2. Auto-create Approval request so Section Head & Dept Head see it in Approval Center
    const approval = await this.prisma.approval.create({
      data: {
        type: 'DESIGN_REVISION',
        status: 'WAITING',
        designId: design.id,
        revisionNote: dto.revisionNote || `Rilis desain baru ${design.noReg} — Rev ${dto.revStatus || '0'}`,
        submittedById: userId,
        sectionHeadId: sectionHead?.id,
        deptHeadId: deptHead?.id,
        sectionStatus: 'WAITING',
        deptStatus: 'WAITING',
        finalStatus: 'WAITING',
      },
    });

    // 3. Notify Section Heads for Checked signature review
    const sectionHeads = await this.prisma.user.findMany({
      where: { role: { name: 'PE_SECTION_HEAD' } },
    });
    if (sectionHeads.length > 0) {
      await this.prisma.notification.createMany({
        data: sectionHeads.map((sh) => ({
          type: 'WAITING_APPROVAL',
          title: '📋 Approval Waiting: Section Head',
          message: `${user?.name || 'Drafter'} telah menambahkan desain baru untuk item ${design.noReg}. Silakan periksa dan tandatangani (Checked).`,
          designId: design.id,
          userId: sh.id,
        })),
      });
    }

    // Bulk create ChildParts if provided from drawing extraction
    if (Array.isArray(dto.childParts) && dto.childParts.length > 0) {
      for (const cp of dto.childParts) {
        if (!cp.partNumber || !cp.name) continue;
        try {
          await this.prisma.childPart.create({
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
      this.prisma.tpmChecklist.deleteMany({ where: { designId: id } }),
      this.prisma.tpmMaintenanceLog.deleteMany({ where: { designId: id } }),
      this.prisma.partReplacementLog.deleteMany({ where: { designId: id } }),
      this.prisma.machine.updateMany({ where: { designId: id }, data: { designId: null } }),
      this.prisma.childPart.deleteMany({ where: { designId: id } }),
      this.prisma.design.delete({ where: { id } }),
    ]);
  }

  /**
   * Extract a single page of 2D drawing (Hal 1 for Induk Jig, Hal N for ChildPart)
   * Drawing can ONLY be downloaded when fully approved.
   * Stamped with official legal seal at the bottom-right corner.
   */
  async getSinglePagePdf(designId: string, pageNumber: number) {
    const design = await this.prisma.design.findUnique({
      where: { id: designId },
      include: {
        documents: { orderBy: { createdAt: 'desc' } },
        childParts: true,
      },
    });
    if (!design) throw new NotFoundException(`Desain ${designId} tidak ditemukan.`);

    // 1. Fetch latest approval status
    const latestApproval = await this.prisma.approval.findFirst({
      where: { designId: design.id, type: 'DESIGN_REVISION' },
      include: {
        sectionHead: { select: { name: true } },
        deptHead: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const approvedDoc = design.documents.find((d) => d.approvalStatus === 'APPROVED' && d.loc2D);
    const isApproved = approvedDoc || (latestApproval && latestApproval.finalStatus === 'APPROVED');

    // Drawing can ONLY be downloaded once approved by all parties
    if (!isApproved) {
      throw new ForbiddenException(
        'Drawing belum disetujui (Approved) secara resmi oleh Section Head dan Dept Head. Dokumen belum dapat diunduh.',
      );
    }

    const doc = approvedDoc || design.documents.find((d) => d.loc2D) || design.documents[0];
    if (!doc || !doc.loc2D) throw new NotFoundException('Tidak ada dokumen PDF untuk item ini.');

    const targetPath = doc.loc2D;
    const pdfBuffer = await this.storageService.getFileBuffer(targetPath);

    if (!pdfBuffer) {
      throw new NotFoundException(`File PDF tidak dapat ditemukan di penyimpanan.`);
    }

    // Extract single page and apply official legal stamp at bottom-right corner
    const singlePageBuffer = await this.drawingStamperService.extractAndStampSinglePage(
      pdfBuffer,
      pageNumber,
      {
        noReg: design.noReg,
        revStatus: design.revStatus || '0',
        approvedAt: latestApproval?.deptAt || latestApproval?.updatedAt || doc.updatedAt,
        sectionHeadName: latestApproval?.sectionHead?.name,
        deptHeadName: latestApproval?.deptHead?.name,
        approvalId: latestApproval?.id || doc.id,
      },
    );

    // Compute descriptive filename
    let filename = '';
    if (pageNumber === 1) {
      filename = `${design.noReg}_Induk_Hal_1.pdf`;
    } else {
      const cp = design.childParts.find((c) => (c.pdfPageIndex || 0) === pageNumber);
      if (cp) {
        filename = `${design.noReg}_CP_${cp.partNumber.replace(/[^a-zA-Z0-9_-]/g, '_')}_Hal_${pageNumber}.pdf`;
      } else {
        filename = `${design.noReg}_Hal_${pageNumber}.pdf`;
      }
    }

    return {
      buffer: singlePageBuffer,
      filename,
    };
  }

  /**
   * Get full multi-page PDF stamped on EVERY page with official legality stamp
   * Drawing can ONLY be downloaded when fully approved.
   */
  async getFullPdf(designId: string) {
    const design = await this.prisma.design.findUnique({
      where: { id: designId },
      include: {
        documents: { orderBy: { createdAt: 'desc' } },
        childParts: true,
      },
    });
    if (!design) throw new NotFoundException(`Desain ${designId} tidak ditemukan.`);

    // 1. Fetch latest approval status
    const latestApproval = await this.prisma.approval.findFirst({
      where: { designId: design.id, type: 'DESIGN_REVISION' },
      include: {
        sectionHead: { select: { name: true } },
        deptHead: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const approvedDoc = design.documents.find((d) => d.approvalStatus === 'APPROVED' && d.loc2D);
    const isApproved = approvedDoc || (latestApproval && latestApproval.finalStatus === 'APPROVED');

    // Drawing can ONLY be downloaded once approved by all parties
    if (!isApproved) {
      throw new ForbiddenException(
        'Drawing belum disetujui (Approved) secara resmi oleh Section Head dan Dept Head. Dokumen belum dapat diunduh.',
      );
    }

    const doc = approvedDoc || design.documents.find((d) => d.loc2D) || design.documents[0];
    if (!doc || !doc.loc2D) throw new NotFoundException('Tidak ada file PDF drawing untuk item ini.');

    const pdfBuffer = await this.storageService.getFileBuffer(doc.loc2D);
    if (!pdfBuffer) {
      throw new NotFoundException('File PDF tidak dapat ditemukan di penyimpanan.');
    }

    // Apply official legal stamp on EVERY page at bottom-right corner
    const stampedBuffer = await this.drawingStamperService.stampPdfDocument(pdfBuffer, {
      noReg: design.noReg,
      revStatus: design.revStatus || '0',
      approvedAt: latestApproval?.deptAt || latestApproval?.updatedAt || doc.updatedAt,
      sectionHeadName: latestApproval?.sectionHead?.name,
      deptHeadName: latestApproval?.deptHead?.name,
      approvalId: latestApproval?.id || doc.id,
    });

    return {
      buffer: stampedBuffer,
      filename: `${design.noReg}_Drawing_Resmi.pdf`,
    };
  }

  /**
   * Merge multiple drawings or drawing pages into a single combined PDF.
   * Every included page retains its official legal stamp.
   */
  async getMergedPdf(targets: Array<{ designId: string; pageNumber?: number }>) {
    if (!targets || targets.length === 0) {
      throw new NotFoundException('Tidak ada file atau dokumen yang dipilih untuk digabungkan.');
    }

    const mergedDoc = await PDFDocument.create();
    let totalPagesMerged = 0;

    for (const target of targets) {
      try {
        let pdfBuf: Buffer;
        if (target.pageNumber && target.pageNumber > 0) {
          const res = await this.getSinglePagePdf(target.designId, target.pageNumber);
          pdfBuf = res.buffer;
        } else {
          const res = await this.getFullPdf(target.designId);
          pdfBuf = res.buffer;
        }

        const srcDoc = await PDFDocument.load(pdfBuf);
        const copiedPages = await mergedDoc.copyPages(srcDoc, srcDoc.getPageIndices());
        for (const page of copiedPages) {
          mergedDoc.addPage(page);
          totalPagesMerged++;
        }
      } catch (err: any) {
        // Log error and continue with remaining documents if any, or if first failure rethrow if no pages
        console.error(`Gagal menggabungkan PDF untuk designId ${target.designId}:`, err?.message || err);
      }
    }

    if (totalPagesMerged === 0) {
      throw new NotFoundException('Tidak ada dokumen PDF drawing yang berhasil digabungkan.');
    }

    const mergedBytes = await mergedDoc.save();
    const timestamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    return {
      buffer: Buffer.from(mergedBytes),
      filename: `Drawing_Gabungan_Resmi_${timestamp}.pdf`,
    };
  }

  /** Log or set usage for a Design (Jig) item (stubbed) */
  async logUsage(itemId: string, amount: number, mode: 'ADD' | 'SET' = 'ADD') {
    const existing = await this.prisma.design.findUnique({ where: { id: itemId } });
    if (!existing) {
      throw new NotFoundException(`Item ${itemId} not found`);
    }

    return {
      ...existing,
      ...this.calculateLifetime({
        installDate: existing.designDateNew || (existing as any).createdAt,
        lifetimeDays: existing.lifetimeDays,
      }),
    };
  }

  /** Renew a Design item's lifetime */
  async renewLifetime(itemId: string, options: { resetDays?: boolean; resetUsage?: boolean } = {}) {
    const existing = await this.prisma.design.findUnique({ where: { id: itemId } });
    if (!existing) {
      throw new NotFoundException(`Item ${itemId} not found`);
    }

    const resetDays = options.resetDays !== false;

    const dataToUpdate: any = {};
    if (resetDays) {
      dataToUpdate.designDateNew = new Date();
    }

    const updated = await this.prisma.design.update({
      where: { id: itemId },
      data: dataToUpdate,
    });

    return {
      ...updated,
      ...this.calculateLifetime({
        installDate: updated.designDateNew || (updated as any).createdAt,
        lifetimeDays: updated.lifetimeDays,
      }),
    };
  }

  /** Compute lifetime metrics by days */
  private calculateLifetime(item: {
    installDate?: Date | string | null;
    lastRenewalDate?: Date | string | null;
    lifetimeDays?: number | null;
  }) {
    const baseDate = item.lastRenewalDate || item.installDate || new Date();
    const lifetimeDays = item.lifetimeDays ?? 180;
    const dueDate = new Date(new Date(baseDate).getTime() + lifetimeDays * 86400000);
    const daysRemaining = Math.ceil((dueDate.getTime() - Date.now()) / 86400000);

    const lifetimeStatus: 'OVERDUE' | 'WARNING' | 'SAFE' =
      daysRemaining <= 0 ? 'OVERDUE' : daysRemaining <= 35 ? 'WARNING' : 'SAFE';

    return {
      lifetimeDays,
      dueDate: dueDate.toISOString(),
      daysRemaining,
      dayStatus: lifetimeStatus,
      lifetimeStatus,
      triggerReason: lifetimeStatus !== 'SAFE' ? 'DAYS' : 'NONE',
    };
  }
}
