const fs = require('fs');
let src = fs.readFileSync('src/pages/kasir/NotaStep3Page.jsx', 'utf8');
let lines = src.split('\n');
let pdepth = 0, instr = false, str = '', esc = false;
for (let i = 0; i < lines.length; i++) {
  const l = lines[i];
  for (let j = 0; j < l.length; j++) {
    const c = l[j];
    if (!instr && (c === '"' || c === "'" || c === '`')) { instr = true; str = c; }
    else if (instr && c === str && !esc) { instr = false; str = ''; }
    else if (instr && c === '\\') { esc = !esc; }
    else if (!instr) {
      if (c === '(') pdepth++;
      else if (c === ')') pdepth--;
    }
  }
  if (i >= 990 && i <= 1075 && pdepth !== 0) {
    console.log(i + 1, 'pd=' + pdepth, l.substring(0, 80));
  }
}
console.log('final pd=' + pdepth);
