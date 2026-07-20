// ─────────────────────────────────────────────────────────────────────────────
// KasOutletPage — Redesigned v2 (match new design spec)
// ─────────────────────────────────────────────────────────────────────────────
// Features:
// - Hero header dengan balance display gradient
// - Outlet picker untuk admin
// - Tabs: Pengeluaran | Top-up | Laporan
// - Search bar dengan filter popup
// - Period chips selector
// - List dengan pagination + page dropdown
// - Image preview popup
// - Report tab dengan stats & breakdown
// ─────────────────────────────────────────────────────────────────────────────
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';
import { C, SHADOW } from '../utils/theme';
import { rp } from '../utils/helpers';
import { useResponsive, useIsMobile } from '../utils/hooks';
import { TopBar, Btn, Modal, Input, Select, Textarea, useAppRefresh, MoneyInput } from '../components/ui';
import { alertError, alertSuccess, alertWarning } from '../utils/alert';
import { useApp } from '../context/AppContext';
import {
  getBalance, getAllBalances, topupCash, submitExpense, reconcileBalance,
  getCashSummary, getCashConfig, cancelExpense,
  exportCashCsv,
  CATEGORY_META, TOPUP_SOURCE_META, STATUS_META,
} from '../utils/outletCashApi';
import { uploadImage } from '../utils/imageUpload';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// ── Design Tokens (match new spec) ──────────────────────────────────────────────
const DT = {
  primary: '#7C3AED',
  primaryDark: '#5B21B6',
  primaryTint: '#F5F3FF',
  success: '#16A34A',
  successDark: '#116932',
  successBg: '#EFFDF4',
  danger: '#DC2626',
  dangerDark: '#8F1D1D',
  dangerBg: '#FEF2F2',
  warning: '#D97706',
  warningBg: '#FFFBEB',
  info: '#2563EB',
  n50: '#F8FAFC',
  n100: '#F1F5F9',
  n200: '#E4E9F1',
  n300: '#CBD5E1',
  n500: '#6B7788',
  n600: '#4B5768',
  n700: '#334155',
  n800: '#1E2734',
  n900: '#0F172A',
};

// ── Helpers ─────────────────────────────────────────────────────────────────────
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

// ── Pagination Helper ─────────────────────────────────────────────────────────────
function usePaginatedList({ fetchPage, pageSize = 20, deps = [], enabled = true }) {
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const abortRef = useRef(null);

  const totalPagesCalc = Math.max(1, Math.ceil(total / pageSize));
  const hasMore = page < totalPagesCalc;

  const loadPage = useCallback(async (pageNum, isLoadMore = false) => {
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    if (isLoadMore) setLoadingMore(true);
    else setLoading(true);

    try {
      const result = await fetchPage({ page: pageNum, pageSize, signal: controller.signal });
      if (isLoadMore) {
        setItems(prev => [...prev, ...(result.items || [])]);
      } else {
        setItems(result.items || []);
      }
      if (result.total !== undefined) {
        setTotal(result.total);
        setTotalPages(Math.max(1, Math.ceil(result.total / pageSize)));
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        console.error('Load error:', err);
      }
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [fetchPage, pageSize]);

  useEffect(() => {
    if (enabled) {
      setPage(1);
      loadPage(1, false);
    }
  }, [enabled, ...deps]);

  const loadMore = useCallback(() => {
    if (!hasMore || loadingMore) return;
    const nextPage = page + 1;
    setPage(nextPage);
    loadPage(nextPage, true);
  }, [hasMore, loadingMore, page, loadPage]);

  const refresh = useCallback(() => {
    setPage(1);
    loadPage(1, false);
  }, [loadPage]);

  const goToPage = useCallback((pageNum) => {
    const targetPage = Math.max(1, Math.min(pageNum, totalPagesCalc));
    setPage(targetPage);
    loadPage(targetPage, false);
  }, [totalPagesCalc, loadPage]);

  return {
    items,
    page,
    totalPages: totalPagesCalc,
    total,
    loading,
    loadingMore,
    hasMore,
    refresh,
    loadMore,
    goToPage,
    setPage,
  };
}

// ── Image Preview Modal ─────────────────────────────────────────────────────────
function ImagePreviewModal({ src, onClose }) {
  if (!src) return null;
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.85)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 9500, padding: 20, cursor: 'pointer',
        backdropFilter: 'blur(4px)',
      }}
    >
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: '90vw', maxHeight: '85vh', borderRadius: 16,
          overflow: 'hidden', boxShadow: '0 25px 80px rgba(0,0,0,0.4)',
        }}
      >
        <img
          src={src}
          alt="Preview"
          style={{
            maxWidth: '90vw', maxHeight: '85vh', objectFit: 'contain',
            display: 'block',
          }}
        />
        <div style={{
          position: 'absolute', top: 16, right: 16,
          width: 36, height: 36, borderRadius: '50%',
          background: 'rgba(255,255,255,0.9)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', fontSize: 18, color: DT.n800,
        }}
          onClick={onClose}
        >
          x
        </div>
      </motion.div>
    </motion.div>
  );
}

