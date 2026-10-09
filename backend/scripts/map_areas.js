const fs = require('fs');
const path = require('path');

const shapes = JSON.parse(fs.readFileSync(path.join(__dirname, '../extracted_xlsx/parsed_shapes.json'), 'utf-8'));

// Identify area labels:
// U, S, B, T: direction labels (Utara, Selatan, Barat, Timur)
// JALAN, PINTU SELATAN, PINTU BARAT, LEGEND, Ruang Klasifikasi Conrod, ABNORMAL CONDITION, UNDER DEVELOPMENT, HAS BEEN RENEWED & IMPROVED
// Production areas:
// - MACHINING B AREA
// - BROACHING
// - TURNING HUB CLUTCH
// - CONE RACE
// - BALL RACE
// - LOWER BALL JOINT
// - KAYABA UBC AUTO
// - KAYABA UBC MANUAL
// - ST. STEM - MACH. SHAFT
// - ST.STEM ASSY AUTO
// - ST. STEM ASSY MANUAL
// - ROTOR 1, ROTOR 2
// - HF 2CF/2MD
// - HUB FRONT D14N
// - HUB FRONT D34T
// - HUB FRONT D80N
// - SPINDLE AXLE A
// - ARM CHUSION
// - PIN PISTON
// - CONROD AFTER MARKET
// - CONROD FINISH
// - CONROD - TEMPERING

const areaDefinitions = [
  { name: 'CONROD AFTER MARKET', rowMin: 0, rowMax: 9, colMin: 22, colMax: 30 },
  { name: 'CONROD FINISH', rowMin: 10, rowMax: 17, colMin: 22, colMax: 30 },
  { name: 'CONROD - TEMPERING', rowMin: 18, rowMax: 35, colMin: 22, colMax: 30 },
  { name: 'PIN PISTON', rowMin: 15, rowMax: 23, colMin: 19, colMax: 22 },
  { name: 'ARM CHUSION', rowMin: 24, rowMax: 35, colMin: 19, colMax: 23 },
  { name: 'HF 2CF/2MD', rowMin: 0, rowMax: 6, colMin: 8, colMax: 13 },
  { name: 'HUB FRONT D34T', rowMin: 4, rowMax: 12, colMin: 12, colMax: 18 },
  { name: 'HUB FRONT D80N', rowMin: 12, rowMax: 20, colMin: 13, colMax: 21 },
  { name: 'HUB FRONT D14N', rowMin: 19, rowMax: 26, colMin: 8, colMax: 14 },
  { name: 'SPINDLE AXLE A', rowMin: 21, rowMax: 32, colMin: 13, colMax: 19 },
  { name: 'ROTOR 1 & 2', rowMin: 0, rowMax: 18, colMin: 5, colMax: 8 },
  { name: 'BROACHING', rowMin: 3, rowMax: 12, colMin: 1, colMax: 5 },
  { name: 'TURNING HUB CLUTCH', rowMin: 13, rowMax: 35, colMin: 1, colMax: 6 },
  { name: 'CONE RACE', rowMin: 36, rowMax: 47, colMin: 1, colMax: 6 },
  { name: 'BALL RACE', rowMin: 48, rowMax: 57, colMin: 1, colMax: 6 },
  { name: 'LOWER BALL JOINT', rowMin: 58, rowMax: 70, colMin: 1, colMax: 6 },
  { name: 'KAYABA UBC AUTO', rowMin: 36, rowMax: 50, colMin: 5, colMax: 9 },
  { name: 'KAYABA UBC MANUAL', rowMin: 51, rowMax: 70, colMin: 5, colMax: 9 },
  { name: 'ST. STEM - MACH. SHAFT', rowMin: 36, rowMax: 50, colMin: 9, colMax: 13 },
  { name: 'UB 5 (KAYABA)', rowMin: 36, rowMax: 50, colMin: 12, colMax: 15 },
  { name: 'ST. STEM ASSY AUTO', rowMin: 36, rowMax: 50, colMin: 15, colMax: 20 },
  { name: 'ST. STEM ASSY MANUAL', rowMin: 51, rowMax: 70, colMin: 14, colMax: 20 },
  { name: 'UB 6 & UB 7', rowMin: 51, rowMax: 70, colMin: 9, colMax: 14 },
];

console.log('Defined areas:', areaDefinitions.length);
