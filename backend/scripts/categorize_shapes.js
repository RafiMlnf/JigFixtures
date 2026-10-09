const fs = require('fs');
const path = require('path');

const shapes = JSON.parse(fs.readFileSync(path.join(__dirname, '../extracted_xlsx/parsed_shapes.json'), 'utf-8'));

console.log(`Total shapes: ${shapes.length}`);

// Distinguish Machine Codes vs Area/Line labels
// Machine codes typically look like XX/YY (e.g. SA/08, ST/39, HF/24, RD/21, CR/11, BS/11, KS/79, LB/07, BR/09, PC/01, CN/14, DS/23, LM/26, FL/14, SH/07) or ST/51, or ROBOT
const machineRegex = /^([A-Z]{2}\s*[\/\-]?\s*\d+|ROBOT|UB\s*\d+|UB\s*R\d+.*|PC\/\d+|KS\/\d+)/i;

const machines = [];
const labels = [];

shapes.forEach(s => {
  const text = s.fullText.trim();
  // Check if it contains multiple codes separated by |
  const parts = text.split('|').map(p => p.trim()).filter(Boolean);
  parts.forEach(p => {
    // Clean up spaces in codes like SA/ 08 -> SA/08, ST/ 39 -> ST/39
    const cleanedCode = p.replace(/\s+/g, ' ');
    if (
      /^[A-Z]{2}\s*\/\s*\d+/i.test(cleanedCode) || 
      /^(ROBOT|PC\/\d+|KS\/\d+|UB\s*\d+|UB\s*R[0-9\-]+)/i.test(cleanedCode)
    ) {
      machines.push({
        raw: p,
        code: cleanedCode.replace(/\s*\/\s*/g, '/'),
        fromRow: s.fromRow,
        fromCol: s.fromCol,
        color: s.color,
      });
    } else {
      labels.push({
        text: p,
        fromRow: s.fromRow,
        fromCol: s.fromCol,
        color: s.color,
      });
    }
  });
});

console.log(`\n=== EXTRACTED MACHINES COUNT: ${machines.length} ===`);
const uniqueCodes = [...new Set(machines.map(m => m.code))].sort();
console.log(`Unique Machine Codes (${uniqueCodes.length}):`, uniqueCodes.join(', '));

console.log(`\n=== EXTRACTED LABELS / AREAS (${labels.length}) ===`);
labels.forEach(l => {
  console.log(`[R${l.fromRow}:C${l.fromCol}] => "${l.text}"`);
});
