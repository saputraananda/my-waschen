const fs = require('fs');
const lines = fs.readFileSync('src/pages/kasir/NotaStep3Page.jsx', 'utf8').split('\n');
let tagDepth = 0; // JSX element depth
let parenDepth = 0;
let inStr = false;
let strChar = '';
let escape = false;
for (let i = 0; i < lines.length; i++) {
  const l = lines[i];
  for (let j = 0; j < l.length; j++) {
    const c = l[j];
    const next = l[j + 1];
    if (!inStr && (c === '"' || c === "'" || c === '`')) { inStr = true; strChar = c; escape = false; }
    else if (inStr && !escape && c === strChar) { inStr = false; strChar = ''; }
    else if (inStr && c === '\\') { escape = !escape; }
    else if (!inStr) {
      // Closing JSX tag </tag>
      if (c === '<' && next === '/') {
        tagDepth--; j += 2;
      }
      // Self-closing tag <tag/>
      else if (c === '<' && l.indexOf('/>', j + 1) === j + 1) {
        // Already consumed below
      }
      // Opening tag <tag> or <tag ...>
      else if (c === '<') {
        tagDepth++; j++;
      }
      // Self-closing />
      else if (c === '/' && next === '>') {
        j++;
      }
      // Regular >
      else if (c === '>') {
        // close the tag opened by <
      }
      // Bracket depth
      else if (c === '(' || c === '[' || c === '{') { parenDepth++; }
      else if (c === ')' || c === ']' || c === '}') { parenDepth--; }
    }
  }
  if (i >= 1540 && i <= 1600) {
    console.log(i + 1, 't=' + tagDepth + ' p=' + parenDepth, l.substring(0, 70));
  }
}
console.log('final t=' + tagDepth + ' p=' + parenDepth);
