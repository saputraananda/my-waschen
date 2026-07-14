// ─────────────────────────────────────────────────────────────────────────────
// KasOutletPage — saldo & riwayat kas operasional outlet (optimized)
// ─────────────────────────────────────────────────────────────────────────────
// Features:
// - Lazy loading + infinite scroll (useInfiniteList)
// - Search bar
// - Filter icon dengan dropdown (kategori, status, periode, nominal)
// - Visualisasi data: pie chart kategori, line chart trend harian
// - Pull-to-refresh
// ─────────────────────────────────────────────────────────────────────────────
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import axios from 'axios';
import { C, SHADOW } from '../utils/theme';
import { rp } from '../utils/helpers';
import { useResponsive } from '../utils/hooks';
import { TopBar, Btn, Modal, Input, Select, Textarea, useAppRefresh, SearchBar, MoneyInput } from '../components/ui';
import { alertError, alertSuccess, alertWarning } from '../utils/alert';
import { useApp } from '../context/AppContext';
import { useInfiniteList } from '../utils/useInfiniteList';
import {
  getBalance, getAllBalances, topupCash, submitExpense, reconcileBalance,
  getCashSummary, getCashConfig, cancelExpense,
  exportCashCsv,
  CATEGORY_META, TOPUP_SOURCE_META, STATUS_META,
} from '../utils/outletCashApi';
import { uploadImage } from '../utils/imageUpload';

const fmtDate = (v) => {
  if (!v) return '-';
  try { return new Date(v).toLocaleString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }); }
  catch { return '-'; }
};

const fmtDateOnly = (v) => {
  if (!v) return '';
  try { return new Date(v).toLocaleDateString('id-ID', { day: '2-digit', month: 'short' }); }
  catch { return ''; }
};

const PERIOD_PRESETS = [
  { key: 'today', label: 'Hari ini', days: 1 },
  { key: '7d', label: '7 Hari', days: 7 },
  { key: '30d', label: '30 Hari', days: 30 },
  { key: '90d', label: '90 Hari', days: 90 },
];

function periodToRange(period) {
  if (!period) return { startDate: null, endDate: null };
  const now = new Date();
  const end = now.toISOString().slice(0, 10);
  const startMs = period === 'today' ? now : new Date(now.getTime() - (period.days - 1) * 86400000);
  return { startDate: startMs.toISOString().slice(0, 10), endDate: end };
}

