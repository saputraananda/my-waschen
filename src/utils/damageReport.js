// ─────────────────────────────────────────────────────────────────────────────
// Damage Report Helper — identify high-value items that require pre-photo
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Kategori layanan yang WAJIB difoto sebelum cuci karena nilai tinggi/risiko tinggi.
 * Bisa di-customize per outlet via config nantinya.
 */
const HIGH_VALUE_CATEGORIES = ['Karpet', 'Sepatu', 'Boneka', 'Helm', 'Dry Clean', 'Jas', 'Tas'];
const HIGH_VALUE_KEYWORDS = ['karpet', 'sepatu', 'boneka', 'helm', 'jas', 'tas', 'kebaya', 'gaun', 'jaket kulit', 'ulos', 'bordir'];

/**
 * Threshold harga: di atas nilai ini, wajib foto kondisi sebelum cuci.
 */
const HIGH_VALUE_PRICE_THRESHOLD = 50000; // Rp 50.000

/**
 * Cek apakah item perlu foto wajib sebelum cuci.
 *
 * @param {object} item { name, category, price, unit, qty }
 * @returns {boolean}
 */
export function requiresPhotoBeforeWash(item) {
  if (!item) return false;

  // Cek kategori
  if (item.category && HIGH_VALUE_CATEGORIES.includes(item.category)) {
    return true;
  }

  // Cek keyword di nama
  const name = String(item.name || item.serviceName || '').toLowerCase();
  if (HIGH_VALUE_KEYWORDS.some(kw => name.includes(kw))) {
    return true;
  }

  // Cek total nilai (price × qty)
  const total = Number(item.price || 0) * Number(item.qty || 1);
  if (total >= HIGH_VALUE_PRICE_THRESHOLD) {
    return true;
  }

  // Unit m² (karpet) selalu wajib
  if (item.unit === 'm2') {
    return true;
  }

  return false;
}

/**
 * Cek transaksi keseluruhan: ada item yang wajib foto?
 */
export function transactionRequiresPhoto(transaction) {
  if (!transaction?.items) return false;
  return transaction.items.some(requiresPhotoBeforeWash);
}

/**
 * Get list item yang wajib foto.
 */
export function getItemsRequiringPhoto(transaction) {
  if (!transaction?.items) return [];
  return transaction.items.filter(requiresPhotoBeforeWash);
}

/**
 * Friendly reason kenapa item ini wajib foto.
 */
export function getPhotoRequirementReason(item) {
  if (!item) return null;
  if (item.unit === 'm2') return 'Karpet — selalu wajib foto kondisi';
  if (item.category && HIGH_VALUE_CATEGORIES.includes(item.category)) {
    return `Kategori ${item.category} — barang bernilai tinggi`;
  }
  const name = String(item.name || item.serviceName || '').toLowerCase();
  for (const kw of HIGH_VALUE_KEYWORDS) {
    if (name.includes(kw)) return `Mengandung "${kw}" — barang bernilai tinggi`;
  }
  const total = Number(item.price || 0) * Number(item.qty || 1);
  if (total >= HIGH_VALUE_PRICE_THRESHOLD) {
    return `Total ≥ Rp ${HIGH_VALUE_PRICE_THRESHOLD.toLocaleString('id-ID')}`;
  }
  return null;
}
