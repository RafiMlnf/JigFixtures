import { Injectable } from '@nestjs/common';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

export interface SignatureSlot {
  name: string;
  date: string;
  signatureData?: string; // base64 data URL (e.g. "data:image/png;base64,...")
  npk?: string;
}

export interface StampOptions {
  drawn?: SignatureSlot;
  checked?: SignatureSlot;
  approved?: SignatureSlot;
  allPages?: boolean;
}

@Injectable()
export class DrawingStamperService {
  /**
   * Stamp digital signatures and verification seals onto the E-Tiket of the PDF drawing.
   * Returns modified PDF buffer.
   */
  async stampSignatures(pdfBuffer: Buffer, options: StampOptions): Promise<Buffer> {
    const pdfDoc = await PDFDocument.load(pdfBuffer);
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    const pages = options.allPages ? pdfDoc.getPages() : [pdfDoc.getPage(0)];

    for (const page of pages) {
      const { width, height } = page.getSize();

      // Scaled coordinates relative to page size
      // Standard title block at bottom-right corner:
      // We calculate offset from bottom-right (x: width - margin, y: bottom margin)
      const isLargeFormat = width > 1000; // e.g. A2 / A1
      const scale = isLargeFormat ? 1.4 : 1.0;

      // Positions for Drawn, Checked, Approved boxes in bottom-right E-Tiket
      const slots = [
        { key: 'drawn' as const, data: options.drawn, xOffset: 200 * scale },
        { key: 'checked' as const, data: options.checked, xOffset: 145 * scale },
        { key: 'approved' as const, data: options.approved, xOffset: 90 * scale },
      ];

      for (const slot of slots) {
        if (!slot.data || !slot.data.name) continue;

        const boxX = width - slot.xOffset;
        const boxY = 32 * scale;
        const boxWidth = 45 * scale;
        const boxHeight = 25 * scale;

        // 1. Draw signature image if provided
        if (slot.data.signatureData && slot.data.signatureData.startsWith('data:image/')) {
          try {
            const base64Data = slot.data.signatureData.split(',')[1];
            const imgBytes = Buffer.from(base64Data, 'base64');
            
            let img;
            if (slot.data.signatureData.includes('image/png')) {
              img = await pdfDoc.embedPng(imgBytes);
            } else {
              img = await pdfDoc.embedJpg(imgBytes);
            }

            const imgDims = img.scaleToFit(boxWidth - 4, boxHeight - 6);
            page.drawImage(img, {
              x: boxX + (boxWidth - imgDims.width) / 2,
              y: boxY + (boxHeight - imgDims.height) / 2 + 3,
              width: imgDims.width,
              height: imgDims.height,
              opacity: 0.9,
            });
          } catch (imgErr) {
            console.warn('Failed to embed signature image in PDF, falling back to text stamp:', imgErr);
            this.drawTextStamp(page, boxX, boxY, boxWidth, boxHeight, slot.data, font, fontBold, scale);
          }
        } else {
          // If no image, draw professional digital stamp badge
          this.drawTextStamp(page, boxX, boxY, boxWidth, boxHeight, slot.data, font, fontBold, scale);
        }

        // 2. Draw Date text under the signature box
        const dateStr = slot.data.date ? slot.data.date.split('T')[0] : new Date().toISOString().split('T')[0];
        page.drawText(dateStr, {
          x: boxX + 2,
          y: boxY - (8 * scale),
          size: 6 * scale,
          font: font,
          color: rgb(0.2, 0.2, 0.2),
        });
      }
    }

    const modifiedBytes = await pdfDoc.save();
    return Buffer.from(modifiedBytes);
  }

  /**
   * Draw digital certification badge / stamp text in the signature slot
   */
  private drawTextStamp(
    page: any,
    x: number,
    y: number,
    width: number,
    height: number,
    data: SignatureSlot,
    font: any,
    fontBold: any,
    scale: number,
  ) {
    // Background seal tint
    page.drawRectangle({
      x: x + 1,
      y: y + 1,
      width: width - 2,
      height: height - 2,
      color: rgb(0.92, 0.96, 1.0),
      opacity: 0.85,
    });

    // Stamp border
    page.drawRectangle({
      x: x + 1,
      y: y + 1,
      width: width - 2,
      height: height - 2,
      borderColor: rgb(0.1, 0.4, 0.8),
      borderWidth: 0.75,
    });

    // Seal text
    const cleanName = data.name.length > 12 ? data.name.slice(0, 11) + '..' : data.name;
    page.drawText(cleanName.toUpperCase(), {
      x: x + 3,
      y: y + height - (8 * scale),
      size: 5.5 * scale,
      font: fontBold,
      color: rgb(0.05, 0.3, 0.7),
    });

    const npkText = data.npk ? `NPK: ${data.npk}` : 'DIGITAL SIGN';
    page.drawText(npkText, {
      x: x + 3,
      y: y + (3 * scale),
      size: 4.5 * scale,
      font: font,
      color: rgb(0.3, 0.3, 0.4),
    });
  }
}
