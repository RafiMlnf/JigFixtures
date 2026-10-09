const fs = require('fs');
const path = require('path');

const shapes = JSON.parse(fs.readFileSync(path.join(__dirname, '../extracted_xlsx/parsed_shapes.json'), 'utf-8'));

// Detailed line areas mapping based on spatial coordinates:
function getLineInfo(row, col) {
  // Area 1: Top-Right (Col >= 21)
  if (col >= 21) {
    if (row <= 8) return { line: 'Conrod After Market', area: 'Machining B - Conrod' };
    if (row <= 16) return { line: 'Conrod Finish', area: 'Machining B - Conrod' };
    return { line: 'Conrod Tempering', area: 'Machining B - Conrod' };
  }

  // Area 2: Top-Middle (Col 19 to 21, Row 15 to 30)
  if (col >= 19 && col <= 21) {
    if (row <= 22) return { line: 'Pin Piston', area: 'Machining B - Pin Piston' };
    return { line: 'Arm Cushion', area: 'Machining B - Arm Cushion' };
  }

  // Area 3: Middle Hub & Spindle (Row <= 35, Col between 8 and 20)
  if (row <= 35 && col >= 7) {
    if (row <= 6 && col >= 8 && col <= 13) return { line: 'HF 2CF/2MD', area: 'Machining B - Hub Front' };
    if (row <= 12 && col >= 12 && col <= 18) return { line: 'Hub Front D34T', area: 'Machining B - Hub Front' };
    if (row <= 20 && col >= 13 && col <= 21) return { line: 'Hub Front D80N', area: 'Machining B - Hub Front' };
    if (row >= 18 && row <= 26 && col <= 14) return { line: 'Hub Front D14N', area: 'Machining B - Hub Front' };
    if (row >= 21 && col >= 13 && col <= 19) return { line: 'Spindle Axle A', area: 'Machining B - Spindle Axle' };
    return { line: 'Hub Front', area: 'Machining B - Hub Front' };
  }

  // Area 4: Top-Left (Row <= 35, Col <= 7)
  if (row <= 35 && col <= 7) {
    if (col >= 5) return { line: 'Rotor 1 & 2', area: 'Machining B - Rotor' };
    if (row <= 12) return { line: 'Broaching', area: 'Machining B - Broaching' };
    return { line: 'Turning Hub Clutch', area: 'Machining B - Turning' };
  }

  // Area 5: Bottom-Left (Row >= 36, Col <= 6)
  if (row >= 36 && col <= 6) {
    if (row <= 47) return { line: 'Cone Race', area: 'Machining B - Cone Race' };
    if (row <= 57) return { line: 'Ball Race', area: 'Machining B - Ball Race' };
    return { line: 'Lower Ball Joint', area: 'Machining B - Lower Ball Joint' };
  }

  // Area 6: Bottom-Middle & Right (Row >= 36, Col >= 7)
  if (row >= 36) {
    if (col <= 9) {
      if (row <= 50) return { line: 'Kayaba UBC Auto', area: 'Machining B - Kayaba UBC' };
      return { line: 'Kayaba UBC Manual', area: 'Machining B - Kayaba UBC' };
    }
    if (col <= 13) {
      if (row <= 50) return { line: 'Steering Stem - Mach Shaft', area: 'Line Assy Stem' };
      return { line: 'UB 6 & UB 7 (Kayaba)', area: 'Machining B - Kayaba' };
    }
    if (col <= 15) {
      if (row <= 50) return { line: 'UB 5 (Kayaba)', area: 'Machining B - Kayaba' };
      return { line: 'UB 6 & UB 7 (Kayaba)', area: 'Machining B - Kayaba' };
    }
    // Col >= 16
    if (row <= 50) return { line: 'Auto Assy Steering Stem', area: 'Line Assy Stem' };
    return { line: 'Manual Assy Steering Stem', area: 'Line Assy Stem' };
  }

  return { line: 'Machining B Area', area: 'Machining B Area' };
}

// Clean codes and parse all
const rawMachines = [];

shapes.forEach(s => {
  s.texts.forEach(t => {
    const trimmed = t.trim();
    // Split combined lines like "ST/39|ST/38" etc
    const tokens = trimmed.split(/[\r\n|]+/);
    tokens.forEach(tok => {
      let code = tok.trim();
      // standardize codes
      if (/^[A-Z]{2}\s*\/\s*\d+/i.test(code)) {
        code = code.replace(/\s+/g, '').toUpperCase();
        rawMachines.push({ code, row: s.fromRow, col: s.fromCol, color: s.color });
      } else if (/^ROBOT\s*ST\s*\/\s*\d+/i.test(code)) {
        code = code.replace(/\s+/g, '').replace('ROBOT', 'ROBOT-').toUpperCase();
        rawMachines.push({ code, row: s.fromRow, col: s.fromCol, color: s.color });
      } else if (/^KS\s*\/\s*\d+/i.test(code)) {
        code = code.replace(/\s+/g, '').toUpperCase();
        rawMachines.push({ code, row: s.fromRow, col: s.fromCol, color: s.color });
      } else if (/^PC\s*\/\s*\d+/i.test(code)) {
        code = code.replace(/\s+/g, '').toUpperCase();
        rawMachines.push({ code, row: s.fromRow, col: s.fromCol, color: s.color });
      } else if (/^UB\s*(\d+|R[0-9\-]+)/i.test(code)) {
        code = code.replace(/\s+/g, ' ').toUpperCase();
        rawMachines.push({ code, row: s.fromRow, col: s.fromCol, color: s.color });
      }
    });
  });
});

console.log('Total extracted machine tokens:', rawMachines.length);

// Deduplicate and group by code
const machineMap = new Map();

rawMachines.forEach(m => {
  if (!machineMap.has(m.code)) {
    const loc = getLineInfo(m.row, m.col);
    machineMap.set(m.code, {
      code: m.code,
      name: `Mesin ${m.code}`,
      lineName: loc.line,
      location: loc.area,
      status: m.color === 'FF0000' ? 'ABNORMAL' : (m.color === '00B050' ? 'RENEWED' : 'ACTIVE'),
      row: m.row,
      col: m.col
    });
  }
});

const finalList = Array.from(machineMap.values());
finalList.sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }));

console.log(`Unique machines: ${finalList.length}`);

// Group by Line
const byLine = {};
finalList.forEach(m => {
  byLine[m.lineName] = (byLine[m.lineName] || 0) + 1;
});
console.log('\nDistribution by Line:', byLine);

fs.writeFileSync(path.join(__dirname, '../extracted_xlsx/complete_machines_dataset.json'), JSON.stringify(finalList, null, 2));
console.log('\nSaved to complete_machines_dataset.json');
