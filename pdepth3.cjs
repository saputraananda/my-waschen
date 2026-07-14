const fs = require('fs');
const src = fs.readFileSync('src/pages/kasir/NotaStep3Page.jsx', 'utf8');
const lines = src.split('\n');
let pdepth = 0;
let inStr = false;
let strChar = '';
for (let i = 0; i < lines.length; i++) {
  const l = lines[i];
  for (let j = 0; j < l.length; j++) {
    const c = l[j];
    const n = l[j + 1];
    // String entry/exit
    if (!inStr && (c === '"' || c === "'" || c === '`')) { inStr = true; strChar = c; }
    else if (inStr && c === strChar) { inStr = false; strChar = ''; }
    else if (!inStr) {
      if (c === '(') { pdepth++; }
      else if (c === ')') { pdepth--; }
    }
  }
  // Track when depth goes negative (extra ')') or stays positive after ) where it shouldn't
  if (i >= 1033 && i <= 1080) {
    const opens = (l.match(/\(/g) || []).length;
    const closes = (l.match(/\)/g) || []).length;
    console.log(i + 1, 'd=' + pdepth, 'o=' + opens, 'c=' + closes, l.substring(0, 60));
  }
}
console.log('final d=' + pdepth);
