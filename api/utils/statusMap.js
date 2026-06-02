// ─────────────────────────────────────────────────────────────────────────────
// Status Map — backend Single Source of Truth
// ─────────────────────────────────────────────────────────────────────────────
// Mirror dari src/utils/statusMap.js di frontend. Pastikan keduanya konsisten
// kalau ada update.
// ─────────────────────────────────────────────────────────────────────────────

// ─── 1. Transaction Status ─────────────────────────────────────────────────
// UI  : baru | proses | selesai | diambil | dibatalkan | semua
// DB  : draft, pending, process, ready_for_pickup, ready_for_delivery,
//       completed, cancelled
export const TX_STATUS_UI_TO_DB = {
  baru:        ['draft', 'pending'],
  proses:      ['process'],
  selesai:     ['completed', 'ready_for_pickup', 'ready_for_delivery'],
  diambil:     ['completed', 'ready_for_pickup', 'ready_for_delivery'], // diambil = selesai + picked_up_at IS NOT NULL (handled separately)
  dibatalkan:  ['cancelled'],
};

/**
 * Convert UI status (mis. 'selesai') ke array DB status untuk SQL filter.
 * Return { dbStatuses: string[], extraWhere: string|null }
 */
export function uiToDbStatusFilter(uiStatus) {
  if (!uiStatus || uiStatus === 'semua' || uiStatus === 'all') {
    return { dbStatuses: null, extraWhere: null };
  }
  const dbList = TX_STATUS_UI_TO_DB[uiStatus] || [];

  let extraWhere = null;
  // 'diambil' butuh extra check picked_up_at NOT NULL
  if (uiStatus === 'diambil') extraWhere = 't.picked_up_at IS NOT NULL';
  // 'selesai' tapi BELUM diambil
  if (uiStatus === 'selesai') extraWhere = 't.picked_up_at IS NULL';

  return { dbStatuses: dbList, extraWhere };
}

/**
 * Convert DB status row ke UI status (matches frontend logic).
 */
export function dbToUiTxStatus(dbStatus, pickedUpAt) {
  if (dbStatus === 'cancelled') return 'dibatalkan';
  if (pickedUpAt) return 'diambil';
  if (dbStatus === 'completed' || dbStatus === 'ready_for_pickup' || dbStatus === 'ready_for_delivery') return 'selesai';
  if (dbStatus === 'process') return 'proses';
  return 'baru';
}

// ─── 2. Production Stage ───────────────────────────────────────────────────
export const STAGE_DB_TO_UI = {
  received: 'Diterima', pending: 'Diterima',
  washing: 'Cuci', drying: 'Cuci',
  ironing: 'Setrika', qc: 'Setrika',
  packing: 'Packing',
  ready: 'Selesai', done: 'Selesai', completed: 'Selesai',
};

export const STAGE_UI_TO_DB = {
  Diterima: 'received',
  Cuci: 'washing',
  Setrika: 'ironing',
  Packing: 'packing',
  Selesai: 'ready',
};

export function dbToUiStage(dbStage) {
  if (!dbStage) return 'Diterima';
  return STAGE_DB_TO_UI[String(dbStage).toLowerCase()] || 'Diterima';
}

export function uiToDbStage(uiStage) {
  return STAGE_UI_TO_DB[uiStage] || 'received';
}

// ─── 3. Payment Method aliases ─────────────────────────────────────────────
// Backend menerima banyak alias dari frontend, normalisasi ke DB column.
export function normalizePayMethod(method) {
  if (!method) return null;
  const m = String(method).toLowerCase().trim();
  // Midtrans channels — semua disimpan as their respective method
  if (['qris', 'gopay', 'shopeepay', 'ovo', 'dana'].includes(m)) return m;
  if (m.endsWith('_va') || ['bca', 'bni', 'bri', 'permata', 'mandiri', 'echannel'].includes(m)) return 'transfer';
  if (m === 'cash' || m === 'tunai') return 'cash';
  if (m === 'transfer' || m === 'bank_transfer') return 'transfer';
  if (m === 'edc') return 'edc';
  if (m === 'deposit' || m === 'wallet') return 'deposit';
  if (m === 'midtrans') return 'qris'; // backward-compat default
  return m;
}

export default {
  TX_STATUS_UI_TO_DB,
  STAGE_DB_TO_UI,
  STAGE_UI_TO_DB,
  uiToDbStatusFilter,
  dbToUiTxStatus,
  dbToUiStage,
  uiToDbStage,
  normalizePayMethod,
};
