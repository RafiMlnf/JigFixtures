import * as fs from 'fs';
import * as path from 'path';
import { Injectable, Logger } from '@nestjs/common';
import { PDFDocument, PDFPage, PDFFont, PDFImage, StandardFonts, rgb, degrees } from 'pdf-lib';

export interface LegalStampMetadata {
  noReg: string;
  revStatus?: string;
  approvedAt?: Date | string | null;
  sectionHeadName?: string | null;
  deptHeadName?: string | null;
  approvedByName?: string | null;
  approvalId?: string | null;
}

@Injectable()
export class DrawingStamperService {
  private readonly logger = new Logger(DrawingStamperService.name);

  /**
   * Helper to load the mtmwide.png logo file
   */
  private getLogoBytes(): Buffer | null {
    const candidatePaths = [
      path.join(process.cwd(), '..', 'frontend', 'assets', 'img', 'mtmwide.png'),
      path.join(process.cwd(), 'frontend', 'assets', 'img', 'mtmwide.png'),
      path.join(process.cwd(), 'assets', 'img', 'mtmwide.png'),
      'd:\\PT MTM\\JigFixtures\\frontend\\assets\\img\\mtmwide.png',
    ];

    for (const p of candidatePaths) {
      try {
        if (fs.existsSync(p)) {
          return fs.readFileSync(p);
        }
      } catch {}
    }
    return null;
  }

  /**
   * Extract a single page (1-based index) and apply official legalization stamp
   */
  async extractAndStampSinglePage(
    pdfBuffer: Buffer,
    pageNumber: number,
    metadata: LegalStampMetadata,
  ): Promise<Buffer> {
    const srcDoc = await PDFDocument.load(pdfBuffer);
    const pageCount = srcDoc.getPageCount();

    if (pageNumber < 1 || pageNumber > pageCount) {
      throw new Error(`Halaman ${pageNumber} tidak valid. Total halaman dokumen adalah ${pageCount}.`);
    }

    const dstDoc = await PDFDocument.create();
    const [copiedPage] = await dstDoc.copyPages(srcDoc, [pageNumber - 1]);
    const page = dstDoc.addPage(copiedPage);

    const fontRegular = await dstDoc.embedFont(StandardFonts.Helvetica);
    const fontBold = await dstDoc.embedFont(StandardFonts.HelveticaBold);

    let logoImage: PDFImage | null = null;
    const logoBytes = this.getLogoBytes();
    if (logoBytes) {
      try {
        logoImage = await dstDoc.embedPng(logoBytes);
      } catch (err) {
        this.logger.warn(`Failed to embed logo image: ${err}`);
      }
    }

    this.applyLegalStamp(page, metadata, fontRegular, fontBold, logoImage);

    const pdfBytes = await dstDoc.save();
    return Buffer.from(pdfBytes);
  }

  /**
   * Apply official legalization stamp to EVERY page of a multi-page PDF document
   */
  async stampPdfDocument(
    pdfBuffer: Buffer,
    metadata: LegalStampMetadata,
  ): Promise<Buffer> {
    const doc = await PDFDocument.load(pdfBuffer);
    const fontRegular = await doc.embedFont(StandardFonts.Helvetica);
    const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);

    let logoImage: PDFImage | null = null;
    const logoBytes = this.getLogoBytes();
    if (logoBytes) {
      try {
        logoImage = await doc.embedPng(logoBytes);
      } catch (err) {
        this.logger.warn(`Failed to embed logo image: ${err}`);
      }
    }

    const pages = doc.getPages();
    for (const page of pages) {
      this.applyLegalStamp(page, metadata, fontRegular, fontBold, logoImage);
    }

