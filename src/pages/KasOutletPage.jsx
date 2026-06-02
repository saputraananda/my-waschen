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
import { C } from '../utils/theme';
import { rp } from '../utils/helpers';
import { TopBar, Btn, Modal, Input, Select, Textarea, useAppRefresh, SearchBar, MoneyInput } from '../components/ui';
import { alertError, alertSuccess, alertWarning } from '../utils/alert';
import { useApp } from '../context/AppContext';
import { useInfiniteList } from '../utils/useInfiniteList';
import {
  getBalance, getAllBalances, topupCash, submitExpense, reconcileBalance,
  getCashSummary, getCashConfig,
  exportCashCsv,
  CATEGORY_META, TOPUP_SOURCE_META, STATUS_META,
} from '../utils/outletCashApi';

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
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
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
      console.error('[fetchBalance]', err);
    }
  }, [isAdmin, selectedOutletId]);

  useEffect(() => { fetchBalance(); }, [fetchBalance]);

  // Filter range
  const { startDate, endDate } = useMemo(() => periodToRange(period), [period]);

  // ── Infinite list expenses
  const expensesList = useInfiniteList({
    fetchPage: useCallback(async ({ page, pageSize, signal }) => {
      const params = { page, limit: pageSize, startDate, endDate };
      if (selectedOutletId) params.outletId = selectedOutletId;
      if (categoryFilter !== 'all') params.category = categoryFilter;
      if (statusFilter !== 'all') params.status = statusFilter;
      if (search.trim()) params.search = search.trim();
      const res = await axios.get('/api/outlet-cash/expenses', { params, signal });
      return {
        items: res?.data?.data || [],
        total: res?.data?.pagination?.total ?? null,
      };
    }, [selectedOutletId, categoryFilter, statusFilter, search, startDate, endDate]),
    pageSize: 20,
    deps: [selectedOutletId, categoryFilter, statusFilter, search, startDate, endDate],
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
        startDate, endDate,
      });
      setReportData(data);
    } catch (err) {
      console.error('[fetchReport]', err);
    } finally {
      setReportLoading(false);
    }
  }, [selectedOutletId, startDate, endDate]);

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
    + (search.trim() ? 1 : 0);

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: C.n50, overflow: 'hidden' }}>
      <TopBar
        title="Kas Operasional"
        subtitle={balance?.outletName || ''}
        onBack={goBack}
      />

      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px 24px' }}>
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
                  boxShadow: active ? '0 1px 4px rgba(15,23,42,0.06)' : 'none',
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
            <div style={{ display: 'flex', gap: 8, marginBottom: 10, alignItems: 'center' }}>
              <div style={{ flex: 1, display: 'flex', gap: 6, overflowX: 'auto', scrollbarWidth: 'none' }}>
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
              <div style={{ textAlign: 'center', padding: 30, fontFamily: 'Poppins', fontSize: 12, color: C.n500 }}>
                Memuat…
              </div>
            )}
            {!expensesList.loading && expensesList.items.length === 0 && (
              <div style={{ textAlign: 'center', padding: 50 }}>
                <div style={{ fontSize: 40, marginBottom: 8 }}>📭</div>
                <div style={{ fontFamily: 'Poppins', fontSize: 13, color: C.n500 }}>
                  {activeFilterCount > 0 || search ? 'Tidak ada hasil sesuai filter.' : 'Belum ada pengeluaran.'}
                </div>
              </div>
            )}
            {expensesList.items.map(it => <ExpenseCard key={it.id} item={it} />)}

            {expensesList.hasMore && !expensesList.loading && (
              <div ref={expensesList.sentinelRef} style={{ padding: '14px 0', textAlign: 'center' }}>
                {expensesList.loadingMore ? (
                  <span style={{ fontFamily: 'Poppins', fontSize: 11, color: C.n500 }}>Memuat lebih banyak…</span>
                ) : (
                  <span style={{ fontFamily: 'Poppins', fontSize: 11, color: C.n400 }}>·</span>
                )}
              </div>
            )}
            {!expensesList.hasMore && expensesList.items.length > 0 && (
              <div style={{ textAlign: 'center', padding: '14px 0', fontFamily: 'Poppins', fontSize: 10, color: C.n400 }}>
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
              <div style={{ textAlign: 'center', padding: 30, fontFamily: 'Poppins', fontSize: 12, color: C.n500 }}>Memuat…</div>
            )}
            {!topupsList.loading && topupsList.items.length === 0 && (
              <div style={{ textAlign: 'center', padding: 50 }}>
                <div style={{ fontSize: 40, marginBottom: 8 }}>💵</div>
                <div style={{ fontFamily: 'Poppins', fontSize: 13, color: C.n500 }}>Belum ada top-up.</div>
              </div>
            )}
            {topupsList.items.map(it => <TopupCard key={it.id} item={it} />)}

            {topupsList.hasMore && !topupsList.loading && (
              <div ref={topupsList.sentinelRef} style={{ padding: '14px 0', textAlign: 'center' }}>
                {topupsList.loadingMore && <span style={{ fontFamily: 'Poppins', fontSize: 11, color: C.n500 }}>Memuat…</span>}
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
                      startDate, endDate,
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
                  fontFamily: 'Poppins', fontSize: 12, fontWeight: 700,
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
              period={period}
              setPeriod={setPeriod}
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
          onClose={() => setShowFilterModal(false)}
          onReset={() => { setCategoryFilter('all'); setStatusFilter('all'); setSearch(''); }}
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
        ? 'linear-gradient(135deg, #7C2D12 0%, #B91C1C 100%)'
        : 'linear-gradient(135deg, #064E3B 0%, #065F46 50%, #0F766E 100%)',
      borderRadius: 18,
      padding: '18px 20px',
      color: 'white',
      boxShadow: '0 8px 32px rgba(15,23,42,0.18)',
      position: 'relative', overflow: 'hidden',
    }}>
      <div style={{
        position: 'absolute', top: -50, right: -40, width: 180, height: 180, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(255,255,255,0.15), transparent 70%)',
        pointerEvents: 'none',
      }} />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8, position: 'relative' }}>
        <div>
          <div style={{ fontFamily: 'Poppins', fontSize: 10, color: 'rgba(255,255,255,0.7)', fontWeight: 700, letterSpacing: 0.5 }}>
            💼 SALDO KAS OUTLET
          </div>
          <div style={{ fontFamily: 'Poppins', fontSize: 11, color: 'rgba(255,255,255,0.85)', marginTop: 2 }}>
            {balance?.outletName || '—'}
          </div>
        </div>
        {isLow && (
          <span style={{
            background: 'rgba(255,255,255,0.2)', color: 'white',
            fontFamily: 'Poppins', fontSize: 10, fontWeight: 700,
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
              color: 'white', fontFamily: 'Poppins', fontSize: 13, fontWeight: 700,
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
                color: 'white', fontFamily: 'Poppins', fontSize: 13, fontWeight: 700,
                cursor: 'pointer', backdropFilter: 'blur(10px)',
              }}
            >📥 Top-up</button>
            <button
              onClick={onReconcile}
              style={{
                flex: 1, minWidth: 110, padding: '10px 12px', borderRadius: 12,
                background: 'rgba(255,255,255,0.10)', border: '1.5px solid rgba(255,255,255,0.25)',
                color: 'white', fontFamily: 'Poppins', fontSize: 13, fontWeight: 700,
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
function ExpenseCard({ item }) {
  const cat = CATEGORY_META[item.category] || CATEGORY_META.other;
  const status = STATUS_META[item.status] || STATUS_META.auto_approved;
  return (
    <div style={{
      background: 'white', borderRadius: 12, padding: '12px 14px', marginBottom: 8,
      boxShadow: '0 1px 4px rgba(15,23,42,0.05)',
      borderLeft: `4px solid ${cat.color}`,
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <div style={{
          width: 38, height: 38, borderRadius: 10, flexShrink: 0,
          background: `${cat.color}15`, border: `1px solid ${cat.color}30`,
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18,
        }}>{cat.icon}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
            <div style={{ fontFamily: 'Poppins', fontSize: 13, fontWeight: 700, color: C.n900 }}>
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
              fontFamily: 'Poppins', fontSize: 9, fontWeight: 700,
              padding: '2px 7px', borderRadius: 999,
              background: status.bg, color: status.fg,
            }}>{status.label}</span>
            <span style={{ fontFamily: 'Poppins', fontSize: 10, color: C.n500 }}>
              {fmtDate(item.createdAt)} · {item.requesterName}
            </span>
          </div>
          {item.receiptPhotoUrl && (
            <a href={item.receiptPhotoUrl} target="_blank" rel="noreferrer" style={{ display: 'inline-block', marginTop: 6 }}>
              <img src={item.receiptPhotoUrl} alt="bon" style={{ width: 50, height: 50, borderRadius: 6, objectFit: 'cover', border: `1px solid ${C.n200}` }} />
            </a>
          )}
          {item.rejectReason && (
            <div style={{ background: '#FEE2E2', borderRadius: 6, padding: '4px 8px', marginTop: 6, fontFamily: 'Poppins', fontSize: 10, color: '#991B1B' }}>
              ❌ {item.rejectReason}
            </div>
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
      boxShadow: '0 1px 4px rgba(15,23,42,0.05)',
      borderLeft: '4px solid #10B981',
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <div style={{
          width: 38, height: 38, borderRadius: 10, flexShrink: 0,
          background: '#ECFDF5', border: '1px solid #BBF7D0',
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18,
        }}>{src.icon}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
            <div style={{ fontFamily: 'Poppins', fontSize: 13, fontWeight: 700, color: C.n900 }}>
              {src.label}
            </div>
            <div style={{ fontFamily: 'Poppins', fontSize: 13, fontWeight: 800, color: '#15803D', whiteSpace: 'nowrap' }}>
              +{rp(item.amount)}
            </div>
          </div>
          {item.notes && (
            <div style={{ fontFamily: 'Poppins', fontSize: 11, color: C.n700, marginTop: 2 }}>
              {item.notes}
            </div>
          )}
          {item.referenceNo && (
            <div style={{ fontFamily: 'Poppins', fontSize: 10, color: C.n500, marginTop: 2 }}>
              Ref: {item.referenceNo}
            </div>
          )}
          <div style={{ fontFamily: 'Poppins', fontSize: 10, color: C.n500, marginTop: 4 }}>
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
function ReportPanel({ data, loading, period, setPeriod, outletName }) {
  if (loading) {
    return <div style={{ textAlign: 'center', padding: 40, fontFamily: 'Poppins', fontSize: 12, color: C.n500 }}>Memuat laporan…</div>;
  }
  if (!data || !data.summary) {
    return (
      <div style={{ textAlign: 'center', padding: 50 }}>
        <div style={{ fontSize: 40, marginBottom: 8 }}>📊</div>
        <div style={{ fontFamily: 'Poppins', fontSize: 13, color: C.n500 }}>Belum ada data laporan.</div>
      </div>
    );
  }

  const { summary, byCategory, daily, topSpenders, topExpenses } = data;
  const maxDaily = daily.length > 0 ? Math.max(...daily.map(d => d.totalAmount), 1) : 1;

  return (
    <div>
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

      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
        <SummaryCard
          icon="📤" label="Total Pengeluaran" value={rp(summary.totalExpense)}
          sub={`${summary.totalCount} transaksi`} color="#DC2626" bg="#FEE2E2"
        />
        <SummaryCard
          icon="📥" label="Total Top-up" value={rp(summary.topupTotal)}
          sub={`${summary.topupCount} kali`} color="#15803D" bg="#DCFCE7"
        />
        <SummaryCard
          icon={summary.netCashFlow >= 0 ? "📈" : "📉"}
          label="Net Cash Flow"
          value={`${summary.netCashFlow >= 0 ? '+' : ''}${rp(summary.netCashFlow)}`}
          sub={summary.netCashFlow >= 0 ? "Surplus" : "Defisit"}
          color={summary.netCashFlow >= 0 ? '#15803D' : '#DC2626'}
          bg={summary.netCashFlow >= 0 ? '#DCFCE7' : '#FEE2E2'}
        />
        <SummaryCard
          icon="📊" label="Rata-rata"
          value={rp(summary.avgAmount)}
          sub={`Max: ${rp(summary.maxAmount)}`}
          color="#7C3AED" bg="#EDE9FE"
        />
      </div>

      {/* Daily trend chart (sparkline) */}
      {daily.length > 1 && (
        <div style={{ background: 'white', borderRadius: 14, padding: '14px 16px', marginBottom: 12, boxShadow: '0 2px 8px rgba(15,23,42,0.05)' }}>
          <div style={{ fontFamily: 'Poppins', fontSize: 11, fontWeight: 700, color: C.n500, letterSpacing: 0.3, marginBottom: 10 }}>
            📈 TREND PENGELUARAN HARIAN
          </div>
          <DailyBarChart daily={daily} maxDaily={maxDaily} />
        </div>
      )}

      {/* Category breakdown */}
      {byCategory.length > 0 && (
        <div style={{ background: 'white', borderRadius: 14, padding: '14px 16px', marginBottom: 12, boxShadow: '0 2px 8px rgba(15,23,42,0.05)' }}>
          <div style={{ fontFamily: 'Poppins', fontSize: 11, fontWeight: 700, color: C.n500, letterSpacing: 0.3, marginBottom: 12 }}>
            🎯 BREAKDOWN PER KATEGORI
          </div>
          <CategoryBreakdown items={byCategory} totalAmount={summary.totalExpense} />
        </div>
      )}

      {/* Top spenders */}
      {topSpenders.length > 0 && (
        <div style={{ background: 'white', borderRadius: 14, padding: '14px 16px', marginBottom: 12, boxShadow: '0 2px 8px rgba(15,23,42,0.05)' }}>
          <div style={{ fontFamily: 'Poppins', fontSize: 11, fontWeight: 700, color: C.n500, letterSpacing: 0.3, marginBottom: 10 }}>
            👤 KASIR PALING AKTIF
          </div>
          {topSpenders.map((s, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0', borderBottom: i < topSpenders.length - 1 ? `1px dashed ${C.n100}` : 'none' }}>
              <div style={{
                width: 28, height: 28, borderRadius: 8,
                background: i === 0 ? '#FEF3C7' : C.n100,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: 'Poppins', fontSize: 11, fontWeight: 800,
                color: i === 0 ? '#92400E' : C.n700,
              }}>#{i + 1}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: 'Poppins', fontSize: 12, fontWeight: 700, color: C.n900 }}>
                  {s.userName}
                </div>
                <div style={{ fontFamily: 'Poppins', fontSize: 10, color: C.n500 }}>
                  {s.count} pengeluaran
                </div>
              </div>
              <div style={{ fontFamily: 'Poppins', fontSize: 12, fontWeight: 700, color: C.danger }}>
                {rp(s.totalAmount)}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Top expenses */}
      {topExpenses.length > 0 && (
        <div style={{ background: 'white', borderRadius: 14, padding: '14px 16px', boxShadow: '0 2px 8px rgba(15,23,42,0.05)' }}>
          <div style={{ fontFamily: 'Poppins', fontSize: 11, fontWeight: 700, color: C.n500, letterSpacing: 0.3, marginBottom: 10 }}>
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
                  <div style={{ fontFamily: 'Poppins', fontSize: 10, color: C.n500 }}>
                    {fmtDateOnly(e.createdAt)} · {e.requesterName}
                  </div>
                </div>
                <div style={{ fontFamily: 'Poppins', fontSize: 12, fontWeight: 700, color: C.danger, whiteSpace: 'nowrap' }}>
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
      <div style={{ fontFamily: 'Poppins', fontSize: 9, color: C.n600, fontWeight: 700, letterSpacing: 0.3 }}>
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
                  background: d.totalAmount > 0 ? 'linear-gradient(180deg, #DC2626, #991B1B)' : C.n100,
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
          <div key={d.date + 'lbl'} style={{ flex: 1, fontFamily: 'Poppins', fontSize: 8, color: C.n500, textAlign: 'center', overflow: 'hidden' }}>
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
                <span style={{ fontFamily: 'Poppins', fontSize: 11, fontWeight: 700, color: meta.color }}>
                  {rp(c.totalAmount)}
                </span>
                <span style={{ fontFamily: 'Poppins', fontSize: 10, color: C.n500 }}>
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
            <div style={{ fontFamily: 'Poppins', fontSize: 9, color: C.n500, marginTop: 2 }}>
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
function FilterModal({ categoryFilter, setCategoryFilter, statusFilter, setStatusFilter, onClose, onReset }) {
  return (
    <Modal visible onClose={onClose} title="Filter Lanjutan">
      <div style={{ padding: '8px 18px 18px' }}>
        <div style={{ fontFamily: 'Poppins', fontSize: 12, fontWeight: 700, color: C.n700, marginBottom: 8 }}>
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

        <div style={{ fontFamily: 'Poppins', fontSize: 12, fontWeight: 700, color: C.n700, marginBottom: 8 }}>
          🏷️ Status
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
          {[
            { value: 'all', label: 'Semua' },
            { value: 'auto_approved', label: '✅ Auto OK' },
            { value: 'approved', label: '✅ Disetujui' },
            { value: 'pending_approval', label: '⏳ Pending' },
            { value: 'rejected', label: '❌ Ditolak' },
          ].map(s => (
            <button
              key={s.value}
              onClick={() => setStatusFilter(s.value)}
              style={chipStyle(statusFilter === s.value, C.primary)}
            >{s.label}</button>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
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
  const [loading, setLoading] = useState(false);
  const limit = config?.autoApproveLimit || 500_000;

  const numAmount = Number(String(amount).replace(/\D/g, '')) || 0;
  const willNeedApproval = numAmount > limit;
  const insufficientBalance = !willNeedApproval && numAmount > balance;

  const submit = async () => {
    if (numAmount <= 0) { alertWarning('Nominal harus > 0'); return; }
    if (!description.trim()) { alertWarning('Deskripsi wajib diisi'); return; }
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

        {willNeedApproval && (
          <div style={{ background: '#FEF3C7', borderRadius: 8, padding: '8px 12px', marginBottom: 10, fontFamily: 'Poppins', fontSize: 11, color: '#92400E' }}>
            ⚠️ Nominal di atas Rp {limit.toLocaleString('id-ID')} memerlukan persetujuan admin.
          </div>
        )}
        {insufficientBalance && (
          <div style={{ background: '#FEE2E2', borderRadius: 8, padding: '8px 12px', marginBottom: 10, fontFamily: 'Poppins', fontSize: 11, color: '#991B1B' }}>
            ❌ Saldo tidak cukup. Minta admin top-up dulu.
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
          <Btn variant="secondary" onClick={onClose} style={{ flex: 1 }}>Batal</Btn>
          <Btn
            variant="primary"
            onClick={submit}
            loading={loading}
            disabled={numAmount <= 0 || !description.trim() || insufficientBalance}
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
  const [loading, setLoading] = useState(false);

  const numAmount = Number(String(amount).replace(/\D/g, '')) || 0;

  const submit = async () => {
    if (numAmount <= 0) { alertWarning('Nominal harus > 0'); return; }
    setLoading(true);
    try {
      const result = await topupCash({
        outletId, amount: numAmount, source,
        referenceNo: referenceNo.trim() || undefined,
        notes: notes.trim() || undefined,
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
        <MoneyInput label="Nominal (Rp)" value={amount} onChange={setAmount} placeholder="500.000" hint={numAmount > 0 ? rp(numAmount) : undefined} />
        <Select
          label="Sumber dana"
          value={source}
          onChange={setSource}
          options={Object.entries(TOPUP_SOURCE_META).map(([k, m]) => ({ value: k, label: `${m.icon} ${m.label}` }))}
        />
        <Input label="No. Referensi (opsional)" value={referenceNo} onChange={setReferenceNo} placeholder="No transfer / bukti" />
        <Textarea label="Catatan (opsional)" value={notes} onChange={setNotes} rows={2} />
        <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
          <Btn variant="secondary" onClick={onClose} style={{ flex: 1 }}>Batal</Btn>
          <Btn variant="primary" onClick={submit} loading={loading} disabled={numAmount <= 0} style={{ flex: 1 }}>
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
