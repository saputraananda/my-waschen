// ─────────────────────────────────────────────────────────────────────────────
// Image Upload Helper — consistent compression, validation, & error handling
// ─────────────────────────────────────────────────────────────────────────────
import { compressImage } from './helpers';

/**
 * Upload presets — different size/quality for different use cases
 */
export const UPLOAD_PRESETS = {
  // Avatar/photo profile — small, high quality
  avatar:        { maxWidth: 400,  maxHeight: 400,  quality: 0.85, maxBytes: 200 * 1024 },
  // Photo kondisi laundry — medium, decent quality (untuk dokumentasi)
  documentation: { maxWidth: 1024, maxHeight: 1024, quality: 0.75, maxBytes: 800 * 1024 },
  // Receipt / bukti transaksi — small to avoid data URL overflow
  receipt:      { maxWidth: 640,  maxHeight: 640,  quality: 0.65, maxBytes: 400 * 1024 },
  // Damage report — high quality (bukti hukum/klaim)
  damage:        { maxWidth: 1600, maxHeight: 1600, quality: 0.85, maxBytes: 2 * 1024 * 1024 },
  // Thumbnail — sangat kecil
  thumbnail:     { maxWidth: 200,  maxHeight: 200,  quality: 0.7,  maxBytes: 50 * 1024 },
};

const MAX_INPUT_SIZE = 15 * 1024 * 1024; // 15MB raw input limit

const ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];

/**
 * Validate dan compress image file dengan preset.
 *
 * @param {File} file - File from <input type="file">
 * @param {string|object} preset - Key dari UPLOAD_PRESETS atau custom config
 * @returns {Promise<{ dataUrl: string, sizeKb: number, originalSizeKb: number, ratio: number }>}
 */
export async function uploadImage(file, preset = 'documentation') {
  if (!file) throw new Error('Tidak ada file yang dipilih.');

  // Validation
  if (!file.type || !ALLOWED_TYPES.some(t => file.type.toLowerCase().includes(t.split('/')[1]))) {
    throw new Error('Format file tidak didukung. Gunakan JPG, PNG, atau WebP.');
  }
  if (file.size > MAX_INPUT_SIZE) {
    throw new Error(`Ukuran file terlalu besar (maks ${Math.round(MAX_INPUT_SIZE / 1024 / 1024)}MB).`);
  }

  // Get preset config
  const cfg = typeof preset === 'string' ? UPLOAD_PRESETS[preset] : preset;
  if (!cfg) throw new Error(`Preset "${preset}" tidak valid.`);

  const originalSizeKb = Math.round(file.size / 1024);

  // Compress — try catch wrapper for better error messages
  let dataUrl;
  try {
    dataUrl = await compressImage(file, cfg.maxWidth, cfg.maxHeight, cfg.quality);
  } catch (e) {
    throw new Error(e?.message || 'Gagal memproses gambar. Coba lagi dengan foto lain.');
  }

  // Validate result
  if (!dataUrl || !dataUrl.startsWith('data:image/')) {
    throw new Error('Hasil kompresi gambar tidak valid. Coba lagi.');
  }

  // Verify size
  const sizeKb = Math.round((dataUrl.length * 3 / 4) / 1024); // base64 → bytes ≈ length * 3/4
  const sizeBytes = Math.round(dataUrl.length * 3 / 4);

  // Re-compress lebih agresif kalau masih over budget
  if (cfg.maxBytes && sizeBytes > cfg.maxBytes) {
    const reducedQuality = Math.max(0.4, cfg.quality - 0.2);
    const reducedSize = Math.max(400, Math.floor(cfg.maxWidth * 0.7));
    dataUrl = await compressImage(file, reducedSize, reducedSize, reducedQuality);
  }

  const finalSizeKb = Math.round((dataUrl.length * 3 / 4) / 1024);
  const ratio = originalSizeKb > 0 ? Math.round((1 - finalSizeKb / originalSizeKb) * 100) : 0;

  return {
    dataUrl,
    sizeKb: finalSizeKb,
    originalSizeKb,
    ratio,
  };
}

/**
 * Upload multiple files dengan progress callback.
 *
 * @param {File[]} files
 * @param {string} preset
 * @param {(idx, total, result) => void} onProgress
 * @returns {Promise<Array>}
 */
export async function uploadMultipleImages(files, preset = 'documentation', onProgress) {
  const results = [];
  for (let i = 0; i < files.length; i++) {
    try {
      const result = await uploadImage(files[i], preset);
      results.push({ ...result, name: files[i].name, success: true });
    } catch (err) {
      results.push({ name: files[i].name, success: false, error: err.message });
    }
    if (typeof onProgress === 'function') {
      onProgress(i + 1, files.length, results[results.length - 1]);
    }
  }
  return results;
}

/**
 * Format file size for display
 */
export function formatFileSize(kb) {
  if (kb < 1024) return `${Math.round(kb)} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
}
