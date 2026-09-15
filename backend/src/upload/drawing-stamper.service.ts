import { Injectable } from '@nestjs/common';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

export interface PlacementCoordinates {
  pageIndex?: number;    // 0-indexed page in PDF (default 0)
  xPercent: number;      // 0.0 - 1.0 (relative to page width from left)
  yPercent: number;      // 0.0 - 1.0 (relative to page height from TOP)
  widthPercent: number;  // 0.0 - 1.0 (relative to page width)
  heightPercent: number; // 0.0 - 1.0 (relative to page height)
  allPages?: boolean;    // Apply to all pages in drawing set (Induk Jig + Cell Parts)
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
 * Title block column layout calibrated from real PT MTM jig PDF (A2 landscape, 1683.78 x 1190.55 pts)
 * using PyMuPDF text extraction to find exact column positions.
 *
 * Text analysis results:
 *   'Drawn'    word center_x = 1153 → col x:[1118 - 1188]
 *   'Checked'  word center_x = 1218 → col x:[1188 - 1257]
 *   'Approved' word center_x = 1287 → col x:[1257 - 1326]
 *
 * Signature row (fitz top-left → pdf-lib bottom-left conversion):
 *   fitz y:[1103 - 1127]  →  pdf-lib y:[63 - 87]  (height = 24 pt)
 *   Name row below label: fitz y:[1116-1127]  →  pdf-lib y:[63-74]
 *   Extra space to include: fitz y:[1092-1130] →  pdf-lib y:[60-98]  (height = 38pt) 
 */

const A2_WIDTH  = 1683.78;   // pts (A2 landscape reference)
const A2_HEIGHT = 1190.55;   // pts

// Calibrated column X positions (from page LEFT edge) for A2 size
// CAD measurements: Drawn=[1118.2, 1185.3], Checked=[1185.3, 1252.4], Approved=[1252.4, 1319.4]
const DRAWN_X    = 1119;   // 'Drawn' column left edge (box width 65pt)
const CHECKED_X  = 1186;   // 'Checked' column left edge
const APPROVED_X = 1253;   // 'Approved' column left edge
const COL_WIDTH  = 65;     // Width of each signature slot

// Calibrated Y positions (from page BOTTOM edge, pdf-lib convention) for A2 size
// CAD horizontal lines:
//   Top border of signature box:  y = 96.9  (below 'Drawn' label)
//   Bottom border of sig box:     y = 62.9  (above 'Date :' line)
//   'Date :' row:                 y = [51.6, 62.9]
//   MTM logo box:                 y = [28.9, 51.6]
const SIG_BOX_Y  = 65;     // bottom edge of signature box (y: 65 to 93)
const SIG_BOX_H  = 28;     // height of signature box (fits cleanly above Date row)

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
        const targetPages = (p.allPages !== false)
          ? pdfDoc.getPages()
          : [pdfDoc.getPage(Math.max(0, Math.min(p.pageIndex || 0, pdfDoc.getPageCount() - 1)))];

        console.log(
          `[DrawingStamper] Visual Placement for "${slot.key}" applied to ${targetPages.length} page(s) (allPages=${p.allPages !== false})`,
        );

        for (const page of targetPages) {
          const { width: pW, height: pH } = page.getSize();
          const boxW = Math.max(20, p.widthPercent * pW);
          const boxH = Math.max(15, p.heightPercent * pH);
          const boxX = Math.max(0, p.xPercent * pW);
          // Convert top-left (web) coordinate to bottom-left (PDF) coordinate:
          const boxY = Math.max(0, pH - (p.yPercent * pH) - boxH);

          await this.embedSlotToPage(pdfDoc, page, boxX, boxY, boxW, boxH, slot.data, font, fontBold);
        }
      } else {
        // 2. Fallback: Default Calibrated Coordinates (on all pages by default so CellParts get signed too)
        const pages = options.allPages !== false ? pdfDoc.getPages() : [pdfDoc.getPage(0)];
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

          // Align date text directly beside the "Date :" CAD label in each column
          const defaultDateX =
            slot.key === 'drawn'
              ? 1142 * scaleX
              : slot.key === 'checked'
              ? 1209 * scaleX
              : 1276 * scaleX;
          const defaultDateY = 54.5 * scaleY;

          console.log(
            `[DrawingStamper] Default Placement for "${slot.key}": boxX=${defaultX.toFixed(1)}, boxY=${boxY.toFixed(1)}, dateX=${defaultDateX.toFixed(1)}, dateY=${defaultDateY.toFixed(1)}`,
          );

          await this.embedSlotToPage(
            pdfDoc,
            page,
            defaultX,
            boxY,
            boxW,
            boxH,
            slot.data,
            font,
            fontBold,
            defaultDateX,
            defaultDateY,
          );
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
    customDateX?: number,
    customDateY?: number,
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

        // Write date text directly next to "Date :"
        if (!slotData.signatureData.includes('VERIF-ID')) {
          const dateStr = slotData.date ? slotData.date.split('T')[0] : new Date().toISOString().split('T')[0];
          const dateSize = 6.5;
          const dx = customDateX ?? (boxX + 1);
          const dy = customDateY ?? Math.max(1, boxY - dateSize - 1);
          page.drawText(dateStr, {
            x: dx,
            y: dy,
            size: dateSize,
            font: font,
            color: rgb(0.1, 0.1, 0.1),
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
