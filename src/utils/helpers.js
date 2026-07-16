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


export const STAGES = ['Diterima', 'Packing', 'Selesai'];

// Status colors — Design System v1.0 (Juni 2026)
// Single source of truth untuk warna status badge di seluruh app.
export const STATUS_COLORS = {
  // Transaction status (UI)
  baru:        { bg: '#f5eef7', text: '#5B005F', border: '#d9b8e0' },
  proses:      { bg: '#f0ecf2', text: '#5a5a5a', border: '#d4cad8' },
  selesai:     { bg: '#e1f5ee', text: '#0f6e56', border: '#86efac' },
  diambil:     { bg: '#e1f5ee', text: '#0f6e56', border: '#86efac' },
  dibatalkan:  { bg: '#fce8eb', text: '#a32d2d', border: '#fca5a5' },

  // Payment status
  paid:        { bg: '#e1f5ee', text: '#0f6e56', border: '#86efac' },
  partial:     { bg: '#fef3e2', text: '#ba7517', border: '#f5c27a' },
  unpaid:      { bg: '#fce8eb', text: '#a32d2d', border: '#fca5a5' },

  // Membership tier
  Gold:        { bg: '#fef3e2', text: '#ba7517', border: '#f5c27a' },
  Silver:      { bg: '#f0ecf2', text: '#5a5a5a', border: '#d4cad8' },
  Regular:     { bg: '#f7f5f8', text: '#9a9a9a', border: '#e8e2ea' },
  Premium:     { bg: '#f5eef7', text: '#5B005F', border: '#d9b8e0' },

  // Approval / generic
  pending:          { bg: '#fef3e2', text: '#ba7517', border: '#f5c27a' },
  pending_approval:  { bg: '#fef3e2', text: '#ba7517', border: '#f5c27a' },
  approved:          { bg: '#e1f5ee', text: '#0f6e56', border: '#86efac' },
  auto_approved:     { bg: '#e1f5ee', text: '#0f6e56', border: '#86efac' },
  revised:           { bg: '#fef3e2', text: '#ba7517', border: '#f5c27a' },
  rejected:          { bg: '#fce8eb', text: '#a32d2d', border: '#fca5a5' },
  fulfilled:         { bg: '#e1f5ee', text: '#0f6e56', border: '#86efac' },
  cancelled:        { bg: '#f0ecf2', text: '#5a5a5a', border: '#d4cad8' },

  // Urgency
  normal:    { bg: '#e6f1fb', text: '#185fa5', border: '#93c5fd' },
  urgent:    { bg: '#fef3e2', text: '#ba7517', border: '#f5c27a' },
  critical:  { bg: '#fce8eb', text: '#a32d2d', border: '#fca5a5' },
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

/**
 * Hitung estimasi selesai dari keranjang nota.
 * Ambil SLA TERBESAR dari semua item (express atau regular).
 * Return Date object.
 */
export function calculateEstimateDone(cartItems = []) {
  if (!cartItems || cartItems.length === 0) return null;

  const now = new Date();
  let maxHours = 0;

  for (const item of cartItems) {
    const isExpress = !!(item.express || item.isExpress);
    // sla_express_hours jika express, sla_regular_hours jika tidak
    const slaHours = isExpress
      ? Number(item.slaExpressHours || item.sla_express_hours)
      : Number(item.slaRegularHours || item.sla_regular_hours);

    if (slaHours && slaHours > maxHours) {
      maxHours = slaHours;
    }
  }

  if (maxHours <= 0) return null;

  const estimateDate = new Date(now.getTime() + maxHours * 60 * 60 * 1000);
  return estimateDate;
}

/**
 * Format estimasi selesai untuk display.
 * Return string seperti "15 Jul 2026, 14:00" atau null.
 */
export function formatEstimateDone(estimateDate) {
  if (!estimateDate) return null;
  const d = estimateDate instanceof Date ? estimateDate : new Date(estimateDate);
  if (isNaN(d.getTime())) return null;

  return d.toLocaleString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

/**
 * Get human-readable estimate string.
 * Return "dalam X jam" atau formatted date.
 */
export function getEstimateLabel(estimateDate) {
  if (!estimateDate) return null;
  const d = estimateDate instanceof Date ? estimateDate : new Date(estimateDate);
  if (isNaN(d.getTime())) return null;

  const now = new Date();
  const diffMs = d - now;
  const diffHours = diffMs / (1000 * 60 * 60);

  if (diffHours < 1) {
    const diffMins = Math.round(diffMs / (1000 * 60));
    return `${diffMins} menit lagi`;
  }
  if (diffHours < 24) {
    return `${Math.round(diffHours)} jam lagi`;
  }
  // Lebih dari 1 hari
  return formatEstimateDone(d);
}

// ─── STANDARDIZED DATE FORMATTING ───────────────────────────────────────────────
// Single source of truth untuk semua formatting date di aplikasi

const WIB = 'Asia/Jakarta';

/**
 * Format date untuk display umum
 * @param {string|Date} date - date string atau Date object
 * @param {object} options - Intl.DateTimeFormat options
 * @returns {string} formatted date
 */
export function formatDate(date, options = {}) {
  if (!date) return '-';
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return '-';

  const defaults = {
    timeZone: WIB,
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  };

  return new Intl.DateTimeFormat('id-ID', { ...defaults, ...options }).format(d);
}

/**
 * Format date + time untuk display
 * @param {string|Date} date
 * @returns {string} "15 Jul 2026, 14:30"
 */
export function formatDateTime(date) {
  if (!date) return '-';
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return '-';

  return new Intl.DateTimeFormat('id-ID', {
    timeZone: WIB,
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(d);
}

/**
 * Format time only
 * @param {string|Date} date
 * @returns {string} "14:30"
 */
export function formatTime(date) {
  if (!date) return '-';
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return '-';

  return new Intl.DateTimeFormat('id-ID', {
    timeZone: WIB,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(d);
}

/**
 * Format date untuk table column / list
 * @param {string|Date} date
 * @returns {string} "15 Jul 2026"
 */
export function formatDateList(date) {
  return formatDate(date, { day: '2-digit', month: 'short', year: 'numeric' });
}

/**
 * Format date untuk header/banner
 * @param {string|Date} date
 * @returns {string} "Senin, 15 Juli 2026"
 */
export function formatDateFull(date) {
  return formatDate(date, { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
}

/**
 * Format date untuk input/display biasa
 * @param {string|Date} date
 * @returns {string} "15/07/2026"
 */
export function formatDateShort(date) {
  return formatDate(date, { day: '2-digit', month: '2-digit', year: 'numeric' });
}

/**
 * Get relative time string
 * @param {string|Date} date
 * @returns {string} "2 jam lalu", "Kemarin", "3 hari lalu"
 */
export function formatRelative(date) {
  if (!date) return '-';
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return '-';

  const now = new Date();
  const diffMs = now - d;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Baru saja';
  if (diffMins < 60) return `${diffMins} menit lalu`;
  if (diffHours < 24) return `${diffHours} jam lalu`;
  if (diffDays === 1) return 'Kemarin';
  if (diffDays < 7) return `${diffDays} hari lalu`;
  return formatDateList(d);
}

// ─── WhatsApp Utilities ──────────────────────────────────────────────────────────

/**
 * Format phone number to wa.me format.
 * Always converts: 0xxx → 62xxx, then strips non-digits.
 * @param {string} phone
 * @returns {string|null} e.g. "6281234567890" or null
 */
export function formatPhoneForWa(phone) {
  if (!phone) return null;
  const cleaned = String(phone).replace(/\D/g, '');
  if (!cleaned) return null;
  // 0xxx → 62xxx
  if (cleaned.startsWith('0')) return '62' + cleaned.slice(1);
  // already 62xxx
  if (cleaned.startsWith('62')) return cleaned;
  // bare number (no country code)
  return '62' + cleaned;
}

/**
 * Build a wa.me URL with optional pre-filled text.
 * @param {string} phone
 * @param {string} [message]
 * @returns {string|null}
 */
export function buildWaMeLink(phone, message) {
  const waNumber = formatPhoneForWa(phone);
  if (!waNumber) return null;
  const encoded = message ? encodeURIComponent(message) : '';
  return encoded
    ? `https://wa.me/${waNumber}?text=${encoded}`
    : `https://wa.me/${waNumber}`;
}

/**
 * Open WhatsApp with wa.me link.
 * @param {string} phone
 * @param {string} [message]
 */
export function openWaMe(phone, message) {
  const url = buildWaMeLink(phone, message);
  if (!url) {
    alert('Nomor HP tidak valid.');
    return;
  }
  window.open(url, '_blank', 'noopener,noreferrer');
}
