export const rp = (n) => 'Rp ' + Number(n).toLocaleString('id-ID');

/**
 * Check if a date string falls within a period relative to today.
 * @param {string} dateStr - Date string (ISO or locale)
 * @param {'hari_ini'|'minggu_ini'|'bulan_ini'|'semua'|'all'|'today'|'7d'|'30d'} period
 * @returns {boolean}
 */
export const inPeriod = (dateStr, period) => {
  if (!period || period === 'semua' || period === 'all') return true;
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return false;
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  // Standard keys
  if (period === 'hari_ini' || period === 'today') return d >= startOfDay;
  if (period === 'minggu_ini') {
    const day = now.getDay() || 7;
    const startOfWeek = new Date(startOfDay);
    startOfWeek.setDate(startOfWeek.getDate() - day + 1);
    return d >= startOfWeek;
  }
  if (period === 'bulan_ini') {
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }
  // Simple day-diff keys (used by ApprovalPage)
  if (period === '7d' || period === '30d') {
    const diffDays = Math.floor((now - d) / 86400000);
    return diffDays <= (period === '7d' ? 7 : 30);
  }
  return true;
};

/**
 * Formats a string of numbers into a Rupiah currency format (e.g., "100.000").
 * @param {string} value - The number string to format.
 * @param {string} prefix - The currency prefix.
 * @returns {string} The formatted currency string.
 */
export const formatRupiah = (value, prefix = 'Rp ') => {
  if (value === null || value === undefined) return '';
  let number_string = String(value).replace(/[^,\d]/g, '').toString();
  let split = number_string.split(',');
  let sisa = split[0].length % 3;
  let rupiah = split[0].substr(0, sisa);
  let ribuan = split[0].substr(sisa).match(/\d{3}/gi);

  if (ribuan) {
    let separator = sisa ? '.' : '';
    rupiah += separator + ribuan.join('.');
  }

  rupiah = split[1] !== undefined ? rupiah + ',' + split[1] : rupiah;
  return prefix ? (rupiah ? 'Rp ' + rupiah : '') : rupiah;
};

/**
 * Parses a formatted Rupiah string back to a plain number.
 * @param {string} value - The formatted Rupiah string.
 * @returns {number} The parsed number.
 */
export const parseRupiah = (value) => {
  if (!value) return 0;
  return parseInt(String(value).replace(/[^0-9]/g, ''), 10) || 0;
};


export const STAGES = ['Diterima', 'Cuci', 'Setrika', 'Packing', 'Selesai'];

// Status colors — kalau update value, sync juga ke src/utils/statusMap.js (TX_STATUS, etc).
// Single source of truth untuk warna status badge di seluruh app.
export const STATUS_COLORS = {
  // Transaction status (UI)
  baru:        { bg: '#DBEAFE', text: '#2563EB' },
  proses:      { bg: '#E0F2FE', text: '#0EA5E9' },
  selesai:     { bg: '#DCFCE7', text: '#10B981' },
  diambil:     { bg: '#EDE9FE', text: '#5B21B6' },
  dibatalkan:  { bg: '#FEE2E2', text: '#DC2626' },

  // Payment status
  paid:        { bg: '#DCFCE7', text: '#10B981' },
  partial:     { bg: '#FEF3C7', text: '#F59E0B' },
  unpaid:      { bg: '#FEE2E2', text: '#DC2626' },

  // Membership tier
  Gold:        { bg: '#FEF9C3', text: '#92400E' },
  Silver:      { bg: '#F6F1F7', text: '#475569' },
  Regular:     { bg: '#F3E6F5', text: '#5B005F' },
  Premium:     { bg: '#FEF3C7', text: '#92400E' },

  // Approval / generic
  pending:          { bg: '#FEF3C7', text: '#F59E0B' },
  pending_approval: { bg: '#FEF3C7', text: '#F59E0B' },
  approved:         { bg: '#DCFCE7', text: '#10B981' },
  auto_approved:    { bg: '#DCFCE7', text: '#10B981' },
  revised:          { bg: '#FED7AA', text: '#9A3412' },
  rejected:         { bg: '#FEE2E2', text: '#DC2626' },
  fulfilled:        { bg: '#DCFCE7', text: '#15803D' },
  cancelled:        { bg: '#F3F4F6', text: '#6B7280' },

  // Urgency
  normal:      { bg: '#DBEAFE', text: '#1E40AF' },
  urgent:      { bg: '#FEF3C7', text: '#92400E' },
  critical:    { bg: '#FEE2E2', text: '#991B1B' },
};