export default function KasOutletPage({ goBack }) {
  const { isMobile } = useResponsive();
  const { user } = useApp();
  const userRole = user?.originalRoleCode || user?.roleCode || user?.role;
  const isAdmin = ['admin', 'superadmin', 'owner'].includes(userRole);
  const isKasir = ['kasir', 'frontline'].includes(userRole);

  const [config, setConfig] = useState(null);
  const [balance, setBalance] = useState(null);
  const [allBalances, setAllBalances] = useState([]);
  const [selectedOutletId, setSelectedOutletId] = useState(user?.outletId || null);
  const [tab, setTab] = useState('expenses'); // expenses | topups | report

  // Filters
  const [search, setSearch] = useState('');
  const [period, setPeriod] = useState(PERIOD_PRESETS[2]); // default 30 hari
  const [reportPeriod, setReportPeriod] = useState(PERIOD_PRESETS[2]);
  const [reportCustomRange, setReportCustomRange] = useState(() => periodToRange(PERIOD_PRESETS[2]));
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [hasPhotoFilter, setHasPhotoFilter] = useState('all'); // all | 1 | 0
  const [showFilterModal, setShowFilterModal] = useState(false);

  // Modals
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [showTopupModal, setShowTopupModal] = useState(false);
  const [showReconcileModal, setShowReconcileModal] = useState(false);

  // Load config
  useEffect(() => { getCashConfig().then(setConfig).catch(() => {}); }, []);

  // Load balance
  const fetchBalance = useCallback(async () => {
    try {
      if (isAdmin) {
        const all = await getAllBalances();
        setAllBalances(all);
        const target = selectedOutletId || all[0]?.outletId;
        setSelectedOutletId(target);
        const b = all.find(o => o.outletId === target);
        setBalance(b || null);
      } else {
        const b = await getBalance();
        setBalance(b);
        if (!selectedOutletId && b?.outletId) setSelectedOutletId(b.outletId);
      }
    } catch (err) {
      // Error handled silently
    }
  }, [isAdmin, selectedOutletId]);

  useEffect(() => { fetchBalance(); }, [fetchBalance]);

  // Filter range
  const { startDate, endDate } = useMemo(() => periodToRange(period), [period]);
  const { startDate: reportStartDate, endDate: reportEndDate } = useMemo(() => {
    if (reportPeriod?.key === 'custom' && reportCustomRange.startDate && reportCustomRange.endDate) {
      return reportCustomRange;
    }
    return periodToRange(reportPeriod);
  }, [reportPeriod, reportCustomRange]);

  useEffect(() => {
    if (reportPeriod?.key !== 'custom') {
      setReportCustomRange(periodToRange(reportPeriod));
    }
  }, [reportPeriod]);

  // ── Infinite list expenses
  const expensesList = useInfiniteList({
    fetchPage: useCallback(async ({ page, pageSize, signal }) => {
      const params = { page, limit: pageSize, startDate, endDate };
      if (selectedOutletId) params.outletId = selectedOutletId;
      if (categoryFilter !== 'all') params.category = categoryFilter;
      if (statusFilter !== 'all') params.status = statusFilter;
      if (hasPhotoFilter !== 'all') params.hasPhoto = hasPhotoFilter;
      if (search.trim()) params.search = search.trim();
      const res = await axios.get('/api/outlet-cash/expenses', { params, signal });
      return {
        items: res?.data?.data || [],
        total: res?.data?.pagination?.total ?? null,
      };
    }, [selectedOutletId, categoryFilter, statusFilter, search, startDate, endDate]),
    pageSize: 20,
    deps: [selectedOutletId, categoryFilter, statusFilter, hasPhotoFilter, search, startDate, endDate],
    enabled: tab === 'expenses',
  });

  // ── Infinite list topups
  const topupsList = useInfiniteList({
    fetchPage: useCallback(async ({ page, pageSize, signal }) => {
      const params = { page, limit: pageSize, startDate, endDate };
      if (selectedOutletId) params.outletId = selectedOutletId;
      const res = await axios.get('/api/outlet-cash/topups', { params, signal });
      return {
        items: res?.data?.data || [],
        total: res?.data?.pagination?.total ?? null,
      };
    }, [selectedOutletId, startDate, endDate]),
    pageSize: 20,
    deps: [selectedOutletId, startDate, endDate],
    enabled: tab === 'topups',
  });

  // ── Report data
  const [reportData, setReportData] = useState(null);
  const [reportLoading, setReportLoading] = useState(false);
  const fetchReport = useCallback(async () => {
    setReportLoading(true);
    try {
      const data = await getCashSummary({
        outletId: selectedOutletId,
        startDate: reportStartDate, endDate: reportEndDate,
      });
      setReportData(data);
    } catch (err) {
      // Error handled silently
    } finally {
      setReportLoading(false);
    }
  }, [selectedOutletId, reportStartDate, reportEndDate]);

  useEffect(() => {
    if (tab === 'report') fetchReport();
  }, [tab, fetchReport]);

  // Pull-to-refresh
  useAppRefresh(() => {
    fetchBalance();
    if (tab === 'expenses') expensesList.refresh();
    else if (tab === 'topups') topupsList.refresh();
    else if (tab === 'report') fetchReport();
  }, [fetchBalance, tab, expensesList.refresh, topupsList.refresh, fetchReport]);

  const refreshAll = () => {
    fetchBalance();
    expensesList.refresh();
    topupsList.refresh();
    if (tab === 'report') fetchReport();
  };

  const activeFilterCount = (categoryFilter !== 'all' ? 1 : 0)
    + (statusFilter !== 'all' ? 1 : 0)
    + (hasPhotoFilter !== 'all' ? 1 : 0)
    + (search.trim() ? 1 : 0);

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: C.n50, overflow: 'hidden' }}>
      <TopBar
        title="Kas Operasional"
        subtitle={balance?.outletName || ''}
        onBack={goBack}
      />

      <div style={{ flex: 1, overflowY: 'auto', padding: isMobile ? '12px 12px 24px' : '12px 16px 24px' }}>
        {/* Outlet picker untuk admin */}
        {isAdmin && allBalances.length > 0 && (
          <div style={{ marginBottom: 12 }}>
            <Select
              label="Outlet"
              value={selectedOutletId || ''}
              onChange={(v) => setSelectedOutletId(Number(v))}
              options={allBalances.map(o => ({
                value: o.outletId,
                label: `${o.outletName} — ${rp(o.balance)}`,
              }))}
            />
          </div>
        )}

        {/* Hero balance */}
        <BalanceHero
          balance={balance}
          isAdmin={isAdmin}
          isKasir={isKasir}
          onTopup={() => setShowTopupModal(true)}
          onExpense={() => setShowExpenseModal(true)}
          onReconcile={() => setShowReconcileModal(true)}
        />

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 4, marginTop: 14, marginBottom: 12, background: C.n100, borderRadius: 12, padding: 4 }}>
          {[
            { key: 'expenses', label: '📤 Pengeluaran' },
            { key: 'topups',   label: '📥 Top-up' },
            { key: 'report',   label: '📊 Laporan' },
          ].map(t => {
            const active = tab === t.key;
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                style={{
                  flex: 1, padding: '8px 6px', borderRadius: 9,
                  border: 'none',
                  background: active ? 'white' : 'transparent',
                  fontFamily: 'Poppins', fontSize: 11, fontWeight: active ? 700 : 500,
                  color: active ? C.primary : C.n600,
                  cursor: 'pointer',
                  boxShadow: active ? SHADOW.sm : 'none',
                  transition: 'all 0.15s',
                }}
              >
                {t.label}
              </button>
            );
          })}
        </div>

        {/* === EXPENSES TAB === */}
        {tab === 'expenses' && (
          <>
            {/* Period & filter row */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <div style={{ flex: 1, display: 'flex', gap: 6, overflowX: 'auto', scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch', minWidth: 0 }}>
                {PERIOD_PRESETS.map(p => {
                  const active = period.key === p.key;
                  return (
                    <button
                      key={p.key}
                      onClick={() => setPeriod(p)}
                      style={{
                        flexShrink: 0, padding: '5px 11px', borderRadius: 999,
                        border: `1.5px solid ${active ? C.primary : C.n200}`,
                        background: active ? `${C.primary}10` : 'white',
                        fontFamily: 'Poppins', fontSize: 11, fontWeight: active ? 700 : 500,
                        color: active ? C.primary : C.n700,
                        cursor: 'pointer',
                      }}
                    >{p.label}</button>
                  );
                })}
              </div>
              {/* Filter icon button */}
              <button
                onClick={() => setShowFilterModal(true)}
                aria-label="Filter"
                style={{
                  position: 'relative', padding: 8, borderRadius: 10,
                  border: `1.5px solid ${activeFilterCount > 0 ? C.primary : C.n200}`,
                  background: activeFilterCount > 0 ? `${C.primary}10` : 'white',
                  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: activeFilterCount > 0 ? C.primary : C.n700,
                  flexShrink: 0,
                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="4" y1="6" x2="14" y2="6" />
                  <circle cx="16" cy="6" r="2" />
                  <line x1="20" y1="6" x2="18" y2="6" />
                  <line x1="4" y1="12" x2="6" y2="12" />
                  <circle cx="8" cy="12" r="2" />
                  <line x1="20" y1="12" x2="10" y2="12" />
                  <line x1="4" y1="18" x2="12" y2="18" />
                  <circle cx="14" cy="18" r="2" />
                  <line x1="20" y1="18" x2="16" y2="18" />
                </svg>
                {activeFilterCount > 0 && (
                  <span style={{
                    position: 'absolute', top: 1, right: 1,
                    width: 16, height: 16, borderRadius: 8,
                    background: C.primary, color: 'white',
                    fontFamily: 'Poppins', fontSize: 9, fontWeight: 800,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>{activeFilterCount}</span>
                )}
              </button>
            </div>

            {/* Search bar */}
            <div style={{ marginBottom: 12 }}>
              <SearchBar value={search} onChange={setSearch} placeholder="Cari deskripsi atau nama kasir..." />
            </div>

            {/* List */}
            {expensesList.loading && (
              <div style={{ textAlign: 'center', padding: 30, fontFamily: 'Poppins', fontSize: 12, color: C.n600 }}>
                Memuat…
              </div>
            )}
            {!expensesList.loading && expensesList.items.length === 0 && (
              <div style={{ textAlign: 'center', padding: 50 }}>
                <div style={{ fontSize: 40, marginBottom: 8 }}>📭</div>
                <div style={{ fontFamily: 'Poppins', fontSize: 13, color: C.n600 }}>
                  {activeFilterCount > 0 || search ? 'Tidak ada hasil sesuai filter.' : 'Belum ada pengeluaran.'}
                </div>
              </div>
            )}
            {expensesList.items.map(it => <ExpenseCard key={it.id} item={it} userId={user?.userId} isKasir={isKasir} onRefresh={refreshAll} />)}

            {expensesList.hasMore && !expensesList.loading && (
              <div ref={expensesList.sentinelRef} style={{ padding: '14px 0', textAlign: 'center' }}>
                {expensesList.loadingMore ? (
                  <span style={{ fontFamily: 'Poppins', fontSize: 11, color: C.n600 }}>Memuat lebih banyak…</span>
                ) : (
                  <span style={{ fontFamily: 'Poppins', fontSize: 11, color: C.n600 }}>·</span>
                )}
              </div>
            )}
            {!expensesList.hasMore && expensesList.items.length > 0 && (
              <div style={{ textAlign: 'center', padding: '14px 0', fontFamily: 'Poppins', fontSize: 10, color: C.n600 }}>
                ✓ {expensesList.items.length} dari {expensesList.total} data
              </div>
            )}
          </>
        )}

        {/* === TOPUPS TAB === */}
        {tab === 'topups' && (
          <>
            <div style={{ display: 'flex', gap: 6, overflowX: 'auto', marginBottom: 12, scrollbarWidth: 'none' }}>
              {PERIOD_PRESETS.map(p => {
                const active = period.key === p.key;
                return (
                  <button
                    key={p.key}
                    onClick={() => setPeriod(p)}
                    style={{
                      flexShrink: 0, padding: '5px 11px', borderRadius: 999,
                      border: `1.5px solid ${active ? C.primary : C.n200}`,
                      background: active ? `${C.primary}10` : 'white',
                      fontFamily: 'Poppins', fontSize: 11, fontWeight: active ? 700 : 500,
                      color: active ? C.primary : C.n700,
                      cursor: 'pointer',
                    }}
                  >{p.label}</button>
                );
              })}
            </div>

            {topupsList.loading && (
              <div style={{ textAlign: 'center', padding: 30, fontFamily: 'Poppins', fontSize: 12, color: C.n600 }}>Memuat…</div>
            )}
            {!topupsList.loading && topupsList.items.length === 0 && (
              <div style={{ textAlign: 'center', padding: 50 }}>
                <div style={{ fontSize: 40, marginBottom: 8 }}>💵</div>
                <div style={{ fontFamily: 'Poppins', fontSize: 13, color: C.n600 }}>Belum ada top-up.</div>
              </div>
            )}
            {topupsList.items.map(it => <TopupCard key={it.id} item={it} />)}

            {topupsList.hasMore && !topupsList.loading && (
              <div ref={topupsList.sentinelRef} style={{ padding: '14px 0', textAlign: 'center' }}>
                {topupsList.loadingMore && <span style={{ fontFamily: 'Poppins', fontSize: 11, color: C.n600 }}>Memuat…</span>}
              </div>
            )}
          </>
        )}

        {/* === REPORT TAB === */}
        {tab === 'report' && (
          <>
            {isAdmin && (
              <button
                onClick={async () => {
                  try {
                    await exportCashCsv({
                      outletId: selectedOutletId || undefined,
                      startDate: reportStartDate, endDate: reportEndDate,
                    });
                    alertSuccess('CSV berhasil diunduh.');
                  } catch (err) {
                    alertError(err?.response?.data?.message || 'Gagal export CSV.');
                  }
                }}
                style={{
                  width: '100%', padding: '12px',
                  border: `1.5px solid ${C.primary}`, background: 'white',
                  borderRadius: 12, color: C.primary,
                  fontFamily: 'Poppins', fontSize: 12, fontWeight: 600,
                  cursor: 'pointer', marginBottom: 12,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                }}
              >
                📥 Export CSV (Top-up + Pengeluaran)
              </button>
            )}
            <ReportPanel
              data={reportData}
              loading={reportLoading}
              period={reportPeriod}
              setPeriod={setReportPeriod}
              customRange={reportCustomRange}
              setCustomRange={setReportCustomRange}
              rangeStart={reportStartDate}
              rangeEnd={reportEndDate}
              onApplyCustomRange={() => {
                if (!reportCustomRange.startDate || !reportCustomRange.endDate) return;
                let { startDate: s, endDate: e } = reportCustomRange;
                if (s > e) [s, e] = [e, s];
                setReportCustomRange({ startDate: s, endDate: e });
                setReportPeriod({ key: 'custom', label: 'Custom', days: 0 });
              }}
              outletName={balance?.outletName}
            />
          </>
        )}
      </div>

      {/* Modals */}
      {showExpenseModal && (
        <ExpenseModal
          config={config}
          balance={Number(balance?.balance || 0)}
          onClose={() => setShowExpenseModal(false)}
          onSuccess={() => { setShowExpenseModal(false); refreshAll(); }}
        />
      )}
      {showTopupModal && (
        <TopupModal
          outletId={selectedOutletId}
          outletName={balance?.outletName}
          onClose={() => setShowTopupModal(false)}
          onSuccess={() => { setShowTopupModal(false); refreshAll(); }}
        />
      )}
      {showReconcileModal && (
        <ReconcileModal
          outletId={selectedOutletId}
          currentBalance={Number(balance?.balance || 0)}
          onClose={() => setShowReconcileModal(false)}
          onSuccess={() => { setShowReconcileModal(false); refreshAll(); }}
        />
      )}
      {showFilterModal && (
        <FilterModal
          categoryFilter={categoryFilter}
          setCategoryFilter={setCategoryFilter}
          statusFilter={statusFilter}
          setStatusFilter={setStatusFilter}
          hasPhotoFilter={hasPhotoFilter}
          setHasPhotoFilter={setHasPhotoFilter}
          onClose={() => setShowFilterModal(false)}
          onReset={() => { setCategoryFilter('all'); setStatusFilter('all'); setHasPhotoFilter('all'); setSearch(''); }}
        />
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// BalanceHero
// ════════════════════════════════════════════════════════════════════════════
function BalanceHero({ balance, isAdmin, isKasir, onTopup, onExpense, onReconcile }) {
  const amt = Number(balance?.balance || 0);
  const isLow = amt < 100_000 && amt >= 0;
  const fmtDate2 = (v) => v ? new Date(v).toLocaleString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '-';

  return (
    <div style={{
      background: isLow
        ? `linear-gradient(135deg, ${C.dangerDark} 0%, ${C.danger} 100%)`
        : `linear-gradient(135deg, ${C.successDark} 0%, ${C.success} 50%, ${C.infoDark} 100%)`,
      borderRadius: 18,
      padding: '18px 20px',
      color: 'white',
      boxShadow: SHADOW.lg,
      position: 'relative', overflow: 'hidden',
    }}>
      <div style={{
        position: 'absolute', top: -50, right: -40, width: 180, height: 180, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(255,255,255,0.15), transparent 70%)',
        pointerEvents: 'none',
      }} />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8, position: 'relative' }}>
        <div>
          <div style={{ fontFamily: 'Poppins', fontSize: 10, color: 'rgba(255,255,255,0.7)', fontWeight: 600, letterSpacing: 0.5 }}>
            💼 SALDO KAS OUTLET
          </div>
          <div style={{ fontFamily: 'Poppins', fontSize: 11, color: 'rgba(255,255,255,0.85)', marginTop: 2 }}>
            {balance?.outletName || '—'}
          </div>
        </div>
        {isLow && (
          <span style={{
            background: 'rgba(255,255,255,0.2)', color: 'white',
            fontFamily: 'Poppins', fontSize: 10, fontWeight: 600,
            padding: '3px 10px', borderRadius: 999,
          }}>⚠️ Saldo rendah</span>
        )}
      </div>

      <div style={{ fontFamily: 'Poppins', fontSize: 28, fontWeight: 800, lineHeight: 1.2, marginTop: 6 }}>
        {rp(amt)}
      </div>

      {balance?.last_topup_at && (
        <div style={{ fontFamily: 'Poppins', fontSize: 10, color: 'rgba(255,255,255,0.65)', marginTop: 6 }}>
          Top-up terakhir: {fmtDate2(balance.last_topup_at)}
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
        {isKasir && (
          <button
            onClick={onExpense}
            style={{
              flex: 1, minWidth: 130, padding: '10px 12px', borderRadius: 12,
              background: 'rgba(255,255,255,0.20)', border: '1.5px solid rgba(255,255,255,0.35)',
              color: 'white', fontFamily: 'Poppins', fontSize: 13, fontWeight: 600,
              cursor: 'pointer', backdropFilter: 'blur(10px)',
            }}
          >
            📤 Catat Pengeluaran
          </button>
        )}
        {isAdmin && (
          <>
            <button
              onClick={onTopup}
              style={{
                flex: 1, minWidth: 110, padding: '10px 12px', borderRadius: 12,
                background: 'rgba(255,255,255,0.20)', border: '1.5px solid rgba(255,255,255,0.35)',
                color: 'white', fontFamily: 'Poppins', fontSize: 13, fontWeight: 600,
                cursor: 'pointer', backdropFilter: 'blur(10px)',
              }}
            >📥 Top-up</button>
            <button
              onClick={onReconcile}
              style={{
                flex: 1, minWidth: 110, padding: '10px 12px', borderRadius: 12,
                background: 'rgba(255,255,255,0.10)', border: '1.5px solid rgba(255,255,255,0.25)',
                color: 'white', fontFamily: 'Poppins', fontSize: 13, fontWeight: 600,
                cursor: 'pointer', backdropFilter: 'blur(10px)',
              }}
            >⚖️ Rekonsiliasi</button>
          </>
        )}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// Cards
// ════════════════════════════════════════════════════════════════════════════
function ExpenseCard({ item, userId, isKasir, onRefresh }) {
  const cat = CATEGORY_META[item.category] || CATEGORY_META.other;
  const status = STATUS_META[item.status] || STATUS_META.auto_approved;
  const canCancel = item.status === 'pending_approval' && isKasir && item.requesterName;
  const [cancelling, setCancelling] = useState(false);

  const handleCancel = async () => {
    if (!confirmAction) {
      if (!window.confirm('Yakin ingin membatalkan pengeluaran ini?')) return;
    }
    setCancelling(true);
    try {
      await cancelExpense(item.id);
      alertSuccess('Pengeluaran berhasil dibatalkan.');
      onRefresh?.();
    } catch (err) {
      alertError(err?.response?.data?.message || 'Gagal membatalkan pengeluaran.');
    } finally {
      setCancelling(false);
    }
  };

  return (
    <div style={{
      background: 'white', borderRadius: 12, padding: '12px 14px', marginBottom: 8,
      boxShadow: SHADOW.sm,
      borderLeft: `4px solid ${item.status === 'cancelled' ? C.n500 : cat.color}`,
      opacity: item.status === 'cancelled' ? 0.65 : 1,
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <div style={{
          width: 38, height: 38, borderRadius: 10, flexShrink: 0,
          background: `${cat.color}15`, border: `1px solid ${cat.color}30`,
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18,
        }}>{cat.icon}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
            <div style={{ fontFamily: 'Poppins', fontSize: 13, fontWeight: 600, color: C.n900 }}>
              {cat.label}
            </div>
            <div style={{ fontFamily: 'Poppins', fontSize: 13, fontWeight: 800, color: C.danger, whiteSpace: 'nowrap' }}>
              -{rp(item.amount)}
            </div>
          </div>
          <div style={{ fontFamily: 'Poppins', fontSize: 11, color: C.n700, marginTop: 2 }}>
            {item.description}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
            <span style={{
              fontFamily: 'Poppins', fontSize: 9, fontWeight: 600,
              padding: '2px 7px', borderRadius: 999,
              background: status.bg, color: status.fg,
            }}>{status.label}</span>
            <span style={{ fontFamily: 'Poppins', fontSize: 10, color: C.n600 }}>
              {fmtDate(item.createdAt)} · {item.requesterName}
            </span>
            {item.picName && (
              <span style={{ fontFamily: 'Poppins', fontSize: 10, color: C.n600 }}>
                · 👤 {item.picName}
              </span>
            )}
          </div>
          {item.receiptPhotoUrl && (
            <a href={item.receiptPhotoUrl} target="_blank" rel="noreferrer" style={{ display: 'inline-block', marginTop: 6 }}>
              <img src={item.receiptPhotoUrl} alt="bon" style={{ width: 50, height: 50, borderRadius: 6, objectFit: 'cover', border: `1px solid ${C.n200}` }} />
            </a>
          )}
          {item.rejectReason && (
            <div style={{ background: C.validationErrorBg, borderRadius: 6, padding: '4px 8px', marginTop: 6, fontFamily: 'Poppins', fontSize: 10, color: C.validationErrorText }}>
              ❌ {item.rejectReason}
            </div>
          )}
          {canCancel && (
            <button
              onClick={handleCancel}
              disabled={cancelling}
              style={{
                marginTop: 8, padding: '5px 12px', borderRadius: 8,
                border: `1.5px solid ${C.danger}`, background: 'white',
                color: C.danger, fontFamily: 'Poppins', fontSize: 11, fontWeight: 600,
                cursor: cancelling ? 'wait' : 'pointer', opacity: cancelling ? 0.6 : 1,
              }}
            >
              {cancelling ? 'Membatalkan…' : '✕ Batalkan'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function TopupCard({ item }) {
  const src = TOPUP_SOURCE_META[item.source] || TOPUP_SOURCE_META.other;
  return (
    <div style={{
      background: 'white', borderRadius: 12, padding: '12px 14px', marginBottom: 8,
      boxShadow: SHADOW.sm,
      borderLeft: `4px solid ${C.success}`,
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <div style={{
          width: 38, height: 38, borderRadius: 10, flexShrink: 0,
          background: `${C.successBg}`, border: `1px solid ${C.successBg}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18,
        }}>{src.icon}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
            <div style={{ fontFamily: 'Poppins', fontSize: 13, fontWeight: 600, color: C.n900 }}>
              {src.label}
            </div>
            <div style={{ fontFamily: 'Poppins', fontSize: 13, fontWeight: 800, color: C.success, whiteSpace: 'nowrap' }}>
              +{rp(item.amount)}
            </div>
          </div>
          {item.notes && (
            <div style={{ fontFamily: 'Poppins', fontSize: 11, color: C.n700, marginTop: 2 }}>
              {item.notes}
            </div>
          )}
          {item.referenceNo && (
            <div style={{ fontFamily: 'Poppins', fontSize: 10, color: C.n600, marginTop: 2 }}>
              Ref: {item.referenceNo}
            </div>
          )}
          <div style={{ fontFamily: 'Poppins', fontSize: 10, color: C.n600, marginTop: 4 }}>
            {fmtDate(item.createdAt)} · {item.topupByName}
          </div>
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// Report Panel
// ════════════════════════════════════════════════════════════════════════════
function formatReportRange(start, end) {
  if (!start || !end) return 'Semua periode';
  try {
    const fmt = (s) => new Date(`${s}T00:00:00`).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
    return `${fmt(start)} – ${fmt(end)}`;
  } catch {
    return `${start} – ${end}`;
  }
}

function ReportPanel({ data, loading, period, setPeriod, customRange, setCustomRange, onApplyCustomRange, outletName, rangeStart, rangeEnd }) {
  if (loading) {
    return <div style={{ textAlign: 'center', padding: 40, fontFamily: 'Poppins', fontSize: 12, color: C.n600 }}>Memuat laporan…</div>;
  }
  if (!data || !data.summary) {
    return (
      <div style={{ textAlign: 'center', padding: 50 }}>
        <div style={{ fontSize: 40, marginBottom: 8 }}>📊</div>
        <div style={{ fontFamily: 'Poppins', fontSize: 13, color: C.n600 }}>Belum ada data laporan.</div>
      </div>
    );
  }

  const { summary, byCategory, daily, topSpenders, topExpenses } = data;
  const maxDaily = daily.length > 0 ? Math.max(...daily.map(d => d.totalAmount), 1) : 1;

  return (
    <div>
      <div style={{
        background: 'white', borderRadius: 12, padding: '10px 14px', marginBottom: 12,
        border: `1px solid ${C.n200}`,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
      }}>
        <div>
          <div style={{ fontFamily: 'Poppins', fontSize: 10, fontWeight: 600, color: C.n600, letterSpacing: 0.3 }}>
            RENTANG LAPORAN
          </div>
          <div style={{ fontFamily: 'Poppins', fontSize: 12, fontWeight: 600, color: C.n900, marginTop: 2 }}>
            {formatReportRange(rangeStart, rangeEnd)}
          </div>
          {outletName && (
            <div style={{ fontFamily: 'Poppins', fontSize: 10, color: C.n600, marginTop: 2 }}>
              {outletName}
            </div>
          )}
        </div>
        <div style={{
          fontFamily: 'Poppins', fontSize: 10, fontWeight: 600,
          padding: '4px 8px', borderRadius: 999,
          background: `${C.primary}12`, color: C.primary,
        }}>
          {period?.label || 'Periode'}
        </div>
      </div>

      {/* Period selector */}
      <div style={{ display: 'flex', gap: 6, overflowX: 'auto', marginBottom: 12, scrollbarWidth: 'none' }}>
        {PERIOD_PRESETS.map(p => {
          const active = period.key === p.key;
          return (
            <button
              key={p.key}
              onClick={() => setPeriod(p)}
              style={{
                flexShrink: 0, padding: '5px 11px', borderRadius: 999,
                border: `1.5px solid ${active ? C.primary : C.n200}`,
                background: active ? `${C.primary}10` : 'white',
                fontFamily: 'Poppins', fontSize: 11, fontWeight: active ? 700 : 500,
                color: active ? C.primary : C.n700,
                cursor: 'pointer',
              }}
            >{p.label}</button>
          );
        })}
      </div>

      {/* Custom date range */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 8, marginBottom: 10 }}>
        <label style={{ display: 'block' }}>
          <div style={{ fontFamily: 'Poppins', fontSize: 10, color: C.n600, marginBottom: 4 }}>Dari</div>
          <input
            type="date"
            value={customRange?.startDate || ''}
            onChange={(e) => setCustomRange({
              startDate: e.target.value,
              endDate: customRange?.endDate || '',
            })}
            style={{
              width: '100%', height: 36, borderRadius: 8,
              border: `1.5px solid ${C.n200}`,
              padding: '0 10px', fontFamily: 'Poppins', fontSize: 11,
              color: C.n900, background: 'white', boxSizing: 'border-box',
            }}
          />
        </label>
        <label style={{ display: 'block' }}>
          <div style={{ fontFamily: 'Poppins', fontSize: 10, color: C.n600, marginBottom: 4 }}>Sampai</div>
          <input
            type="date"
            value={customRange?.endDate || ''}
            onChange={(e) => setCustomRange({
              startDate: customRange?.startDate || '',
              endDate: e.target.value,
            })}
            style={{
              width: '100%', height: 36, borderRadius: 8,
              border: `1.5px solid ${C.n200}`,
              padding: '0 10px', fontFamily: 'Poppins', fontSize: 11,
              color: C.n900, background: 'white', boxSizing: 'border-box',
            }}
          />
        </label>
      </div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexDirection: isMobile ? 'column' : 'row' }}>
        <button
          onClick={onApplyCustomRange}
          disabled={!customRange?.startDate || !customRange?.endDate}
          style={{
            flex: 1, padding: '8px 10px', borderRadius: 10,
            border: `1.5px solid ${C.primary}`,
            background: 'white', color: C.primary,
            fontFamily: 'Poppins', fontSize: 11, fontWeight: 600,
            cursor: !customRange?.startDate || !customRange?.endDate ? 'not-allowed' : 'pointer',
            opacity: !customRange?.startDate || !customRange?.endDate ? 0.6 : 1,
          }}
        >Terapkan Rentang</button>
      </div>

      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : '1fr 1fr', gap: 8, marginBottom: 12 }}>
        <SummaryCard
          icon="📤" label="Total Pengeluaran" value={rp(summary.totalExpense)}
          sub={`${summary.totalCount} transaksi`} color={C.danger} bg={C.validationErrorBg}
        />
        <SummaryCard
          icon="📥" label="Total Top-up" value={rp(summary.topupTotal)}
          sub={`${summary.topupCount} kali`} color={C.success} bg={C.successBg}
        />
        <SummaryCard
          icon={summary.netCashFlow >= 0 ? "📈" : "📉"}
          label="Net Cash Flow"
          value={`${summary.netCashFlow >= 0 ? '+' : ''}${rp(summary.netCashFlow)}`}
          sub={summary.netCashFlow >= 0 ? "Surplus" : "Defisit"}
          color={summary.netCashFlow >= 0 ? C.success : C.danger}
          bg={summary.netCashFlow >= 0 ? C.successBg : C.validationErrorBg}
        />
        <SummaryCard
          icon="📊" label="Rata-rata"
          value={rp(summary.avgAmount)}
          sub={`Max: ${rp(summary.maxAmount)}`}
          color={C.primary} bg={C.primaryTint}
        />
      </div>

      {/* Daily trend chart (sparkline) */}
      {daily.length > 1 && (
        <div style={{ background: 'white', borderRadius: 14, padding: '14px 16px', marginBottom: 12, boxShadow: SHADOW.sm }}>
          <div style={{ fontFamily: 'Poppins', fontSize: 11, fontWeight: 600, color: C.n600, letterSpacing: 0.3, marginBottom: 10 }}>
            📈 TREND PENGELUARAN HARIAN
          </div>
          <DailyBarChart daily={daily} maxDaily={maxDaily} />
        </div>
      )}

      {/* Category breakdown */}
      {byCategory.length > 0 && (
        <div style={{ background: 'white', borderRadius: 14, padding: '14px 16px', marginBottom: 12, boxShadow: SHADOW.sm }}>
          <div style={{ fontFamily: 'Poppins', fontSize: 11, fontWeight: 600, color: C.n600, letterSpacing: 0.3, marginBottom: 12 }}>
            🎯 BREAKDOWN PER KATEGORI
          </div>
          <CategoryBreakdown items={byCategory} totalAmount={summary.totalExpense} />
        </div>
      )}

      {/* Top spenders */}
      {topSpenders.length > 0 && (
        <div style={{ background: 'white', borderRadius: 14, padding: '14px 16px', marginBottom: 12, boxShadow: SHADOW.sm }}>
          <div style={{ fontFamily: 'Poppins', fontSize: 11, fontWeight: 600, color: C.n600, letterSpacing: 0.3, marginBottom: 10 }}>
            👤 KASIR PALING AKTIF
          </div>
          {topSpenders.map((s, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0', borderBottom: i < topSpenders.length - 1 ? `1px dashed ${C.n100}` : 'none' }}>
              <div style={{
                width: 28, height: 28, borderRadius: 8,
                background: i === 0 ? C.validationWarningBg : C.n100,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: 'Poppins', fontSize: 11, fontWeight: 800,
                color: i === 0 ? C.validationWarningText : C.n700,
              }}>#{i + 1}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: 'Poppins', fontSize: 12, fontWeight: 600, color: C.n900 }}>
                  {s.userName}
                </div>
                <div style={{ fontFamily: 'Poppins', fontSize: 10, color: C.n600 }}>
                  {s.count} pengeluaran
                </div>
              </div>
              <div style={{ fontFamily: 'Poppins', fontSize: 12, fontWeight: 600, color: C.danger }}>
                {rp(s.totalAmount)}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Top expenses */}
      {topExpenses.length > 0 && (
        <div style={{ background: 'white', borderRadius: 14, padding: '14px 16px', boxShadow: SHADOW.sm }}>
          <div style={{ fontFamily: 'Poppins', fontSize: 11, fontWeight: 600, color: C.n600, letterSpacing: 0.3, marginBottom: 10 }}>
            💸 PENGELUARAN TERBESAR
          </div>
          {topExpenses.slice(0, 5).map((e) => {
            const cat = CATEGORY_META[e.category] || CATEGORY_META.other;
            return (
              <div key={e.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: `1px dashed ${C.n100}` }}>
                <div style={{
                  width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                  background: `${cat.color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16,
                }}>{cat.icon}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: 'Poppins', fontSize: 12, fontWeight: 600, color: C.n900, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {e.description}
                  </div>
                  <div style={{ fontFamily: 'Poppins', fontSize: 10, color: C.n600 }}>
                    {fmtDateOnly(e.createdAt)} · {e.requesterName}
                  </div>
                </div>
                <div style={{ fontFamily: 'Poppins', fontSize: 12, fontWeight: 600, color: C.danger, whiteSpace: 'nowrap' }}>
                  {rp(e.amount)}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function SummaryCard({ icon, label, value, sub, color, bg }) {
  return (
    <div style={{ background: bg, borderRadius: 12, padding: '10px 12px', borderLeft: `4px solid ${color}` }}>
      <div style={{ fontSize: 16, marginBottom: 2 }}>{icon}</div>
      <div style={{ fontFamily: 'Poppins', fontSize: 9, color: C.n600, fontWeight: 600, letterSpacing: 0.3 }}>
        {label.toUpperCase()}
      </div>
      <div style={{ fontFamily: 'Poppins', fontSize: 14, fontWeight: 800, color, marginTop: 2 }}>
        {value}
      </div>
      <div style={{ fontFamily: 'Poppins', fontSize: 9, color: C.n600, marginTop: 1 }}>
        {sub}
      </div>
    </div>
  );
}

function DailyBarChart({ daily, maxDaily }) {
  // Show last N days as bar chart
  const showLastN = daily.slice(-21);
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 100, padding: '0 4px' }}>
        {showLastN.map((d, i) => {
          const heightPct = d.totalAmount > 0 ? (d.totalAmount / maxDaily) * 100 : 0;
          return (
            <div key={d.date} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', justifyContent: 'flex-end' }}>
              <div
                title={`${fmtDateOnly(d.date)}: ${rp(d.totalAmount)} (${d.count} item)`}
                style={{
                  width: '100%', maxWidth: 28,
                  height: `${Math.max(heightPct, d.totalAmount > 0 ? 4 : 0)}%`,
                  background: d.totalAmount > 0 ? `linear-gradient(180deg, ${C.danger}, ${C.dangerDark})` : C.n100,
                  borderRadius: '4px 4px 0 0',
                  transition: 'height 0.3s ease',
                }}
              />
            </div>
          );
        })}
      </div>
      <div style={{ display: 'flex', gap: 3, marginTop: 6, padding: '0 4px' }}>
        {showLastN.map((d) => (
          <div key={d.date + 'lbl'} style={{ flex: 1, fontFamily: 'Poppins', fontSize: 8, color: C.n600, textAlign: 'center', overflow: 'hidden' }}>
            {new Date(d.date).getDate()}
          </div>
        ))}
      </div>
    </div>
  );
}

function CategoryBreakdown({ items, totalAmount }) {
  return (
    <div>
      {items.map((c) => {
        const meta = CATEGORY_META[c.category] || CATEGORY_META.other;
        return (
          <div key={c.category} style={{ marginBottom: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 14 }}>{meta.icon}</span>
                <span style={{ fontFamily: 'Poppins', fontSize: 12, fontWeight: 600, color: C.n800 }}>{meta.label}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontFamily: 'Poppins', fontSize: 11, fontWeight: 600, color: meta.color }}>
                  {rp(c.totalAmount)}
                </span>
                <span style={{ fontFamily: 'Poppins', fontSize: 10, color: C.n600 }}>
                  ({c.percentage}%)
                </span>
              </div>
            </div>
            <div style={{ height: 8, background: C.n100, borderRadius: 4, overflow: 'hidden' }}>
              <div style={{
                width: `${c.percentage}%`, height: '100%',
                background: meta.color,
                transition: 'width 0.4s ease',
              }} />
            </div>
            <div style={{ fontFamily: 'Poppins', fontSize: 9, color: C.n600, marginTop: 2 }}>
              {c.count} pengeluaran
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// Modals
// ════════════════════════════════════════════════════════════════════════════
function FilterModal({ categoryFilter, setCategoryFilter, statusFilter, setStatusFilter, hasPhotoFilter, setHasPhotoFilter, onClose, onReset }) {
  return (
    <Modal visible onClose={onClose} title="Filter Lanjutan">
      <div style={{ padding: '8px 18px 18px' }}>
        <div style={{ fontFamily: 'Poppins', fontSize: 12, fontWeight: 600, color: C.n700, marginBottom: 8 }}>
          🎯 Kategori
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 16 }}>
          <button
            onClick={() => setCategoryFilter('all')}
            style={chipStyle(categoryFilter === 'all', C.primary)}
          >Semua</button>
          {Object.entries(CATEGORY_META).map(([k, m]) => (
            <button
              key={k}
              onClick={() => setCategoryFilter(k)}
              style={chipStyle(categoryFilter === k, m.color)}
            >
              <span style={{ marginRight: 4 }}>{m.icon}</span> {m.label}
            </button>
          ))}
        </div>

        <div style={{ fontFamily: 'Poppins', fontSize: 12, fontWeight: 600, color: C.n700, marginBottom: 8 }}>
          🏷️ Status
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 16 }}>
          {[
            { value: 'all', label: 'Semua' },
            { value: 'auto_approved', label: '✅ Auto OK' },
            { value: 'approved', label: '✅ Disetujui' },
            { value: 'pending_approval', label: '⏳ Pending' },
            { value: 'rejected', label: '❌ Ditolak' },
            { value: 'cancelled', label: '🚫 Dibatalkan' },
          ].map(s => (
            <button
              key={s.value}
              onClick={() => setStatusFilter(s.value)}
              style={chipStyle(statusFilter === s.value, C.primary)}
            >{s.label}</button>
          ))}
        </div>

        <div style={{ fontFamily: 'Poppins', fontSize: 12, fontWeight: 600, color: C.n700, marginBottom: 8 }}>
          📷 Bukti Foto
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, marginBottom: 16 }}>
          {[
            { value: 'all', label: 'Semua' },
            { value: '1', label: '✅ Ada Foto' },
            { value: '0', label: '❌ Tanpa Foto' },
          ].map(s => (
            <button
              key={s.value}
              onClick={() => setHasPhotoFilter(s.value)}
              style={chipStyle(hasPhotoFilter === s.value, C.primary)}
            >{s.label}</button>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 8, marginTop: 16, flexDirection: 'window.innerWidth < 640 ? "column" : "row" : "row"' }}>
          <Btn variant="secondary" onClick={() => { onReset(); onClose(); }} style={{ flex: 1 }}>Reset</Btn>
          <Btn variant="primary" onClick={onClose} style={{ flex: 1 }}>Terapkan</Btn>
        </div>
      </div>
    </Modal>
  );
}

const chipStyle = (active, color) => ({
  padding: '8px 10px', borderRadius: 10,
  border: `1.5px solid ${active ? color : C.n200}`,
  background: active ? `${color}10` : 'white',
  fontFamily: 'Poppins', fontSize: 11, fontWeight: active ? 700 : 500,
  color: active ? color : C.n700,
  cursor: 'pointer', textAlign: 'center',
});

function ExpenseModal({ config, balance, onClose, onSuccess }) {
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('gas');
  const [description, setDescription] = useState('');
  const [picName, setPicName] = useState(''); // PIC / penanggung jawab
  const [receiptPhoto, setReceiptPhoto] = useState(null); // { dataUrl, filename }
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [loading, setLoading] = useState(false);
  const limit = config?.autoApproveLimit || 500_000;

  const numAmount = Number(String(amount).replace(/\D/g, '')) || 0;
  const willNeedApproval = numAmount > limit;
  const insufficientBalance = !willNeedApproval && numAmount > balance;

  // ── Upload photo ─────────────────────────────────────────────────────────────
  const handlePhotoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingPhoto(true);
    try {
      const result = await uploadImage(file, 'receipt');
      setReceiptPhoto({ dataUrl: result.dataUrl, filename: file.name });
    } catch (err) {
      alertError('Gagal upload foto bukti.');
    } finally {
      setUploadingPhoto(false);
    }
  };

  const submit = async () => {
    if (numAmount <= 0) { alertWarning('Nominal harus > 0'); return; }
    if (!description.trim()) { alertWarning('Deskripsi wajib diisi'); return; }
    if (!picName.trim()) { alertWarning('Nama PIC / Penanggung Jawab wajib diisi'); return; }
    if (!receiptPhoto) { alertWarning('Bukti foto pengeluaran wajib diunggah'); return; }
    if (insufficientBalance) {
      alertWarning(`Saldo tidak cukup. Saldo: ${rp(balance)}`);
      return;
    }

    setLoading(true);
    try {
      const result = await submitExpense({
        amount: numAmount,
        category,
        description: description.trim(),
        receiptPhotoUrl: receiptPhoto?.dataUrl || null,
        picName: picName.trim() || null,
      });
      if (result.needsApproval) {
        await alertSuccess(`Pengeluaran ${rp(numAmount)} dikirim ke admin untuk persetujuan.`, { title: 'Menunggu Approval' });
      } else {
        await alertSuccess(`Pengeluaran ${rp(numAmount)} tercatat. Saldo: ${rp(result.balanceAfter)}`);
      }
      onSuccess();
    } catch (err) {
      alertError(err?.response?.data?.message || 'Gagal catat pengeluaran.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible onClose={onClose} title="Catat Pengeluaran">
      <div style={{ padding: '8px 18px 18px' }}>
        <div style={{ background: C.n50, borderRadius: 8, padding: '8px 10px', marginBottom: 12, fontFamily: 'Poppins', fontSize: 11, color: C.n700 }}>
          Saldo tersedia: <strong style={{ color: C.success }}>{rp(balance)}</strong>
          {numAmount > 0 && !willNeedApproval && !insufficientBalance && (
            <span> · Setelah: <strong>{rp(balance - numAmount)}</strong></span>
          )}
        </div>

        <Select
          label="Kategori"
          value={category}
          onChange={setCategory}
          options={Object.entries(CATEGORY_META).map(([k, m]) => ({ value: k, label: `${m.icon} ${m.label}` }))}
        />

        <MoneyInput
          label="Nominal (Rp)"
          value={amount}
          onChange={setAmount}
          placeholder="50.000"
          hint={numAmount > 0 ? `Nominal: ${rp(numAmount)}` : undefined}
        />

        <Textarea
          label="Catatan / Deskripsi"
          value={description}
          onChange={setDescription}
          rows={3}
          placeholder="Mis. Beli gas 12 kg untuk setrika uap"
        />

        {/* PIC field */}
        <div style={{ marginTop: 10 }}>
          <div style={{ fontFamily: 'Poppins', fontSize: 11, fontWeight: 600, color: C.n700, marginBottom: 4 }}>Nama PIC / Penanggung Jawab <span style={{ color: C.danger }}>*</span></div>
          <input
            type="text"
            value={picName}
            onChange={(e) => setPicName(e.target.value)}
            placeholder="Contoh: Sari, Andi Kasir"
            style={{ width: '100%', height: 40, borderRadius: 10, border: `1.5px solid ${C.n300}`, fontFamily: 'Poppins', fontSize: 13, padding: '0 12px', boxSizing: 'border-box', outline: 'none' }}
          />
        </div>

        {/* Photo upload */}
        <div style={{ marginTop: 10 }}>
          <div style={{ fontFamily: 'Poppins', fontSize: 11, fontWeight: 600, color: C.n700, marginBottom: 6 }}>📷 Bukti Foto <span style={{ color: C.danger }}>*</span></div>
          {receiptPhoto ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: C.n50, borderRadius: 10, padding: '10px 12px' }}>
              <img src={receiptPhoto.dataUrl} alt="bukti" style={{ width: 56, height: 56, borderRadius: 8, objectFit: 'cover', border: `1px solid ${C.n200}` }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: 'Poppins', fontSize: 12, color: C.n700, fontWeight: 600 }}>✅ Foto tersimpan</div>
                <div style={{ fontFamily: 'Poppins', fontSize: 10, color: C.n600 }}>{receiptPhoto.filename}</div>
              </div>
              <button
                onClick={() => setReceiptPhoto(null)}
                style={{ width: 28, height: 28, borderRadius: 8, border: `1.5px solid ${C.n200}`, background: 'white', cursor: 'pointer', fontSize: 14, color: C.n600 }}
              >×</button>
            </div>
          ) : (
            <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, height: 56, borderRadius: 10, border: `1.5px dashed ${C.n300}`, cursor: uploadingPhoto ? 'wait' : 'pointer', background: C.n50, opacity: uploadingPhoto ? 0.6 : 1 }}>
              {uploadingPhoto ? (
                <span style={{ fontFamily: 'Poppins', fontSize: 12, color: C.n600 }}>⏳ Mengupload…</span>
              ) : (
                <>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={C.primary} strokeWidth="2" strokeLinecap="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" /></svg>
                  <span style={{ fontFamily: 'Poppins', fontSize: 12, fontWeight: 600, color: C.primary }}>Ambil Foto Bukti</span>
                </>
              )}
              <input type="file" accept="image/*" capture="environment" onChange={handlePhotoUpload} style={{ display: 'none' }} />
            </label>
          )}
        </div>

        {willNeedApproval && (
          <div style={{ background: C.validationWarningBg, borderRadius: 8, padding: '8px 12px', marginBottom: 10, fontFamily: 'Poppins', fontSize: 11, color: C.validationWarningText }}>
            ⚠️ Nominal di atas Rp {limit.toLocaleString('id-ID')} memerlukan persetujuan admin.
          </div>
        )}
        {insufficientBalance && (
          <div style={{ background: C.validationErrorBg, borderRadius: 8, padding: '8px 12px', marginBottom: 10, fontFamily: 'Poppins', fontSize: 11, color: C.validationErrorText }}>
            ❌ Saldo tidak cukup. Minta admin top-up dulu.
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, marginTop: 10, flexDirection: 'window.innerWidth < 640 ? "column" : "row" : "row"' }}>
          <Btn variant="secondary" onClick={onClose} style={{ flex: 1 }}>Batal</Btn>
          <Btn
            variant="primary"
            onClick={submit}
            loading={loading}
            disabled={numAmount <= 0 || !description.trim() || !picName.trim() || !receiptPhoto || insufficientBalance}
            style={{ flex: 1 }}
          >
            {willNeedApproval ? 'Ajukan' : 'Simpan'}
          </Btn>
        </div>
      </div>
    </Modal>
  );
}

function TopupModal({ outletId, outletName, onClose, onSuccess }) {
  const [amount, setAmount] = useState('');
  const [source, setSource] = useState('transfer');
  const [referenceNo, setReferenceNo] = useState('');
  const [notes, setNotes] = useState('');
  const [picName, setPicName] = useState('');
  const [proofPhotoUrl, setProofPhotoUrl] = useState('');
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [loading, setLoading] = useState(false);

  const numAmount = Number(String(amount).replace(/\D/g, '')) || 0;

  const handlePhotoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingPhoto(true);
    try {
      const result = await uploadImage(file, 'documentation');
      setProofPhotoUrl(result.dataUrl);
      alertSuccess('Foto berhasil diunggah');
    } catch (err) {
      alertError(err?.message || 'Gagal upload foto');
    } finally {
      setUploadingPhoto(false);
    }
  };

  const submit = async () => {
    if (numAmount <= 0) { alertWarning('Nominal harus > 0'); return; }
    if (!picName.trim()) { alertWarning('Nama PIC / Penanggung Jawab wajib diisi'); return; }
    if (!proofPhotoUrl.trim()) { alertWarning('Bukti foto transfer wajib diunggah'); return; }

    setLoading(true);
    try {
      const result = await topupCash({
        outletId, 
        amount: numAmount, 
        source,
        referenceNo: referenceNo.trim() || undefined,
        notes: notes.trim() || undefined,
        picName: picName.trim(),
        proofPhotoUrl: proofPhotoUrl.trim(),
      });
      await alertSuccess(`Top-up ${rp(numAmount)} berhasil. Saldo baru: ${rp(result.balanceAfter)}`);
      onSuccess();
    } catch (err) {
      alertError(err?.response?.data?.message || 'Gagal top-up.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible onClose={onClose} title={`Top-up Kas — ${outletName || 'Outlet'}`}>
      <div style={{ padding: '8px 18px 18px' }}>
        <MoneyInput 
          label={<span>Nominal (Rp) <span style={{ color: C.danger }}>*</span></span>} 
          value={amount} 
          onChange={setAmount} 
          placeholder="500.000" 
          hint={numAmount > 0 ? rp(numAmount) : undefined} 
        />
        
        <Input 
          label={<span>Nama PIC / Penanggung Jawab <span style={{ color: C.danger }}>*</span></span>}
          value={picName}
          onChange={setPicName}
          placeholder="Nama lengkap PIC"
        />
        
        <Select
          label="Sumber dana"
          value={source}
          onChange={setSource}
          options={Object.entries(TOPUP_SOURCE_META).map(([k, m]) => ({ value: k, label: `${m.icon} ${m.label}` }))}
        />
        
        <Input 
          label="No. Referensi (opsional)" 
          value={referenceNo} 
          onChange={setReferenceNo} 
          placeholder="No transfer / bukti" 
        />
        
        <Textarea 
          label="Catatan (opsional)" 
          value={notes} 
          onChange={setNotes} 
          rows={2} 
        />

        {/* Upload Bukti Foto */}
        <div style={{ marginTop: 12 }}>
          <div style={{ fontFamily: 'Poppins', fontSize: 11, fontWeight: 600, color: C.n700, marginBottom: 6 }}>
            Bukti Foto Transfer <span style={{ color: C.danger }}>*</span>
          </div>
          <input
            type="file"
            accept="image/*"
            onChange={handlePhotoUpload}
            disabled={uploadingPhoto}
            style={{ display: 'none' }}
            id="topup-proof-upload"
          />
          <label
            htmlFor="topup-proof-upload"
            style={{
              display: 'block',
              padding: '12px 16px',
              background: C.n50,
              border: `1.5px dashed ${C.n300}`,
              borderRadius: 12,
              cursor: uploadingPhoto ? 'not-allowed' : 'pointer',
              textAlign: 'center',
              fontFamily: 'Poppins',
              fontSize: 12,
              color: C.n600,
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => !uploadingPhoto && (e.currentTarget.style.borderColor = C.primary)}
            onMouseLeave={(e) => (e.currentTarget.style.borderColor = C.n300)}
          >
            {uploadingPhoto ? '📤 Mengunggah...' : proofPhotoUrl ? '✅ Foto terupload — Klik untuk ganti' : '📷 Klik untuk upload foto'}
          </label>
          
          {proofPhotoUrl && !uploadingPhoto && (
            <div style={{ marginTop: 8, textAlign: 'center' }}>
              <img 
                src={proofPhotoUrl} 
                alt="Bukti transfer" 
                style={{ 
                  maxWidth: '100%', 
                  maxHeight: 200, 
                  borderRadius: 8, 
                  border: `1px solid ${C.n200}`,
                  objectFit: 'contain'
                }} 
              />
            </div>
          )}
          
          <div style={{ fontFamily: 'Poppins', fontSize: 10, color: C.n500, marginTop: 4 }}>
            Maks. 5MB • Format: JPG, PNG, atau JPEG
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
          <Btn variant="secondary" onClick={onClose} style={{ flex: 1 }}>Batal</Btn>
          <Btn 
            variant="primary" 
            onClick={submit} 
            loading={loading} 
            disabled={numAmount <= 0 || !picName.trim() || !proofPhotoUrl.trim() || uploadingPhoto} 
            style={{ flex: 1 }}
          >
            Top-up
          </Btn>
        </div>
      </div>
    </Modal>
  );
}

function ReconcileModal({ outletId, currentBalance, onClose, onSuccess }) {
  const [actual, setActual] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);

  const numActual = Number(String(actual).replace(/\D/g, '')) || 0;
  const diff = numActual - currentBalance;

  const submit = async () => {
    if (!actual) { alertWarning('Isi saldo aktual'); return; }
    if (!notes.trim()) { alertWarning('Notes alasan wajib'); return; }
    setLoading(true);
    try {
      await reconcileBalance({ outletId, actualBalance: numActual, notes: notes.trim() });
      await alertSuccess(`Rekonsiliasi tercatat. Saldo: ${rp(numActual)} (selisih: ${diff > 0 ? '+' : ''}${rp(diff)})`);
      onSuccess();
    } catch (err) {
      alertError(err?.response?.data?.message || 'Gagal rekonsiliasi.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible onClose={onClose} title="Rekonsiliasi Saldo">
      <div style={{ padding: '8px 18px 18px' }}>
        <div style={{ background: C.n50, borderRadius: 8, padding: '10px 12px', marginBottom: 12, fontFamily: 'Poppins', fontSize: 12, color: C.n700 }}>
          Saldo sistem: <strong>{rp(currentBalance)}</strong>
        </div>
        <MoneyInput
          label="Saldo aktual (kas fisik)"
          value={actual}
          onChange={setActual}
          placeholder="Masukkan jumlah uang fisik"
          hint={numActual > 0 ? `${rp(numActual)} (${diff > 0 ? '+' : ''}${rp(diff)})` : undefined}
        />
        <Textarea
          label="Alasan rekonsiliasi (wajib)"
          value={notes}
          onChange={setNotes}
          rows={3}
          placeholder="Mis. Selisih kembalian belum dicatat"
        />
        <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
          <Btn variant="secondary" onClick={onClose} style={{ flex: 1 }}>Batal</Btn>
          <Btn variant="primary" onClick={submit} loading={loading} disabled={!actual || !notes.trim()} style={{ flex: 1 }}>
            Simpan
          </Btn>
        </div>
      </div>
    </Modal>
  );
}
