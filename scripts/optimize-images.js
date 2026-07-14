/**
 * Image Optimizer Script
 * Converts PNG images to WebP format to reduce file size
 *
 * Usage: node scripts/optimize-images.js
 *
 * Dependencies: npm install --save-dev png-to-webp
 * Or use: npx png-to-webp
 */

const fs = require('fs');
const path = require('path');

// Configuration
const ASSETS_DIR = path.join(__dirname, 'src/assets');
const QUALITY = 85; // WebP quality (0-100)
const MAX_DIMENSION = 800; // Max width/height for icons

// File size stats
let stats = {
  totalFiles: 0,
  totalSizeBefore: 0,
  totalSizeAfter: 0,
  converted: 0,
  skipped: 0,
};

/**
 * Recursively find all PNG files
 */
function findPngFiles(dir) {
  const files = [];
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
 * Get file size in human readable format
 */
function formatSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
}

/**
 * Convert PNG to WebP using Canvas API (in browser) or System tools
 */
async function convertToWebP(inputPath, outputPath) {
  const inputSize = fs.statSync(inputPath).size;

  try {
    // Try using sharp if available
    if (process.env.USE_SHARP === 'true') {
      const sharp = require('sharp');
      await sharp(inputPath)
        .resize(MAX_DIMENSION, MAX_DIMENSION, { fit: 'inside', withoutEnlargement: true })
        .webp({ quality: QUALITY })
        .toFile(outputPath);
      return true;
    }

    // Fallback: copy PNG as WebP (placeholder - user should use online converter)
    // This is just for reference - actual conversion needs tools
    console.log(`  ⚠️  Manual conversion needed for: ${path.basename(inputPath)}`);
    console.log(`      Current: ${formatSize(inputSize)}`);
    console.log(`      Suggested: Use https://cloudconvert.com/png-to-webp`);
    return false;

  } catch (error) {
    console.error(`  ❌ Error: ${error.message}`);
    return false;
  }
}

/**
 * Process all PNG files
 */
async function processImages() {
  console.log('\n🖼️  Image Optimizer - PNG to WebP Converter');
  console.log('═'.repeat(50));

  const pngFiles = findPngFiles(ASSETS_DIR);

  if (pngFiles.length === 0) {
    console.log('No PNG files found!');
    return;
  }

  console.log(`\n📁 Found ${pngFiles.length} PNG files\n`);

  for (const pngFile of pngFiles) {
    const relativePath = path.relative(ASSETS_DIR, pngFile);
    const dir = path.dirname(relativePath);
    const fileName = path.basename(pngFile, '.png');
    const webpFile = path.join(ASSETS_DIR, dir, fileName + '.webp');

    stats.totalFiles++;
    const fileSize = fs.statSync(pngFile).size;
    stats.totalSizeBefore += fileSize;

    process.stdout.write(`📦 ${relativePath} (${formatSize(fileSize)})`);

    // Check if WebP already exists
    if (fs.existsSync(webpFile)) {
      console.log(' → ⏭️  Skipped (WebP exists)');
      stats.skipped++;
      continue;
    }

    // Try to convert
    const success = await convertToWebP(pngFile, webpFile);

    if (success) {
      const newSize = fs.statSync(webpFile).size;
      const saved = fileSize - newSize;
      const savedPercent = ((saved / fileSize) * 100).toFixed(1);
      stats.totalSizeAfter += newSize;
      stats.converted++;

      console.log(` → ✅ WebP created (${formatSize(newSize)}, saved ${savedPercent}%)`);
    } else {
      console.log('');
    }
  }

  // Summary
  console.log('\n' + '═'.repeat(50));
  console.log('\n📊 Summary:');
  console.log(`   Total files: ${stats.totalFiles}`);
  console.log(`   Converted: ${stats.converted}`);
  console.log(`   Skipped: ${stats.skipped}`);
  console.log(`   Size before: ${formatSize(stats.totalSizeBefore)}`);
  if (stats.totalSizeAfter > 0) {
    console.log(`   Size after: ${formatSize(stats.totalSizeAfter)}`);
    console.log(`   Total saved: ${formatSize(stats.totalSizeBefore - stats.totalSizeAfter)}`);
  }
  console.log('\n✨ Done!\n');
}

// Run
processImages().catch(console.error);
