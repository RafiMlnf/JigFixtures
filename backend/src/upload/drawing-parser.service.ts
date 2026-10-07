import { Injectable, Logger } from '@nestjs/common';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { PDFParse } = require('pdf-parse');

export interface ParsedJigInfo {
  partName: string;
  partNumber: string;
  title: string;
  model: string;
  qty: string;
  drawnBy?: string;
  checkedBy?: string;
  approvedBy?: string;
  scale?: string;
  format?: string;
  weight?: string;
}

export interface ParsedCellPart {
  itemNo: number;
  name: string;
  partNumber: string;
  material?: string;
  heatTreatment?: string;
  hardness?: string;
  qty: string;
  pdfPageIndex?: number;
  isStandardPart: boolean;
  description?: string;
}

export interface ParsedDrawingResult {
  jig: ParsedJigInfo;
  cellParts: ParsedCellPart[];
  totalPages: number;
  extractedTextSummary?: string;
}

@Injectable()
export class DrawingParserService {
  private readonly logger = new Logger(DrawingParserService.name);

  /**
   * Parse an engineering drawing PDF buffer to extract Jig metadata and CellPart list.
   */
  async parseDrawingPdf(buffer: Buffer): Promise<ParsedDrawingResult> {
    let fullPdfData: any = null;
    let totalPages = 1;

    try {
      // In pdf-parse v2, options must be an object with { data: buffer }
      const parser = new PDFParse({ data: buffer });
      try {
        fullPdfData = await parser.getText();
      } finally {
        try {
          await parser.destroy();
        } catch {}
      }
    } catch (err: any) {
      this.logger.warn(`pdf-parse getText error: ${err?.message || err}. Attempting fallback...`);
    }

    // Fallback: If pdf-parse failed, use pdf-lib to safely get the total page count
    if (!fullPdfData) {
      try {
        const { PDFDocument } = await import('pdf-lib');
        const pdfDoc = await PDFDocument.load(buffer, { ignoreEncryption: true });
        totalPages = pdfDoc.getPageCount();
      } catch (e: any) {
        this.logger.warn(`pdf-lib fallback count failed: ${e?.message || e}`);
      }

      return {
        jig: {
          partName: '',
          partNumber: '',
          title: '',
          model: '',
          qty: '1 Set',
        },
        cellParts: [],
        totalPages,
      };
    }

    totalPages = fullPdfData.total || (fullPdfData.pages ? fullPdfData.pages.length : 1);
    const pageTexts: string[] = (fullPdfData.pages || []).map((p: any) => p.text || '');
    const page1Text = pageTexts[0] || fullPdfData.text || '';

    // 1. Extract Jig Info from Page 1 E-Tiket
    let jig: ParsedJigInfo;
    try {
      jig = this.extractJigInfo(page1Text);
    } catch (e) {
      this.logger.warn('Failed to extract jig info from page 1:', e);
      jig = {
        partName: '',
        partNumber: '',
        title: '',
        model: '',
        qty: '1 Set',
      };
    }

    // 2. Extract CellParts directly from each subsequent sheet / etiket (Pages 2..N)
    let cellParts: ParsedCellPart[] = [];
    try {
      cellParts = this.extractCellPartsFromSheets(pageTexts);
    } catch (e) {
      this.logger.warn('Failed to extract cell parts from sheets:', e);
    }

    return {
      jig,
      cellParts,
      totalPages,
      extractedTextSummary: page1Text.slice(0, 500),
    };
  }

