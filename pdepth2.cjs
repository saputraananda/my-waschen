const fs = require('fs');
const src = fs.readFileSync('src/pages/kasir/NotaStep3Page.jsx', 'utf8');
const lines = src.split('\n');
let pdepth = 0;
let instr = false;
let strChar = '';
let escape = false;

for (let i = 0; i < lines.length; i++) {
  const l = lines[i];
  for (let j = 0; j < l.length; j++) {
    const c = l[j];
    const n = l[j + 1];

    // String handling
    if (!instr && (c === '"' || c === "'" || c === '`')) {
      instr = true;
      strChar = c;
    } else if (instr && c === strChar && !escape) {
      instr = false;
      strChar = '';
    } else if (instr && c === '\\') {
      escape = !escape;
    } else if (!instr) {
      // Parens only
      if (c === '(') pdepth++;
      else if (c === ')') pdepth--;
    }
  }
  // Print key transition points
  if (i >= 1030 && i <= 1605) {
    if (pdepth !== 0 || i < 1040) {
      console.log(i + 1, 'pd=' + pdepth, l.substring(0, 70));
    }
  }
}
console.log('final pd=' + pdepth);