export default function KasOutletPage({ goBack }) {
  const { isMobile } = useResponsive();
  const { user } = useApp();
  const userRole = user?.originalRoleCode || user?.roleCode || user?.role;
  const isAdmin = ['admin'].includes(userRole);
  const isKasir = ['frontline'].includes(userRole);

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

  // Image preview
  const [previewImage, setPreviewImage] = useState(null);

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

  // ── Paginated expenses list
  const expensesList = usePaginatedList({
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
    deps: [selectedOutletId, categoryFilter, statusFilter, search, startDate, endDate],
    enabled: tab === 'expenses',
  });

  // ── Paginated topups list
  const topupsList = usePaginatedList({
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

  // Balance info
  const balanceAmt = Number(balance?.balance || 0);
  const minBalance = config?.minBalance || 500_000;
  const isLowBalance = balanceAmt < minBalance && balanceAmt >= 0;
  const gaugePercent = Math.min(100, (balanceAmt / (minBalance * 2)) * 100);

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: DT.n100, overflow: 'hidden' }}>
      <AnimatePresence>
        {previewImage && (
          <ImagePreviewModal src={previewImage} onClose={() => setPreviewImage(null)} />
        )}
      </AnimatePresence>

      {/* ── HERO HEADER ── */}
      <div style={{
        background: 'linear-gradient(120deg, #170B29 0%, #3B1B52 38%, #6E2E68 72%, #9C3F7E 100%)',
        padding: '14px 18px 18px',
        borderRadius: '0 0 20px 20px',
        position: 'relative',
        overflow: 'hidden',
        flexShrink: 0,
      }}>
        {/* Decorative orbs */}
        <div style={{
          position: 'absolute', top: -70, right: -30, width: 260, height: 260,
          borderRadius: '50%', background: 'radial-gradient(circle, rgba(255,255,255,.16), transparent 70%)',
          pointerEvents: 'none',
        }} />
        <div style={{
          position: 'absolute', bottom: -90, left: '18%', width: 220, height: 220,
          borderRadius: '50%', background: 'radial-gradient(circle, rgba(236,72,153,.22), transparent 70%)',
          pointerEvents: 'none',
        }} />

        {/* Top row with back button */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, position: 'relative', zIndex: 1 }}>
          <button
            onClick={goBack}
            style={{
              width: 30, height: 30, borderRadius: 9, border: '1px solid rgba(255,255,255,.14)',
              background: 'rgba(255,255,255,.06)', color: '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0,
            }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M15 18l-6-6 6-6"/></svg>
          </button>
          <div>
            <div style={{ fontFamily: 'Poppins', fontSize: 15, fontWeight: 700, color: '#fff', lineHeight: 1.2 }}>
              Kas Operasional
            </div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,.5)', marginTop: 1 }}>
              {balance?.outletName || 'Waschen Laundry'}
            </div>
          </div>
        </div>

        {/* Balance display */}
        <div style={{
          background: isLowBalance
            ? 'linear-gradient(160deg, rgba(220,38,38,.4), rgba(220,38,38,.08))'
            : 'linear-gradient(160deg, rgba(124,58,237,.4), rgba(124,58,237,.08))',
          border: `1px solid ${isLowBalance ? 'rgba(220,38,38,.45)' : 'rgba(124,58,237,.4)'}`,
          borderRadius: 16, padding: '16px 18px 17px', position: 'relative', zIndex: 1,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: .5, color: 'rgba(255,255,255,.55)' }}>
              SALDO KAS OUTLET
            </span>
            {isLowBalance && (
              <span style={{ fontSize: 9.5, fontWeight: 700, padding: '3px 8px', borderRadius: 99, background: 'rgba(220,38,38,.9)', color: '#fff' }}>
                RENDAH
              </span>
            )}
          </div>
          <div style={{ fontFamily: 'Poppins', fontSize: 36, fontWeight: 800, color: '#fff', marginTop: 8, letterSpacing: -.5 }}>
            {rp(balanceAmt)}
          </div>

          {/* Balance gauge */}
          <div style={{ height: 6, borderRadius: 99, background: 'rgba(255,255,255,.12)', marginTop: 12, overflow: 'hidden', position: 'relative' }}>
            <div style={{
              display: 'block', height: '100%', width: `${gaugePercent}%`,
              borderRadius: 99, background: 'linear-gradient(90deg, #DC2626, #F59E0B, #16A34A)',
            }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'rgba(255,255,255,.45)', marginTop: 6 }}>
            <span>Rp 0</span>
            <span>Batas aman {rp(minBalance)}</span>
          </div>

          {balance?.last_topup_at && (
            <div style={{ fontSize: 10.5, color: 'rgba(255,255,255,.55)', marginTop: 10 }}>
              Top-up terakhir: {fmtDate(balance.last_topup_at)}
            </div>
          )}
        </div>

        {/* Action row */}
        <div style={{ display: 'flex', alignItems: 'stretch', gap: 10, marginTop: 12, flexWrap: 'wrap', position: 'relative', zIndex: 1 }}>
          {/* Outlet picker for admin */}
          {isAdmin && allBalances.length > 0 && (
            <div style={{
              flex: '1 1 240px', display: 'flex', alignItems: 'center', gap: 8,
              background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.12)',
              color: 'rgba(255,255,255,.85)', borderRadius: 11, padding: '0 13px', minHeight: 44,
            }}>
              <span style={{ fontSize: 14 }}>📍</span>
              <select
                value={selectedOutletId || ''}
                onChange={(e) => {
                  const newId = Number(e.target.value);
                  setSelectedOutletId(newId);
                  const b = allBalances.find(o => o.outletId === newId);
                  setBalance(b || null);
                }}
                style={{
                  flex: 1, background: 'transparent', border: 'none', color: 'rgba(255,255,255,.85)',
                  fontSize: 12, fontFamily: 'Poppins', outline: 'none', cursor: 'pointer',
                }}
              >
                {allBalances.map(o => (
                  <option key={o.outletId} value={o.outletId} style={{ color: DT.n800 }}>
                    {o.outletName} — {rp(o.balance)}
                  </option>
                ))}
              </select>
            </div>
          )}

          {isKasir && (
            <button
              onClick={() => setShowExpenseModal(true)}
              style={{
                flex: '1 1 200px', minHeight: 44, borderRadius: 11, border: 'none',
                background: DT.primary, color: '#fff',
                fontFamily: 'Poppins', fontSize: 13, fontWeight: 700,
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
              }}
            >
              Catat Pengeluaran
            </button>
          )}
          {isAdmin && (
            <button
              onClick={() => setShowTopupModal(true)}
              style={{
                flex: '1 1 160px', minHeight: 44, borderRadius: 11, border: 'none',
                background: 'rgba(255,255,255,.15)', color: '#fff',
                fontFamily: 'Poppins', fontSize: 13, fontWeight: 700,
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
              }}
            >
              📥 Top-up
            </button>
          )}
        </div>
      </div>

      {/* ── CONTENT ── */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '14px 18px 28px' }}>
        <style>{`
          @media (max-width: 640px) {
            .mobile-full-width { width: 100% !important; }
            .mobile-stack { display: flex !important; flex-direction: column !important; }
            .mobile-hide-label { display: none !important; }
            .expense-row-desktop { display: flex !important; flex-wrap: wrap !important; gap: 8px 10px !important; }
            .expense-row-desktop .row-meta { order: 4 !important; flex-basis: 100% !important; display: flex !important; flex-wrap: wrap !important; align-items: center !important; gap: 8px 14px !important; padding-left: 42px !important; }
            .expense-row-desktop .row-amount { order: 3 !important; margin-left: auto !important; }
            .stat-grid { grid-template-columns: 1fr 1fr !important; }
            .report-grid { grid-template-columns: 1fr !important; }
            .topup-row-desktop { display: flex !important; flex-direction: column !important; gap: 8px !important; }
            .filter-popup { width: calc(100vw - 36px) !important; left: 0 !important; right: 0 !important; margin: 0 auto !important; }
          }
          @media (max-width: 480px) {
            .hero-title { font-size: 14px !important; }
            .balance-amt { font-size: 28px !important; }
            .tab-btn { padding: 6px 10px !important; font-size: 11px !important; }
            .period-chip { padding: 5px 10px !important; font-size: 10.5px !important; }
            .row-item { padding: 8px !important; }
            .modal-body { padding: 12px !important; }
          }
          .expense-row-desktop:hover { box-shadow: 0 1px 3px rgba(15,23,42,.08) !important; border-color: #CBD5E1 !important; }
          .expense-row-desktop.cancelled { opacity: 0.55 !important; }
        `}</style>

        {/* Toolbar: Tabs + Search + Filter */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 10, position: 'relative' }}>
          {/* Tabs */}
          <div style={{ display: 'flex', gap: 3, background: DT.n100, borderRadius: 10, padding: 3, flexShrink: 0 }}>
            {[
              { key: 'expenses', label: 'Pengeluaran' },
              { key: 'topups', label: 'Top-up' },
              { key: 'report', label: 'Laporan' },
            ].map(t => {
              const active = tab === t.key;
              return (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  className="tab-btn"
                  style={{
                    border: 'none', background: active ? '#fff' : 'transparent',
                    padding: '7px 14px', borderRadius: 8,
                    fontSize: 12, fontWeight: 600,
                    color: active ? DT.primary : DT.n600,
                    cursor: 'pointer',
                    boxShadow: active ? '0 1px 2px rgba(15,23,42,.06)' : 'none',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {t.label}
                </button>
              );
            })}
          </div>

          {/* Search - hidden on very small screens */}
          <div className="mobile-full-width" style={{ flex: '1 1 180px', maxWidth: 300, position: 'relative', display: isMobile ? 'none' : 'block' }}>
            <svg
              width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={DT.n500}
              strokeWidth="2.2" style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)' }}
            >
              <circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" />
            </svg>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari..."
              style={{
                width: '100%', height: 34, borderRadius: 9,
                border: `1.5px solid ${DT.n200}`, background: DT.n50,
                padding: '0 12px 0 30px', fontSize: 12, fontFamily: 'inherit',
                outline: 'none', color: DT.n800,
              }}
            />
          </div>

          {/* Filter button */}
          <button
            onClick={() => setShowFilterModal(!showFilterModal)}
            className="mobile-hide-label"
            style={{
              width: 34, height: 34, borderRadius: 9,
              border: `1.5px solid ${activeFilterCount > 0 ? DT.primary : DT.n200}`,
              background: activeFilterCount > 0 ? DT.primaryTint : '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', color: activeFilterCount > 0 ? DT.primary : DT.n700,
              position: 'relative', flexShrink: 0,
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
              <line x1="4" y1="6" x2="14" y2="6" /><circle cx="16" cy="6" r="2" /><line x1="20" y1="6" x2="18" y2="6" />
              <line x1="4" y1="12" x2="6" y2="12" /><circle cx="8" cy="12" r="2" /><line x1="20" y1="12" x2="10" y2="12" />
              <line x1="4" y1="18" x2="12" y2="18" /><circle cx="14" cy="18" r="2" /><line x1="20" y1="18" x2="16" y2="18" />
            </svg>
            {activeFilterCount > 0 && (
              <span style={{
                position: 'absolute', top: -3, right: -3,
                width: 15, height: 15, borderRadius: 99,
                background: DT.primary, color: '#fff',
                fontSize: 8.5, fontWeight: 800,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {activeFilterCount}
              </span>
            )}
          </button>

          {/* Filter popup */}
          {showFilterModal && (
            <div className="filter-popup"
              style={{
                position: 'absolute', top: 44, right: isMobile ? 0 : 0, left: isMobile ? 0 : 'auto', width: isMobile ? 'calc(100vw - 36px)' : 300,
                background: '#fff', border: `1px solid ${DT.n200}`,
                borderRadius: 12, boxShadow: '0 4px 14px rgba(15,23,42,.08)',
                padding: 14, zIndex: 20, margin: '0 auto',
              }}>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: .4, color: DT.n500, marginBottom: 8 }}>
                KATEGORI
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 12 }}>
                <button
                  onClick={() => setCategoryFilter('all')}
                  style={{
                    padding: '6px 9px', borderRadius: 8,
                    border: `1.5px solid ${categoryFilter === 'all' ? DT.primary : DT.n200}`,
                    background: categoryFilter === 'all' ? DT.primaryTint : '#fff',
                    fontSize: 11, fontWeight: categoryFilter === 'all' ? 700 : 500,
                    color: categoryFilter === 'all' ? DT.primary : DT.n700,
                    cursor: 'pointer', textAlign: 'left',
                  }}
                >
                  Semua
                </button>
                {Object.entries(CATEGORY_META).map(([k, m]) => (
                  <button
                    key={k}
                    onClick={() => setCategoryFilter(k)}
                    style={{
                      padding: '6px 9px', borderRadius: 8,
                      border: `1.5px solid ${categoryFilter === k ? DT.primary : DT.n200}`,
                      background: categoryFilter === k ? DT.primaryTint : '#fff',
                      fontSize: 11, fontWeight: categoryFilter === k ? 700 : 500,
                      color: categoryFilter === k ? DT.primary : DT.n700,
                      cursor: 'pointer', textAlign: 'left',
                    }}
                  >
                    {m.icon} {m.label}
                  </button>
                ))}
              </div>

              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: .4, color: DT.n500, marginBottom: 8 }}>
                STATUS
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 12 }}>
                {[
                  { value: 'all', label: 'Semua' },
                  { value: 'auto_approved', label: 'Auto OK' },
                  { value: 'approved', label: 'Disetujui' },
                  { value: 'pending_approval', label: 'Pending' },
                  { value: 'rejected', label: 'Ditolak' },
                  { value: 'cancelled', label: 'Dibatalkan' },
                ].map(s => (
                  <button
                    key={s.value}
                    onClick={() => setStatusFilter(s.value)}
                    style={{
                      padding: '6px 9px', borderRadius: 8,
                      border: `1.5px solid ${statusFilter === s.value ? DT.primary : DT.n200}`,
                      background: statusFilter === s.value ? DT.primaryTint : '#fff',
                      fontSize: 11, fontWeight: statusFilter === s.value ? 700 : 500,
                      color: statusFilter === s.value ? DT.primary : DT.n700,
                      cursor: 'pointer',
                    }}
                  >
                    {s.label}
                  </button>
                ))}
              </div>

              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={() => {
                    setCategoryFilter('all');
                    setStatusFilter('all');
                    setHasPhotoFilter('all');
                    setSearch('');
                    setShowFilterModal(false);
                  }}
                  style={{
                    flex: 1, height: 32, borderRadius: 8,
                    border: `1.5px solid ${DT.n200}`, background: '#fff',
                    fontSize: 11, fontWeight: 600, color: DT.n700, cursor: 'pointer',
                  }}
                >
                  Reset
                </button>
                <button
                  onClick={() => setShowFilterModal(false)}
                  style={{
                    flex: 1, height: 32, borderRadius: 8,
                    border: 'none', background: DT.primary,
                    fontSize: 11, fontWeight: 600, color: '#fff', cursor: 'pointer',
                  }}
                >
                  Terapkan
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Period chips */}
        <div style={{ display: 'flex', gap: 6, overflowX: 'auto', marginBottom: 12, paddingBottom: 2 }}>
          {PERIOD_PRESETS.map(p => {
            const active = period.key === p.key;
            return (
              <button
                key={p.key}
                onClick={() => setPeriod(p)}
                style={{
                  flexShrink: 0, padding: '6px 13px', borderRadius: 99,
                  border: `1.5px solid ${active ? DT.primary : DT.n200}`,
                  background: active ? DT.primaryTint : '#fff',
                  fontSize: 11.5, fontWeight: active ? 700 : 500,
                  color: active ? DT.primary : DT.n700,
                  cursor: 'pointer',
                }}
              >
                {p.label}
              </button>
            );
          })}
        </div>

        {/* === EXPENSES TAB === */}
        {tab === 'expenses' && (
          <>
            {/* List Header */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '34px 1.6fr 130px 110px 100px 60px 120px',
              gap: 10, padding: '0 10px 7px',
              fontSize: 9.5, fontWeight: 700, letterSpacing: .4, color: DT.n500,
            }}>
              <span></span>
              <span>KATEGORI & DESKRIPSI</span>
              <span>PIC</span>
              <span>TANGGAL</span>
              <span>STATUS</span>
              <span>BUKTI</span>
              <span style={{ textAlign: 'right' }}>NOMINAL</span>
            </div>

            {/* Loading */}
            {expensesList.loading && (
              <div style={{ textAlign: 'center', padding: 30, fontFamily: 'Poppins', fontSize: 12, color: DT.n600 }}>
                Memuat…
              </div>
            )}

            {/* Empty state */}
            {!expensesList.loading && expensesList.items.length === 0 && (
              <div style={{ textAlign: 'center', padding: '32px 0 18px' }}>
                <div style={{ fontSize: 26, marginBottom: 6 }}>📭</div>
                <div style={{ fontSize: 12, color: DT.n500 }}>
                  {activeFilterCount > 0 || search ? 'Tidak ada hasil sesuai filter.' : 'Belum ada pengeluaran.'}
                </div>
              </div>
            )}

            {/* Expense rows */}
            {expensesList.items.map(it => (
              <ExpenseRow
                key={it.id}
                item={it}
                userId={user?.userId}
                isKasir={isKasir}
                onRefresh={refreshAll}
                onPreview={(src) => setPreviewImage(src)}
              />
            ))}

            {/* Pagination */}
            {!expensesList.loading && expensesList.items.length > 0 && (
              <PaginationControl
                page={expensesList.page}
                totalPages={expensesList.totalPages}
                total={expensesList.total}
                onPageChange={expensesList.goToPage}
                onLoadMore={expensesList.hasMore ? expensesList.loadMore : undefined}
                loadingMore={expensesList.loadingMore}
              />
            )}
          </>
        )}

        {/* === TOPUPS TAB === */}
        {tab === 'topups' && (
          <>
            {/* List Header */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '34px 1.6fr 140px 100px 110px 110px',
              gap: 10, padding: '0 10px 7px',
              fontSize: 9.5, fontWeight: 700, letterSpacing: .4, color: DT.n500,
            }}>
              <span></span>
              <span>SUMBER & CATATAN</span>
              <span>REF</span>
              <span>TANGGAL</span>
              <span>OLEH</span>
              <span style={{ textAlign: 'right' }}>NOMINAL</span>
            </div>

            {/* Loading */}
            {topupsList.loading && (
              <div style={{ textAlign: 'center', padding: 30, fontFamily: 'Poppins', fontSize: 12, color: DT.n600 }}>
                Memuat…
              </div>
            )}

            {/* Empty state */}
            {!topupsList.loading && topupsList.items.length === 0 && (
              <div style={{ textAlign: 'center', padding: '32px 0 18px' }}>
                <div style={{ fontSize: 26, marginBottom: 6 }}>💵</div>
                <div style={{ fontSize: 12, color: DT.n500 }}>Belum ada top-up.</div>
              </div>
            )}

            {/* Topup rows */}
            {topupsList.items.map(it => (
              <TopupRow key={it.id} item={it} />
            ))}

            {/* Pagination */}
            {!topupsList.loading && topupsList.items.length > 0 && (
              <PaginationControl
                page={topupsList.page}
                totalPages={topupsList.totalPages}
                total={topupsList.total}
                onPageChange={topupsList.goToPage}
                onLoadMore={topupsList.hasMore ? topupsList.loadMore : undefined}
                loadingMore={topupsList.loadingMore}
              />
            )}
          </>
        )}

        {/* === REPORT TAB === */}
        {tab === 'report' && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
              <button
                onClick={async () => {
                  if (!reportData) { alertWarning('Tidak ada data.'); return; }
                  await exportToExcel(reportData, balance?.outletName, formatReportRange(reportStartDate, reportEndDate));
                }}
                disabled={reportLoading || !reportData}
                style={{
                  height: 34, padding: '0 13px', borderRadius: 9,
                  border: `1.5px solid ${DT.primary}`, background: DT.primaryTint,
                  fontSize: 11.5, fontWeight: 600, color: DT.primary,
                  cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
                  opacity: (reportLoading || !reportData) ? 0.6 : 1,
                }}
              >
                📊 Export Excel
              </button>
              <button
                onClick={async () => {
                  if (!reportData) { alertWarning('Tidak ada data.'); return; }
                  await exportToPDF(reportData, balance?.outletName, formatReportRange(reportStartDate, reportEndDate));
                }}
                disabled={reportLoading || !reportData}
                style={{
                  height: 34, padding: '0 13px', borderRadius: 9,
                  border: `1.5px solid ${DT.danger}`, background: DT.dangerBg,
                  fontSize: 11.5, fontWeight: 600, color: DT.dangerDark,
                  cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
                  opacity: (reportLoading || !reportData) ? 0.6 : 1,
                }}
              >
                📄 Export PDF
              </button>
            </div>
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
        <TopupToOutletModal
          allBalances={allBalances}
          selectedOutletId={selectedOutletId}
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
// ExpenseRow - Mobile responsive design
// ════════════════════════════════════════════════════════════════════════════
function ExpenseRow({ item, userId, isKasir, onRefresh, onPreview }) {
  const cat = CATEGORY_META[item.category] || CATEGORY_META.other;
  const status = STATUS_META[item.status] || STATUS_META.auto_approved;
  const canCancel = item.status === 'pending_approval' && isKasir && item.requesterName;
  const [cancelling, setCancelling] = useState(false);

  const handleCancel = async () => {
    if (!window.confirm('Yakin ingin membatalkan pengeluaran ini?')) return;
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
    <div
      className={`expense-row-desktop ${item.status === 'cancelled' ? 'cancelled' : ''}`}
      style={{
        background: '#fff', border: `1px solid ${DT.n200}`,
        borderRadius: 10, padding: 10, marginBottom: 6,
        borderLeft: `4px solid ${item.status === 'cancelled' ? DT.n500 : cat.color}`,
        display: 'grid',
        gridTemplateColumns: '34px 1.6fr 120px',
        gap: 10,
        alignItems: 'center',
      }}
    >
      {/* Icon */}
      <div style={{
        width: 32, height: 32, borderRadius: 8,
        background: `${cat.color}15`, display: 'flex', alignItems: 'center',
        justifyContent: 'center', fontSize: 15, flexShrink: 0,
      }}>
        {cat.icon}
      </div>

      {/* Main info */}
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 12.5, fontWeight: 600, color: DT.n900 }}>{cat.label}</div>
        <div style={{ fontSize: 11, color: DT.n600, marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {item.description}
        </div>
        {/* Meta - mobile stack */}
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '4px 10px', marginTop: 6 }} className="mobile-meta-row">
          <span style={{ fontSize: 10.5, color: DT.n700 }}>{item.picName || item.requesterName}</span>
          <span style={{ fontSize: 10, color: DT.n500 }}>{fmtDate(item.createdAt)}</span>
          <span style={{
            fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 99,
            background: status.bg, color: status.fg,
          }}>
            {status.label}
          </span>
          {item.receiptPhotoUrl && (
            <img
              src={item.receiptPhotoUrl}
              alt="bukti"
              onClick={() => onPreview?.(item.receiptPhotoUrl)}
              style={{
                width: 24, height: 24, borderRadius: 4, objectFit: 'cover',
                border: `1px solid ${DT.n200}`, cursor: 'pointer',
              }}
            />
          )}
        </div>
      </div>

      {/* Amount */}
      <div style={{ fontSize: 13, fontWeight: 700, textAlign: 'right', color: DT.danger, whiteSpace: 'nowrap' }}>
        -{rp(item.amount)}
        {canCancel && (
          <button
            onClick={handleCancel}
            disabled={cancelling}
            style={{
              display: 'block', marginTop: 6, marginLeft: 'auto',
              fontSize: 10, fontWeight: 600, color: DT.danger,
              background: 'none', border: `1.5px solid ${DT.danger}`,
              borderRadius: 6, padding: '3px 8px', cursor: cancelling ? 'wait' : 'pointer',
            }}
          >
            Batalkan
          </button>
        )}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// TopupRow - Mobile responsive design
// ════════════════════════════════════════════════════════════════════════════
function TopupRow({ item }) {
  const src = TOPUP_SOURCE_META[item.source] || TOPUP_SOURCE_META.other;
  return (
    <div
      className="topup-row-desktop"
      style={{
        background: '#fff', border: `1px solid ${DT.n200}`,
        borderRadius: 10, padding: 10, marginBottom: 6,
        borderLeft: `4px solid ${DT.success}`,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{
          width: 32, height: 32, borderRadius: 8,
          background: DT.successBg, display: 'flex', alignItems: 'center',
          justifyContent: 'center', fontSize: 15, flexShrink: 0,
        }}>
          {src.icon}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12.5, fontWeight: 600, color: DT.n900 }}>{src.label}</div>
          {item.notes && (
            <div style={{ fontSize: 11, color: DT.n700, marginTop: 1 }}>{item.notes}</div>
          )}
          <div style={{ display: 'flex', gap: 10, marginTop: 4, flexWrap: 'wrap' }}>
            {item.referenceNo && (
              <span style={{ fontSize: 10, color: DT.n700 }}>Ref: {item.referenceNo}</span>
            )}
            <span style={{ fontSize: 10, color: DT.n500 }}>{fmtDate(item.createdAt)}</span>
            <span style={{ fontSize: 10, color: DT.n700 }}>{item.topupByName}</span>
          </div>
        </div>
        <div style={{ fontSize: 13, fontWeight: 700, color: DT.success, whiteSpace: 'nowrap' }}>
          +{rp(item.amount)}
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// Export Functions - Excel & PDF
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

async function exportToExcel(reportData, outletName, dateRange) {
  if (!reportData || !reportData.summary) {
    alertWarning('Tidak ada data untuk di-export.');
    return;
  }

  const { summary, byCategory, daily, topSpenders, topExpenses } = reportData;

  // Create workbook
  const wb = XLSX.utils.book_new();

  // Sheet 1: Summary
  const summaryData = [
    ['LAPORAN KAS OPERASIONAL'],
    [''],
    ['Outlet:', outletName || 'Semua Outlet'],
    ['Periode:', dateRange],
    ['Tanggal Export:', new Date().toLocaleString('id-ID')],
    [''],
    ['RINGKASAN'],
    ['Total Pengeluaran', summary.totalExpense, summary.totalCount + ' transaksi'],
    ['Total Top-up', summary.topupTotal, summary.topupCount + ' kali'],
    ['Net Cash Flow', summary.netCashFlow, summary.netCashFlow >= 0 ? 'Surplus' : 'Defisit'],
    ['Rata-rata per Transaksi', summary.avgAmount],
    ['Pengeluaran Tertinggi', summary.maxAmount],
    [''],
  ];

  // Sheet 2: By Category
  const categoryData = [
    ['BREAKDOWN PER KATEGORI'],
    [''],
    ['Kategori', 'Jumlah', 'Total (Rp)', 'Persentase'],
    ...byCategory.map(c => {
      const meta = CATEGORY_META[c.category] || CATEGORY_META.other;
      return [meta.label, c.count, c.totalAmount, c.percentage + '%'];
    }),
    [''],
  ];

  // Sheet 3: Expenses List
  const expensesData = [
    ['DAFTAR PENGELUARAN'],
    [''],
    ['No', 'Tanggal', 'Kategori', 'Deskripsi', 'Jumlah', 'Status', 'PIC'],
    ...(topExpenses || []).map((e, i) => {
      const cat = CATEGORY_META[e.category] || CATEGORY_META.other;
      const stat = STATUS_META[e.status] || {};
      return [
        i + 1,
        e.createdAt ? new Date(e.createdAt).toLocaleString('id-ID') : '-',
        cat.label,
        e.description,
        e.amount,
        stat.label,
        e.requesterName,
      ];
    }),
  ];

  // Sheet 4: Top Spenders
  const spendersData = [
    ['KASIR PALING AKTIF'],
    [''],
    ['Peringkat', 'Nama Kasir', 'Jumlah Pengeluaran', 'Total (Rp)'],
    ...(topSpenders || []).map((s, i) => [i + 1, s.userName, s.count + ' pengeluaran', s.totalAmount]),
  ];

  // Create sheets
  const ws1 = XLSX.utils.aoa_to_sheet(summaryData);
  const ws2 = XLSX.utils.aoa_to_sheet(categoryData);
  const ws3 = XLSX.utils.aoa_to_sheet(expensesData);
  const ws4 = XLSX.utils.aoa_to_sheet(spendersData);

  // Set column widths
  ws1['!cols'] = [{ wch: 25 }, { wch: 18 }, { wch: 25 }];
  ws2['!cols'] = [{ wch: 25 }, { wch: 10 }, { wch: 15 }, { wch: 12 }];
  ws3['!cols'] = [{ wch: 5 }, { wch: 20 }, { wch: 15 }, { wch: 30 }, { wch: 15 }, { wch: 12 }, { wch: 15 }];
  ws4['!cols'] = [{ wch: 10 }, { wch: 20 }, { wch: 18 }, { wch: 15 }];

  XLSX.utils.book_append_sheet(wb, ws1, 'Ringkasan');
  XLSX.utils.book_append_sheet(wb, ws2, 'Kategori');
  XLSX.utils.book_append_sheet(wb, ws3, 'Pengeluaran');
  XLSX.utils.book_append_sheet(wb, ws4, 'Kasir Aktif');

  // Download
  const fileName = `Laporan_Kas_${outletName || 'Semua'}_${new Date().toISOString().slice(0,10)}.xlsx`;
  XLSX.writeFile(wb, fileName);
  alertSuccess('Excel berhasil di-download.');
}

async function exportToPDF(reportData, outletName, dateRange) {
  if (!reportData || !reportData.summary) {
    alertWarning('Tidak ada data untuk di-export.');
    return;
  }

  const { summary, byCategory, daily, topSpenders, topExpenses } = reportData;
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();

  // Colors
  const primaryColor = [124, 58, 237];
  const successColor = [22, 163, 74];
  const dangerColor = [220, 38, 38];

  // Header
  doc.setFillColor(...primaryColor);
  doc.rect(0, 0, pageWidth, 35, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('LAPORAN KAS OPERASIONAL', pageWidth / 2, 15, { align: 'center' });

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(outletName || 'Semua Outlet', pageWidth / 2, 23, { align: 'center' });
  doc.text(dateRange, pageWidth / 2, 30, { align: 'center' });

  let yPos = 45;

  // Summary Cards
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('RINGKASAN KEUANGAN', 14, yPos);
  yPos += 8;

  // Summary grid
  const summaryItems = [
    { label: 'Total Pengeluaran', value: summary.totalExpense, color: dangerColor, sub: summary.totalCount + ' transaksi' },
    { label: 'Total Top-up', value: summary.topupTotal, color: successColor, sub: summary.topupCount + ' kali' },
    { label: 'Net Cash Flow', value: summary.netCashFlow, color: summary.netCashFlow >= 0 ? successColor : dangerColor, sub: summary.netCashFlow >= 0 ? 'Surplus' : 'Defisit' },
    { label: 'Rata-rata', value: summary.avgAmount, color: primaryColor, sub: 'per transaksi' },
  ];

  const cardWidth = (pageWidth - 28) / 2;
  summaryItems.forEach((item, idx) => {
    const x = 14 + (idx % 2) * (cardWidth + 6);
    const y = yPos + Math.floor(idx / 2) * 25;

    // Card background
    doc.setFillColor(250, 250, 250);
    doc.roundedRect(x, y, cardWidth, 22, 3, 3, 'F');

    // Left accent
    doc.setFillColor(...item.color);
    doc.rect(x, y, 3, 22, 'F');

    // Text
    doc.setTextColor(100, 100, 100);
    doc.setFontSize(8);
    doc.text(item.label.toUpperCase(), x + 6, y + 7);

    doc.setTextColor(...item.color);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text(rp(item.value), x + 6, y + 16);

    doc.setTextColor(100, 100, 100);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.text(item.sub, x + 6, y + 20);
  });

  yPos += 60;

  // Category Breakdown
  if (byCategory.length > 0) {
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('BREAKDOWN PER KATEGORI', 14, yPos);
    yPos += 6;

    autoTable(doc, {
      startY: yPos,
      head: [['Kategori', 'Jumlah', 'Total (Rp)', '%']],
      body: byCategory.map(c => {
        const meta = CATEGORY_META[c.category] || CATEGORY_META.other;
        return [meta.label, c.count, rp(c.totalAmount), c.percentage + '%'];
      }),
      theme: 'striped',
      headStyles: { fillColor: primaryColor, fontSize: 9 },
      bodyStyles: { fontSize: 9 },
      columnStyles: {
        0: { cellWidth: 80 },
        1: { halign: 'center', cellWidth: 25 },
        2: { halign: 'right', cellWidth: 40 },
        3: { halign: 'center', cellWidth: 25 },
      },
      margin: { left: 14, right: 14 },
    });

    yPos = doc.lastAutoTable.finalY + 15;
  }

  // Top Expenses
  if (topExpenses.length > 0) {
    // Check if need new page
    if (yPos > 240) {
      doc.addPage();
      yPos = 20;
    }

    doc.setTextColor(0, 0, 0);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('PENGELUARAN TERBESAR', 14, yPos);
    yPos += 6;

    autoTable(doc, {
      startY: yPos,
      head: [['Tanggal', 'Kategori', 'Deskripsi', 'Jumlah']],
      body: topExpenses.slice(0, 10).map(e => {
        const cat = CATEGORY_META[e.category] || CATEGORY_META.other;
        return [
          e.createdAt ? new Date(e.createdAt).toLocaleDateString('id-ID') : '-',
          cat.label,
          e.description,
          rp(e.amount),
        ];
      }),
      theme: 'striped',
      headStyles: { fillColor: dangerColor, fontSize: 9 },
      bodyStyles: { fontSize: 8 },
      columnStyles: {
        0: { cellWidth: 30 },
        1: { cellWidth: 40 },
        2: { cellWidth: 70 },
        3: { halign: 'right', cellWidth: 30 },
      },
      margin: { left: 14, right: 14 },
    });

    yPos = doc.lastAutoTable.finalY + 15;
  }

  // Top Spenders
  if (topSpenders.length > 0) {
    if (yPos > 220) {
      doc.addPage();
      yPos = 20;
    }

    doc.setTextColor(0, 0, 0);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('KASIR PALING AKTIF', 14, yPos);
    yPos += 6;

    autoTable(doc, {
      startY: yPos,
      head: [['Peringkat', 'Nama Kasir', 'Jumlah', 'Total (Rp)']],
      body: topSpenders.map((s, i) => [
        '#' + (i + 1),
        s.userName,
        s.count + ' pengeluaran',
        rp(s.totalAmount),
      ]),
      theme: 'striped',
      headStyles: { fillColor: primaryColor, fontSize: 9 },
      bodyStyles: { fontSize: 9 },
      columnStyles: {
        0: { halign: 'center', cellWidth: 20 },
        1: { cellWidth: 80 },
        2: { halign: 'center', cellWidth: 35 },
        3: { halign: 'right', cellWidth: 35 },
      },
      margin: { left: 14, right: 14 },
    });
  }

  // Footer
  const pageCount = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text(
      `Dicetak: ${new Date().toLocaleString('id-ID')} | Halaman ${i} dari ${pageCount}`,
      pageWidth / 2,
      doc.internal.pageSize.getHeight() - 10,
      { align: 'center' }
    );
  }

  const fileName = `Laporan_Kas_${outletName || 'Semua'}_${new Date().toISOString().slice(0,10)}.pdf`;
  doc.save(fileName);
  alertSuccess('PDF berhasil di-download.');
}

// ════════════════════════════════════════════════════════════════════════════
// PaginationControl - New design
// ════════════════════════════════════════════════════════════════════════════
function PaginationControl({ page, totalPages, total, onPageChange, onLoadMore, loadingMore }) {
  const pageInfo = `${total} data · hal. ${page}/${totalPages}`;

  const getPageNumbers = () => {
    const pages = [];
    const maxVisible = 5;
    if (totalPages <= maxVisible) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (page > 3) pages.push('...');
      for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) {
        pages.push(i);
      }
      if (page < totalPages - 2) pages.push('...');
      pages.push(totalPages);
    }
    return pages;
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 14, flexWrap: 'wrap' }}>
      <span style={{ fontSize: 10.5, color: DT.n500, marginRight: 10 }}>{pageInfo}</span>

      <button
        className="page-btn nav"
        onClick={() => onPageChange(page - 1)}
        disabled={page <= 1}
        style={{
          minWidth: 30, height: 30, padding: '0 9px', borderRadius: 8,
          border: `1.5px solid ${DT.n200}`, background: '#fff',
          fontSize: 11.5, fontWeight: 600, color: page > 1 ? DT.primary : DT.n500,
          cursor: page > 1 ? 'pointer' : 'not-allowed',
          opacity: page > 1 ? 1 : 0.35,
        }}
      >
        ‹
      </button>

      {getPageNumbers().map((p, i) => (
        p === '...' ? (
          <span key={`dots-${i}`} style={{ color: DT.n400, fontSize: 12, padding: '0 2px' }}>…</span>
        ) : (
          <button
            key={p}
            onClick={() => onPageChange(p)}
            style={{
              minWidth: 30, height: 30, padding: '0 9px', borderRadius: 8,
              border: `1.5px solid ${p === page ? DT.primary : DT.n200}`,
              background: p === page ? DT.primary : '#fff',
              fontSize: 11.5, fontWeight: 600,
              color: p === page ? '#fff' : DT.n700,
              cursor: 'pointer',
              fontFamily: 'Poppins',
            }}
          >
            {p}
          </button>
        )
      ))}

      <button
        className="page-btn nav"
        onClick={() => onPageChange(page + 1)}
        disabled={page >= totalPages}
        style={{
          minWidth: 30, height: 30, padding: '0 9px', borderRadius: 8,
          border: `1.5px solid ${DT.n200}`, background: '#fff',
          fontSize: 11.5, fontWeight: 600, color: page < totalPages ? DT.primary : DT.n500,
          cursor: page < totalPages ? 'pointer' : 'not-allowed',
          opacity: page < totalPages ? 1 : 0.35,
        }}
      >
        ›
      </button>

      {onLoadMore && (
        <button
          onClick={onLoadMore}
          disabled={loadingMore}
          style={{
            minWidth: 80, height: 30, padding: '0 12px', borderRadius: 8,
            border: `1.5px solid ${DT.primary}`, background: DT.primaryTint,
            fontSize: 11, fontWeight: 600, color: DT.primary, cursor: loadingMore ? 'wait' : 'pointer',
          }}
        >
          {loadingMore ? 'Memuat…' : 'Lihat lagi'}
        </button>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// Report Panel
// ════════════════════════════════════════════════════════════════════════════
function ReportPanel({ data, loading, period, setPeriod, customRange, setCustomRange, onApplyCustomRange, outletName, rangeStart, rangeEnd }) {
  if (loading) {
    return <div style={{ textAlign: 'center', padding: 40, fontSize: 12, color: DT.n600 }}>Memuat laporan…</div>;
  }
  if (!data || !data.summary) {
    return (
      <div style={{ textAlign: 'center', padding: 50 }}>
        <div style={{ fontSize: 40, marginBottom: 8 }}>📊</div>
        <div style={{ fontSize: 13, color: DT.n600 }}>Belum ada data laporan.</div>
      </div>
    );
  }

  const { summary, byCategory, daily, topSpenders, topExpenses } = data;
  const maxDaily = daily.length > 0 ? Math.max(...daily.map(d => d.totalAmount), 1) : 1;

  return (
    <div>
      {/* Period info header */}
      <div style={{
        background: 'white', borderRadius: 12, padding: '10px 14px', marginBottom: 12,
        border: `1px solid ${DT.n200}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
        flexWrap: 'wrap',
      }}>
        <div>
          <div style={{ fontSize: 10, fontWeight: 600, color: DT.n600, letterSpacing: .3 }}>
            RENTANG LAPORAN
          </div>
          <div style={{ fontSize: 12, fontWeight: 600, color: DT.n900, marginTop: 2 }}>
            {formatReportRange(rangeStart, rangeEnd)}
          </div>
          {outletName && (
            <div style={{ fontSize: 10, color: DT.n600, marginTop: 2 }}>{outletName}</div>
          )}
        </div>
        <div style={{
          fontSize: 10, fontWeight: 600, padding: '4px 8px', borderRadius: 99,
          background: `${DT.primary}12`, color: DT.primary,
        }}>
          {period?.label || 'Periode'}
        </div>
      </div>

      {/* Period chips */}
      <div style={{ display: 'flex', gap: 6, overflowX: 'auto', marginBottom: 12, paddingBottom: 2 }}>
        {PERIOD_PRESETS.map(p => {
          const active = period.key === p.key;
          return (
            <button
              key={p.key}
              onClick={() => setPeriod(p)}
              style={{
                flexShrink: 0, padding: '5px 11px', borderRadius: 99,
                border: `1.5px solid ${active ? DT.primary : DT.n200}`,
                background: active ? DT.primaryTint : 'white',
                fontSize: 11, fontWeight: active ? 700 : 500,
                color: active ? DT.primary : DT.n700, cursor: 'pointer',
              }}
            >{p.label}</button>
          );
        })}
      </div>

      {/* Custom date range */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8, marginBottom: 10 }}>
        <label style={{ display: 'block' }}>
          <div style={{ fontSize: 10, color: DT.n600, marginBottom: 4 }}>Dari</div>
          <input
            type="date"
            value={customRange?.startDate || ''}
            onChange={(e) => setCustomRange({
              startDate: e.target.value,
              endDate: customRange?.endDate || '',
            })}
            style={{
              width: '100%', height: 36, borderRadius: 8,
              border: `1.5px solid ${DT.n200}`, padding: '0 10px', fontSize: 11,
              color: DT.n900, background: 'white', boxSizing: 'border-box', outline: 'none',
            }}
          />
        </label>
        <label style={{ display: 'block' }}>
          <div style={{ fontSize: 10, color: DT.n600, marginBottom: 4 }}>Sampai</div>
          <input
            type="date"
            value={customRange?.endDate || ''}
            onChange={(e) => setCustomRange({
              startDate: customRange?.startDate || '',
              endDate: e.target.value,
            })}
            style={{
              width: '100%', height: 36, borderRadius: 8,
              border: `1.5px solid ${DT.n200}`, padding: '0 10px', fontSize: 11,
              color: DT.n900, background: 'white', boxSizing: 'border-box', outline: 'none',
            }}
          />
        </label>
      </div>
      <button
        onClick={onApplyCustomRange}
        disabled={!customRange?.startDate || !customRange?.endDate}
        style={{
          width: '100%', padding: '8px 10px', borderRadius: 10, marginBottom: 12,
          border: `1.5px solid ${DT.primary}`, background: 'white', color: DT.primary,
          fontSize: 11, fontWeight: 600, cursor: 'not-allowed',
          opacity: (!customRange?.startDate || !customRange?.endDate) ? 0.6 : 1,
        }}
      >
        Terapkan Rentang
      </button>

      {/* Summary cards */}
      <div className="stat-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 12 }}>
        <SummaryCard
          icon="📤" label="Total Pengeluaran" value={rp(summary.totalExpense)}
          sub={`${summary.totalCount} transaksi`} color={DT.danger} bg={DT.dangerBg}
        />
        <SummaryCard
          icon="📥" label="Total Top-up" value={rp(summary.topupTotal)}
          sub={`${summary.topupCount} kali`} color={DT.success} bg={DT.successBg}
        />
        <SummaryCard
          icon={summary.netCashFlow >= 0 ? "📈" : "📉"}
          label="Net Cash Flow"
          value={`${summary.netCashFlow >= 0 ? '+' : ''}${rp(summary.netCashFlow)}`}
          sub={summary.netCashFlow >= 0 ? "Surplus" : "Defisit"}
          color={summary.netCashFlow >= 0 ? DT.success : DT.danger}
          bg={summary.netCashFlow >= 0 ? DT.successBg : DT.dangerBg}
        />
        <SummaryCard
          icon="📊" label="Rata-rata"
          value={rp(summary.avgAmount)}
          sub={`Max: ${rp(summary.maxAmount)}`}
          color={DT.primary} bg={DT.primaryTint}
        />
      </div>

      {/* Daily trend chart */}
      {daily.length > 1 && (
        <div style={{ background: 'white', borderRadius: 14, padding: '14px 16px', marginBottom: 12, boxShadow: '0 1px 2px rgba(15,23,42,.06)' }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: DT.n600, letterSpacing: .3, marginBottom: 10 }}>
            📈 TREND PENGELUARAN HARIAN
          </div>
          <DailyBarChart daily={daily} maxDaily={maxDaily} />
        </div>
      )}

      {/* Category breakdown */}
      {byCategory.length > 0 && (
        <div style={{ background: 'white', borderRadius: 14, padding: '14px 16px', marginBottom: 12, boxShadow: '0 1px 2px rgba(15,23,42,.06)' }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: DT.n600, letterSpacing: .3, marginBottom: 12 }}>
            🎯 BREAKDOWN PER KATEGORI
          </div>
          <CategoryBreakdown items={byCategory} totalAmount={summary.totalExpense} />
        </div>
      )}

      {/* Grid layout for spenders & expenses */}
      <div className="report-grid" style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: 10, marginBottom: 10 }}>

        {/* Top spenders */}
        {topSpenders.length > 0 && (
          <div style={{ background: 'white', borderRadius: 14, padding: '14px 16px', boxShadow: '0 1px 2px rgba(15,23,42,.06)' }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: DT.n600, letterSpacing: .3, marginBottom: 10 }}>
              👤 KASIR PALING AKTIF
            </div>
            {topSpenders.map((s, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0', borderBottom: i < topSpenders.length - 1 ? `1px dashed ${DT.n100}` : 'none' }}>
                <div style={{
                  width: 28, height: 28, borderRadius: 8,
                  background: i === 0 ? DT.warningBg : DT.n100,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 11, fontWeight: 800, color: i === 0 ? '#92400E' : DT.n700,
                }}>#{i + 1}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: DT.n900 }}>{s.userName}</div>
                  <div style={{ fontSize: 10, color: DT.n600 }}>{s.count} pengeluaran</div>
                </div>
                <div style={{ fontSize: 12, fontWeight: 600, color: DT.danger }}>{rp(s.totalAmount)}</div>
              </div>
            ))}
          </div>
        )}

        {/* Top expenses */}
        {topExpenses.length > 0 && (
          <div style={{ background: 'white', borderRadius: 14, padding: '14px 16px', boxShadow: '0 1px 2px rgba(15,23,42,.06)' }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: DT.n600, letterSpacing: .3, marginBottom: 10 }}>
              💸 PENGELUARAN TERBESAR
            </div>
            {topExpenses.slice(0, 5).map((e) => {
              const cat = CATEGORY_META[e.category] || CATEGORY_META.other;
              return (
                <div key={e.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: `1px dashed ${DT.n100}` }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                    background: `${cat.color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16,
                  }}>{cat.icon}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: DT.n900, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {e.description}
                    </div>
                    <div style={{ fontSize: 10, color: DT.n600 }}>
                      {fmtDateOnly(e.createdAt)} · {e.requesterName}
                    </div>
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: DT.danger, whiteSpace: 'nowrap' }}>
                    {rp(e.amount)}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
// Old remnant removed - see new ReportPanel above

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
      <div style={{ padding: '14px 18px 18px' }}>
        <div style={{ background: DT.n50, borderRadius: 9, padding: '8px 11px', marginBottom: 12, fontSize: 11.5, color: DT.n700 }}>
          Saldo tersedia: <strong style={{ color: DT.success }}>{rp(balance)}</strong>
          {numAmount > 0 && !willNeedApproval && !insufficientBalance && (
            <span> · Setelah: <strong>{rp(balance - numAmount)}</strong></span>
          )}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 11 }}>
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
        </div>

        <Textarea
          label="Catatan / Deskripsi"
          value={description}
          onChange={setDescription}
          rows={2}
          placeholder="Mis. Beli gas 12 kg untuk setrika uap"
        />

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 11 }}>
          {/* PIC field */}
          <div>
            <div style={{ fontSize: 10.5, fontWeight: 600, color: DT.n700, marginBottom: 5 }}>Nama PIC <span style={{ color: DT.danger }}>*</span></div>
            <input
              type="text"
              value={picName}
              onChange={(e) => setPicName(e.target.value)}
              placeholder="Contoh: Sari"
              style={{
                width: '100%', height: 40, borderRadius: 9,
                border: `1.5px solid ${DT.n300}`, fontSize: 12.5,
                padding: '0 11px', outline: 'none', boxSizing: 'border-box',
              }}
            />
          </div>

          {/* Photo upload */}
          <div>
            <div style={{ fontSize: 10.5, fontWeight: 600, color: DT.n700, marginBottom: 5 }}>Bukti Foto <span style={{ color: DT.danger }}>*</span></div>
            {receiptPhoto ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: DT.n50, borderRadius: 9, padding: '8px 10px' }}>
                <img src={receiptPhoto.dataUrl} alt="bukti" style={{ width: 36, height: 36, borderRadius: 6, objectFit: 'cover', border: `1px solid ${DT.n200}` }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 11, color: DT.success, fontWeight: 600 }}>✓ Tersimpan</div>
                </div>
                <button
                  onClick={() => setReceiptPhoto(null)}
                  style={{ width: 24, height: 24, borderRadius: 6, border: `1.5px solid ${DT.n200}`, background: '#fff', cursor: 'pointer', fontSize: 12, color: DT.n600 }}
                >×</button>
              </div>
            ) : (
              <label style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, height: 40,
                borderRadius: 9, border: `1.5px dashed ${DT.n300}`, background: DT.n50,
                cursor: uploadingPhoto ? 'wait' : 'pointer', fontSize: 11.5, fontWeight: 600, color: DT.primary,
              }}>
                {uploadingPhoto ? 'Mengunggah...' : 'Ambil Foto'}
                <input type="file" accept="image/*" capture="environment" onChange={handlePhotoUpload} style={{ display: 'none' }} />
              </label>
            )}
          </div>
        </div>

        {willNeedApproval && (
          <div style={{ background: DT.warningBg, borderRadius: 8, padding: '7px 10px', marginTop: 10, fontSize: 10.5, color: '#92400E' }}>
            ⚠️ Nominal di atas Rp {limit.toLocaleString('id-ID')} memerlukan persetujuan admin.
          </div>
        )}
        {insufficientBalance && (
          <div style={{ background: DT.dangerBg, borderRadius: 8, padding: '7px 10px', marginTop: 10, fontSize: 10.5, color: DT.dangerDark }}>
            ❌ Saldo tidak cukup. Minta admin top-up dulu.
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
          <button
            onClick={onClose}
            style={{
              flex: 1, height: 38, borderRadius: 9,
              border: `1.5px solid ${DT.n300}`, background: '#fff',
              fontSize: 12.5, fontWeight: 600, color: DT.n700, cursor: 'pointer',
            }}
          >
            Batal
          </button>
          <button
            onClick={submit}
            disabled={numAmount <= 0 || !description.trim() || !picName.trim() || !receiptPhoto || insufficientBalance || loading}
            style={{
              flex: 1, height: 38, borderRadius: 9, border: 'none',
              background: (numAmount <= 0 || !description.trim() || !picName.trim() || !receiptPhoto || insufficientBalance) ? DT.n300 : DT.primary,
              fontSize: 12.5, fontWeight: 600, color: '#fff', cursor: 'pointer',
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? 'Menyimpan…' : (willNeedApproval ? 'Ajukan' : 'Simpan')}
          </button>
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
      <div style={{ padding: '14px 18px 18px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 11 }}>
          <MoneyInput
            label={<span>Nominal (Rp) <span style={{ color: DT.danger }}>*</span></span>}
            value={amount}
            onChange={setAmount}
            placeholder="500.000"
            hint={numAmount > 0 ? rp(numAmount) : undefined}
          />
          <Input
            label={<span>Nama PIC <span style={{ color: DT.danger }}>*</span></span>}
            value={picName}
            onChange={setPicName}
            placeholder="Nama PIC"
          />
        </div>

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
          placeholder="No transfer"
        />

        <Textarea
          label="Catatan (opsional)"
          value={notes}
          onChange={setNotes}
          rows={2}
        />

        {/* Upload Bukti Foto */}
        <div style={{ marginTop: 12 }}>
          <div style={{ fontSize: 10.5, fontWeight: 600, color: DT.n700, marginBottom: 6 }}>
            Bukti Foto Transfer <span style={{ color: DT.danger }}>*</span>
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
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, height: 52,
              background: DT.n50, border: `1.5px dashed ${DT.n300}`,
              borderRadius: 9, cursor: uploadingPhoto ? 'not-allowed' : 'pointer',
              fontSize: 11.5, fontWeight: 600, color: DT.primary,
            }}
          >
            {uploadingPhoto ? '📤 Mengunggah...' : proofPhotoUrl ? '✓ Foto terupload' : '📷 Ambil Foto'}
          </label>

          {proofPhotoUrl && !uploadingPhoto && (
            <div style={{ marginTop: 8, textAlign: 'center' }}>
              <img
                src={proofPhotoUrl}
                alt="Bukti transfer"
                style={{ maxWidth: '100%', maxHeight: 150, borderRadius: 8, border: `1px solid ${DT.n200}`, objectFit: 'contain' }}
              />
            </div>
          )}

          <div style={{ fontSize: 10, color: DT.n500, marginTop: 4 }}>
            Maks. 5MB • Format: JPG, PNG</div>
        </div>

        <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
          <button onClick={onClose} style={{ flex: 1, height: 38, borderRadius: 9, border: `1.5px solid ${DT.n300}`, background: '#fff', fontSize: 12.5, fontWeight: 600, color: DT.n700, cursor: 'pointer' }}>Batal</button>
          <button
            onClick={submit}
            disabled={numAmount <= 0 || !picName.trim() || !proofPhotoUrl.trim() || uploadingPhoto || loading}
            style={{
              flex: 1, height: 38, borderRadius: 9, border: 'none',
              background: (numAmount <= 0 || !picName.trim() || !proofPhotoUrl.trim()) ? DT.n300 : DT.primary,
              fontSize: 12.5, fontWeight: 600, color: '#fff', cursor: 'pointer',
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? 'Menyimpan…' : 'Top-up'}
          </button>
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
      <div style={{ padding: '14px 18px 18px' }}>
        <div style={{ background: DT.n50, borderRadius: 9, padding: '10px 12px', marginBottom: 12, fontSize: 12, color: DT.n700 }}>
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
        <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
          <button onClick={onClose} style={{ flex: 1, height: 38, borderRadius: 9, border: `1.5px solid ${DT.n300}`, background: '#fff', fontSize: 12.5, fontWeight: 600, color: DT.n700, cursor: 'pointer' }}>Batal</button>
          <button
            onClick={submit}
            disabled={!actual || !notes.trim() || loading}
            style={{
              flex: 1, height: 38, borderRadius: 9, border: 'none',
              background: (!actual || !notes.trim()) ? DT.n300 : DT.primary,
              fontSize: 12.5, fontWeight: 600, color: '#fff', cursor: 'pointer',
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? 'Menyimpan…' : 'Simpan'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// TopupToOutletModal - Penyaluran Dana ke Outlet Outlet
// Finance Flow: Admin mendistribusikan dana kas ke outlet-outlet yang butuh
// ════════════════════════════════════════════════════════════════════════════
function TopupToOutletModal({ allBalances, selectedOutletId, onClose, onSuccess }) {
  const [mode, setMode] = useState('single'); // 'single' | 'multi'
  const [selectedOutlets, setSelectedOutlets] = useState({});
  const [amount, setAmount] = useState('');
  const [distributions, setDistributions] = useState({}); // outletId -> amount
  const [source, setSource] = useState('transfer');
  const [referenceNo, setReferenceNo] = useState('');
  const [notes, setNotes] = useState('');
  const [picName, setPicName] = useState('');
  const [proofPhotoUrl, setProofPhotoUrl] = useState('');
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [loading, setLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState(1); // 1: pilih outlet, 2: nominal

  // Parse amount
  const parseAmount = (val) => Number(String(val).replace(/\D/g, '')) || 0;
  const totalAmount = mode === 'single'
    ? parseAmount(amount)
    : Object.values(distributions).reduce((sum, v) => sum + parseAmount(v), 0);

  const numAmount = parseAmount(amount);

  // Toggle outlet selection
  const toggleOutlet = (outletId) => {
    setSelectedOutlets(prev => {
      const next = { ...prev };
      if (next[outletId]) {
        delete next[outletId];
      } else {
        next[outletId] = true;
        if (!distributions[outletId]) {
          setDistributions(d => ({ ...d, [outletId]: '' }));
        }
      }
      return next;
    });
  };

  // Select/deselect all outlets
  const toggleAllOutlets = () => {
    if (Object.keys(selectedOutlets).length === allBalances.length) {
      setSelectedOutlets({});
      setDistributions({});
    } else {
      const all = {};
      const dist = {};
      allBalances.forEach(o => {
        all[o.outletId] = true;
        dist[o.outletId] = '';
      });
      setSelectedOutlets(all);
      setDistributions(dist);
    }
  };

  // Quick fill equal distribution
  const fillEqualDistribution = () => {
    if (totalAmount <= 0 || Object.keys(selectedOutlets).length === 0) return;
    const perOutlet = Math.floor(totalAmount / Object.keys(selectedOutlets).length);
    const remainder = totalAmount - (perOutlet * Object.keys(selectedOutlets).length);

    setDistributions(prev => {
      const next = { ...prev };
      Object.keys(next).forEach(id => {
        if (selectedOutlets[id]) {
          next[id] = (Number(id) === Number(Object.keys(selectedOutlets)[0]))
            ? (perOutlet + remainder).toString()
            : perOutlet.toString();
        }
      });
      return next;
    });
  };

  // Photo upload
  const handlePhotoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { alertError('Maks 5MB'); return; }
    setUploadingPhoto(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('category', 'proof');
      const res = await axios.post('/api/upload', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      if (res?.data?.url) {
        setProofPhotoUrl(res.data.url);
        alertSuccess('Foto berhasil diunggah');
      } else throw new Error('No URL');
    } catch (err) {
      alertError('Gagal upload foto');
    } finally {
      setUploadingPhoto(false);
    }
  };

  // Submit
  const submit = async () => {
    if (totalAmount <= 0) { alertWarning('Total nominal harus > 0'); return; }
    if (!picName.trim()) { alertWarning('Nama PIC wajib diisi'); return; }
    if (!proofPhotoUrl.trim()) { alertWarning('Bukti foto wajib diunggah'); return; }

    // Validate distributions for multi mode
    if (mode === 'multi') {
      const zeroDist = Object.entries(distributions)
        .filter(([id]) => selectedOutlets[id])
        .filter(([, v]) => parseAmount(v) <= 0);
      if (zeroDist.length > 0) {
        alertWarning('Semua outlet yang dipilih harus punya nominal > 0');
        return;
      }
    }

    setLoading(true);
    try {
      if (mode === 'single') {
        // Single outlet topup
        await topupCash({
          outletId: selectedOutletId,
          amount: numAmount,
          source,
          referenceNo: referenceNo.trim() || undefined,
          notes: notes.trim() || undefined,
          picName: picName.trim(),
          proofPhotoUrl: proofPhotoUrl.trim(),
        });
      } else {
        // Multi outlet distribution
        const promises = Object.entries(distributions)
          .filter(([id]) => selectedOutlets[id])
          .filter(([, v]) => parseAmount(v) > 0)
          .map(([outletId, v]) =>
            topupCash({
              outletId: Number(outletId),
              amount: parseAmount(v),
              source,
              referenceNo: referenceNo.trim() || undefined,
              notes: notes.trim() || undefined,
              picName: picName.trim(),
              proofPhotoUrl: proofPhotoUrl.trim(),
            })
          );
        await Promise.all(promises);
      }

      await alertSuccess(
        mode === 'single'
          ? `Top-up ${rp(totalAmount)} berhasil!`
          : `${Object.keys(selectedOutlets).length} outlet berhasil di-top-up! Total: ${rp(totalAmount)}`
      );
      onSuccess();
    } catch (err) {
      alertError(err?.response?.data?.message || 'Gagal top-up.');
    } finally {
      setLoading(false);
    }
  };

  const selectedCount = Object.keys(selectedOutlets).length;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)',
        backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 9500, padding: 16,
      }}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.9, opacity: 0, y: 20 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#fff', borderRadius: 20,
          width: '100%', maxWidth: 480, maxHeight: '92vh',
          overflow: 'hidden', display: 'flex', flexDirection: 'column',
          boxShadow: '0 24px 60px rgba(0,0,0,0.25)',
        }}
      >
        {/* Header */}
        <div style={{
          padding: '18px 20px 14px',
          borderBottom: `1px solid ${DT.n100}`,
          flexShrink: 0,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h2 style={{ fontFamily: "'Outfit', sans-serif", fontSize: 18, fontWeight: 700, color: DT.n900, margin: 0 }}>
                📥 Penyaluran Dana Kas
              </h2>
              <p style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 12, color: DT.n600, margin: '4px 0 0' }}>
                Distribusikan dana ke outlet-outlet
              </p>
            </div>
            <button
              onClick={onClose}
              style={{
                width: 32, height: 32, borderRadius: 10, border: 'none',
                background: DT.n100, cursor: 'pointer', fontSize: 18, color: DT.n700,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >×</button>
          </div>
        </div>

        {/* Scrollable content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>

          {/* Mode selector */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            <button
              onClick={() => { setMode('single'); setSelectedOutlets({}); setDistributions({}); }}
              style={{
                flex: 1, padding: '10px 12px', borderRadius: 12,
                border: `2px solid ${mode === 'single' ? DT.primary : DT.n200}`,
                background: mode === 'single' ? DT.primaryTint : '#fff',
                fontFamily: "'Plus Jakarta Sans', sans-serif",
                fontSize: 12, fontWeight: 700,
                color: mode === 'single' ? DT.primary : DT.n700,
                cursor: 'pointer',
              }}
            >
              🎯 Satu Outlet
            </button>
            <button
              onClick={() => { setMode('multi'); setAmount(''); }}
              style={{
                flex: 1, padding: '10px 12px', borderRadius: 12,
                border: `2px solid ${mode === 'multi' ? DT.primary : DT.n200}`,
                background: mode === 'multi' ? DT.primaryTint : '#fff',
                fontFamily: "'Plus Jakarta Sans', sans-serif",
                fontSize: 12, fontWeight: 700,
                color: mode === 'multi' ? DT.primary : DT.n700,
                cursor: 'pointer',
              }}
            >
              📦 Multi Outlet
            </button>
          </div>

          {/* Step 1: Select outlets (multi mode) or single outlet info */}
          {mode === 'multi' && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <div style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 11, fontWeight: 700, color: DT.n700, letterSpacing: 0.3 }}>
                  PILIH OUTLET ({selectedCount}/{allBalances.length})
                </div>
                <button
                  onClick={toggleAllOutlets}
                  style={{
                    fontFamily: "'Plus Jakarta Sans', sans-serif",
                    fontSize: 11, fontWeight: 600, color: DT.primary,
                    background: 'none', border: 'none', cursor: 'pointer',
                  }}
                >
                  {selectedCount === allBalances.length ? 'Batal semua' : 'Pilih semua'}
                </button>
              </div>

              {/* Total budget input */}
              <div style={{
                background: DT.n50, borderRadius: 12, padding: '12px 14px',
                marginBottom: 12, border: `1px solid ${DT.n200}`,
              }}>
                <div style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 11, fontWeight: 600, color: DT.n700, marginBottom: 8 }}>
                  Total Dana yang Didistribusikan
                </div>
                <div style={{ position: 'relative' }}>
                  <span style={{
                    position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
                    fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 12, fontWeight: 600, color: DT.n600,
                  }}>Rp</span>
                  <input
                    type="text"
                    value={amount}
                    onChange={(e) => {
                      setAmount(e.target.value);
                    }}
                    placeholder="0"
                    style={{
                      width: '100%', height: 40, borderRadius: 10,
                      border: `1.5px solid ${DT.n300}`, paddingLeft: 36,
                      fontFamily: "'Poppins', sans-serif", fontSize: 15, fontWeight: 700,
                      color: DT.primary, outline: 'none', boxSizing: 'border-box',
                    }}
                  />
                </div>
                {totalAmount > 0 && selectedCount > 0 && (
                  <button
                    onClick={fillEqualDistribution}
                    style={{
                      marginTop: 8, width: '100%', padding: '7px 12px', borderRadius: 8,
                      border: `1px solid ${DT.primary}40`, background: DT.primaryTint,
                      fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 11, fontWeight: 600,
                      color: DT.primary, cursor: 'pointer',
                    }}
                  >
                    🔄 Bagi rata: {rp(Math.floor(totalAmount / selectedCount))} per outlet
                  </button>
                )}
              </div>

              {/* Outlet list */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 240, overflowY: 'auto' }}>
                {allBalances.map(outlet => {
                  const isSelected = !!selectedOutlets[outlet.outletId];
                  const distAmount = parseAmount(distributions[outlet.outletId] || '');
                  return (
                    <div
                      key={outlet.outletId}
                      onClick={() => toggleOutlet(outlet.outletId)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
                        borderRadius: 12, border: `2px solid ${isSelected ? DT.primary : DT.n200}`,
                        background: isSelected ? DT.primaryTint : '#fff',
                        cursor: 'pointer', transition: 'all .15s ease',
                      }}
                    >
                      {/* Checkbox */}
                      <div style={{
                        width: 22, height: 22, borderRadius: 6, flexShrink: 0,
                        border: `2px solid ${isSelected ? DT.primary : DT.n300}`,
                        background: isSelected ? DT.primary : '#fff',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        {isSelected && (
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        )}
                      </div>

                      {/* Outlet info */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 13, fontWeight: 600, color: DT.n900 }}>
                          {outlet.outletName}
                        </div>
                        <div style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 11, color: DT.n600, marginTop: 2 }}>
                          Saldo saat ini: <strong style={{ color: DT.success }}>{rp(outlet.balance)}</strong>
                        </div>
                      </div>

                      {/* Per-outlet amount input */}
                      {isSelected && (
                        <div style={{ position: 'relative', width: 120 }}>
                          <span style={{
                            position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)',
                            fontSize: 11, fontWeight: 600, color: DT.n500,
                          }}>Rp</span>
                          <input
                            type="text"
                            value={distributions[outlet.outletId] || ''}
                            onChange={(e) => {
                              e.stopPropagation();
                              setDistributions(d => ({ ...d, [outlet.outletId]: e.target.value }));
                            }}
                            placeholder="0"
                            style={{
                              width: '100%', height: 34, borderRadius: 8,
                              border: `1.5px solid ${distAmount > 0 ? DT.success : DT.n300}`,
                              paddingLeft: 28, fontSize: 12, fontWeight: 600,
                              color: distAmount > 0 ? DT.success : DT.n700,
                              outline: 'none', boxSizing: 'border-box',
                            }}
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Single mode: just show selected outlet */}
          {mode === 'single' && (
            <div style={{ marginBottom: 16 }}>
              {(() => {
                const outlet = allBalances.find(o => o.outletId === selectedOutletId);
                return outlet ? (
                  <div style={{
                    background: DT.n50, borderRadius: 14, padding: '14px 16px',
                    border: `1px solid ${DT.n200}`,
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{
                        width: 44, height: 44, borderRadius: 12,
                        background: 'linear-gradient(135deg, #7C3AED, #5B21B6)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 18,
                      }}>
                        🏪
                      </div>
                      <div>
                        <div style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 14, fontWeight: 700, color: DT.n900 }}>
                          {outlet.outletName}
                        </div>
                        <div style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 12, color: DT.n600, marginTop: 2 }}>
                          Saldo saat ini: <strong style={{ color: DT.success }}>{rp(outlet.balance)}</strong>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : null;
              })()}

              {/* Amount input */}
              <div style={{ marginTop: 14 }}>
                <div style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 11, fontWeight: 600, color: DT.n700, marginBottom: 6 }}>
                  Nominal Top-up <span style={{ color: DT.danger }}>*</span>
                </div>
                <div style={{ position: 'relative' }}>
                  <span style={{
                    position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
                    fontFamily: "'Poppins', sans-serif", fontSize: 13, fontWeight: 600, color: DT.n600,
                  }}>Rp</span>
                  <input
                    type="text"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0"
                    style={{
                      width: '100%', height: 48, borderRadius: 12,
                      border: `1.5px solid ${numAmount > 0 ? DT.primary : DT.n300}`,
                      paddingLeft: 40, fontSize: 18, fontWeight: 700,
                      color: DT.primary, outline: 'none', boxSizing: 'border-box',
                      fontFamily: "'Poppins', sans-serif",
                    }}
                  />
                </div>
                {numAmount > 0 && (
                  <div style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 11, color: DT.n600, marginTop: 6 }}>
                    {(() => {
                      const outlet = allBalances.find(o => o.outletId === selectedOutletId);
                      const newBalance = (outlet?.balance || 0) + numAmount;
                      return `Saldo setelah top-up: ${rp(newBalance)}`;
                    })()}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Summary */}
          {mode === 'multi' && totalAmount > 0 && selectedCount > 0 && (
            <div style={{
              background: 'linear-gradient(135deg, #7C3AED10, #5B21B610)',
              borderRadius: 12, padding: '12px 14px', marginBottom: 16,
              border: `1px solid ${DT.primary}20`,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 12, fontWeight: 600, color: DT.n700 }}>
                  Total Didistribusikan
                </span>
                <span style={{ fontFamily: "'Poppins', sans-serif", fontSize: 16, fontWeight: 800, color: DT.primary }}>
                  {rp(totalAmount)}
                </span>
              </div>
              <div style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 11, color: DT.n600, marginTop: 4 }}>
                Ke {selectedCount} outlet
              </div>
            </div>
          )}

          {/* Source selector */}
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 11, fontWeight: 600, color: DT.n700, marginBottom: 6 }}>
              Sumber Dana
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
              {Object.entries(TOPUP_SOURCE_META).map(([k, m]) => (
                <button
                  key={k}
                  onClick={() => setSource(k)}
                  style={{
                    padding: '8px 6px', borderRadius: 10,
                    border: `2px solid ${source === k ? DT.primary : DT.n200}`,
                    background: source === k ? DT.primaryTint : '#fff',
                    fontFamily: "'Plus Jakarta Sans', sans-serif",
                    fontSize: 11, fontWeight: 600,
                    color: source === k ? DT.primary : DT.n700,
                    cursor: 'pointer', textAlign: 'center',
                  }}
                >
                  <div style={{ fontSize: 16, marginBottom: 2 }}>{m.icon}</div>
                  <div>{m.label}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Reference & Notes */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
            <div>
              <div style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 11, fontWeight: 600, color: DT.n700, marginBottom: 5 }}>
                No. Referensi
              </div>
              <input
                type="text"
                value={referenceNo}
                onChange={(e) => setReferenceNo(e.target.value)}
                placeholder="Opsional"
                style={{
                  width: '100%', height: 38, borderRadius: 9,
                  border: `1.5px solid ${DT.n300}`, padding: '0 10px',
                  fontSize: 12, outline: 'none', boxSizing: 'border-box',
                }}
              />
            </div>
            <div>
              <div style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 11, fontWeight: 600, color: DT.n700, marginBottom: 5 }}>
                Nama PIC <span style={{ color: DT.danger }}>*</span>
              </div>
              <input
                type="text"
                value={picName}
                onChange={(e) => setPicName(e.target.value)}
                placeholder="Nama PIC"
                style={{
                  width: '100%', height: 38, borderRadius: 9,
                  border: `1.5px solid ${DT.n300}`, padding: '0 10px',
                  fontSize: 12, outline: 'none', boxSizing: 'border-box',
                }}
              />
            </div>
          </div>

          <div style={{ marginBottom: 14 }}>
            <div style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 11, fontWeight: 600, color: DT.n700, marginBottom: 5 }}>
              Catatan
            </div>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Catatan opsional"
              style={{
                width: '100%', borderRadius: 9, border: `1.5px solid ${DT.n300}`,
                padding: '8px 10px', fontSize: 12, outline: 'none',
                resize: 'vertical', boxSizing: 'border-box',
              }}
            />
          </div>

          {/* Photo upload */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 11, fontWeight: 600, color: DT.n700, marginBottom: 6 }}>
              Bukti Foto Transfer <span style={{ color: DT.danger }}>*</span>
            </div>
            <input
              type="file"
              accept="image/*"
              onChange={handlePhotoUpload}
              disabled={uploadingPhoto}
              style={{ display: 'none' }}
              id="distrib-proof-upload"
            />
            <label
              htmlFor="distrib-proof-upload"
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, height: 52,
                background: DT.n50, border: `1.5px dashed ${proofPhotoUrl ? DT.success : DT.n300}`,
                borderRadius: 12, cursor: uploadingPhoto ? 'not-allowed' : 'pointer',
                fontFamily: "'Plus Jakarta Sans', sans-serif",
                fontSize: 12, fontWeight: 600,
                color: proofPhotoUrl ? DT.success : DT.primary,
              }}
            >
              {uploadingPhoto ? '⏳ Mengunggah...' : proofPhotoUrl ? '✅ Foto tersimpan' : '📷 Ambil Foto'}
            </label>
            {proofPhotoUrl && (
              <img
                src={proofPhotoUrl}
                alt="Bukti"
                style={{ marginTop: 8, width: '100%', maxHeight: 120, objectFit: 'cover', borderRadius: 10, border: `1px solid ${DT.n200}` }}
              />
            )}
          </div>
        </div>

        {/* Footer */}
        <div style={{
          padding: '14px 20px 18px',
          borderTop: `1px solid ${DT.n100}`,
          flexShrink: 0,
        }}>
          <button
            onClick={submit}
            disabled={
              totalAmount <= 0 ||
              !picName.trim() ||
              !proofPhotoUrl ||
              loading ||
              (mode === 'multi' && Object.keys(selectedOutlets).filter(id => selectedOutlets[id] && parseAmount(distributions[id]) > 0).length === 0)
            }
            style={{
              width: '100%', height: 48, borderRadius: 14, border: 'none',
              background: (
                totalAmount <= 0 || !picName.trim() || !proofPhotoUrl || loading ||
                (mode === 'multi' && Object.keys(selectedOutlets).filter(id => selectedOutlets[id] && parseAmount(distributions[id]) > 0).length === 0)
              ) ? DT.n300 : 'linear-gradient(135deg, #7C3AED, #5B21B6)',
              fontFamily: "'Poppins', sans-serif",
              fontSize: 14, fontWeight: 700, color: '#fff',
              cursor: (
                totalAmount <= 0 || !picName.trim() || !proofPhotoUrl || loading ||
                (mode === 'multi' && Object.keys(selectedOutlets).filter(id => selectedOutlets[id] && parseAmount(distributions[id]) > 0).length === 0)
              ) ? 'not-allowed' : 'pointer',
              boxShadow: (
                totalAmount <= 0 || !picName.trim() || !proofPhotoUrl || loading ||
                (mode === 'multi' && Object.keys(selectedOutlets).filter(id => selectedOutlets[id] && parseAmount(distributions[id]) > 0).length === 0)
              ) ? 'none' : '0 8px 24px rgba(124, 58, 237, 0.4)',
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? '⏳ Memproses...' : `📥 Salurkan Dana ${totalAmount > 0 ? rp(totalAmount) : ''}`}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
