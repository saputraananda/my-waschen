// ─────────────────────────────────────────────────────────────────────────────
// Dashboard API helpers
// ─────────────────────────────────────────────────────────────────────────────
import axios from 'axios';

// ── Dashboard Stats ───────────────────────────────────────────────────────────
export async function getDashboardStats(params = {}) {
  const res = await axios.get('/api/dashboard/stats', { params });
  return res?.data?.data;
}

// ── Sparkline Data ────────────────────────────────────────────────────────────
export async function getSparklineData(days = 7) {
  const res = await axios.get('/api/dashboard/sparkline', { params: { days } });
  return res?.data?.data;
}

// ── Target Tracking (Monthly + Daily) ───────────────────────────────────────
export async function getTargetTracking(outletId = null) {
  const res = await axios.get('/api/dashboard/target-tracking', {
    params: outletId ? { outletId } : {}
  });
  return res?.data?.data;
}

// ── Outlet Dashboard List (Admin only) ──────────────────────────────────────
export async function getOutletDashboard() {
  const res = await axios.get('/api/dashboard/outlets');
  return res?.data?.data;
}

// ── Target Status Helper ─────────────────────────────────────────────────────
export function getTargetStatus(achievementPct) {
  if (achievementPct >= 100) return { label: 'Tercapai', color: '#10B981', bg: '#D1FAE5' };
  if (achievementPct >= 95) return { label: 'Hampir', color: '#F59E0B', bg: '#FEF3C7' };
  if (achievementPct >= 80) return { label: 'On Track', color: '#3B82F6', bg: '#DBEAFE' };
  return { label: 'Terlambat', color: '#EF4444', bg: '#FEE2E2' };
}
