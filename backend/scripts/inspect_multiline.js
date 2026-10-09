const fs = require('fs');
const path = require('path');

const shapes = JSON.parse(fs.readFileSync(path.join(__dirname, '../extracted_xlsx/parsed_shapes.json'), 'utf-8'));

shapes.forEach(s => {
  // If text has split tokens or multi lines
  if (s.texts.length > 1) {
    console.log(`[R${s.fromRow}:C${s.fromCol}] Texts:`, JSON.stringify(s.texts));
  }
});
