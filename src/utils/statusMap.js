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
import { status } from './colors';

// ─── 1. STATUS TRANSAKSI (tr_transaction.status + picked_up_at) ────────────
// DB possible values: draft, pending, process, ready_for_pickup,
//                     ready_for_delivery, completed, cancelled
// UI keys: baru, proses, selesai, diambil, dibatalkan
//
// Color convention: Design System 2.4 — selesai: hijau | proses: netral | batal: merah
export const TX_STATUS = {
  baru:        { label: 'Baru',          icon: '📥', ...status.selesai, color: status.selesai.text, desc: 'Nota baru, menunggu produksi' },
  proses:      { label: 'Proses',        icon: '🔄', ...status.proses,  color: status.proses.text,  desc: 'Sedang dikerjakan' },
  selesai:     { label: 'Selesai',       icon: '✅', ...status.selesai, color: status.selesai.text, desc: 'Siap diambil' },
  diambil:     { label: 'Diambil',       icon: '📦', ...status.selesai, color: status.selesai.text, desc: 'Sudah diserahkan' },
  dibatalkan:  { label: 'Dibatalkan',    icon: '❌', ...status.batal,   color: status.batal.text,   desc: 'Dibatalkan' },
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
  paid:    { label: 'Lunas',       icon: '💰', color: '#0f6e56', bg: '#e1f5ee' },
  partial: { label: 'Sebagian',    icon: '🔸', color: '#ba7517', bg: '#fef3e2' },
  unpaid:  { label: 'Belum Bayar', icon: '⚠️', color: '#a32d2d', bg: '#fce8eb' },
};

// ─── 3. PRODUCTION STAGE (tr_item_unit.production_stage) ───────────────────
// DB raw: received, ready, completed
// UI keys: Diterima, Ready to Pickup, Selesai (3 stage)
//
// Color convention: Design System — netral | brand | hijau
// Updated: Brand color #3C0A63
export const PRODUCTION_STAGES = [
  { key: 'Diterima', icon: '📥', color: '#5a5a5a', bg: '#f0ecf2', dbKeys: ['received', 'pending'] },
  { key: 'Ready to Pickup', icon: '📦', color: '#3C0A63', bg: '#F2E7FC', dbKeys: ['ready', 'pickup'] },
  { key: 'Selesai', icon: '✅', color: '#0f6e56', bg: '#e1f5ee', dbKeys: ['completed', 'done'] },
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
  pending:          { label: 'Menunggu',     icon: '⏳', color: '#ba7517', bg: '#fef3e2' },
  pending_approval: { label: 'Menunggu',     icon: '⏳', color: '#ba7517', bg: '#fef3e2' },
  approved:         { label: 'Disetujui',    icon: '✅', color: '#0f6e56', bg: '#e1f5ee' },
  auto_approved:    { label: 'Otomatis',     icon: '⚡', color: '#0f6e56', bg: '#e1f5ee' },
  revised:          { label: 'Perlu Revisi', icon: '↩️', color: '#ba7517', bg: '#fef3e2' },
  rejected:         { label: 'Ditolak',      icon: '❌', color: '#a32d2d', bg: '#fce8eb' },
  fulfilled:        { label: 'Selesai',      icon: '🎉', color: '#0f6e56', bg: '#e1f5ee' },
  cancelled:        { label: 'Dibatalkan',   icon: '⊘', color: '#5a5a5a', bg: '#f0ecf2' },
};

// ─── 5. URGENCY (tr_purchase_request.urgency) ──────────────────────────────
export const URGENCY = {
  normal:   { label: 'Normal',  icon: '📋', color: '#185fa5', bg: '#e6f1fb' },
  urgent:   { label: 'Urgent',  icon: '⚠️', color: '#ba7517', bg: '#fef3e2' },
  critical: { label: 'Kritis',  icon: '🚨', color: '#a32d2d', bg: '#fce8eb' },
};

// ─── 6. PAYMENT METHOD (tr_payment_item.method) ────────────────────────────
export const PAYMENT_METHODS = {
  cash:        { label: 'Tunai',          icon: '💵', color: '#0f6e56' },
  transfer:    { label: 'Transfer',       icon: '🔁', color: '#185fa5' },
  qris:        { label: 'QRIS',           icon: '📱', color: '#185fa5' },
  gopay:       { label: 'GoPay',          icon: '💚', color: '#0f6e56' },
  shopeepay:   { label: 'ShopeePay',      icon: '🛒', color: '#ba7517' },
  ovo:         { label: 'OVO',            icon: '🟣', color: '#5B005F' },
  dana:        { label: 'DANA',           icon: '🔵', color: '#185fa5' },
  deposit:     { label: 'Deposit Member', icon: '💎', color: '#5B005F' },
  edc:         { label: 'EDC',            icon: '💳', color: '#5a5a5a' },
  mixed:       { label: 'Gabungan',       icon: '🔀', color: '#ba7517' },
};

// ─── 7. GATEWAY STATUS (Midtrans transaction_status) ───────────────────────
export const GATEWAY_STATUS = {
  pending:       { label: 'Menunggu',   icon: '⏳', color: '#ba7517', bg: '#fef3e2' },
  capture:       { label: 'Diproses',  icon: '🔄', color: '#185fa5', bg: '#e6f1fb' },
  settlement:    { label: 'Lunas',     icon: '✅', color: '#0f6e56', bg: '#e1f5ee' },
  deny:          { label: 'Ditolak',   icon: '❌', color: '#a32d2d', bg: '#fce8eb' },
  cancel:        { label: 'Dibatalkan', icon: '⊘', color: '#5a5a5a', bg: '#f0ecf2' },
  expire:        { label: 'Kadaluarsa', icon: '⏰', color: '#9a9a9a', bg: '#f7f5f8' },
  failure:       { label: 'Gagal',     icon: '💥', color: '#a32d2d', bg: '#fce8eb' },
  refund:        { label: 'Refund',    icon: '↩️', color: '#185fa5', bg: '#e6f1fb' },
};

// ─── 8. EXPENSE STATUS (tr_outlet_cash_expense) ────────────────────────────
export const EXPENSE_STATUS = {
  auto_approved:    { label: 'Otomatis',  icon: '⚡', color: '#0f6e56', bg: '#e1f5ee' },
  approved:         { label: 'Disetujui', icon: '✅', color: '#0f6e56', bg: '#e1f5ee' },
  pending_approval: { label: 'Menunggu',  icon: '⏳', color: '#ba7517', bg: '#fef3e2' },
  rejected:         { label: 'Ditolak',   icon: '❌', color: '#a32d2d', bg: '#fce8eb' },
};

export function pctColor(pct) {
  if (pct >= 100) return '#0f6e56';
  if (pct >= 80)  return '#0f6e56';
  if (pct >= 50)  return '#ba7517';
  return '#a32d2d';
}

export function pctBg(pct) {
  if (pct >= 100) return '#e1f5ee';
  if (pct >= 80)  return '#e1f5ee';
  if (pct >= 50)  return '#fef3e2';
  return '#fce8eb';
}

// ─── 10. Generic helper — get meta with fallback ───────────────────────────
export function getStatusMeta(map, key, fallback = null) {
  if (!key) return fallback || { label: '-', icon: '·', color: '#5a5a5a', bg: '#f0ecf2' };
  return map[key] || map[String(key).toLowerCase()] || fallback || { label: String(key), icon: '·', color: '#5a5a5a', bg: '#f0ecf2' };
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
