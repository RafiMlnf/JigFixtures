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
    const uint8Array = new Uint8Array(buffer);
    const parser = new PDFParse(uint8Array);

    let fullPdfData: any;
    try {
      fullPdfData = await parser.getText();
    } catch (err) {
      this.logger.error('Error parsing PDF text:', err);
      throw err;
    }

    const totalPages = fullPdfData.total || (fullPdfData.pages ? fullPdfData.pages.length : 1);
    const pageTexts: string[] = (fullPdfData.pages || []).map((p: any) => p.text || '');
    const page1Text = pageTexts[0] || fullPdfData.text || '';

    // 1. Extract Jig Info from Page 1 E-Tiket
    const jig = this.extractJigInfo(page1Text);

    // 2. Extract BOM Table from Page 1
    const cellParts = this.extractBomItems(page1Text);

    // 3. Map Subsequent Pages (Page 2..N) to Cell Parts
    this.mapSubsequentPagesToCellParts(cellParts, pageTexts);

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
   * Extract BOM table items from Page 1 text.
   * Header: ITEM NO | PART NAME | PART NUMBER | MATERIAL | HEAT TREATMENT | HARDNESS | QTY
   */
  private extractBomItems(text: string): ParsedCellPart[] {
    const items: ParsedCellPart[] = [];
    const lines = text.split(/\r?\n/);

    // Regex to match BOM table rows:
    // 1. Line starts with item number (1..99)
    // 2. Part Name
    // 3. Part Number: TXMACH-..., MISUMI ..., AMF ..., STD, or hyphenated part numbers
    // 4. Material / Treatment / Hardness
    // 5. Quantity (digits at end of line)
    const bomRowRegex = /^(\d{1,2})\s+(.+?)\s+(TXMACH-[A-Z0-9]+|MISUMI\s+[A-Z0-9_-]+|AMF\s+[A-Z0-9_-]+|STD|\b[A-Z0-9]{2,}-[A-Z0-9_-]+\b)\s+(.*?)\s*(\d+)\s*$/;

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line || line.includes('ITEM NO')) continue;

      const rowMatch = line.match(bomRowRegex);

      if (rowMatch) {
        const itemNo = parseInt(rowMatch[1], 10);
        const name = rowMatch[2].trim();
        const partNumber = rowMatch[3].trim();
        let middleInfo = rowMatch[4]?.trim() || '';
        const qty = rowMatch[5].trim();

        // Check if standard part (e.g. BOLT, NUT, STD, MISUMI, etc.)
        const isStandard =
          partNumber === 'STD' ||
          name.toUpperCase().startsWith('BOLT') ||
          name.toUpperCase().startsWith('NUT') ||
          name.toUpperCase().startsWith('SCREW') ||
          name.toUpperCase().startsWith('WASHER') ||
          partNumber.startsWith('MISUMI') ||
          partNumber.startsWith('AMF') ||
          name.toUpperCase().includes('HYDRAULIC') ||
          middleInfo.includes('STD');

        // Extract Material & Treatment from middleInfo
        let hardness = '';
        let heatTreatment = '';

        if (middleInfo.includes('Hrc') || middleInfo.includes('HRC')) {
          const hrcMatch = middleInfo.match(/([0-9\s-]+\s*Hrc)/i);
          if (hrcMatch) {
            hardness = hrcMatch[1].trim().replace(/\s+/g, ' ');
            middleInfo = middleInfo.replace(hrcMatch[0], '').trim();
          }
        }

        if (middleInfo.match(/Q-?T/i)) {
          heatTreatment = 'QT';
          middleInfo = middleInfo.replace(/Q-?T/i, '').trim();
        }

        // Clean up dashes in material
        let material = middleInfo.replace(/[-–—]+/g, ' ').replace(/\s+/g, ' ').trim();
        if (material === 'STD STD STD' || material === 'STD') {
          material = 'STD';
        }
        if (!material && isStandard) material = 'STD';

        items.push({
          itemNo,
          name,
          partNumber,
          material: material || undefined,
          heatTreatment: heatTreatment || undefined,
          hardness: hardness || undefined,
          qty,
          isStandardPart: isStandard,
          description: `Item #${itemNo} - Material: ${material || 'N/A'}${hardness ? ` - Hardness: ${hardness}` : ''}`,
        });
      }
    }

    // Fallback if structured regex missed some items:
    if (items.length === 0) {
      const txMachRegex = /(\d{1,2})?\s*([A-Za-z0-9Øø\s_-]+?)\s+(TXMACH-[A-Z0-9]+)\s*(.*?)\s+(\d+)/g;
      let m;
      let autoItemNo = 1;
      while ((m = txMachRegex.exec(text)) !== null) {
        const itemNo = m[1] ? parseInt(m[1], 10) : autoItemNo++;
        const name = m[2].trim();
        const partNumber = m[3].trim();
        const material = m[4]?.trim() || '';
        const qty = m[5] || '1';

        items.push({
          itemNo,
          name,
          partNumber,
          material: material || undefined,
          qty,
          isStandardPart: false,
          description: `Material: ${material}`,
        });
      }
    }

    // Sort by itemNo ascending
    return items.sort((a, b) => a.itemNo - b.itemNo);
  }

  /**
   * Map subsequent pages (Pages 2..N) to CellParts.
   * Compares Part Number, Part Name, and Sheet No in each page's text.
   */
  private mapSubsequentPagesToCellParts(cellParts: ParsedCellPart[], pageTexts: string[]): void {
    if (pageTexts.length <= 1) return;

    for (let pageIdx = 1; pageIdx < pageTexts.length; pageIdx++) {
      const pageNum = pageIdx + 1; // 1-indexed page number
      const pageText = pageTexts[pageIdx];

      // Try matching by exact Part Number first
      let matchedPart = cellParts.find((cp) => {
        if (!cp.partNumber || cp.partNumber === 'STD') return false;
        // Normalize OCR variations (e.g., '1' vs 'I')
        const normalizedPartNo = cp.partNumber.replace(/I/g, '1');
        const normalizedPageText = pageText.replace(/I/g, '1');
        return pageText.includes(cp.partNumber) || normalizedPageText.includes(normalizedPartNo);
      });

      // If not matched by Part Number, try matching by Sheet No (e.g. "Sheet No: 2/10" -> Page 2)
      if (!matchedPart) {
        const sheetMatch = pageText.match(/Sheet\s*No\.?\s*[:\s]*(\d+)\s*\/\s*(\d+)/i) || pageText.match(/(\d+)\s*\/\s*10/);
        if (sheetMatch && sheetMatch[1]) {
          const sheetNum = parseInt(sheetMatch[1], 10);
          matchedPart = cellParts.find((cp) => cp.itemNo === (sheetNum - 1));
        }
      }

      // If not matched, try matching by Part Name
      if (!matchedPart) {
        matchedPart = cellParts.find((cp) => {
          if (!cp.name || cp.name.length < 4) return false;
          return pageText.toLowerCase().includes(cp.name.toLowerCase());
        });
      }

      // If matched, assign the page index
      if (matchedPart && !matchedPart.pdfPageIndex) {
        matchedPart.pdfPageIndex = pageNum;
      }
    }

    // For any manufactured cell parts without assigned page, assign sequentially if applicable
    let currentPage = 2;
    for (const cp of cellParts) {
      if (!cp.isStandardPart && !cp.pdfPageIndex && currentPage <= pageTexts.length) {
        cp.pdfPageIndex = currentPage++;
      }
    }
  }
}
