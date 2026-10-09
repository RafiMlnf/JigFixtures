const ExcelJS = require('exceljs');
const path = require('path');

async function main() {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(path.join(__dirname, '../../NEW MAPPING EUY.xlsx'));
  console.log('Worksheet names:', wb.worksheets.map(w => w.name));
  
  wb.worksheets.forEach(ws => {
    console.log(`\n=== SHEET: ${ws.name} (rows: ${ws.rowCount}) ===`);
    ws.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      const cells = [];
      row.eachCell({ includeEmpty: false }, (cell, colNumber) => {
        let v = cell.value;
        if (v && typeof v === 'object' && v.result !== undefined) v = v.result;
        if (v && typeof v === 'object' && v.richText) v = v.richText.map(t => t.text).join('');
        cells.push(`[${colNumber}] ${JSON.stringify(v)}`);
      });
      if (cells.length > 0) {
        console.log(`R${rowNumber}: ${cells.join(' ; ')}`);
      }
    });
  });
}

main().catch(console.error);
