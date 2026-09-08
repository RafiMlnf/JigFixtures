import { Injectable } from '@nestjs/common';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

export interface PlacementCoordinates {
  pageIndex?: number;    // 0-indexed page in PDF (default 0)
  xPercent: number;      // 0.0 - 1.0 (relative to page width from left)
  yPercent: number;      // 0.0 - 1.0 (relative to page height from TOP)
  widthPercent: number;  // 0.0 - 1.0 (relative to page width)
  heightPercent: number; // 0.0 - 1.0 (relative to page height)
}

export interface SignatureSlot {
  name: string;
  date: string;
  signatureData?: string; // base64 data URL (e.g. "data:image/png;base64,...")
  npk?: string;
  placement?: PlacementCoordinates;
}

export interface StampOptions {
  drawn?: SignatureSlot;
  checked?: SignatureSlot;
  approved?: SignatureSlot;
  allPages?: boolean;
}

/**
 * Title block column layout calibrated from real PT MTM jig PDF (A2 landscape, 1683.78 x 1190.55 pts):
 *
 * Columns (from page LEFT):
 *   Drawn    : X = 1125  to  1200  (width = 75 pt)
 *   Checked  : X = 1200  to  1275  (width = 75 pt)
 *   Approved : X = 1275  to  1350  (width = 75 pt)
 *
 * Signature row (from page BOTTOM):
 *   Bottom (Y) = 35 pt
 *   Top    (Y) = 60 pt   (box height = 25 pt)
 */

const A2_WIDTH  = 1683.78;   // pts (A2 landscape reference)
const A2_HEIGHT = 1190.55;   // pts

// Calibrated column X positions (from page LEFT edge) for A2 size
const DRAWN_X    = 1125;
const CHECKED_X  = 1200;
const APPROVED_X = 1275;
const COL_WIDTH  = 75;

// Calibrated Y positions (from page BOTTOM edge) for A2 size
const SIG_BOX_Y  = 35;       // bottom edge of sig name box
const SIG_BOX_H  = 25;       // height of sig name box

@Injectable()
export class DrawingStamperService {
  /**
   * Stamp digital signatures and verification seals onto the E-Tiket of the PDF drawing.
   * Supports both visual interactive placement (Nitro PDF style) and default calibrated slots.
   */
  async stampSignatures(pdfBuffer: Buffer, options: StampOptions): Promise<Buffer> {
    const pdfDoc = await PDFDocument.load(pdfBuffer);
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    const slots = [
      { key: 'drawn'    as const, data: options.drawn },
      { key: 'checked'  as const, data: options.checked },
      { key: 'approved' as const, data: options.approved },
    ];

    for (const slot of slots) {
      if (!slot.data || !slot.data.name) continue;

      // 1. If visual placement is provided (Nitro PDF style)
      if (slot.data.placement && typeof slot.data.placement.xPercent === 'number') {
        const p = slot.data.placement;
        const pageIdx = Math.max(0, Math.min(p.pageIndex || 0, pdfDoc.getPageCount() - 1));
        const page = pdfDoc.getPage(pageIdx);
        const { width: pW, height: pH } = page.getSize();

        const boxW = Math.max(20, p.widthPercent * pW);
        const boxH = Math.max(15, p.heightPercent * pH);
        const boxX = Math.max(0, p.xPercent * pW);
        // Convert top-left (web) coordinate to bottom-left (PDF) coordinate:
        const boxY = Math.max(0, pH - (p.yPercent * pH) - boxH);

        console.log(
          `[DrawingStamper] Visual Placement for "${slot.key}" on Page ${pageIdx + 1}: boxX=${boxX.toFixed(1)}, boxY=${boxY.toFixed(1)}, boxW=${boxW.toFixed(1)}, boxH=${boxH.toFixed(1)}`,
        );

        await this.embedSlotToPage(pdfDoc, page, boxX, boxY, boxW, boxH, slot.data, font, fontBold);
      } else {
        // 2. Fallback: Default Calibrated Coordinates (on Page 0 or all pages)
        const pages = options.allPages ? pdfDoc.getPages() : [pdfDoc.getPage(0)];
        for (const page of pages) {
          const { width, height } = page.getSize();
          const scaleX = width / A2_WIDTH;
          const scaleY = height / A2_HEIGHT;

          const boxW = COL_WIDTH * scaleX;
          const boxH = SIG_BOX_H * scaleY;
          const boxY = SIG_BOX_Y * scaleY;

          const defaultX =
            slot.key === 'drawn'
              ? DRAWN_X * scaleX
              : slot.key === 'checked'
              ? CHECKED_X * scaleX
              : APPROVED_X * scaleX;

          console.log(
            `[DrawingStamper] Default Placement for "${slot.key}": boxX=${defaultX.toFixed(1)}, boxY=${boxY.toFixed(1)}`,
          );

          await this.embedSlotToPage(pdfDoc, page, defaultX, boxY, boxW, boxH, slot.data, font, fontBold);
        }
      }
    }

    const modifiedBytes = await pdfDoc.save();
    return Buffer.from(modifiedBytes);
  }

