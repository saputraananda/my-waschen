// ─────────────────────────────────────────────────────────────────────────────
// Outlet Cash API helpers
// ─────────────────────────────────────────────────────────────────────────────
import axios from 'axios';

let cachedConfig = null;

export async function getCashConfig(force = false) {
  if (cachedConfig && !force) return cachedConfig;
  const res = await axios.get('/api/outlet-cash/config');
  cachedConfig = res?.data?.data || null;
  return cachedConfig;
}

// ── Balance ──────────────────────────────────────────────────────────────────
export async function getBalance(outletId) {
  const params = outletId ? { outletId } : {};
  const res = await axios.get('/api/outlet-cash/balance', { params });
  return res?.data?.data;
}

export async function getAllBalances() {
  const res = await axios.get('/api/outlet-cash/balances');
  return res?.data?.data || [];
}

// ── Top-up (admin) ───────────────────────────────────────────────────────────
export async function topupCash({ outletId, amount, source, referenceNo, notes, picName, proofPhotoUrl }) {
  const res = await axios.post('/api/outlet-cash/topup', {
    outletId, amount, source, referenceNo, notes, picName, proofPhotoUrl,
  });
  return res?.data?.data;
}

export async function getTopups(filters = {}) {
  const res = await axios.get('/api/outlet-cash/topups', { params: filters });
  return res?.data;
}

// ── Expense (kasir) ──────────────────────────────────────────────────────────
export async function submitExpense({ amount, category, description, receiptPhotoUrl, picName }) {
  const res = await axios.post('/api/outlet-cash/expense', {
    amount, category, description, receiptPhotoUrl, picName,
  });
  return res?.data?.data;
}

export async function getExpenses(filters = {}) {
  const res = await axios.get('/api/outlet-cash/expenses', { params: filters });
  return res?.data;
}

// ── Approval (admin) ─────────────────────────────────────────────────────────
export async function getCashApprovals(status = 'pending') {
  const res = await axios.get('/api/outlet-cash/approvals', { params: { status } });
  return res?.data?.data || [];
}

export async function resolveCashApproval(id, action, rejectReason = null) {
  const res = await axios.patch(`/api/outlet-cash/approval/${id}`, { action, rejectReason });
  return res?.data?.data;
}

// ── Rekonsiliasi (admin) ─────────────────────────────────────────────────────
export async function reconcileBalance({ outletId, actualBalance, notes }) {
  const res = await axios.post('/api/outlet-cash/reconcile', {
    outletId, actualBalance, notes,
  });
  return res?.data?.data;
}

// ── Cancel Expense (kasir) ──────────────────────────────────────────────────
export async function cancelExpense(id) {
  const res = await axios.patch(`/api/outlet-cash/expense/${id}/cancel`);
  return res?.data?.data;
}

// ── Low Balance Check ────────────────────────────────────────────────────────
// Backend handles role-based filtering: admin sees all, kasir sees only their outlet
export async function checkLowBalance() {
  const res = await axios.get('/api/outlet-cash/low-balance-check');
  return res?.data?.data;
}

// ── Ledger ───────────────────────────────────────────────────────────────────
export async function getLedger(outletId, limit = 50, filters = {}) {
  const params = { limit, ...filters };
  if (outletId) params.outletId = outletId;
  const res = await axios.get('/api/outlet-cash/ledger', { params });
  return res?.data?.data || [];
}

// ── Summary ──────────────────────────────────────────────────────────────────
export async function getCashSummary(filters = {}) {
  const res = await axios.get('/api/outlet-cash/summary', { params: filters });
  return res?.data?.data;
}

// ── Export CSV (admin) ───────────────────────────────────────────────────────
export async function exportCashCsv(filters = {}) {
  const res = await axios.get('/api/outlet-cash/transactions/export', {
    params: filters,
    responseType: 'blob',
  });

  const disposition = res.headers?.['content-disposition'] || '';
  const match = disposition.match(/filename="?([^";\n]+)"?/i);
  const fallbackRange = filters.startDate && filters.endDate
    ? `${filters.startDate}_${filters.endDate}`
    : new Date().toISOString().slice(0, 10);
  const filename = match?.[1] || `kas-outlet_${fallbackRange}.csv`;

  const blob = new Blob([res.data], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ── Settings (admin) ─────────────────────────────────────────────────────────
export async function getSetting(key) {
  const res = await axios.get(`/api/settings/${key}`);
  return res?.data?.data;
}

export async function updateSetting(key, value) {
  const res = await axios.patch(`/api/settings/${key}`, { value });
  return res?.data?.data;
}

export async function listSettings(category) {
  const params = {};
  if (category) params.category = category;
  const res = await axios.get('/api/settings', { params });
  return res?.data?.data || [];
}

// ── Helpers ──────────────────────────────────────────────────────────────────
export const CATEGORY_META = {
  gas:         { label: 'Gas / Bahan Bakar',   icon: '🔥', color: '#F97316' },
  utility:     { label: 'Listrik & Utilitas',  icon: '⚡', color: '#FACC15' },
  supplies:    { label: 'Bahan Baku Darurat',  icon: '🧴', color: '#3B82F6' },
  repair:      { label: 'Reparasi Alat',       icon: '🔧', color: '#8B5CF6' },
  transport:   { label: 'Transport',           icon: '🚗', color: '#EC4899' },
  consumption: { label: 'Konsumsi Karyawan',   icon: '🍱', color: '#10B981' },
  other:       { label: 'Lain-lain',           icon: '📋', color: '#64748B' },
};

export const TOPUP_SOURCE_META = {
  cash:         { label: 'Tunai',          icon: '💵' },
  transfer:     { label: 'Transfer Bank',  icon: '🏦' },
  admin_pocket: { label: 'Kas Admin',      icon: '👜' },
  other:        { label: 'Lainnya',        icon: '📦' },
};

export const STATUS_META = {
  auto_approved:    { label: 'Otomatis',  bg: '#DCFCE7', fg: '#15803D' },
  approved:         { label: 'Disetujui', bg: '#DBEAFE', fg: '#1E40AF' },
  pending_approval: { label: 'Menunggu Approval', bg: '#FEF3C7', fg: '#92400E' },
  rejected:         { label: 'Ditolak',   bg: '#FEE2E2', fg: '#991B1B' },
  cancelled:        { label: 'Dibatalkan', bg: '#F1F5F9', fg: '#475569' },
};