  /**
   * Extract Jig Info from title block (E-Tiket) on Page 1.
   */
  private extractJigInfo(text: string): ParsedJigInfo {
    const jig: ParsedJigInfo = {
      partName: '',
      partNumber: '',
      title: '',
      model: '',
      qty: '1 Set',
      drawnBy: '',
      checkedBy: '',
      approvedBy: '',
    };

    const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

    // 1. Part Number: Main Assembly Part Number ends with '00' or follows 'REFER TO LIST'
    const mainPartNoMatch =
      text.match(/(TXMACH-[A-Z0-9]*00)/i) ||
      text.match(/REFER\s*TO\s*LIST\s*[\t ]*(TXMACH-[A-Z0-9]+)/i) ||
      text.match(/Part\s*No\.?\s*[:\s]*([A-Z0-9/_-]+)/i);
    if (mainPartNoMatch && mainPartNoMatch[1]) {
      jig.partNumber = mainPartNoMatch[1].trim();
    }

    // 2. Scan lines for standard standalone labels and blocks
    for (const line of lines) {
      if (/^\d+\s+[A-Za-z]/i.test(line) || line.includes('ITEM') || line.includes('NO.')) continue;

      // Model
      if (/^LINE\s+ASSY/i.test(line) && !jig.model) {
        jig.model = line.trim();
      } else if (/Model\s*[:\-]\s*(.+)$/i.test(line) && !jig.model) {
        const m = line.match(/Model\s*[:\-]\s*(.+)$/i);
        if (m && m[1]) jig.model = m[1].trim();
      }

      // Title
      if (/^(FIXTURE|JIG)\s+[A-Z0-9\s/_-]+/i.test(line) && !jig.title) {
        jig.title = line.trim();
      } else if (/Title\s*[:\-]\s*(.+)$/i.test(line) && !jig.title) {
        const m = line.match(/Title\s*[:\-]\s*(.+)$/i);
        if (m && m[1]) jig.title = m[1].trim();
      }

      // Part Name
      if (/^ASSY\s+[A-Z0-9\s/_-]+/i.test(line) && !jig.partName) {
        jig.partName = line.replace(/[\t\- ]+$/, '').trim();
      } else if (/Part\s*Name\s*[:\-]\s*(.+)$/i.test(line) && !jig.partName) {
        const m = line.match(/Part\s*Name\s*[:\-]\s*(.+)$/i);
        if (m && m[1]) jig.partName = m[1].trim();
      }

      // Qty
      if (/^\d+\s*Set$/i.test(line)) {
        jig.qty = line.trim();
      } else if (/Qty\s*[:\-]?\s*([0-9]+\s*(?:Set|Pcs|EA|Unit)?)/i.test(line)) {
        const m = line.match(/Qty\s*[:\-]?\s*([0-9]+\s*(?:Set|Pcs|EA|Unit)?)/i);
        if (m && m[1]) jig.qty = m[1].trim();
      }

      // Weight
      if (/\b(\d+(?:\.\d+)?\s*Kg)\b/i.test(line)) {
        const m = line.match(/\b(\d+(?:\.\d+)?\s*Kg)\b/i);
        if (m && m[1]) jig.weight = m[1].trim();
      }

      // Format
      if (/^A[0-5]$/i.test(line) && !jig.format) {
        jig.format = line.trim();
      }

      // Scale
      if (/\b(1\s*:\s*\d+)\b/.test(line) && !jig.scale) {
        const m = line.match(/\b(1\s*:\s*\d+)\b/);
        if (m) jig.scale = m[1].trim();
      }

      // Names (Drawn, Checked, Approved)
      if (
        !jig.drawnBy &&
        (line.includes('KUKUH') ||
          (line.split(/\t+|\s{2,}/).length === 3 &&
            !line.includes('Date') &&
            !line.includes('Drawn') &&
            !line.includes('NO.') &&
            !line.includes('ITEM')))
      ) {
        const parts = line.split(/\t+|\s{2,}/).map((s) => s.trim()).filter(Boolean);
        if (parts.length === 3) {
          jig.drawnBy = parts[0];
          jig.checkedBy = parts[1];
          jig.approvedBy = parts[2];
        }
      }
    }

    // Fallbacks
    if (!jig.partName && jig.title) {
      jig.partName = jig.title;
    }
    if (!jig.title && jig.partName) {
      jig.title = jig.partName;
    }

    // Header-based approvers fallback
    if (!jig.drawnBy) {
      const headerIdx = lines.findIndex((l) => /Drawn\s+Checked\s+Approved/i.test(l));
      if (headerIdx !== -1 && lines[headerIdx + 1]) {
        const [drawn, checked, approved] = this.splitThreeNames(lines[headerIdx + 1]);
        jig.drawnBy = drawn;
        jig.checkedBy = checked;
        jig.approvedBy = approved;
      }
    }

    return jig;
  }

  /**
   * Helper to partition a single line of names under 3 columns (Drawn, Checked, Approved)
   */
  private splitThreeNames(line: string): [string, string, string] {
    const tabOrMultiSpace = line.split(/\t+|\s{2,}/).map((s) => s.trim()).filter(Boolean);
    if (tabOrMultiSpace.length === 3) {
      return [tabOrMultiSpace[0], tabOrMultiSpace[1], tabOrMultiSpace[2]];
    }

    const tokens = line.trim().split(/\s+/);
    if (tokens.length === 3) {
      return [tokens[0], tokens[1], tokens[2]];
    }
    if (tokens.length === 5) {
      // E.g. ["KUKUH", "M.", "FARIEDL", "RAHMAT", "K."]
      return [tokens[0], `${tokens[1]} ${tokens[2]}`, `${tokens[3]} ${tokens[4]}`];
    }
    if (tokens.length === 4) {
      if (tokens[1].endsWith('.')) {
        return [tokens[0], `${tokens[1]} ${tokens[2]}`, tokens[3]];
      } else if (tokens[2].endsWith('.')) {
        return [tokens[0], tokens[1], `${tokens[2]} ${tokens[3]}`];
      } else {
        return [tokens[0], `${tokens[1]} ${tokens[2]}`, tokens[3]];
      }
    }
    if (tokens.length >= 6) {
      return [
        `${tokens[0]} ${tokens[1]}`,
        `${tokens[2]} ${tokens[3]}`,
        tokens.slice(4).join(' '),
      ];
    }
    return [tokens[0] || '', tokens[1] || '', tokens[2] || ''];
  }



