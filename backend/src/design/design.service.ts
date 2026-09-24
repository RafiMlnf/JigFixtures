import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { UpdateDesignDto } from './dto/update-design.dto';
import { DrawingStamperService } from '../upload/drawing-stamper.service';
import { join, extname, basename } from 'path';
import { existsSync, readFileSync, writeFileSync } from 'fs';

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
        lifetimeDays: dto.lifetimeDays !== undefined ? parseInt(String(dto.lifetimeDays), 10) : undefined,
        lifetimeType: dto.lifetimeType,
        maxUsage: dto.maxUsage !== undefined ? parseInt(String(dto.maxUsage), 10) : undefined,
        currentUsage: dto.currentUsage !== undefined ? parseInt(String(dto.currentUsage), 10) : undefined,
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
      ...this.calculateLifetime({
        installDate: d.designDateNew || (d as any).createdAt,
        lifetimeDays: d.lifetimeDays,
        lifetimeType: (d as any).lifetimeType,
        maxUsage: (d as any).maxUsage,
        currentUsage: (d as any).currentUsage,
      }),
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
        const lifetime = this.calculateLifetime({
          installDate: cp.installDate,
          lastRenewalDate: cp.lastRenewalDate,
          lifetimeDays: cp.lifetimeDays,
          lifetimeType: cp.lifetimeType,
          maxUsage: cp.maxUsage,
          currentUsage: cp.currentUsage,
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
        lifetimeType: dto.lifetimeType || 'DUAL',
        maxUsage: dto.maxUsage !== undefined ? parseInt(String(dto.maxUsage), 10) : 500,
        currentUsage: dto.currentUsage !== undefined ? parseInt(String(dto.currentUsage), 10) : 0,
        revStatus: dto.revStatus || '0',
        lifecycleStatus: dto.lifecycleStatus || 'ACTIVE',
        vendorId: dto.vendorId || undefined,
        designDateNew: dto.designDateNew ? new Date(dto.designDateNew) : new Date(),
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
              lifetimeType: cp.lifetimeType || 'DUAL',
              maxUsage: cp.maxUsage !== undefined ? parseInt(String(cp.maxUsage), 10) : 500,
              currentUsage: cp.currentUsage !== undefined ? parseInt(String(cp.currentUsage), 10) : 0,
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
   * Extract a single page of 2D drawing (Hal 1 for Induk Jig, Hal N for CellPart)
   * Drawing can ONLY be downloaded when fully approved.
   * Stamped with official legal seal at the bottom-right corner.
   */
  async getSinglePagePdf(designId: string, pageNumber: number) {
    const design = await this.prisma.design.findUnique({
      where: { id: designId },
      include: {
        documents: { orderBy: { createdAt: 'desc' } },
        cellParts: true,
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
      const cp = design.cellParts.find((c) => (c.pdfPageIndex || 0) === pageNumber);
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
        cellParts: true,
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

  /** Log or set usage for a Design (Jig) item */
  async logUsage(itemId: string, amount: number, mode: 'ADD' | 'SET' = 'ADD') {
    const existing = await this.prisma.design.findUnique({ where: { id: itemId } });
    if (!existing) {
      throw new NotFoundException(`Item ${itemId} not found`);
    }

    const current = (existing as any).currentUsage ?? 0;
    const newUsage = mode === 'ADD' ? Math.max(0, current + amount) : Math.max(0, amount);

    const updated = await this.prisma.design.update({
      where: { id: itemId },
      data: { currentUsage: newUsage },
    });

    return {
      ...updated,
      ...this.calculateLifetime({
        installDate: updated.designDateNew || (updated as any).createdAt,
        lifetimeDays: updated.lifetimeDays,
        lifetimeType: (updated as any).lifetimeType,
        maxUsage: (updated as any).maxUsage,
        currentUsage: (updated as any).currentUsage,
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
    const resetUsage = options.resetUsage !== false;

    const dataToUpdate: any = {};
    if (resetDays) {
      dataToUpdate.designDateNew = new Date();
    }
    if (resetUsage) {
      dataToUpdate.currentUsage = 0;
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
        lifetimeType: (updated as any).lifetimeType,
        maxUsage: (updated as any).maxUsage,
        currentUsage: (updated as any).currentUsage,
      }),
    };
  }

  /** Compute 2-way lifetime metrics */
  private calculateLifetime(item: {
    installDate?: Date | string | null;
    lastRenewalDate?: Date | string | null;
    lifetimeDays?: number | null;
    lifetimeType?: string | null;
    maxUsage?: number | null;
    currentUsage?: number | null;
  }) {
    const baseDate = item.lastRenewalDate || item.installDate || new Date();
    const lifetimeDays = item.lifetimeDays ?? 180;
    const dueDate = new Date(new Date(baseDate).getTime() + lifetimeDays * 86400000);
    const daysRemaining = Math.ceil((dueDate.getTime() - Date.now()) / 86400000);

    const dayStatus: 'OVERDUE' | 'WARNING' | 'SAFE' =
      daysRemaining <= 0 ? 'OVERDUE' : daysRemaining <= 35 ? 'WARNING' : 'SAFE';

    const maxUsage = item.maxUsage ?? 500;
    const currentUsage = item.currentUsage ?? 0;
    const usageRemaining = Math.max(0, maxUsage - currentUsage);
    const usagePercent = maxUsage > 0 ? Math.round((currentUsage / maxUsage) * 100) : 0;

    let usageStatus: 'OVERDUE' | 'WARNING' | 'SAFE';
    if (currentUsage >= maxUsage) {
      usageStatus = 'OVERDUE';
    } else if (usagePercent >= 85 || (maxUsage - currentUsage) <= 50) {
      usageStatus = 'WARNING';
    } else {
      usageStatus = 'SAFE';
    }

    const lifetimeType: 'DUAL' | 'USAGE' | 'DAYS' = (item.lifetimeType as any) || 'DUAL';
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
        triggerReason =
          dayStatus === 'OVERDUE' && usageStatus === 'OVERDUE'
            ? 'BOTH'
            : dayStatus === 'OVERDUE'
            ? 'DAYS'
            : 'USAGE';
      } else if (dayStatus === 'WARNING' || usageStatus === 'WARNING') {
        lifetimeStatus = 'WARNING';
        triggerReason =
          dayStatus === 'WARNING' && usageStatus === 'WARNING'
            ? 'BOTH'
            : dayStatus === 'WARNING'
            ? 'DAYS'
            : 'USAGE';
      } else {
        lifetimeStatus = 'SAFE';
        triggerReason = 'NONE';
      }
    }

    return {
      lifetimeDays,
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
}
