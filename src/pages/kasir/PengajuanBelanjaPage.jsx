/**
 * PengajuanBelanjaPage.jsx — Redesigned v5 (Waschen Theme + Full Features)
 *
 * Fitur:
 * - Glassmorphism header dengan animated blobs
 * - Clay card components
 * - Tabs: Uang Kas (auto-approve) | Biaya AP (approval >500k)
 * - List dengan pagination + page size dropdown
 * - Category breakdown visualization (bar chart)
 * - Export Excel + PDF
 * - Approval workflow (approve/reject/cancel)
 * - Multi-item form
 * - Skeleton loading states
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';
import { rp } from '../../utils/helpers';
import { C } from '../../utils/theme';
import { useResponsive } from '../../utils/hooks';
import { alertError, alertSuccess, alertWarning } from '../../utils/alert';
import { useApp } from '../../context/AppContext';
import {
  ChevronRight, Plus, X, Check, RefreshCw, Search, ChevronLeft,
  FileSpreadsheet, FileText, Clock, CheckCircle, DollarSign, TrendingUp,
  Eye, Edit2, Trash2, ShoppingBag, Receipt, ArrowUpDown, Filter,
  ChevronDown, Zap, Shield, TrendingDown, Wallet, AlertTriangle,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { getBalance } from '../../utils/outletCashApi';
import { uploadImage } from '../../utils/imageUpload';

// ─── Design Tokens (Waschen Theme) ───────────────────────────────────────────
const DT = {
  primary:      '#5B005F',
  primaryDark:  '#3B0040',
  primaryMid:   '#6B2D7E',
  primaryTint:  '#F4EDF4',
  primarySoft:  '#AD80AF',
  primaryWash:  '#F3EEF7',
  success:      '#059669',
  successBg:    '#DCFCE7',
  successLight: '#5FD9AE',
  warning:      '#D97706',
  warningBg:    '#FEF3C7',
  danger:       '#DC2626',
  dangerBg:     '#FEE2E2',
  info:         '#0891B2',
  infoBg:       '#DBEAFE',
  white:        '#FFFFFF',
  n50:          '#F7F5F8',
  n100:         '#F0ECF2',
  n200:         '#E8E2EA',
  n300:         '#D4CAD8',
  n400:         '#C4C4C4',
  n500:         '#9A9A9A',
  n600:         '#5A5A5A',
  n700:         '#3A3A3A',
  n800:         '#1A1A1A',
  n900:         '#0a0a0a',
};

const AUTO_APPROVE_LIMIT = 500_000;

// ─── CSS Styles ─────────────────────────────────────────────────────────────
const PAGE_STYLES = `
  :root {
    --glass-bg: #F3EEF7;
  }

  .pb-page {
    display: flex;
    flex-direction: column;
    background: var(--glass-bg);
    overflow: hidden;
  }

  .pb-header {
    background:
      radial-gradient(circle at 85% -10%, rgba(232,90,168,0.55) 0%, transparent 55%),
      radial-gradient(circle at -10% 20%, rgba(95,217,174,0.25) 0%, transparent 45%),
      linear-gradient(155deg, #3B0B47 0%, #5C1A6B 55%, #4A1259 100%);
    position: relative;
    overflow: hidden;
    flex-shrink: 0;
  }

  .pb-blob {
    position: absolute;
    border-radius: 50%;
    pointer-events: none;
    filter: blur(12px);
  }

  .pb-blob-1 {
    width: 200px; height: 200px;
    background: radial-gradient(circle, rgba(232,90,168,0.5) 0%, transparent 70%);
    top: -70px; right: -50px;
    animation: pbFloatB 11s ease-in-out infinite;
  }

  .pb-blob-2 {
    width: 160px; height: 160px;
    background: radial-gradient(circle, rgba(95,217,174,0.3) 0%, transparent 70%);
    bottom: 10px; left: -60px;
    animation: pbFloatC 16s ease-in-out infinite;
  }

  .pb-blob-3 {
    width: 100px; height: 100px;
    background: radial-gradient(circle, rgba(255,255,255,0.18) 0%, transparent 70%);
    top: 30px; left: 50%;
    animation: pbFloatA 9s ease-in-out infinite;
  }

  @keyframes pbFloatA { 0%,100%{transform:translate(0,0) scale(1)} 50%{transform:translate(-14px,16px) scale(1.08)} }
  @keyframes pbFloatB { 0%,100%{transform:translate(0,0) scale(1)} 50%{transform:translate(18px,-12px) scale(1.1)} }
  @keyframes pbFloatC { 0%,100%{transform:translate(0,0) scale(1)} 50%{transform:translate(16px,10px) scale(0.95)} }
  @media(prefers-reduced-motion:reduce){.pb-blob-1,.pb-blob-2,.pb-blob-3{animation:none}}

  /* Clay Card */
  .pb-clay-card {
    background: linear-gradient(145deg, #ffffff, #F4EDF4);
    border-radius: 18px;
    box-shadow: 10px 10px 24px rgba(110,46,120,.1), -5px -5px 14px rgba(255,255,255,.95);
    border: 1px solid rgba(139,92,246,.08);
  }

  /* Clay Icon */
  .pb-clay-icon {
    border-radius: 12px;
    background: linear-gradient(145deg, rgba(91,0,95,.1), rgba(91,0,95,.04));
    box-shadow: 3px 3px 8px rgba(110,46,120,.12), -1px -1px 4px rgba(255,255,255,.9);
    display: flex; align-items: center; justify-content: center;
  }

  /* Chip */
  .pb-chip {
    display: inline-flex; align-items: center; gap: 4px;
    padding: 3px 10px; border-radius: 99px;
    font-size: 10px; font-weight: 600;
  }

  /* Skeleton */
  .pb-skeleton {
    border-radius: 10px;
    background: linear-gradient(90deg, #F0ECF2 0%, #E8E2EA 50%, #F0ECF2 100%);
    background-size: 200% 100%;
    animation: pbShimmer 1.5s infinite;
  }
  @keyframes pbShimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
  @keyframes pbSpin { to{transform:rotate(360deg)} }

  /* List item hover */
  .pb-list-item {
    transition: transform .15s ease, box-shadow .15s ease;
    cursor: pointer;
  }
  .pb-list-item:hover {
    transform: translateY(-2px);
    box-shadow: 6px 6px 16px rgba(110,46,120,.12), -2px -2px 8px rgba(255,255,255,.95);
  }

  /* Progress bar */
  .pb-progress {
    height: 5px; border-radius: 99px;
    background: #E8E2EA; overflow: hidden;
  }
  .pb-progress-bar {
    height: 100%; border-radius: 99px;
    transition: width .4s ease;
  }

  /* Custom scrollbar */
  .pb-content::-webkit-scrollbar { width: 4px; }
  .pb-content::-webkit-scrollbar-track { background: transparent; }
  .pb-content::-webkit-scrollbar-thumb { background: #D4CAD8; border-radius: 99px; }

  /* Responsive */
  @media (max-width: 640px) {
    .pb-stats-grid { grid-template-columns: 1fr 1fr !important; }
    .pb-toolbar { flex-wrap: wrap !important; }
    .pb-content { padding: 10px 12px 110px !important; }
  }
`;

function usePageStyles() {
  useEffect(() => {
    const id = 'pb-page-styles';
    if (!document.getElementById(id)) {
      const s = document.createElement('style');
      s.id = id; s.textContent = PAGE_STYLES;
      document.head.appendChild(s);
    }
    return () => { const e = document.getElementById(id); if (e) e.remove(); };
  }, []);
}

// ─── Status Config ──────────────────────────────────────────────────────────
const STATUS_META = {
  pending:        { label: 'Pending',      bg: DT.warningBg, color: DT.warning, icon: Clock },
  auto_approved:  { label: 'Selesai',     bg: DT.successBg, color: DT.success, icon: CheckCircle },
  approved:       { label: 'Disetujui',   bg: DT.infoBg,    color: DT.info,    icon: CheckCircle },
  rejected:       { label: 'Ditolak',    bg: DT.dangerBg,  color: DT.danger,  icon: X },
  cancelled:      { label: 'Batal',       bg: DT.n100,      color: DT.n500,    icon: X },
};

// ─── Tab Config ─────────────────────────────────────────────────────────────
const TABS = [
  {
    key: 'uang_kas',
    label: 'Uang Kas',
    subtitle: 'Dana operasional harian',
    groupType: 'operasional', // Indonesian spelling to match DB
    alwaysAuto: true,
    color: DT.warning,
    categories: [
      { id: 'uang_makan',    label: 'Biaya Uang Makan',     icon: '🍽️', color: '#F59E0B' },
      { id: 'bbm_transport', label: 'BBM / Transportasi',   icon: '🚗', color: '#6366F1' },
      { id: 'biaya_kantor',  label: 'Biaya Kantor',         icon: '📦', color: '#10B981' },
      { id: 'biaya_lain',    label: 'Biaya Lainnya',         icon: '📝', color: '#8B5CF6' },
    ],
  },
  {
    key: 'biaya_ap',
    label: 'Biaya AP',
    subtitle: 'Tagihan utilitas',
    groupType: 'tagihan', // Indonesian spelling to match DB
    alwaysAuto: false,
    color: DT.info,
    categories: [
      { id: 'lpg',      label: 'Biaya LPG',      icon: '🔥', color: '#F59E0B' },
      { id: 'galon',    label: 'Biaya Galon',     icon: '💧', color: '#0EA5E9' },
      { id: 'listrik',  label: 'Biaya Listrik',   icon: '⚡', color: '#EAB308' },
      { id: 'internet', label: 'Biaya Internet',  icon: '📶', color: '#8B5CF6' },
    ],
  },
];

const CAT_COLORS = Object.fromEntries(
  TABS.flatMap(t => t.categories).map(c => [c.id, { icon: c.icon, color: c.color, label: c.label }])
);

const PERIODS = [
  { key: 'today', label: 'Hari ini', days: 1 },
  { key: '7d',    label: '7 Hari',   days: 7 },
  { key: '30d',   label: '30 Hari',  days: 30 },
  { key: '90d',   label: '90 Hari',  days: 90 },
];

const PAGE_SIZES = [
  { key: '10',  label: '10 / halaman' },
  { key: '20',  label: '20 / halaman' },
  { key: '50',  label: '50 / halaman' },
  { key: '100', label: '100 / halaman' },
];

// ─── Helpers ────────────────────────────────────────────────────────────────
const fmtDate = (v) => {
  if (!v) return '-';
  try { return new Date(v).toLocaleString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }); }
  catch { return '-'; }
};
const fmtDateShort = (v) => {
  if (!v) return '';
  try { return new Date(v).toLocaleDateString('id-ID', { day: '2-digit', month: 'short' }); }
  catch { return ''; }
};

function toRange(p) {
  if (!p) return { s: null, e: null };
  const now = new Date();
  const e = now.toISOString().slice(0, 10);
  const s = new Date(now.getTime() - (p.days - 1) * 86400000).toISOString().slice(0, 10);
  return { s, e };
}

function fmtRange(s, e) {
  if (!s || !e) return 'Semua';
  const f = (d) => new Date(d + 'T00:00:00').toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
  return `${f(s)} – ${f(e)}`;
}

// ─── ClayIcon Component ────────────────────────────────────────────────────
function ClayIcon({ icon, color = DT.primary, size = 40 }) {
  return (
    <div className="pb-clay-icon" style={{ width: size, height: size, color }}>
      {typeof icon === 'string' ? <span style={{ fontSize: size * 0.45 }}>{icon}</span> : icon}
    </div>
  );
}

// ─── ClayButton Component ──────────────────────────────────────────────────
function ClayButton({ children, onClick, variant = 'primary', size = 'md', loading, disabled, style, fullWidth }) {
  const h = size === 'sm' ? 36 : size === 'lg' ? 50 : 44;
  const configs = {
    primary: {
      bg: disabled ? DT.n300 : 'linear-gradient(145deg, #6B2D7E, #4A1A59)',
      color: DT.white, border: 'none',
      shadow: disabled ? 'none' : '-3px -3px 8px rgba(255,255,255,.4), 5px 6px 14px rgba(59,11,71,.35)',
    },
    success: {
      bg: disabled ? DT.n300 : 'linear-gradient(145deg, #5FD9AE 0%, #1F9E75 100%)',
      color: DT.white, border: 'none',
      shadow: disabled ? 'none' : '-3px -3px 8px rgba(255,255,255,.5), 5px 6px 14px rgba(31,158,117,.4)',
    },
    danger: {
      bg: disabled ? DT.n300 : DT.danger,
      color: DT.white, border: 'none',
      shadow: disabled ? 'none' : '-3px -3px 8px rgba(255,255,255,.3), 5px 6px 14px rgba(220,38,38,.4)',
    },
    ghost: {
      bg: DT.white,
      color: DT.primary, border: `1.5px solid ${DT.n200}`,
      shadow: '-2px -2px 6px rgba(255,255,255,.8), 3px 4px 10px rgba(110,46,120,.1)',
    },
    dangerGhost: {
      bg: DT.dangerBg,
      color: DT.danger, border: `1.5px solid ${DT.danger}30`,
      shadow: 'none',
    },
  };
  const cfg = configs[variant] || configs.primary;

  return (
    <motion.button
      onClick={onClick}
      disabled={disabled || loading}
      whileHover={{ scale: disabled ? 1 : 1.02, y: disabled ? 0 : -1 }}
      whileTap={{ scale: disabled ? 1 : 0.97 }}
      style={{
        width: fullWidth ? '100%' : 'auto',
        height: h, padding: '0 20px',
        borderRadius: 14, border: cfg.border,
        background: cfg.bg, color: cfg.color,
        fontFamily: "'Poppins', sans-serif",
        fontSize: size === 'sm' ? 12 : 14,
        fontWeight: 600,
        cursor: disabled || loading ? 'not-allowed' : 'pointer',
        boxShadow: cfg.shadow,
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        opacity: disabled ? 0.6 : 1,
        ...style,
      }}
    >
      {loading ? <RefreshCw size={14} style={{ animation: 'pbSpin 1s linear infinite' }} /> : children}
    </motion.button>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────────
export default function PengajuanBelanjaPage({ goBack }) {
  usePageStyles();
  const { isMobile } = useResponsive();
  const { user } = useApp();
  const userRole = user?.originalRoleCode || user?.roleCode || user?.role;
  const isAdmin = ['admin', 'superadmin', 'owner'].includes(userRole);
  const isKasir = ['kasir', 'frontliner'].includes(userRole);

  const [tab, setTab] = useState('uang_kas');
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [totalPages, setTotalPages] = useState(1);

  // Filters
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [statusF, setStatusF] = useState('all');
  const [period, setPeriod] = useState(PERIODS[1]);
  const [sortBy, setSortBy] = useState('newest');
  const [showFilterPanel, setShowFilterPanel] = useState(false);

  // Summary stats
  const [summary, setSummary] = useState(null);

  // Cash balance & pending tracking
  const [cashBalance, setCashBalance] = useState(null);
  const [pendingTotal, setPendingTotal] = useState(0);

  // Modals
  const [showForm, setShowForm] = useState(false);
  const [showDetail, setShowDetail] = useState(null);

  const currentTab = TABS.find(t => t.key === tab) || TABS[0];
  const { s: dateFrom, e: dateTo } = toRange(period);

  // Debounced search
  useEffect(() => {
    const t = setTimeout(() => { setSearch(searchInput); setPage(1); }, 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  // Fetch list
  const fetchData = useCallback(async (pg = 1, ps = pageSize) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('page', pg);
      params.set('limit', ps);
      params.set('groupType', currentTab.groupType);
      if (statusF !== 'all') params.set('status', statusF);
      if (dateFrom) params.set('dateFrom', dateFrom);
      if (dateTo)   params.set('dateTo', dateTo);
      if (search.trim()) params.set('search', search.trim());
      if (sortBy) params.set('sort', sortBy);

      const res = await axios.get(`/api/pengajuan-belanja?${params.toString()}`);
      setData(res.data.data || []);
      setTotal(res.data.pagination?.total ?? 0);
      setTotalPages(res.data.pagination?.totalPages ?? 1);
      setPage(pg);
      setPageSize(ps);
    } catch {
      // silent fail
    } finally {
      setLoading(false);
    }
  }, [currentTab.groupType, statusF, dateFrom, dateTo, search, sortBy, pageSize]);

  useEffect(() => { fetchData(1, pageSize); }, [fetchData]);

  // Fetch summary
  const fetchSummary = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      params.set('groupType', currentTab.groupType);
      if (dateFrom) params.set('dateFrom', dateFrom);
      if (dateTo)   params.set('dateTo', dateTo);
      const res = await axios.get(`/api/pengajuan-belanja/summary?${params.toString()}`);
      setSummary(res.data.data || res.data);
    } catch { /* silent */ }
  }, [currentTab.groupType, dateFrom, dateTo]);

  useEffect(() => { fetchSummary(); }, [fetchSummary]);

  // Fetch cash balance
  const fetchCashBalance = useCallback(async () => {
    try {
      const data = await getBalance();
      setCashBalance(data);
    } catch { /* silent */ }
  }, []);

  // Fetch pending total for preview
  const fetchPendingTotal = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      params.set('groupType', currentTab.groupType);
      params.set('status', 'pending');
      if (dateFrom) params.set('dateFrom', dateFrom);
      if (dateTo)   params.set('dateTo', dateTo);
      const res = await axios.get(`/api/pengajuan-belanja/summary?${params.toString()}`);
      const summaryData = res.data.data || [];
      const total = summaryData.reduce((s, row) => s + parseFloat(row.total_amount || 0), 0);
      setPendingTotal(total);
    } catch { /* silent */ }
  }, [currentTab.groupType, dateFrom, dateTo]);

  useEffect(() => {
    if (tab === 'uang_kas') {
      fetchCashBalance();
      fetchPendingTotal();
    } else {
      setCashBalance(null);
      setPendingTotal(0);
    }
  }, [tab, fetchCashBalance, fetchPendingTotal]);

  const refresh = () => {
    fetchData(page, pageSize);
    if (tab === 'uang_kas') {
      fetchCashBalance();
      fetchPendingTotal();
    }
  };

  // Compute stats from current data
  const stats = useMemo(() => {
    const pending = data.filter(p => p.status === 'pending').length;
    const approved = data.filter(p => ['approved', 'auto_approved'].includes(p.status)).length;
    const rejected = data.filter(p => ['rejected', 'cancelled'].includes(p.status)).length;
    const totalAmt = data.reduce((s, p) => s + parseFloat(p.total_amount || 0), 0);
    const avgAmt = data.length > 0 ? totalAmt / data.length : 0;

    const catBreakdown = {};
    data.forEach(p => {
      (p.items || []).forEach(it => {
        const code = it.category_code;
        if (code) {
          catBreakdown[code] = (catBreakdown[code] || 0) + parseFloat(it.total_price || 0);
        }
      });
    });
    return { pending, approved, rejected, totalAmt, avgAmt, catBreakdown };
  }, [data]);

  // Sort options
  const SORT_OPTIONS = [
    { key: 'newest',    label: 'Terbaru' },
    { key: 'oldest',    label: 'Terlama' },
    { key: 'highest',   label: 'Nominal Tertinggi' },
    { key: 'lowest',    label: 'Nominal Terendah' },
    { key: 'pending',   label: 'Pending Duluan' },
  ];

  // Action handlers
  const handleApprove = async (id) => {
    try {
      await axios.patch(`/api/pengajuan-belanja/${id}/approve`);
      await alertSuccess('Pengajuan berhasil disetujui');
      refresh();
      setShowDetail(null);
    } catch (e) { alertError(e.response?.data?.message || 'Gagal menyetujui'); }
  };

  const handleReject = async (id, reason) => {
    try {
      await axios.patch(`/api/pengajuan-belanja/${id}/reject`, { reason });
      await alertSuccess('Pengajuan ditolak');
      refresh();
      setShowDetail(null);
    } catch (e) { alertError(e.response?.data?.message || 'Gagal menolak'); }
  };

  const handleCancel = async (id) => {
    if (!window.confirm('Yakin ingin membatalkan pengajuan ini?')) return;
    try {
      await axios.patch(`/api/pengajuan-belanja/${id}/cancel`);
      await alertSuccess('Pengajuan dibatalkan');
      refresh();
      setShowDetail(null);
    } catch (e) { alertError(e.response?.data?.message || 'Gagal membatalkan'); }
  };

  // Export
  const handleExport = async (fmt) => {
    if (!data.length) { alertWarning('Tidak ada data untuk di-export'); return; }
    const dateRange = fmtRange(dateFrom, dateTo);
    if (fmt === 'xlsx') exportXlsx(data, currentTab.label, dateRange);
    else exportPdf(data, currentTab.label, dateRange);
  };

  const handlePageSizeChange = (newSize) => {
    setPageSize(Number(newSize));
    setPage(1);
    fetchData(1, Number(newSize));
  };

  return (
    <div className="pb-page">

      {/* ── HEADER ── */}
      <div className="pb-header" style={{ padding: '14px 16px 0' }}>
        <div className="pb-blob pb-blob-1" />
        <div className="pb-blob pb-blob-2" />
        <div className="pb-blob pb-blob-3" />

        <div style={{ position: 'relative', zIndex: 1 }}>
          {/* Top bar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
            <motion.button
              whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
              onClick={goBack}
              style={{
                width: 32, height: 32, borderRadius: 10,
                background: 'rgba(255,255,255,.15)',
                border: '1px solid rgba(255,255,255,.25)',
                color: DT.white, display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer',
              }}
            >
              <ChevronRight size={15} style={{ transform: 'rotate(180deg)' }} />
            </motion.button>

            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,.6)', fontWeight: 500 }}>
                {currentTab.subtitle}
              </div>
              <div style={{ fontSize: 16, fontWeight: 700, color: DT.white, fontFamily: "'Poppins', sans-serif" }}>
                Pengajuan Belanja
              </div>
            </div>

            <motion.button
              whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
              onClick={refresh}
              style={{
                width: 32, height: 32, borderRadius: 10,
                background: 'rgba(255,255,255,.15)',
                border: '1px solid rgba(255,255,255,.25)',
                color: DT.white, display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer',
              }}
            >
              <RefreshCw size={13} style={{ animation: loading ? 'pbSpin 1s linear infinite' : 'none' }} />
            </motion.button>
          </div>

          {/* Tab Switcher */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 0 }}>
            {TABS.map(t => {
              const active = tab === t.key;
              return (
                <motion.button
                  key={t.key}
                  onClick={() => { setTab(t.key); setSearch(''); setSearchInput(''); setStatusF('all'); setPage(1); }}
                  whileHover={{ scale: active ? 1 : 1.02 }}
                  whileTap={{ scale: active ? 1 : 0.98 }}
                  style={{
                    height: 44, borderRadius: '12px 12px 0 0',
                    border: active ? 'none' : '1.5px solid rgba(255,255,255,.25)',
                    background: active ? DT.white : 'rgba(255,255,255,.1)',
                    color: active ? t.color : 'rgba(255,255,255,.85)',
                    fontFamily: "'Poppins', sans-serif",
                    fontSize: 13, fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                    boxShadow: active ? `0 -3px 10px ${t.color}30` : 'none',
                    transition: 'all .2s ease',
                  }}
                >
                  <span style={{ fontSize: 17 }}>{t.key === 'uang_kas' ? '💰' : '📄'}</span>
                  {t.label}
                </motion.button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── CONTENT ── */}
      <div className="pb-content" style={{ flex: 1, overflowY: 'auto', padding: '12px 16px 110px', display: 'flex', flexDirection: 'column', gap: 12 }}>

        {/* Summary Stats */}
        <div className="pb-stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
          <StatCard
            icon={<Clock size={15} />}
            label="Pending"
            value={stats.pending}
            color={DT.warning}
            loading={loading}
          />
          <StatCard
            icon={<CheckCircle size={15} />}
            label="Disetujui"
            value={stats.approved}
            color={DT.success}
            loading={loading}
          />
          <StatCard
            icon={<DollarSign size={15} />}
            label="Total"
            value={rp(stats.totalAmt)}
            color={DT.primary}
            loading={loading}
            small
          />
          <StatCard
            icon={<TrendingUp size={15} />}
            label="Rata-rata"
            value={rp(stats.avgAmt)}
            color={DT.info}
            loading={loading}
            small
          />
        </div>

        {/* Cash Balance Info Banner (Uang Kas only) */}
        {tab === 'uang_kas' && (
          <CashBalanceBanner
            cashBalance={cashBalance}
            pendingTotal={pendingTotal}
            loading={loading}
          />
        )}

        {/* Info Banner */}
        <motion.div
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          className="pb-clay-card"
          style={{ padding: '10px 14px', display: 'flex', alignItems: 'flex-start', gap: 10 }}
        >
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: currentTab.alwaysAuto ? DT.warningBg : DT.infoBg,
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            {currentTab.alwaysAuto ? <Zap size={16} color={DT.warning} /> : <Shield size={16} color={DT.info} />}
          </div>
          <div>
            <div style={{ fontSize: 11.5, fontWeight: 600, color: DT.n800, marginBottom: 2 }}>
              {currentTab.alwaysAuto ? 'Auto-Approve Uang Kas' : 'Aturan Approval Biaya AP'}
            </div>
            <div style={{ fontSize: 11, color: DT.n600, lineHeight: 1.5 }}>
              {currentTab.alwaysAuto
                ? 'Semua pengajuan uang kas langsung diproses & dicatat ke saldo kas harian outlet.'
                : '≤ Rp 500.000 auto-approve. Lebih dari itu perlu persetujuan admin/owner.'}
            </div>
          </div>
        </motion.div>

        {/* Toolbar */}
        <div className="pb-toolbar" style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>

          {/* Search */}
          <div style={{ flex: '1 1 180px', position: 'relative' }}>
            <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: DT.n500, pointerEvents: 'none' }} />
            <input
              type="text"
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              placeholder="Cari pengajuan..."
              style={{
                width: '100%', height: 38, borderRadius: 12,
                border: `1.5px solid ${searchInput ? currentTab.color : DT.n200}`,
                background: DT.white, padding: '0 12px 0 32px',
                fontSize: 12, outline: 'none', color: DT.n800, boxSizing: 'border-box',
                fontFamily: "'Poppins', sans-serif",
                transition: 'border-color .2s ease',
              }}
            />
          </div>

          {/* Sort */}
          <div style={{ position: 'relative' }}>
            <select
              value={sortBy}
              onChange={e => { setSortBy(e.target.value); setPage(1); }}
              style={{
                height: 38, borderRadius: 12,
                border: `1.5px solid ${DT.n200}`,
                background: DT.white,
                padding: '0 28px 0 12px',
                fontSize: 12, color: DT.n700, outline: 'none', cursor: 'pointer',
                fontFamily: "'Poppins', sans-serif",
                appearance: 'none',
              }}
            >
              {SORT_OPTIONS.map(o => <option key={o.key} value={o.key}>{o.label}</option>)}
            </select>
            <ArrowUpDown size={11} style={{ position: 'absolute', right: 9, top: '50%', transform: 'translateY(-50%)', color: DT.n500, pointerEvents: 'none' }} />
          </div>

          {/* Status */}
          <select
            value={statusF}
            onChange={e => { setStatusF(e.target.value); setPage(1); }}
            style={{
              height: 38, borderRadius: 12,
              border: `1.5px solid ${statusF !== 'all' ? currentTab.color : DT.n200}`,
              background: statusF !== 'all' ? `${currentTab.color}12` : DT.white,
              padding: '0 12px', fontSize: 12, color: DT.n700, outline: 'none', cursor: 'pointer',
              fontFamily: "'Poppins', sans-serif",
            }}
          >
            <option value="all">Semua Status</option>
            <option value="pending">Pending</option>
            <option value="auto_approved">Selesai</option>
            <option value="approved">Disetujui</option>
            <option value="rejected">Ditolak</option>
            <option value="cancelled">Batal</option>
          </select>

          {/* Period */}
          <div style={{ display: 'flex', gap: 4, overflowX: 'auto' }}>
            {PERIODS.map(p => {
              const active = period.key === p.key;
              return (
                <motion.button
                  key={p.key}
                  onClick={() => { setPeriod(p); setPage(1); }}
                  whileTap={{ scale: 0.95 }}
                  style={{
                    height: 38, padding: '0 12px', borderRadius: 12,
                    border: `1.5px solid ${active ? currentTab.color : DT.n200}`,
                    background: active ? `${currentTab.color}12` : DT.white,
                    fontSize: 11.5, fontWeight: active ? 700 : 500,
                    color: active ? currentTab.color : DT.n700,
                    cursor: 'pointer', whiteSpace: 'nowrap',
                    fontFamily: "'Poppins', sans-serif",
                    transition: 'all .15s ease',
                  }}
                >
                  {p.label}
                </motion.button>
              );
            })}
          </div>
        </div>

        {/* Toolbar Row 2 — Export */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <motion.button
            whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
            onClick={() => handleExport('xlsx')}
            style={{
              height: 36, padding: '0 14px', borderRadius: 11,
              border: `1.5px solid ${DT.success}`,
              background: DT.successBg, color: DT.success,
              fontSize: 11.5, fontWeight: 600, cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 6,
              fontFamily: "'Poppins', sans-serif",
            }}
          >
            <FileSpreadsheet size={13} />
            Export Excel
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
            onClick={() => handleExport('pdf')}
            style={{
              height: 36, padding: '0 14px', borderRadius: 11,
              border: `1.5px solid ${DT.danger}`,
              background: DT.dangerBg, color: DT.danger,
              fontSize: 11.5, fontWeight: 600, cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 6,
              fontFamily: "'Poppins', sans-serif",
            }}
          >
            <FileText size={13} />
            Export PDF
          </motion.button>

          {/* Summary mini */}
          {!loading && data.length > 0 && (
            <span style={{ marginLeft: 'auto', fontSize: 11, color: DT.n500 }}>
              Menampilkan {data.length} dari {total} data
            </span>
          )}
        </div>

        {/* Category Breakdown Visualization */}
        {Object.keys(stats.catBreakdown).length > 0 && (
          <CategoryBreakdownCard breakdown={stats.catBreakdown} currentTab={currentTab} />
        )}

        {/* List */}
        {loading ? (
          <ListSkeleton />
        ) : data.length === 0 ? (
          <EmptyState message="Belum ada pengajuan dalam periode ini" />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {data.map((item, i) => (
              <PengajuanRow
                key={item.id}
                item={item}
                index={i}
                currentTab={currentTab}
                onClick={() => setShowDetail(item)}
              />
            ))}
          </div>
        )}

        {/* Pagination */}
        {!loading && data.length > 0 && (
          <PaginationBar
            page={page}
            totalPages={totalPages}
            total={total}
            pageSize={pageSize}
            onPage={fetchData}
            onPageSizeChange={handlePageSizeChange}
          />
        )}
      </div>

      {/* ── FAB ── */}
      {(() => {
        const balanceAmt = Number(cashBalance?.balance || 0);
        const previewAmt = balanceAmt - pendingTotal;
        const isDisabled = tab === 'uang_kas' && previewAmt <= 0;
        return (
          <motion.button
            whileHover={{ scale: isDisabled ? 1 : 1.08 }}
            whileTap={{ scale: isDisabled ? 1 : 0.92 }}
            onClick={() => !isDisabled && setShowForm(true)}
            style={{
              position: 'fixed', bottom: 82, right: 16,
              width: 54, height: 54, borderRadius: 27,
              background: isDisabled
                ? `linear-gradient(145deg, ${DT.n400}, ${DT.n300})`
                : 'linear-gradient(145deg, #6B2D7E, #4A1A59)',
              border: 'none',
              boxShadow: isDisabled
                ? 'none'
                : '-4px -4px 12px rgba(255,255,255,.3), 6px 8px 20px rgba(93,0,95,.45)',
              cursor: isDisabled ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              zIndex: 50,
              opacity: isDisabled ? 0.6 : 1,
            }}
          >
            <Plus size={22} color={DT.white} />
          </motion.button>
        );
      })()}

      {/* ── MODALS ── */}
      <AnimatePresence>
        {showForm && (
          <FormModal
            tab={currentTab}
            onClose={() => setShowForm(false)}
            onSuccess={() => { setShowForm(false); refresh(); }}
          />
        )}

        {showDetail && (
          <DetailModal
            item={showDetail}
            isAdmin={isAdmin}
            isKasir={isKasir}
            onClose={() => setShowDetail(null)}
            onApprove={handleApprove}
            onReject={handleReject}
            onCancel={handleCancel}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Cash Balance Banner ──────────────────────────────────────────────────────
function CashBalanceBanner({ cashBalance, pendingTotal, loading }) {
  const balanceAmt = Number(cashBalance?.balance || 0);
  const previewAmt = balanceAmt - pendingTotal;
  const isZero = previewAmt <= 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      style={{
        background: isZero
          ? 'linear-gradient(145deg, #FEF2F2, #FEE2E2)'
          : 'linear-gradient(145deg, #ffffff, #F4EDF4)',
        borderRadius: 18,
        padding: '14px 16px',
        boxShadow: '6px 6px 16px rgba(110,46,120,.1), -3px -3px 10px rgba(255,255,255,.95)',
        border: `1.5px solid ${isZero ? DT.danger + '30' : DT.warning + '30'}`,
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <div style={{
          width: 36, height: 36, borderRadius: 10,
          background: isZero ? DT.dangerBg : DT.warningBg,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Wallet size={16} color={isZero ? DT.danger : DT.warning} />
        </div>
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, color: DT.n500, textTransform: 'uppercase', letterSpacing: .5 }}>
            Saldo Kas Outlet
          </div>
          {cashBalance?.outletName && (
            <div style={{ fontSize: 11, color: DT.n600 }}>{cashBalance.outletName}</div>
          )}
        </div>
      </div>

      {/* Balance */}
      <div style={{ marginBottom: 12 }}>
        {loading && !cashBalance ? (
          <div className="pb-skeleton" style={{ height: 32, width: '60%', borderRadius: 8 }} />
        ) : (
          <div style={{
            fontSize: 28, fontWeight: 800, color: isZero ? DT.danger : DT.n900,
            fontFamily: "'Poppins', sans-serif",
          }}>
            {rp(balanceAmt)}
          </div>
        )}
      </div>

      {/* Breakdown */}
      <div style={{
        background: DT.n50,
        borderRadius: 12,
        padding: '10px 14px',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Clock size={12} color={DT.warning} />
            <span style={{ fontSize: 11.5, color: DT.n700, fontWeight: 500 }}>Sedang Ditinjau</span>
          </div>
          <span style={{ fontSize: 13, fontWeight: 700, color: DT.warning }}>
            {loading && !pendingTotal ? '-' : rp(pendingTotal)}
          </span>
        </div>

        <div style={{ height: 1, background: DT.n200 }} />

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <TrendingDown size={12} color={isZero ? DT.danger : DT.success} />
            <span style={{ fontSize: 11.5, color: DT.n700, fontWeight: 600 }}>Sisa Tersedia</span>
          </div>
          <span style={{ fontSize: 15, fontWeight: 800, color: isZero ? DT.danger : DT.success }}>
            {loading && !cashBalance ? '-' : rp(previewAmt)}
          </span>
        </div>
      </div>

      {/* Warning */}
      {isZero && (
        <div style={{
          marginTop: 10,
          background: DT.dangerBg,
          borderRadius: 10,
          padding: '8px 12px',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}>
          <AlertTriangle size={14} color={DT.danger} />
          <span style={{ fontSize: 11, color: DT.danger, fontWeight: 600 }}>
            Saldo tidak cukup. Minta admin untuk top-up terlebih dahulu.
          </span>
        </div>
      )}
    </motion.div>
  );
}

// ─── Stat Card ──────────────────────────────────────────────────────────────
function StatCard({ icon, label, value, color, loading, small }) {
  return (
    <div className="pb-clay-card" style={{ padding: '10px 12px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ color, opacity: 0.85 }}>{icon}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 9, fontWeight: 600, color: DT.n500, textTransform: 'uppercase', letterSpacing: .4 }}>
            {label}
          </div>
          {loading ? (
            <div className="pb-skeleton" style={{ height: 16, marginTop: 3, width: '85%' }} />
          ) : (
            <div style={{
              fontSize: small ? 11 : 14,
              fontWeight: 800,
              color: DT.n900,
              marginTop: 2,
              fontFamily: "'Poppins', sans-serif",
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}>
              {value}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Category Breakdown ────────────────────────────────────────────────────
function CategoryBreakdownCard({ breakdown, currentTab }) {
  const sorted = Object.entries(breakdown).sort((a, b) => b[1] - a[1]);
  const total = sorted.reduce((s, [, v]) => s + v, 0);
  const maxAmt = sorted[0]?.[1] || 1;

  return (
    <div className="pb-clay-card" style={{ padding: '14px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <Receipt size={14} color={DT.primary} />
        <span style={{ fontSize: 10, fontWeight: 700, color: DT.n500, textTransform: 'uppercase', letterSpacing: .4 }}>
          Breakdown per Kategori
        </span>
        <span style={{ marginLeft: 'auto', fontSize: 10, color: DT.n400 }}>
          Total: {rp(total)}
        </span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {sorted.map(([code, amt]) => {
          const meta = CAT_COLORS[code] || { icon: '📋', color: DT.n500 };
          const pct = total > 0 ? Math.round((amt / total) * 100) : 0;
          const barWidth = (amt / maxAmt) * 100;

          return (
            <div key={code} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 16, width: 22, textAlign: 'center', flexShrink: 0 }}>{meta.icon}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                  <span style={{ fontSize: 11.5, fontWeight: 600, color: DT.n700 }}>{meta.label}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: DT.n900 }}>{rp(amt)}</span>
                    <span style={{ fontSize: 9, fontWeight: 600, color: DT.n400, minWidth: 28, textAlign: 'right' }}>{pct}%</span>
                  </div>
                </div>
                <div className="pb-progress">
                  <div
                    className="pb-progress-bar"
                    style={{ width: `${barWidth}%`, background: meta.color }}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Pengajuan Row ─────────────────────────────────────────────────────────
function PengajuanRow({ item, index, currentTab, onClick }) {
  const status = STATUS_META[item.status] || STATUS_META.pending;
  const StatusIcon = status.icon;
  const first = item.items?.[0];
  const catMeta = first?.category_code ? (CAT_COLORS[first.category_code] || { icon: '📋', color: DT.n500 }) : { icon: '📋', color: DT.n500 };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.04, 0.4) }}
      className="pb-list-item pb-clay-card"
      onClick={onClick}
      style={{
        padding: '12px 14px',
        display: 'flex', gap: 12, alignItems: 'center',
        borderLeft: `4px solid ${catMeta.color}`,
      }}
    >
      {/* Category Icon */}
      <ClayIcon icon={catMeta.icon} color={catMeta.color} size={40} />

      {/* Info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 13, fontWeight: 600, color: DT.n900,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          fontFamily: "'Poppins', sans-serif",
        }}>
          {item.description || first?.item_name || 'Pengajuan Belanja'}
        </div>
        <div style={{ fontSize: 10.5, color: DT.n500, marginTop: 2 }}>
          {item.request_no}
          {item.items?.length > 1 && <span style={{ color: DT.n400 }}> · {item.items.length} item</span>}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 4, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 10, color: DT.n600 }}>{item.requester_name || '-'}</span>
          <span style={{ color: DT.n300 }}>·</span>
          <span style={{ fontSize: 10, color: DT.n500 }}>{fmtDate(item.created_at)}</span>
          {item.status === 'pending' && (
            <span className="pb-chip" style={{ background: DT.warningBg, color: DT.warning, marginLeft: 4 }}>
              <Zap size={8} /> perlu action
            </span>
          )}
        </div>
      </div>

      {/* Amount + Status */}
      <div style={{ textAlign: 'right', flexShrink: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 800, color: DT.n900, fontFamily: "'Poppins', sans-serif" }}>
          {rp(parseFloat(item.total_amount || 0))}
        </div>
        <div className="pb-chip" style={{ marginTop: 4, background: status.bg, color: status.color }}>
          <StatusIcon size={9} />
          {status.label}
        </div>
      </div>
    </motion.div>
  );
}

// ─── Pagination Bar ─────────────────────────────────────────────────────────
function PaginationBar({ page, totalPages, total, pageSize, onPage, onPageSizeChange }) {
  const PAGE_DISPLAY = 5;

  const getPages = () => {
    const pages = [];
    if (totalPages <= PAGE_DISPLAY + 2) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (page > 3) pages.push('...');
      for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) pages.push(i);
      if (page < totalPages - 2) pages.push('...');
      pages.push(totalPages);
    }
    return pages;
  };

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      gap: 8, marginTop: 6, padding: '10px 0', flexWrap: 'wrap',
    }}>
      {/* Page size */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 11, color: DT.n500 }}>Tampilkan</span>
        <select
          value={pageSize}
          onChange={e => onPageSizeChange(e.target.value)}
          style={{
            height: 32, borderRadius: 10,
            border: `1.5px solid ${DT.n200}`,
            background: DT.white,
            padding: '0 24px 0 10px',
            fontSize: 11.5, color: DT.n700, outline: 'none', cursor: 'pointer',
            fontFamily: "'Poppins', sans-serif",
            appearance: 'none',
          }}
        >
          {PAGE_SIZES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
        </select>
      </div>

      {/* Total */}
      <span style={{ fontSize: 11, color: DT.n500 }}>{total} total data</span>

      {/* Page nav */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <motion.button
          whileTap={{ scale: page <= 1 ? 1 : 0.9 }}
          onClick={() => page > 1 && onPage(page - 1)}
          disabled={page <= 1}
          style={{
            width: 32, height: 32, borderRadius: 10,
            border: `1.5px solid ${DT.n200}`,
            background: DT.white,
            color: page <= 1 ? DT.n300 : DT.primary,
            cursor: page <= 1 ? 'not-allowed' : 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            opacity: page <= 1 ? 0.5 : 1,
          }}
        >
          <ChevronLeft size={14} />
        </motion.button>

        {getPages().map((p, i) =>
          p === '...' ? (
            <span key={`dots-${i}`} style={{ color: DT.n400, padding: '0 4px', fontSize: 13 }}>…</span>
          ) : (
            <motion.button
              key={p}
              whileTap={{ scale: p === page ? 1 : 0.9 }}
              onClick={() => p !== page && onPage(p)}
              style={{
                width: 32, height: 32, borderRadius: 10,
                border: `1.5px solid ${p === page ? DT.primary : DT.n200}`,
                background: p === page ? DT.primary : DT.white,
                color: p === page ? DT.white : DT.n700,
                fontSize: 12, fontWeight: 600,
                cursor: p === page ? 'default' : 'pointer',
                fontFamily: "'Poppins', sans-serif",
              }}
            >
              {p}
            </motion.button>
          )
        )}

        <motion.button
          whileTap={{ scale: page >= totalPages ? 1 : 0.9 }}
          onClick={() => page < totalPages && onPage(page + 1)}
          disabled={page >= totalPages}
          style={{
            width: 32, height: 32, borderRadius: 10,
            border: `1.5px solid ${DT.n200}`,
            background: DT.white,
            color: page >= totalPages ? DT.n300 : DT.primary,
            cursor: page >= totalPages ? 'not-allowed' : 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            opacity: page >= totalPages ? 0.5 : 1,
          }}
        >
          <ChevronRight size={14} />
        </motion.button>
      </div>
    </div>
  );
}

// ─── Skeleton ──────────────────────────────────────────────────────────────
function ListSkeleton() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {[0, 1, 2, 3, 4].map(i => (
        <div key={i} className="pb-clay-card" style={{ padding: '12px 14px', display: 'flex', gap: 12, alignItems: 'center' }}>
          <div className="pb-skeleton" style={{ width: 40, height: 40, borderRadius: 12, flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <div className="pb-skeleton" style={{ height: 13, width: '65%', marginBottom: 6 }} />
            <div className="pb-skeleton" style={{ height: 11, width: '40%' }} />
          </div>
          <div style={{ textAlign: 'right' }}>
            <div className="pb-skeleton" style={{ height: 14, width: 70, marginBottom: 4 }} />
            <div className="pb-skeleton" style={{ height: 20, width: 60, borderRadius: 99 }} />
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Empty State ────────────────────────────────────────────────────────────
function EmptyState({ message }) {
  return (
    <div style={{ textAlign: 'center', padding: '60px 0' }}>
      <div style={{ fontSize: 48, marginBottom: 10 }}>📋</div>
      <div style={{ fontSize: 13, fontWeight: 600, color: DT.n500, marginBottom: 4 }}>{message}</div>
      <div style={{ fontSize: 11, color: DT.n400 }}>Coba ubah filter atau periode waktu</div>
    </div>
  );
}

// ─── Detail Modal ──────────────────────────────────────────────────────────
function DetailModal({ item, isAdmin, isKasir, onClose, onApprove, onReject, onCancel }) {
  const status = STATUS_META[item.status] || STATUS_META.pending;
  const StatusIcon = status.icon;
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const canApprove = isAdmin && item.status === 'pending';
  const canCancel = isKasir && ['pending', 'auto_approved'].includes(item.status);

  const handleAction = async (action) => {
    setActionLoading(true);
    try {
      await action();
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <>
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0,
          background: 'rgba(0,0,0,.5)',
          zIndex: 200,
        }}
      />

      {/* Sheet */}
      <motion.div
        initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        style={{
          position: 'fixed', bottom: 0, left: 0, right: 0,
          background: DT.white, borderRadius: '20px 20px 0 0',
          padding: 20, zIndex: 201, maxHeight: '92vh', overflowY: 'auto',
        }}
      >
        {/* Handle */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
          <div style={{ width: 36, height: 4, borderRadius: 99, background: DT.n300 }} />
        </div>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 10.5, color: DT.n500, fontFamily: "'Poppins', sans-serif" }}>{item.request_no}</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: DT.n900, marginTop: 2, fontFamily: "'Poppins', sans-serif" }}>
              {item.description || 'Pengajuan Belanja'}
            </div>
            <div style={{ fontSize: 11, color: DT.n500, marginTop: 2 }}>
              Oleh <strong>{item.requester_name || '-'}</strong> · {fmtDate(item.created_at)}
            </div>
          </div>
          <motion.button whileTap={{ scale: 0.9 }} onClick={onClose}
            style={{ width: 34, height: 34, borderRadius: 17, background: DT.n100, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <X size={16} color={DT.n600} />
          </motion.button>
        </div>

        {/* Status + Total Banner */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          background: status.bg, borderRadius: 14, padding: '12px 16px', marginBottom: 16,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <StatusIcon size={18} color={status.color} />
            <span style={{ fontSize: 13, fontWeight: 700, color: status.color }}>{status.label}</span>
          </div>
          <div style={{ fontSize: 22, fontWeight: 800, color: DT.n900, fontFamily: "'Poppins', sans-serif" }}>
            {rp(parseFloat(item.total_amount || 0))}
          </div>
        </div>

        {/* Items */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: DT.n500, textTransform: 'uppercase', letterSpacing: .4, marginBottom: 10 }}>
            Item ({item.items?.length || 0})
          </div>
          <div className="pb-clay-card" style={{ padding: '0 12px' }}>
            {(item.items || []).map((it, idx) => {
              const cat = CAT_COLORS[it.category_code] || { icon: '📋', color: DT.n500 };
              const isLast = idx === (item.items?.length || 0) - 1;
              return (
                <div key={idx} style={{
                  display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0',
                  borderBottom: isLast ? 'none' : `1px solid ${DT.n100}`,
                }}>
                  <span style={{ fontSize: 20, width: 28, textAlign: 'center' }}>{cat.icon}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 600, color: DT.n800 }}>{it.item_name}</div>
                    <div style={{ fontSize: 11, color: DT.n500, marginTop: 1 }}>
                      {it.qty}x {rp(parseFloat(it.estimated_price || 0))}
                    </div>
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: DT.n900, fontFamily: "'Poppins', sans-serif" }}>
                    {rp(parseFloat(it.total_price || 0))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Approval info */}
        {item.approver_name && (
          <div style={{
            background: DT.successBg, borderRadius: 12, padding: '10px 14px', marginBottom: 16,
            fontSize: 11, color: DT.success,
          }}>
            <strong>Disetujui</strong> oleh {item.approver_name} pada {fmtDate(item.approved_at)}
            {item.approval_notes && <div style={{ marginTop: 3, fontStyle: 'italic', color: DT.n600 }}>"{item.approval_notes}"</div>}
          </div>
        )}

        {item.reject_reason && (
          <div style={{
            background: DT.dangerBg, borderRadius: 12, padding: '10px 14px', marginBottom: 16,
            fontSize: 11, color: DT.danger,
          }}>
            <strong>Ditolak</strong>: {item.reject_reason}
          </div>
        )}

        {/* Reject form */}
        {showRejectForm && (
          <div style={{ marginBottom: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <textarea
              value={rejectReason}
              onChange={e => setRejectReason(e.target.value)}
              placeholder="Alasan penolakan (minimal 3 karakter)..."
              rows={2}
              style={{
                width: '100%', borderRadius: 12, border: `1.5px solid ${DT.danger}`,
                padding: '10px 14px', fontSize: 12, resize: 'none', outline: 'none',
                boxSizing: 'border-box', fontFamily: "'Poppins', sans-serif",
              }}
            />
            <div style={{ display: 'flex', gap: 8 }}>
              <ClayButton variant="ghost" size="sm" onClick={() => setShowRejectForm(false)} fullWidth>Batal</ClayButton>
              <ClayButton
                variant="danger"
                size="sm"
                fullWidth
                disabled={rejectReason.trim().length < 3}
                onClick={() => { if (rejectReason.trim().length >= 3) handleAction(() => onReject(item.id, rejectReason)); }}
              >
                Tolak
              </ClayButton>
            </div>
          </div>
        )}

        {/* Actions */}
        {!showRejectForm && (
          <div style={{ display: 'flex', gap: 8, paddingBottom: 'env(safe-area-inset-bottom)' }}>
            {canCancel && (
              <ClayButton
                variant="ghost"
                onClick={() => handleAction(() => onCancel(item.id))}
                loading={actionLoading}
                fullWidth
              >
                <X size={14} /> Batalkan
              </ClayButton>
            )}
            {canApprove && (
              <>
                <ClayButton
                  variant="dangerGhost"
                  onClick={() => setShowRejectForm(true)}
                  fullWidth
                >
                  <X size={14} /> Tolak
                </ClayButton>
                <ClayButton
                  variant="success"
                  onClick={() => handleAction(() => onApprove(item.id))}
                  loading={actionLoading}
                  fullWidth
                >
                  <CheckCircle size={14} /> Setujui
                </ClayButton>
              </>
            )}
            {!canApprove && !canCancel && (
              <ClayButton variant="primary" onClick={onClose} fullWidth>
                Tutup
              </ClayButton>
            )}
          </div>
        )}
      </motion.div>
    </>
  );
}

// ─── Form Modal ─────────────────────────────────────────────────────────────
function FormModal({ tab, onClose, onSuccess }) {
  const [catId, setCatId] = useState('');
  const [items, setItems] = useState([{ name: '', qty: '1', price: '' }]);
  const [notes, setNotes] = useState('');
  const [picName, setPicName] = useState('');
  const [receiptPhoto, setReceiptPhoto] = useState(null); // { dataUrl, filename }
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [loading, setLoading] = useState(false);

  const addItem = () => setItems(prev => [...prev, { name: '', qty: '1', price: '' }]);
  const removeItem = (i) => setItems(prev => prev.filter((_, idx) => idx !== i));
  const updateItem = (i, field, val) => setItems(prev => prev.map((it, idx) => idx === i ? { ...it, [field]: val } : it));

  const parsedItems = items.map(it => ({
    ...it,
    numPrice: parseFloat(String(it.price).replace(/\D/g, '')) || 0,
    qtyNum: parseInt(it.qty) || 1,
  }));

  const grandTotal = parsedItems.reduce((s, it) => s + it.numPrice * it.qtyNum, 0);
  const needsApproval = !tab.alwaysAuto && grandTotal > AUTO_APPROVE_LIMIT;
  const isOperational = tab.key === 'uang_kas'; // uang kas requires photo, AP optional

  // Upload photo
  const handlePhotoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingPhoto(true);
    try {
      const result = await uploadImage(file, 'receipt');
      setReceiptPhoto({ dataUrl: result.dataUrl, filename: file.name });
    } catch (err) {
      alertError(err?.message || 'Gagal upload foto bukti. Pastikan format JPG/PNG dan ukuran maks 15MB.');
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleSubmit = async () => {
    if (!catId) { alertWarning('Pilih kategori'); return; }
    const validItems = parsedItems.filter(it => it.name.trim() && it.numPrice > 0);
    if (validItems.length === 0) { alertWarning('Tambahkan minimal 1 item dengan nama & harga'); return; }
    if (!picName.trim()) { alertWarning('Nama PIC wajib diisi'); return; }
    if (isOperational && !receiptPhoto) { alertWarning('Foto bukti wajib untuk uang kas'); return; }

    setLoading(true);
    try {
      const cat = tab.categories.find(c => c.id === catId);
      const res = await axios.post('/api/pengajuan-belanja', {
        items: validItems.map(it => ({
          categoryCode: catId,
          itemName: it.name.trim(),
          qty: it.qtyNum,
          unit: 'pcs',
          estimatedPrice: it.numPrice,
        })),
        description: notes.trim() || `${cat?.label}`,
        picName: picName.trim(),
        receiptPhotoUrl: receiptPhoto?.dataUrl || null,
      });

      if (res.data.success || res.data.created) {
        await alertSuccess(needsApproval
          ? `Pengajuan Rp ${rp(grandTotal)} dikirim untuk persetujuan.`
          : `Pengajuan Rp ${grandTotal} berhasil dicatat.`);
        onSuccess();
      } else {
        alertError(res.data.message || 'Gagal menyimpan');
      }
    } catch (e) {
      alertError(e.response?.data?.message || 'Terjadi kesalahan');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose}
        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 200 }}
      />

      <motion.div
        initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        style={{
          position: 'fixed', bottom: 0, left: 0, right: 0,
          background: DT.white, borderRadius: '20px 20px 0 0',
          padding: 20, zIndex: 201, maxHeight: '94vh', overflowY: 'auto',
        }}
      >
        {/* Handle */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
          <div style={{ width: 36, height: 4, borderRadius: 99, background: DT.n300 }} />
        </div>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 11, color: tab.color, fontWeight: 600, fontFamily: "'Poppins', sans-serif" }}>{tab.subtitle}</div>
            <div style={{ fontSize: 17, fontWeight: 700, color: DT.n900, marginTop: 2, fontFamily: "'Poppins', sans-serif" }}>
              Ajukan {tab.label} Baru
            </div>
          </div>
          <motion.button whileTap={{ scale: 0.9 }} onClick={onClose}
            style={{ width: 34, height: 34, borderRadius: 17, background: DT.n100, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <X size={16} color={DT.n600} />
          </motion.button>
        </div>

        {/* Category */}
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 11.5, fontWeight: 600, color: DT.n700, marginBottom: 8 }}>
            Kategori <span style={{ color: DT.danger }}>*</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {tab.categories.map(cat => {
              const active = catId === cat.id;
              return (
                <motion.button
                  key={cat.id}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => setCatId(cat.id)}
                  style={{
                    padding: '10px 12px', borderRadius: 12,
                    border: `1.5px solid ${active ? cat.color : DT.n200}`,
                    background: active ? `${cat.color}12` : DT.white,
                    cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10,
                    transition: 'all .15s ease',
                  }}
                >
                  <span style={{ fontSize: 18 }}>{cat.icon}</span>
                  <span style={{
                    fontSize: 11.5, fontWeight: active ? 700 : 500,
                    color: active ? cat.color : DT.n700,
                    fontFamily: "'Poppins', sans-serif",
                  }}>
                    {cat.label}
                  </span>
                </motion.button>
              );
            })}
          </div>
        </div>

        {/* Items */}
        <div style={{ marginBottom: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <div style={{ fontSize: 11.5, fontWeight: 600, color: DT.n700 }}>
              Item <span style={{ color: DT.danger }}>*</span>
            </div>
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={addItem}
              style={{
                padding: '4px 12px', borderRadius: 20,
                border: `1.5px solid ${DT.primary}`,
                background: `${DT.primary}12`, color: DT.primary,
                fontSize: 11, fontWeight: 600, cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 4,
                fontFamily: "'Poppins', sans-serif",
              }}
            >
              <Plus size={11} /> Tambah Item
            </motion.button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {items.map((it, idx) => (
              <div key={idx} className="pb-clay-card" style={{ padding: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: DT.n600 }}>Item #{idx + 1}</span>
                  {items.length > 1 && (
                    <motion.button
                      whileTap={{ scale: 0.9 }}
                      onClick={() => removeItem(idx)}
                      style={{
                        width: 24, height: 24, borderRadius: 12,
                        background: DT.dangerBg, border: 'none', cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}
                    >
                      <X size={11} color={DT.danger} />
                    </motion.button>
                  )}
                </div>

                <div style={{ marginBottom: 8 }}>
                  <input
                    type="text"
                    value={it.name}
                    onChange={e => updateItem(idx, 'name', e.target.value)}
                    placeholder="Nama barang / keterangan"
                    style={{
                      width: '100%', height: 40, borderRadius: 10,
                      border: `1.5px solid ${DT.n200}`, padding: '0 12px',
                      fontSize: 12.5, outline: 'none', boxSizing: 'border-box',
                      fontFamily: "'Poppins', sans-serif",
                    }}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '70px 1fr', gap: 8 }}>
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 600, color: DT.n500, marginBottom: 4 }}>Qty</div>
                    <input
                      type="number"
                      value={it.qty}
                      onChange={e => updateItem(idx, 'qty', e.target.value)}
                      min="1"
                      style={{
                        width: '100%', height: 40, borderRadius: 10,
                        border: `1.5px solid ${DT.n200}`, padding: '0 10px',
                        fontSize: 12.5, outline: 'none', boxSizing: 'border-box',
                        fontFamily: "'Poppins', sans-serif",
                      }}
                    />
                  </div>
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 600, color: DT.n500, marginBottom: 4 }}>Harga (Rp)</div>
                    <div style={{ position: 'relative' }}>
                      <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 12, color: DT.n500 }}>Rp</span>
                      <input
                        type="text"
                        value={it.price}
                        onChange={e => updateItem(idx, 'price', e.target.value)}
                        placeholder="0"
                        style={{
                          width: '100%', height: 40, borderRadius: 10,
                          border: `1.5px solid ${DT.n200}`, padding: '0 10px 0 28px',
                          fontSize: 12.5, outline: 'none', boxSizing: 'border-box',
                          fontFamily: "'Poppins', sans-serif",
                        }}
                      />
                    </div>
                  </div>
                </div>

                {parsedItems[idx].numPrice > 0 && (
                  <div style={{ marginTop: 6, textAlign: 'right', fontSize: 11.5, fontWeight: 600, color: DT.primary }}>
                    Subtotal: {rp(parsedItems[idx].numPrice * parsedItems[idx].qtyNum)}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Notes */}
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 11.5, fontWeight: 600, color: DT.n700, marginBottom: 6 }}>Catatan (opsional)</div>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            rows={2}
            placeholder="Tambahkan catatan..."
            style={{
              width: '100%', borderRadius: 12, border: `1.5px solid ${DT.n200}`,
              padding: '10px 14px', fontSize: 12.5, outline: 'none', resize: 'none',
              boxSizing: 'border-box', fontFamily: "'Poppins', sans-serif",
            }}
          />
        </div>

        {/* PIC & Photo Row */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
          {/* PIC Name */}
          <div>
            <div style={{ fontSize: 11.5, fontWeight: 600, color: DT.n700, marginBottom: 6 }}>
              Nama PIC <span style={{ color: DT.danger }}>*</span>
            </div>
            <input
              type="text"
              value={picName}
              onChange={e => setPicName(e.target.value)}
              placeholder="Contoh: Sari"
              style={{
                width: '100%', height: 42, borderRadius: 10,
                border: `1.5px solid ${picName ? DT.success : DT.n200}`,
                padding: '0 12px', fontSize: 12.5, outline: 'none',
                boxSizing: 'border-box', fontFamily: "'Poppins', sans-serif",
                background: picName ? `${DT.success}08` : DT.white,
              }}
            />
          </div>

          {/* Receipt Photo */}
          <div>
            <div style={{ fontSize: 11.5, fontWeight: 600, color: DT.n700, marginBottom: 6 }}>
              Bukti Foto {isOperational ? <span style={{ color: DT.danger }}>*</span> : <span style={{ color: DT.n400 }}>(opsional)</span>}
            </div>
            {receiptPhoto ? (
              <div style={{
                height: 42, borderRadius: 10,
                border: `1.5px solid ${DT.success}`,
                background: `${DT.success}08`,
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '0 12px', boxSizing: 'border-box',
              }}>
                <CheckCircle size={14} color={DT.success} />
                <span style={{ flex: 1, fontSize: 12, color: DT.success, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {receiptPhoto.filename || 'Foto tersimpan'}
                </span>
                <button
                  onClick={() => setReceiptPhoto(null)}
                  style={{
                    width: 22, height: 22, borderRadius: 11, border: 'none',
                    background: DT.dangerBg, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <X size={11} color={DT.danger} />
                </button>
              </div>
            ) : (
              <label style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                height: 42, borderRadius: 10,
                border: `1.5px dashed ${DT.n300}`,
                background: DT.n50, cursor: uploadingPhoto ? 'wait' : 'pointer',
                fontSize: 12, fontWeight: 600, color: DT.primary,
                boxSizing: 'border-box',
              }}>
                {uploadingPhoto ? (
                  <RefreshCw size={13} style={{ animation: 'pbSpin 1s linear infinite' }} />
                ) : (
                  <span>Ambil Foto</span>
                )}
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handlePhotoUpload}
                  disabled={uploadingPhoto}
                  style={{ display: 'none' }}
                />
              </label>
            )}
          </div>
        </div>

        {/* Total Banner */}
        <div style={{
          background: needsApproval ? DT.warningBg : DT.successBg,
          border: `1px solid ${needsApproval ? DT.warning : DT.success}30`,
          borderRadius: 14, padding: '12px 16px', marginBottom: 14,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <div>
            <div style={{ fontSize: 11, color: DT.n600 }}>Total Pengajuan</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: needsApproval ? DT.warning : DT.success, fontFamily: "'Poppins', sans-serif" }}>
              {rp(grandTotal)}
            </div>
          </div>
          <div style={{
            padding: '5px 14px', borderRadius: 20,
            background: needsApproval ? DT.warning : DT.success,
            color: DT.white, fontSize: 11, fontWeight: 700,
            display: 'flex', alignItems: 'center', gap: 5,
            fontFamily: "'Poppins', sans-serif",
          }}>
            {needsApproval ? <><Zap size={10} /> Perlu Approve</> : <><CheckCircle size={10} /> Auto-Approve</>}
          </div>
        </div>

        {/* Submit */}
        <ClayButton
          variant="primary"
          size="lg"
          fullWidth
          loading={loading}
          disabled={!catId || parsedItems.every(it => !it.name.trim() || it.numPrice <= 0) || !picName.trim() || (isOperational && !receiptPhoto)}
          onClick={handleSubmit}
        >
          <ShoppingBag size={16} />
          Ajukan Sekarang
        </ClayButton>
      </motion.div>
    </>
  );
}

// ─── Export Functions ────────────────────────────────────────────────────────
function exportXlsx(data, tabLabel, dateRange) {
  const wb = XLSX.utils.book_new();
  const rows = data.map((p, i) => ({
    '#': i + 1,
    'No. Pengajuan': p.request_no,
    'Tanggal': fmtDate(p.created_at),
    'Deskripsi': p.description || '',
    'Nominal': parseFloat(p.total_amount || 0),
    'Status': STATUS_META[p.status]?.label || p.status,
    'Pengaju': p.requester_name || '',
    'Items': (p.items || []).map(it => it.item_name).join(', '),
  }));
  const ws = XLSX.utils.json_to_sheet(rows);
  ws['!cols'] = [{ wch: 4 }, { wch: 22 }, { wch: 18 }, { wch: 30 }, { wch: 16 }, { wch: 14 }, { wch: 16 }, { wch: 40 }];
  XLSX.utils.book_append_sheet(wb, ws, tabLabel);
  XLSX.writeFile(wb, `Pengajuan_${tabLabel}_${new Date().toISOString().slice(0, 10)}.xlsx`);
  alertSuccess('Excel berhasil di-download');
}

function exportPdf(data, tabLabel, dateRange) {
  const doc = new jsPDF();
  doc.setFillColor(59, 0, 95);
  doc.rect(0, 0, doc.internal.pageSize.getWidth(), 30, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(15);
  doc.setFont('helvetica', 'bold');
  doc.text(`Pengajuan ${tabLabel}`, doc.internal.pageSize.getWidth() / 2, 12, { align: 'center' });
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(dateRange, doc.internal.pageSize.getWidth() / 2, 21, { align: 'center' });
  doc.text(`Generated: ${fmtDate(new Date())}`, doc.internal.pageSize.getWidth() / 2, 27, { align: 'center' });

  autoTable(doc, {
    startY: 36,
    head: [['#', 'No. Pengajuan', 'Tanggal', 'Deskripsi', 'Nominal', 'Status', 'Pengaju']],
    body: data.map((p, i) => [
      i + 1,
      p.request_no,
      fmtDateShort(p.created_at),
      (p.description || '').substring(0, 35),
      rp(parseFloat(p.total_amount || 0)),
      STATUS_META[p.status]?.label || p.status,
      p.requester_name || '',
    ]),
    theme: 'striped',
    headStyles: { fillColor: [59, 0, 95], fontSize: 9, fontStyle: 'bold' },
    bodyStyles: { fontSize: 8 },
    columnStyles: {
      0: { cellWidth: 10, halign: 'center' },
      1: { cellWidth: 24 },
      2: { cellWidth: 22 },
      3: { cellWidth: 52 },
      4: { halign: 'right', cellWidth: 26 },
      5: { cellWidth: 22 },
      6: { cellWidth: 28 },
    },
    margin: { left: 12, right: 12 },
    didParseCell: (data) => {
      if (data.column.index === 4 && data.section === 'body') {
        data.cell.styles.halign = 'right';
      }
    },
  });

  doc.save(`Pengajuan_${tabLabel}_${new Date().toISOString().slice(0, 10)}.pdf`);
  alertSuccess('PDF berhasil di-download');
}
