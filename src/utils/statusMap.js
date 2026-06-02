// ─────────────────────────────────────────────────────────────────────────────
// Status Map — Single Source of Truth untuk semua label status di sistem.
// ─────────────────────────────────────────────────────────────────────────────
// Tujuan: tidak ada lagi "status === 'pending'" hardcoded di mana-mana.
// Semua page pakai konstanta ini supaya konsisten antara backend & frontend.
//
// Convention:
//   - DB status  : raw string dari MySQL (mis. 'pending', 'completed', 'cancelled')
//   - UI status  : Indonesia, simpel, untuk display ke user (mis. 'baru', 'proses')
//   - Mapper     : function bilateral (db→ui, ui→db)
// ─────────────────────────────────────────────────────────────────────────────

import { C } from './theme';

// ─── 1. STATUS TRANSAKSI (tr_transaction.status + picked_up_at) ────────────
// DB possible values: draft, pending, process, ready_for_pickup,
//                     ready_for_delivery, completed, cancelled
// UI keys: baru, proses, selesai, diambil, dibatalkan
export const TX_STATUS = {
  baru:        { label: 'Baru',          icon: '📥', color: '#3B82F6', bg: '#DBEAFE', desc: 'Nota baru, menunggu produksi' },
  proses:      { label: 'Proses',        icon: '🔄', color: '#0EA5E9', bg: '#E0F2FE', desc: 'Sedang dikerjakan' },
  selesai:     { label: 'Selesai',       icon: '✅', color: '#10B981', bg: '#DCFCE7', desc: 'Siap diambil' },
  diambil:     { label: 'Diambil',       icon: '📦', color: '#8B5CF6', bg: '#EDE9FE', desc: 'Sudah diserahkan' },
  dibatalkan:  { label: 'Dibatalkan',    icon: '❌', color: '#DC2626', bg: '#FEE2E2', desc: 'Dibatalkan' },
};

// Map DB (mst → frontend ui)
export function dbToUiTxStatus(dbStatus, pickedUpAt) {
  if (dbStatus === 'cancelled') return 'dibatalkan';
  if (pickedUpAt) return 'diambil';
  if (dbStatus === 'completed' || dbStatus === 'ready_for_pickup' || dbStatus === 'ready_for_delivery') return 'selesai';
  if (dbStatus === 'process') return 'proses';
  return 'baru'; // draft, pending
}

// Reverse — kalau frontend kirim ui status, convert ke DB
export function uiToDbTxStatus(uiStatus) {
  switch (uiStatus) {
    case 'baru':        return 'pending';
    case 'proses':      return 'process';
    case 'selesai':     return 'completed';
    case 'diambil':     return 'completed'; // + set picked_up_at
    case 'dibatalkan':  return 'cancelled';
    default:            return uiStatus;
  }
}

// ─── 2. PAYMENT STATUS (tr_transaction.payment_status) ─────────────────────
// DB & UI sama: paid, partial, unpaid
export const PAYMENT_STATUS = {
  paid:    { label: 'Lunas',         icon: '💰', color: '#10B981', bg: '#DCFCE7' },
  partial: { label: 'Sebagian',      icon: '🔸', color: '#F59E0B', bg: '#FEF3C7' },
  unpaid:  { label: 'Belum Bayar',   icon: '⚠️', color: '#DC2626', bg: '#FEE2E2' },
};

// ─── 3. PRODUCTION STAGE (tr_item_unit.production_stage) ───────────────────
// DB raw: received, washing, drying, ironing, qc, packing, ready, done
// UI keys: Diterima, Cuci, Setrika, Packing, Selesai (5 stage simplified)
export const PRODUCTION_STAGES = [
  { key: 'Diterima', icon: '📥', color: '#3B82F6', dbKeys: ['received', 'pending'] },
  { key: 'Cuci',     icon: '🫧', color: '#06B6D4', dbKeys: ['washing', 'drying'] },
  { key: 'Setrika',  icon: '♨️', color: '#F59E0B', dbKeys: ['ironing', 'qc'] },
  { key: 'Packing',  icon: '📦', color: '#8B5CF6', dbKeys: ['packing'] },
  { key: 'Selesai',  icon: '✅', color: '#10B981', dbKeys: ['ready', 'done', 'completed'] },
];

export function dbToUiStage(dbStage) {
  if (!dbStage) return 'Diterima';
  const lower = String(dbStage).toLowerCase();
  for (const s of PRODUCTION_STAGES) {
    if (s.dbKeys.includes(lower)) return s.key;
  }
  return 'Diterima';
}

export function getStageMeta(uiStage) {
  return PRODUCTION_STAGES.find(s => s.key === uiStage) || PRODUCTION_STAGES[0];
}

// ─── 4. APPROVAL STATUS (tr_outlet_cash_approval, purchase_request) ────────
export const APPROVAL_STATUS = {
  pending:          { label: 'Menunggu',     icon: '⏳', color: '#F59E0B', bg: '#FEF3C7' },
  pending_approval: { label: 'Menunggu',     icon: '⏳', color: '#F59E0B', bg: '#FEF3C7' },
  approved:         { label: 'Disetujui',    icon: '✅', color: '#10B981', bg: '#DCFCE7' },
  auto_approved:    { label: 'Otomatis',     icon: '⚡', color: '#10B981', bg: '#DCFCE7' },
  revised:          { label: 'Perlu Revisi', icon: '↩️', color: '#F59E0B', bg: '#FEF3C7' },
  rejected:         { label: 'Ditolak',      icon: '❌', color: '#DC2626', bg: '#FEE2E2' },
  fulfilled:        { label: 'Selesai',      icon: '🎉', color: '#10B981', bg: '#DCFCE7' },
  cancelled:        { label: 'Dibatalkan',   icon: '⊘', color: '#64748B', bg: '#F1F5F9' },
};