  /**
   * Extract CellParts directly from subsequent drawing sheets / etiket (Pages 2..N).
   * Does NOT scrape from the Page 1 BOM table, as requested.
   */
  private extractCellPartsFromSheets(pageTexts: string[]): ParsedCellPart[] {
    const items: ParsedCellPart[] = [];
    if (pageTexts.length <= 1) return items;

    for (let pageIdx = 1; pageIdx < pageTexts.length; pageIdx++) {
      const pageNum = pageIdx + 1; // 1-indexed PDF page
      const pageText = pageTexts[pageIdx];
      const lines = pageText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

      // 1. Part Number: usually TXMACH-... or under Part No.
      const partNoMatch =
        pageText.match(/(TXMACH-[A-Z0-9]+)/i) ||
        pageText.match(/Part\s*No\.?\s*[:\s]*([A-Z0-9/_-]+)/i);
      const partNumber = partNoMatch ? partNoMatch[1].trim() : '';

      // Ignore page if it does not have a manufactured part number or title block
      if (!partNumber && !pageText.includes('MENARA TERUS MAKMUR') && !pageText.includes('Sheet No')) {
        continue;
      }

      // 2. Sheet No: e.g. "2/10" or "Sheet No ... 2/10"
      let sheetNum = pageNum;
      const sheetMatch = pageText.match(/(?:Sheet\s*No[^\d]*)?(\d+)\s*\/\s*(\d+)/i);
      if (sheetMatch && sheetMatch[1]) {
        sheetNum = parseInt(sheetMatch[1], 10);
      }

      // 3. Material
      let material = '';
      const matMatch = pageText.match(/\b(SKD\s*61|SKD\s*11|S\s*45\s*C|S45C|SS400|SCM\s*440|SUS\s*304|AL\s*6061)\b/i);
      if (matMatch) {
        material = matMatch[1].replace(/\s+/g, ' ').trim();
      }

      // 4. Hardness
      let hardness = '';
      const hardMatch = pageText.match(/(\d+\s*[-–]\s*\d+\s*Hrc|\d+\s*Hrc)/i);
      if (hardMatch) {
        hardness = hardMatch[1].trim();
      }

      // 5. Heat Treatment
      let heatTreatment = '';
      if (/\b(Q-?T|QT)\b/i.test(pageText)) {
        heatTreatment = 'QT';
      }

      // 6. Name and Quantity from sheet etiket layout
      let name = '';
      let qty = '1';

      const itemNoIdx = lines.findIndex((l) => l.includes('Item No :'));
      if (itemNoIdx !== -1) {
        // Standard Layout (e.g. A3/A2 formats):
        // lines[itemNoIdx + 1] = Approver names (e.g., 'M. FARIEDL \t RAHMAT K.')
        // lines[itemNoIdx + 2] = Part Name, tab, Qty (e.g., 'Base Plate \t - \t 1')
        const targetLine = lines[itemNoIdx + 2];
        if (targetLine && !targetLine.startsWith('Title') && !targetLine.startsWith('FIXTURE') && !targetLine.startsWith('LINE')) {
          const parts = targetLine.split(/\t+|\s{2,}/).map((s) => s.trim()).filter(Boolean);
          name = parts[0] || '';
          for (let p = 1; p < parts.length; p++) {
            if (/^\d+$/.test(parts[p])) {
              qty = parts[p];
              break;
            }
          }
        } else {
          // Alternative layout (e.g. A4 formats):
          // Title block order has standalone quantity before approver, and part name after approver
          const qLine = lines[itemNoIdx + 3];
          if (qLine) {
            const qm = qLine.match(/^(\d+)/);
            if (qm) qty = qm[1];
          }
          const nLine = lines[itemNoIdx + 6];
          if (nLine && !nLine.startsWith(':')) {
            name = nLine.trim();
          }
        }
      }

      // Fallback for Name if not yet identified: look for Part Name line in page text
      if (!name) {
        const pnMatch = pageText.match(/Part\s*Name\s*[:\-]\s*([^\r\n]+)/i);
        if (pnMatch && pnMatch[1]) {
          name = pnMatch[1].trim();
        }
      }

      // Fallback for Qty if still '1': check for Qty : [0-9]+
      if (qty === '1') {
        const qm = pageText.match(/Qty\s*[:\s]*([0-9]+)/i);
        if (qm && qm[1]) qty = qm[1].trim();
      }

      const itemNo = sheetNum > 1 ? sheetNum - 1 : pageIdx;

      items.push({
        itemNo,
        name: name.replace(/[:\-]/g, '').trim() || `Part Sheet #${sheetNum}`,
        partNumber: partNumber || `CP-P${sheetNum}`,
        qty,
        material: material || undefined,
        hardness: hardness || undefined,
        heatTreatment: heatTreatment || undefined,
        pdfPageIndex: pageNum,
        isStandardPart: false,
        description: `Sheet #${sheetNum}${material ? ` - Material: ${material}` : ''}${hardness ? ` - Hardness: ${hardness}` : ''}`,
      });
    }

    return items.sort((a, b) => a.itemNo - b.itemNo);
  }
}