    const pdfBytes = await doc.save();
    return Buffer.from(pdfBytes);
  }

  /**
   * Extract a single page without stamp (legacy helper)
   */
  async extractSinglePage(pdfBuffer: Buffer, pageNumber: number): Promise<Buffer> {
    const srcDoc = await PDFDocument.load(pdfBuffer);
    const pageCount = srcDoc.getPageCount();

    if (pageNumber < 1 || pageNumber > pageCount) {
      throw new Error(`Halaman ${pageNumber} tidak valid. Total halaman dokumen adalah ${pageCount}.`);
    }

    const dstDoc = await PDFDocument.create();
    const [copiedPage] = await dstDoc.copyPages(srcDoc, [pageNumber - 1]);
    dstDoc.addPage(copiedPage);

    const pdfBytes = await dstDoc.save();
    return Buffer.from(pdfBytes);
  }

  /**
   * Apply clean official engineering legalization stamp at bottom-left/bottom margin of the page
   */
  private applyLegalStamp(
    page: PDFPage,
    metadata: LegalStampMetadata,
    fontRegular: PDFFont,
    fontBold: PDFFont,
    logoImage?: PDFImage | null,
  ) {
    const { width, height } = page.getSize();
    const rotationAngle = page.getRotation().angle;

    // Format date: DD MMM YYYY, HH:mm WIB
    let dateStr = 'DOKUMEN RESMI';
    try {
      const d = metadata.approvedAt ? new Date(metadata.approvedAt) : new Date();
      const day = String(d.getDate()).padStart(2, '0');
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
      const month = monthNames[d.getMonth()] || 'Bln';
      const year = d.getFullYear();
      const hours = String(d.getHours()).padStart(2, '0');
      const mins = String(d.getMinutes()).padStart(2, '0');
      dateStr = `${day} ${month} ${year}, ${hours}:${mins} WIB`;
    } catch {
      dateStr = new Date().toISOString().split('T')[0];
    }

    const noRegText = (metadata.noReg || 'NO-REG').toUpperCase();
    const revText = `REV: ${metadata.revStatus ?? '0'}`;
    // Format nama approver & ID legalitas
    const peDeptApprover = metadata.deptHeadName
      ? `APPROVED BY PE DEPT: ${metadata.deptHeadName.toUpperCase()}`
      : 'APPROVED BY PE DEPT (HEAD)';
    const secHeadApprover = metadata.sectionHeadName
      ? `CHECKED BY SEC. HEAD: ${metadata.sectionHeadName.toUpperCase()}`
      : null;
    const approversCombined = secHeadApprover 
      ? `${peDeptApprover} | ${secHeadApprover}` 
      : peDeptApprover;
    const idText = metadata.approvalId
      ? `ID: ${metadata.approvalId.slice(-8).toUpperCase()}`
      : 'ID: MTM-LEGAL-OK';

    // --- POSISI DI LUAR FRAME GAMBAR (OUTER MARGIN BOTTOM EDGE / CORNER) ---
    // Letakkan di area margin luar kertas (outside drawing border / frame)
    // Tinggi strip margin = 20 pt, berada di y = 3 pt dari tepi bawah kertas
    const bannerHeight = 20;
    const bannerMargin = 4;

    let x = bannerMargin;
    let y = 3;
    let rot = degrees(0);

    if (rotationAngle === 90) {
      x = width - bannerHeight - 3;
      y = bannerMargin;
      rot = degrees(90);
    } else if (rotationAngle === 180) {
      x = bannerMargin;
      y = height - bannerHeight - 3;
      rot = degrees(180);
    } else if (rotationAngle === 270) {
      x = 3;
      y = height - bannerMargin;
      rot = degrees(270);
    }

    // 1. Gambar Logo MTM Wide di Kiri Bawah (Di luar frame drawing)
    let textStartX = x + 4;
    if (logoImage) {
      // Rasio aspek mtmwide.png adalah ~6.3:1
      const logoH = 14;
      const logoW = Math.round(logoH * 5.8); // lebar ~81 pt

      page.drawImage(logoImage, {
        x: x + 4,
        y: y + 2,
        width: logoW,
        height: logoH,
        rotate: rot,
      });

      // Teks bergeser ke sebelah kanan logo
      textStartX = x + 4 + logoW + 8;
    }

    // 2. Teks Legalitas Resmi di samping Logo MTM (Tanpa Box, Tanpa Border)
    const brandColor = rgb(0.06, 0.45, 0.25); // Emerald Green MTM
    const legalNoticeColor = rgb(0.18, 0.38, 0.25);
    const mutedColor = rgb(0.38, 0.44, 0.5);

    // Line 1 (Atas, y + 10): No Reg, Rev, Status & PE Dept Approval
    page.drawText(`REG: ${noRegText}  |  ${revText}  |  STATUS: FULLY APPROVED  |  ${peDeptApprover}`, {
      x: textStartX,
      y: y + 10,
      size: 5.2,
      font: fontBold,
      color: brandColor,
      rotate: rot,
    });

    // Line 2 (Tengah, y + 5): Penjelasan Legalitas Resmi bahwa dokumen sah & mengikat
    page.drawText(`DOKUMEN INI TELAH DISETUJUI SECARA HUKUM & SAH DIGUNAKAN SEBAGAI GAMBAR KERJA RESMI (CONTROLLED DRAWING)`, {
      x: textStartX,
      y: y + 5,
      size: 4.3,
      font: fontBold,
      color: legalNoticeColor,
      rotate: rot,
    });

    // Line 3 (Bawah, y + 0.5): Tanggal Legalitas, Verifikasi ID, dan Seal Mark
    page.drawText(`TGL LEGAL: ${dateStr}  |  ${idText}  |  << MTM QA/PE PASSED & VERIFIED >>`, {
      x: textStartX,
      y: y + 0.5,
      size: 4.1,
      font: fontRegular,
      color: mutedColor,
      rotate: rot,
    });
  }
}