// ─── 5. URGENCY (tr_purchase_request.urgency) ──────────────────────────────
export const URGENCY = {
  normal:   { label: 'Normal',  icon: '📋', color: '#3B82F6', bg: '#DBEAFE' },
  urgent:   { label: 'Urgent',  icon: '⚠️', color: '#F59E0B', bg: '#FEF3C7' },
  critical: { label: 'Kritis',  icon: '🚨', color: '#DC2626', bg: '#FEE2E2' },
};

// ─── 6. PAYMENT METHOD (tr_payment_item.method) ────────────────────────────
export const PAYMENT_METHODS = {
  cash:        { label: 'Tunai',          icon: '💵', color: '#10B981' },
  transfer:    { label: 'Transfer',       icon: '🔁', color: '#8B5CF6' },
  qris:        { label: 'QRIS',           icon: '📱', color: '#3B82F6' },
  gopay:       { label: 'GoPay',          icon: '💚', color: '#00AA13' },
  shopeepay:   { label: 'ShopeePay',      icon: '🛒', color: '#EE4D2D' },
  ovo:         { label: 'OVO',            icon: '🟣', color: '#4C2A85' },
  dana:        { label: 'DANA',           icon: '🔵', color: '#0093D9' },
  deposit:     { label: 'Deposit Member', icon: '💎', color: '#A855F7' },
  edc:         { label: 'EDC',            icon: '💳', color: '#64748B' },
  mixed:       { label: 'Gabungan',       icon: '🔀', color: '#F97316' },
};

// ─── 7. GATEWAY STATUS (Midtrans transaction_status) ───────────────────────
export const GATEWAY_STATUS = {
  pending:       { label: 'Menunggu',  icon: '⏳', color: '#F59E0B', bg: '#FEF3C7' },
  capture:       { label: 'Diproses',  icon: '🔄', color: '#3B82F6', bg: '#DBEAFE' },
  settlement:    { label: 'Lunas',     icon: '✅', color: '#10B981', bg: '#DCFCE7' },
  deny:          { label: 'Ditolak',   icon: '❌', color: '#DC2626', bg: '#FEE2E2' },
  cancel:        { label: 'Dibatalkan', icon: '⊘', color: '#64748B', bg: '#F1F5F9' },
  expire:        { label: 'Kadaluarsa', icon: '⏰', color: '#94A3B8', bg: '#F1F5F9' },
  failure:       { label: 'Gagal',     icon: '💥', color: '#DC2626', bg: '#FEE2E2' },
  refund:        { label: 'Refund',    icon: '↩️', color: '#3B82F6', bg: '#DBEAFE' },
};

// ─── 8. EXPENSE STATUS (tr_outlet_cash_expense) ────────────────────────────
export const EXPENSE_STATUS = {
  auto_approved:    { label: 'Otomatis',  icon: '⚡', color: '#10B981', bg: '#DCFCE7' },
  approved:         { label: 'Disetujui', icon: '✅', color: '#10B981', bg: '#DCFCE7' },
  pending_approval: { label: 'Menunggu',  icon: '⏳', color: '#F59E0B', bg: '#FEF3C7' },
  rejected:         { label: 'Ditolak',   icon: '❌', color: '#DC2626', bg: '#FEE2E2' },
};

// ─── 9. PERCENTAGE COLOR (untuk progress bar, target, dst) ─────────────────
export function pctColor(pct) {
  if (pct >= 100) return '#059669';
  if (pct >= 80)  return '#10B981';
  if (pct >= 50)  return '#F59E0B';
  return '#EF4444';
}

export function pctBg(pct) {
  if (pct >= 100) return '#DCFCE7';
  if (pct >= 80)  return '#D1FAE5';
  if (pct >= 50)  return '#FEF3C7';
  return '#FEE2E2';
}

// ─── 10. Generic helper — get meta with fallback ───────────────────────────
export function getStatusMeta(map, key, fallback = null) {
  if (!key) return fallback || { label: '-', icon: '·', color: C?.n500 || '#64748B', bg: C?.n100 || '#F1F5F9' };
  return map[key] || map[String(key).toLowerCase()] || fallback || { label: String(key), icon: '·', color: C?.n500 || '#64748B', bg: C?.n100 || '#F1F5F9' };
}

// Default exports for convenience
export default {
  TX_STATUS,
  PAYMENT_STATUS,
  PRODUCTION_STAGES,
  APPROVAL_STATUS,
  URGENCY,
  PAYMENT_METHODS,
  GATEWAY_STATUS,
  EXPENSE_STATUS,
  dbToUiTxStatus,
  uiToDbTxStatus,
  dbToUiStage,
  getStageMeta,
  getStatusMeta,
  pctColor,
  pctBg,
};