/**
 * Compresses an image file and returns a base64 DataURL (JPEG).
 * @param {File} file - The image file to compress.
 * @param {number} [maxWidth=800] - Maximum width of the compressed image.
 * @param {number} [maxHeight=800] - Maximum height of the compressed image.
 * @param {number} [quality=0.7] - Quality of the JPEG (0 to 1).
 * @returns {Promise<string>}
 */
export const compressImage = (file, maxWidth = 800, maxHeight = 800, quality = 0.7) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target.result;
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = (err) => reject(err);
    };
    reader.onerror = (err) => reject(err);
  });
};

/**
 * Crops an image based on pixel coordinates and returns a base64 DataURL (JPEG).
 */
export const getCroppedImg = (imageSrc, pixelCrop, targetSize = 800, quality = 0.8) => {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.src = imageSrc;
    image.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = targetSize;
      canvas.height = targetSize;
      const ctx = canvas.getContext('2d');

      ctx.drawImage(
        image,
        pixelCrop.x,
        pixelCrop.y,
        pixelCrop.width,
        pixelCrop.height,
        0,
        0,
        targetSize,
        targetSize
      );

      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    image.onerror = (error) => reject(error);
  });
};

/** UUID transaksi untuk panggilan API (bukan no. nota tampilan). */
export const txApiId = (tx) => tx?.transactionUuid || tx?.transactionNo || tx?.id;

const PHOTO_TYPE_LABELS = {
  initial_condition: 'Kondisi terima',
  damage: 'Kerusakan / defect',
  packing_handover: 'Packing / serah',
  after_condition: 'Setelah cuci',
  before: 'Sebelum',
  after: 'Sesudah',
  note_only: 'Catatan',
};

export const photoTypeLabel = (type) => PHOTO_TYPE_LABELS[type] || type || 'Foto';


// ─── Text utilities ──────────────────────────────────────────────────────────
/**
 * Auto-kapitalisasi setiap awal kata. Cocok untuk nama orang, jalan, kota.
 * "perumahan griya jl. mawar 5" → "Perumahan Griya Jl. Mawar 5"
 */
export const titleCase = (str) => {
  if (!str) return '';
  return String(str)
    .split(/(\s+)/) // pertahankan spacing asli
    .map((part) => {
      if (!part.trim()) return part;
      return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
    })
    .join('');
};

/** Auto-kapitalisasi pertama dari string saja (untuk alamat detail) */
export const sentenceCase = (str) => {
  if (!str) return '';
  const trimmed = String(str);
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
};

/**
 * Format alamat: kapitalisasi tiap kata, pertahankan abbreviation seperti "Jl." "Rt." dll
 */
export const formatAlamat = (str) => {
  if (!str) return '';
  return titleCase(str)
    .replace(/\bJl\./gi, 'Jl.')
    .replace(/\bRt\.?\s?/gi, 'RT ')
    .replace(/\bRw\.?\s?/gi, 'RW ')
    .replace(/\bNo\./gi, 'No.')
    .replace(/\bBlok\b/gi, 'Blok')
    .replace(/\s{2,}/g, ' ') // collapse double spaces from dot removal
    .trim();
};

/** Harga satuan cart/nota — express = harga dasar × multiplier (default 2×). */
export function getCartUnitPrice(item) {
  const base = Number(item?.price) || 0;
  const isExpress = !!(item?.express || item?.isExpress);
  if (!isExpress) return base;
  const mul = Number(item?.expressMultiplier);
  return Math.round(base * (mul > 1 ? mul : 2));
}

/** Subtotal satu baris cart/nota. */
export function getCartLineSubtotal(item) {
  return getCartUnitPrice(item) * (Number(item?.qty) || 1);
}

/** Total baris item transaksi tersimpan (price di DB sudah harga final). */
export function getTransactionItemLineTotal(item) {
  if (item?.subtotal != null && item.subtotal !== '') return Number(item.subtotal);
  return (Number(item?.price) || 0) * (Number(item?.qty) || 1);
}
