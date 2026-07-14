#!/usr/bin/env node
/**
 * Token Enforcement Script v2
 * Scans source files for hardcoded hex colors that should use design tokens
 *
 * Usage:
 *   node scripts/check-hardcoded-colors.cjs          # Report only (exit 1 if violations)
 *   node scripts/check-hardcoded-colors.cjs --warn   # Report only (exit 0)
 *   node scripts/check-hardcoded-colors.cjs --fix    # Auto-fix with dry-run preview
 *   node scripts/check-hardcoded-colors.cjs --apply  # Apply fixes
 *
 * Files excluded: utils/theme.js, utils/colors.js, *.css, *.svg
 */

const fs = require('fs');
const path = require('path');

// Files/dirs to exclude
const EXCLUDE_PATTERNS = [
  'node_modules',
  '.git',
  'dist',
  'src/utils/theme.js',     // Token definitions
  'src/utils/colors.js',    // Token definitions
  'src/styles',            // CSS files
  'scripts',                // This script itself
];

// Known safe color values (don't need tokens)
const KNOWN_SAFE = new Set([
  'transparent',
  'inherit',
  'initial',
  'unset',
  'none',
  'currentColor',
  'rgba(0,0,0,0)',
  'rgba(255,255,255,0)',
]);

// Complete token mapping - hardcoded color → C.token
const TOKEN_MAP = {
  // Brand colors
  '#6e2e78': 'C.primary',
  '#5B005F': 'C.primaryStrong',
  '#8C4C8F': 'C.primaryHover',
  '#4D0051': 'C.primaryDark',
  '#3C0A63': 'C.primary',

  // Semantic
  '#10B981': 'C.success',
  '#059669': 'C.success',
  '#0f6e56': 'C.success',
  '#22C55E': 'C.success',
  '#F59E0B': 'C.warning',
  '#D97706': 'C.warning',
  '#FEF3C7': 'C.warningBg',
  '#DC2626': 'C.danger',
  '#EF4444': 'C.danger',
  '#E11D48': 'C.danger',
  '#FECACA': 'C.dangerBg',
  '#FEE2E2': 'C.dangerBg',

  // Neutral
  '#9CA3AF': 'C.n400',
  '#6B7280': 'C.n500',
  '#64748B': 'C.n500',
  '#E5E7EB': 'C.n200',
  '#D1D5DB': 'C.n200',
  '#F3F4F6': 'C.n100',
  '#F9FAFB': 'C.n50',
  '#111827': 'C.n800',
  '#1F2937': 'C.n700',
  '#374151': 'C.n600',
  '#FFFFFF': 'C.white',
  '#000000': 'C.black',

  // Material colors (keep as-is, specific to materials)
  // Skip: #EC4899, #F472B6 (pink/magenta - material specific)
  // Skip: #06B6D4 (cyan - material specific)
  // Skip: #14B8A6 (teal - material specific)
  // Skip: #3B82F6 (blue - material specific)
  // Skip: #F97316 (orange - action)

  // Info
  '#0891B2': 'C.info',
  '#06B6D4': 'C.info',
  '#0284C7': 'C.info',
  '#0EA5E9': 'C.info',

  // Validation
  '#FEF2F2': 'C.dangerBg',
  '#FCA5A5': 'C.dangerDark',
  '#991B1B': 'C.dangerDark',
};

// Skip these files (special cases)
const SKIP_FILES = new Set([
  'DetailCustomerPage.jsx',  // Special gradient theme
  'LoginPage.jsx',          // Decorative elements
]);

// Track statistics
let stats = {
  filesScanned: 0,
  violations: 0,
  fixes: 0,
  errors: 0,
};

function shouldExclude(filePath) {
  for (const pattern of EXCLUDE_PATTERNS) {
    if (filePath.includes(pattern)) return true;
  }
  return false;
}

function findFiles(dir, ext = ['.js', '.jsx']) {
  const files = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...findFiles(fullPath, ext));
    } else if (entry.isFile()) {
      const extMatch = ext.some(e => entry.name.endsWith(e));
      if (extMatch && !shouldExclude(fullPath)) {
        files.push(fullPath);
      }
    }
  }
  return files;
}

function normalizeColor(hex) {
  return hex.toUpperCase();
}

