const fs = require('fs');
const path = require('path');

const drawingXmlPath = path.join(__dirname, '../extracted_xlsx/xl/drawings/drawing1.xml');
const content = fs.readFileSync(drawingXmlPath, 'utf-8');

console.log('XML Length:', content.length);

// Extract all <a:t>...</a:t> text nodes
const matches = [];
const regex = /<a:t>(.*?)<\/a:t>/g;
let match;
while ((match = regex.exec(content)) !== null) {
  if (match[1].trim()) {
    matches.push(match[1].trim());
  }
}

console.log('Total text nodes:', matches.length);
console.log('\n--- First 100 text items ---');
console.log(matches.slice(0, 100).join('\n'));

// Save all extracted texts to a text file for complete inspection
fs.writeFileSync(path.join(__dirname, '../extracted_xlsx/all_drawing_texts.txt'), matches.join('\n'));
console.log('\nSaved all texts to extracted_xlsx/all_drawing_texts.txt');
