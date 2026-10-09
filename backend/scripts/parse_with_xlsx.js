const XLSX = require('xlsx');
const path = require('path');

const filePath = path.join(__dirname, '../../NEW MAPPING EUY.xlsx');
const workbook = XLSX.readFile(filePath);

console.log('Sheet Names:', workbook.SheetNames);

workbook.SheetNames.forEach(sheetName => {
  console.log(`\n================== SHEET: ${sheetName} ==================`);
  const sheet = workbook.Sheets[sheetName];
  const data = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
  console.log('Total Rows:', data.length);
  data.slice(0, 30).forEach((row, i) => {
    const nonEmpties = row.map((c, colIdx) => c !== '' ? `[${colIdx}]: ${c}` : null).filter(Boolean);
    if (nonEmpties.length > 0) {
      console.log(`Row ${i + 1}: ${nonEmpties.join(' | ')}`);
    }
  });
});
