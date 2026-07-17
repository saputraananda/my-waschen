/**
 * Script untuk compress gambar di src/assets/
 * Usage: node scripts/compress-images.cjs
 *
 * Dependensi yang dibutuhkan:
 * npm install sharp glob
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Check if sharp is available
let sharp;
try {
  sharp = require('sharp');
  console.log('✓ Sharp ditemukan, akan compress gambar...\n');
} catch (e) {
  console.log('⚠ Sharp tidak ditemukan. Install dengan: npm install sharp\n');
  console.log('Akan coba alternatif dengan jimp atau skip...\n');
  sharp = null;
}

const GLOB_PATTERN = 'src/assets/**/*.webp';
const OUTPUT_DIR = 'src/assets-optimized';

// Target sizes (mengikuti standar icon lucide: 16, 18, 20, 22, 24, 32)
const ICON_SIZES = {
  xs: 16,
  sm: 18,
  md: 20,
  lg: 22,
  xl: 24,
  '2xl': 32,
};

// Kategori folder
const CATEGORIES = [
  'Icon and Asset Laundry',
  'Decorative icon',
  'Avatar set',
  'karakter Perempuan',
];

// Quality settings
const QUALITY = {
  webp: 80, // 80% quality WebP
  jpg: 85,
};

// Files to skip (already small or decorative)
const SKIP_FILES = [
  'LoginPage.jsx',
];

function getFiles(dir, pattern) {
  const files = [];
  const items = fs.readdirSync(dir, { withFileTypes: true });

  for (const item of items) {
    const fullPath = path.join(dir, item.name);
    if (item.isDirectory()) {
      files.push(...getFiles(fullPath, pattern));
    } else if (item.isFile() && item.name.endsWith('.webp')) {
      files.push(fullPath);
    }
  }
  return files;
}

function getOutputPath(inputPath) {
  const relative = path.relative('src/assets', inputPath);
  return path.join(OUTPUT_DIR, relative.replace('.webp', '-icon.webp'));
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

async function compressImage(inputPath, outputPath, targetWidth = null) {
  if (!sharp) {
    console.log(`⏭ Skip (sharp not available): ${path.basename(inputPath)}`);
    return false;
  }

  try {
    ensureDir(path.dirname(outputPath));

    let pipeline = sharp(inputPath);

    // Resize if target width specified
    if (targetWidth) {
      const metadata = await sharp(inputPath).metadata();
      if (metadata.width > targetWidth) {
        pipeline = pipeline.resize(targetWidth, null, {
          fit: 'inside',
          withoutEnlargement: true,
        });
      }
    }

    await pipeline
      .webp({ quality: QUALITY.webp })
      .toFile(outputPath);

    const inputSize = fs.statSync(inputPath).size;
    const outputSize = fs.statSync(outputPath).size;
    const savings = ((inputSize - outputSize) / inputSize * 100).toFixed(1);

    console.log(
      `✓ ${path.basename(inputPath)}: ${(inputSize / 1024).toFixed(1)}KB → ${(outputSize / 1024).toFixed(1)}KB (${savings}% saved)`
    );
    return true;
  } catch (err) {
    console.log(`✗ Error compressing ${inputPath}: ${err.message}`);
    return false;
  }
}

async function createIconVariants(inputPath, baseOutputDir) {
  if (!sharp) return;

  const name = path.basename(inputPath, '.webp');

  for (const [sizeName, size] of Object.entries(ICON_SIZES)) {
    const outputPath = path.join(baseOutputDir, `${name}-${size}.webp`);
    await compressImage(inputPath, outputPath, size);
  }
}

async function main() {
  console.log('🖼️  Image Compression Script untuk Waschen\n');
  console.log('=' .repeat(50));

  // Show current stats
  console.log('\n📊 Status Gambar Saat Ini:\n');

  for (const category of CATEGORIES) {
    const categoryPath = path.join('src/assets', category);
    if (!fs.existsSync(categoryPath)) continue;

    const files = fs.readdirSync(categoryPath).filter(f => f.endsWith('.webp'));
    const totalSize = files.reduce((sum, f) => {
      return sum + fs.statSync(path.join(categoryPath, f)).size;
    }, 0);

    console.log(`  ${category}: ${files.length} files, ${(totalSize / 1024 / 1024).toFixed(2)}MB`);
  }

  console.log('\n' + '=' .repeat(50));
  console.log('\n🚀 Memulai compression...\n');

  // Process Icon and Asset Laundry with icon sizes
  const iconDir = path.join('src/assets', 'Icon and Asset Laundry');
  if (fs.existsSync(iconDir)) {
    console.log('\n📦 Processing Icon and Asset Laundry (creating icon variants)...\n');

    for (const file of fs.readdirSync(iconDir)) {
      if (!file.endsWith('.webp')) continue;
      if (SKIP_FILES.includes(file)) continue;

      const inputPath = path.join(iconDir, file);
      const outputDir = path.join(OUTPUT_DIR, 'Icon and Asset Laundry');

      // Create multiple size variants
      await createIconVariants(inputPath, outputDir);
    }
  }

  // Process Decorative icons (keep original, just compress)
  const decorDir = path.join('src/assets', 'Decorative icon');
  if (fs.existsSync(decorDir)) {
    console.log('\n✨ Processing Decorative icons...\n');

    for (const file of fs.readdirSync(decorDir)) {
      if (!file.endsWith('.webp')) continue;

      const inputPath = path.join(decorDir, file);
      const outputPath = path.join(OUTPUT_DIR, 'Decorative icon', file);

      await compressImage(inputPath, outputPath);
    }
  }

  console.log('\n' + '=' .repeat(50));
  console.log('\n✅ Compression selesai!\n');

  // Show summary
  if (fs.existsSync(OUTPUT_DIR)) {
    const outputFiles = getFiles(OUTPUT_DIR, '*.webp');
    const totalOutputSize = outputFiles.reduce((sum, f) => {
      return sum + fs.statSync(f).size;
    }, 0);

    console.log('📊 Hasil Compression:\n');
    console.log(`  Total files: ${outputFiles.length}`);
    console.log(`  Output dir: ${OUTPUT_DIR}/`);
    console.log(`  Estimated size: ${(totalOutputSize / 1024 / 1024).toFixed(2)}MB`);
  }
}

// Run
main().catch(console.error);