  private async embedSlotToPage(
    pdfDoc: PDFDocument,
    page: any,
    boxX: number,
    boxY: number,
    boxW: number,
    boxH: number,
    slotData: SignatureSlot,
    font: any,
    fontBold: any,
  ) {
    if (slotData.signatureData && slotData.signatureData.startsWith('data:image/')) {
      try {
        const base64Data = slotData.signatureData.split(',')[1];
        if (!base64Data) {
          this.drawTextStamp(page, boxX, boxY, boxW, boxH, slotData, font, fontBold);
          return;
        }

        const imgBytes = Buffer.from(base64Data, 'base64');
        const isPng = slotData.signatureData.includes('image/png');

        let img;
        if (isPng) {
          img = await pdfDoc.embedPng(imgBytes);
        } else {
          img = await pdfDoc.embedJpg(imgBytes);
        }

        const padding = 1;
        const imgDims = img.scaleToFit(boxW - padding * 2, boxH - padding * 2);

        const imgX = boxX + (boxW - imgDims.width) / 2;
        const imgY = boxY + (boxH - imgDims.height) / 2;

        page.drawImage(img, {
          x: imgX,
          y: imgY,
          width: imgDims.width,
          height: imgDims.height,
          opacity: 0.98,
        });

        // If not a full stamp (hand-drawn), write small date text below if room permits
        if (!slotData.signatureData.includes('VERIF-ID')) {
          const dateStr = slotData.date ? slotData.date.split('T')[0] : new Date().toISOString().split('T')[0];
          const dateSize = Math.max(4, Math.min(6.5, boxH * 0.22));
          page.drawText(dateStr, {
            x: boxX + 1,
            y: Math.max(1, boxY - dateSize - 1),
            size: dateSize,
            font: font,
            color: rgb(0.2, 0.2, 0.2),
          });
        }
      } catch (imgErr) {
        console.warn('[DrawingStamper] Failed to embed image, fallback to text stamp:', imgErr);
        this.drawTextStamp(page, boxX, boxY, boxW, boxH, slotData, font, fontBold);
      }
    } else {
      this.drawTextStamp(page, boxX, boxY, boxW, boxH, slotData, font, fontBold);
    }
  }

  /**
   * Draw digital certification badge / stamp text in the signature slot
   */
  private drawTextStamp(
    page: any,
    boxX: number,
    boxY: number,
    boxW: number,
    boxH: number,
    slot: SignatureSlot,
    font: any,
    fontBold: any,
  ) {
    const pad = 1.5;
    const innerX = boxX + pad;
    const innerY = boxY + pad;
    const innerW = boxW - pad * 2;
    const innerH = boxH - pad * 2;

    // Draw background & border
    page.drawRectangle({
      x: innerX,
      y: innerY,
      width: innerW,
      height: innerH,
      color: rgb(0.97, 0.98, 1.0),
      borderColor: rgb(0.1, 0.35, 0.75),
      borderWidth: 0.75,
    });

    // Header badge
    const headerH = Math.max(5, innerH * 0.32);
    page.drawRectangle({
      x: innerX,
      y: innerY + innerH - headerH,
      width: innerW,
      height: headerH,
      color: rgb(0.1, 0.35, 0.75),
    });

    const headerFontSize = Math.max(3.5, Math.min(6, headerH * 0.65));
    page.drawText('DIGITALLY SIGNED', {
      x: innerX + 2,
      y: innerY + innerH - headerH + (headerH - headerFontSize) / 2,
      size: headerFontSize,
      font: fontBold,
      color: rgb(1, 1, 1),
    });

    // Signer name
    const nameFontSize = Math.max(4, Math.min(7.5, (innerH - headerH) * 0.45));
    const cleanName = (slot.name || 'APPROVED').substring(0, 18).toUpperCase();
    page.drawText(cleanName, {
      x: innerX + 2,
      y: innerY + (innerH - headerH) * 0.45,
      size: nameFontSize,
      font: fontBold,
      color: rgb(0.08, 0.15, 0.35),
    });

    // Date & NPK footer
    const dateStr = slot.date ? slot.date.split('T')[0] : new Date().toISOString().split('T')[0];
    const footerText = slot.npk ? `${slot.npk} | ${dateStr}` : dateStr;
    const footerFontSize = Math.max(3, Math.min(5, (innerH - headerH) * 0.3));
    page.drawText(footerText, {
      x: innerX + 2,
      y: innerY + 2,
      size: footerFontSize,
      font: font,
      color: rgb(0.4, 0.45, 0.55),
    });
  }

  /**
   * Extract a single page (1-based index) from a multi-page PDF document
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
}