function findViolations(content) {
  const violations = [];

  // Match hex colors: #RGB or #RRGGBB
  const hexRegex = /#([0-9A-Fa-f]{3}){1,2}\b/g;
  const lines = content.split('\n');

  lines.forEach((line, idx) => {
    // Skip CSS content (style tags in JSX)
    if (line.includes('<style') || line.includes('.css') || line.includes('{`') || line.includes('`}')) {
      return;
    }

    // Skip comments
    const cleanLine = line.replace(/\/\/.*$/, '').replace(/'[^']*'|"[^"]*"/g, '');

    let match;
    while ((match = hexRegex.exec(cleanLine)) !== null) {
      const color = match[0];
      const upperColor = normalizeColor(color);

      if (KNOWN_SAFE.has(upperColor)) continue;

      const token = TOKEN_MAP[upperColor];
      if (token) {
        violations.push({
          line: idx + 1,
          color,
          token,
          context: line.trim().substring(0, 100),
        });
      }
    }
  });

  return violations;
}

function applyFixes(content, violations) {
  let result = content;
  const replacements = [];

  for (const v of violations) {
    // Only replace if the token appears in the same context
    // Be careful with regex to avoid breaking URLs or other patterns
    const safeRegex = new RegExp(
      `(?:style[^{]*|[:=]\\s*)['"\`]?${v.color}['"\`]?(?=[\\s,;})\\'\\"\\)]|$)`,
      'g'
    );

    const newContent = result.replace(safeRegex, (match, prefix) => {
      if (prefix) {
        replacements.push({ from: v.color, to: v.token });
        return prefix + v.token;
      }
      return v.token;
    });

    if (newContent !== result) {
      result = newContent;
      stats.fixes++;
    }
  }

  return { content: result, replacements };
}

function processFile(filePath, dryRun = false) {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    stats.filesScanned++;

    const violations = findViolations(content);
    stats.violations += violations.length;

    if (violations.length > 0 && !dryRun) {
      const { content: newContent, replacements } = applyFixes(content, violations);
      if (replacements.length > 0) {
        console.log(`\n📁 ${path.relative(process.cwd(), filePath)}`);
        replacements.forEach(r => {
          console.log(`  ${r.from} → ${r.to}`);
        });
        fs.writeFileSync(filePath, newContent);
      }
    }

    return violations;
  } catch (err) {
    stats.errors++;
    console.error(`❌ Error processing ${filePath}: ${err.message}`);
    return [];
  }
}

function main() {
  const args = process.argv.slice(2);
  const mode = args[0] === '--fix' ? 'fix'
    : args[0] === '--apply' ? 'apply'
    : 'report';

  console.log('\n🎨 Token Enforcement Script v2');
  console.log('='.repeat(50));
  console.log(`Mode: ${mode}`);
  console.log('');

  const files = findFiles(path.join(__dirname, '..', 'src'));
  console.log(`Found ${files.length} files to scan\n`);

  const allViolations = {};

  for (const file of files) {
    const violations = processFile(file, mode === 'report');
    if (violations.length > 0) {
      allViolations[file] = violations;
    }
  }

  // Summary
  console.log('\n📊 Summary');
  console.log('-'.repeat(50));
  console.log(`Files scanned: ${stats.filesScanned}`);
  console.log(`Total violations: ${stats.violations}`);
  console.log(`Fixes applied: ${stats.fixes}`);
  console.log(`Errors: ${stats.errors}`);

  if (mode === 'report') {
    // Group by color
    const colorCount = {};
    Object.values(allViolations).flat().forEach(v => {
      const color = normalizeColor(v.color);
      colorCount[color] = (colorCount[color] || 0) + 1;
    });

    console.log('\n🔴 Top Violations by Color:');
    Object.entries(colorCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .forEach(([color, count]) => {
        const token = TOKEN_MAP[color] || '/* unknown */';
        console.log(`  ${color} (${count}x) → ${token}`);
      });

    console.log('\n💡 Run with --fix to auto-apply safe replacements');
  }

  if (mode !== 'report' && stats.fixes > 0) {
    console.log(`\n✅ Applied ${stats.fixes} fixes`);
  }

  console.log('');
  process.exit(stats.errors > 0 ? 1 : 0);
}

main();
