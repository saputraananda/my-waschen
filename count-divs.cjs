const fs = require('fs');
const content = fs.readFileSync('src/pages/kasir/NotaStep3Page.jsx', 'utf8');

// Proper JSX parsing - track depth correctly
let depth = 0;
let i = 0;
let inComponent = false;
let componentStart = 0;
let minDepth = 0;
let minDepthPos = 0;

while(i < content.length) {
  // Skip strings
  if(content[i] === '"' || content[i] === "'" || content[i] === '`') {
    const quote = content[i++];
    while(i < content.length && content[i] !== quote) {
      if(content[i] === '\\') i++;
      i++;
    }
    i++;
    continue;
  }

  // Skip comments
  if(content.substring(i, i+4) === '<!--') {
    i += 4;
    while(i < content.length && content.substring(i, i+3) !== '-->') i++;
    i += 3;
    continue;
  }

  // Track component start
  if(content.substring(i, i+21) === 'export default function') {
    inComponent = true;
    componentStart = i;
  }

  // Check for div tags (only inside component)
  if(inComponent && content.substring(i, i+4) === '<div') {
    if(content.substring(i, i+5) === '</div') {
      depth--;
      i += 5;
    } else {
      depth++;
      i += 4;
      while(i < content.length && content[i] !== '>') i++;
      i++;
    }
    if(depth < minDepth) {
      minDepth = depth;
      minDepthPos = i;
    }
    continue;
  }

  i++;
}

console.log('In component:', inComponent);
console.log('Final div depth:', depth);
console.log('Min depth reached:', minDepth);
