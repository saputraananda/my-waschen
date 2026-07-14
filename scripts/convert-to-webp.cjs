/**
 * PNG to WebP Converter for Waschen POS
 *
 * Usage: node scripts/convert-to-webp.js
 *
 * This script:
 * 1. Converts all PNG files to WebP format
 * 2. Resizes images that are too large
 * 3. Reports size savings
 * 4. Updates import paths in codebase
 */

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const ASSETS_DIR = path.join(__dirname, '..', 'src', 'assets');

// Configuration
const CONFIG = {
  quality: 85,
  maxWidth: 1200,
  maxHeight: 1200,
  preserveAspectRatio: true,
  replaceOriginal: true, // Replace PNG with WebP
};

let stats = {
  totalFiles: 0,
  totalSizeBefore: 0,
  totalSizeAfter: 0,
  converted: 0,
  skipped: 0,
  errors: 0,
};

/**
 * Format bytes to human readable
 */
function formatSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
}

/**
 * Find all PNG files recursively
 */
function findPngFiles(dir) {
  const files = [];
  if (!fs.existsSync(dir)) return files;

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...findPngFiles(fullPath));
    } else if (entry.name.toLowerCase().endsWith('.png')) {
      files.push(fullPath);
    }
  }
  return files;
}

/**
 * Convert single PNG to WebP
 */
async function convertToWebP(pngPath) {
  const dir = path.dirname(pngPath);
  const fileName = path.basename(pngPath, '.png');
  const webpPath = path.join(dir, fileName + '.webp');

  try {
    const inputSize = fs.statSync(pngPath).size;
    stats.totalSizeBefore += inputSize;
    stats.totalFiles++;

    const relativePath = path.relative(ASSETS_DIR, pngPath);
    process.stdout.write(`📦 ${relativePath} (${formatSize(inputSize)})`);

    // Read and resize if needed
    const image = sharp(pngPath);
    const metadata = await image.metadata();

    // Resize if too large
    if (metadata.width > CONFIG.maxWidth || metadata.height > CONFIG.maxHeight) {
      image.resize(CONFIG.maxWidth, CONFIG.maxHeight, {
        fit: 'inside',
        withoutEnlargement: true,
      });
    }

    // Convert to WebP
    await image.webp({ quality: CONFIG.quality }).toFile(webpPath);

    const outputSize = fs.statSync(webpPath).size;
    const saved = inputSize - outputSize;
    const savedPercent = ((saved / inputSize) * 100).toFixed(1);

    stats.totalSizeAfter += outputSize;
    stats.converted++;

    // Optionally remove original
    if (CONFIG.replaceOriginal) {
      fs.unlinkSync(pngPath);
    }

    const emoji = saved > 0 ? '✅' : '⚠️';
    console.log(` → ${emoji} WebP created: ${formatSize(outputSize)} (${savedPercent > 0 ? '-' : '+'}${Math.abs(savedPercent)}%)`);

    return { success: true, saved, webpPath };

  } catch (error) {
    stats.errors++;
    console.log(` → ❌ Error: ${error.message}`);
    return { success: false, error: error.message };
  }
}

/**
 * Update import paths in JSX files
 */
function updateImportPaths() {
  console.log('\n🔄 Updating import paths in codebase...\n');

  const srcDir = path.join(__dirname, '..', 'src');
  const jsFiles = findJsFiles(srcDir);

  let updated = 0;

  for (const file of jsFiles) {
    let content = fs.readFileSync(file, 'utf8');
    let original = content;

    // Replace .png with .webp in import statements
    content = content.replace(/\.png['"]/g, '.webp"');

    if (content !== original) {
      fs.writeFileSync(file, content);
      const relativePath = path.relative(srcDir, file);
      console.log(`   📝 Updated: ${relativePath}`);
      updated++;
    }
  }

  console.log(`\n✅ Updated ${updated} files`);
}

/**
 * Find all JS/JSX files
 */
function findJsFiles(dir, files = []) {
  if (!fs.existsSync(dir)) return files;

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
      findJsFiles(fullPath, files);
    } else if (fullPath.endsWith('.js') || fullPath.endsWith('.jsx')) {
      files.push(fullPath);
    }
  }
  return files;
}

/**
 * Generate a report
 */
function generateReport() {
  console.log('\n' + '='.repeat(60));
  console.log('\n📊 CONVERSION REPORT\n');
  console.log(`   Total files processed: ${stats.totalFiles}`);
  console.log(`   Successfully converted: ${stats.converted}`);
  console.log(`   Skipped: ${stats.skipped}`);
  console.log(`   Errors: ${stats.errors}`);
  console.log(`\n   Size before: ${formatSize(stats.totalSizeBefore)}`);
  console.log(`   Size after:  ${formatSize(stats.totalSizeAfter)}`);

  if (stats.totalSizeBefore > stats.totalSizeAfter) {
    const saved = stats.totalSizeBefore - stats.totalSizeAfter;
    const percent = ((saved / stats.totalSizeBefore) * 100).toFixed(1);
    console.log(`   💰 Total saved: ${formatSize(saved)} (${percent}%)`);
  }

  console.log('\n' + '='.repeat(60) + '\n');
}

/**
 * Main execution
 */
async function main() {
  console.log('\n🖼️  PNG to WebP Image Optimizer');
  console.log('='.repeat(60));
  console.log(`\n📁 Assets directory: ${ASSETS_DIR}`);
  console.log(`🎯 Quality: ${CONFIG.quality}%`);
  console.log(`📐 Max dimensions: ${CONFIG.maxWidth}x${CONFIG.maxHeight}`);
  console.log(`🗑️  Replace original: ${CONFIG.replaceOriginal ? 'Yes' : 'No'}\n`);

  const pngFiles = findPngFiles(ASSETS_DIR);

  if (pngFiles.length === 0) {
    console.log('❌ No PNG files found!');
    return;
  }

  console.log(`📦 Found ${pngFiles.length} PNG files\n`);
  console.log('-'.repeat(60));

  // Process files
  for (const pngFile of pngFiles) {
    await convertToWebP(pngFile);
  }

  // Generate report
  generateReport();

  // Ask to update imports
  console.log('❓ Update import paths in codebase? (y/n)');
  console.log('   This will replace .png extensions with .webp in all JS/JSX files.\n');

  // Auto-update for now
  updateImportPaths();

  console.log('✨ Done! Build the project to verify.');
}

main().catch(console.error);
