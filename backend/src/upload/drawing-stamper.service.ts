import { Injectable } from '@nestjs/common';
import { PDFDocument } from 'pdf-lib';

@Injectable()
export class DrawingStamperService {
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
