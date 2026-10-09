const fs = require('fs');
const path = require('path');

const xmlPath = path.join(__dirname, '../extracted_xlsx/xl/drawings/drawing1.xml');
const xml = fs.readFileSync(xmlPath, 'utf-8');

// Parse twoCellAnchor elements
const anchors = xml.split('<xdr:twoCellAnchor');

console.log('Total twoCellAnchor blocks:', anchors.length - 1);

const items = [];

anchors.slice(1).forEach((block, idx) => {
  // extract from col, from row
  const fromMatch = block.match(/<xdr:from>[\s\S]*?<xdr:col>(\d+)<\/xdr:col>[\s\S]*?<xdr:row>(\d+)<\/xdr:row>/);
  const toMatch = block.match(/<xdr:to>[\s\S]*?<xdr:col>(\d+)<\/xdr:col>[\s\S]*?<xdr:row>(\d+)<\/xdr:row>/);

  const fromCol = fromMatch ? parseInt(fromMatch[1]) : null;
  const fromRow = fromMatch ? parseInt(fromMatch[2]) : null;
  const toCol = toMatch ? parseInt(toMatch[1]) : null;
  const toRow = toMatch ? parseInt(toMatch[2]) : null;

  // extract text paragraphs
  const textMatches = [];
  const pRegex = /<a:p>([\s\S]*?)<\/a:p>/g;
  let pMatch;
  while ((pMatch = pRegex.exec(block)) !== null) {
    const tRegex = /<a:t>(.*?)<\/a:t>/g;
    let tMatch;
    const pTexts = [];
    while ((tMatch = tRegex.exec(pMatch[1])) !== null) {
      pTexts.push(tMatch[1]);
    }
    const lineText = pTexts.join('').trim();
    if (lineText) textMatches.push(lineText);
  }

  const fullText = textMatches.join(' | ');

  // extract fill color if any
  const colorMatch = block.match(/<a:srgbClr val="([A-Fa-f0-9]+)"/);
  const color = colorMatch ? colorMatch[1] : null;

  if (fullText) {
    items.push({
      idx,
      fromRow,
      fromCol,
      toRow,
      toCol,
      color,
      texts: textMatches,
      fullText
    });
  }
});

console.log('Shapes with text:', items.length);

// Sort by Row then Col
items.sort((a, b) => (a.fromRow - b.fromRow) || (a.fromCol - b.fromCol));

fs.writeFileSync(path.join(__dirname, '../extracted_xlsx/parsed_shapes.json'), JSON.stringify(items, null, 2));

console.log('\n--- SAMPLE SHAPES (first 30 sorted by position) ---');
items.slice(0, 30).forEach(it => {
  console.log(`[R${it.fromRow}:C${it.fromCol}] (color: ${it.color}) => ${it.fullText}`);
});
