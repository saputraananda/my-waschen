// ══════════════════════════════════════════════════════════════════════════════
// ShiftPage.jsx — Complete Shift Management (Kasir View)
// Supports: Main Session + Sub-Session + Handover Flow
// Tabs: Status | Kas | Sub-Session | Riwayat
// ══════════════════════════════════════════════════════════════════════════════
import { useEffect, useState, useCallback } from 'react';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import { C } from '../../utils/theme';
import { rp } from '../../utils/helpers';
import { TopBar, Btn, MoneyInput, Modal, Badge } from '../../components/ui';
import { alertError, alertSuccess, alertWarning } from '../../utils/alert';
import { useResponsive, useWindowSize } from '../../utils/hooks';
import PaymentBreakdownCard from '../../components/ui/PaymentBreakdownCard';
import {
  IconClock, IconCash, IconTrendUp, IconTrendDown, IconWarning,
  IconReceipt, IconChevronRight, IconRefresh, IconCheck, IconX,
  IconPerson, IconUsers
} from '../../components/ui/StatusIcons';

// ─── Constants ────────────────────────────────────────────────────────────────
const SHIFT_OPTIONS = [
  { value: 'pagi', label: 'Pagi', jam: '06:00 - 14:00', icon: '🌅' },
  { value: 'siang', label: 'Siang', jam: '14:00 - 22:00', icon: '🌤️' },
  { value: 'malam', label: 'Malam', jam: '22:00 - 06:00', icon: '🌙' },
  { value: 'full', label: 'Full Day', jam: '06:00 - 22:00', icon: '☀️' },
];

const TABS = [
  { id: 'status', label: 'Status', icon: IconClock },
  { id: 'kas', label: 'Kas', icon: IconCash },
  { id: 'subSession', label: 'Sub-Session', icon: IconUsers },
  { id: 'riwayat', label: 'Riwayat', icon: IconReceipt },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmtTime = (v) => {
  if (!v) return '-';
  try {
    return new Date(v).toLocaleString('id-ID', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit', hour12: false
    });
  } catch { return String(v); }
};

const fmtElapsed = (openedAt) => {
  if (!openedAt) return '';
  const ms = Date.now() - new Date(openedAt).getTime();
  if (ms < 0) return '';
  const totalMin = Math.floor(ms / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h > 0) return `${h}j ${m}m`;
  return `${m} menit`;
};

const fmtDate = () => {
  return new Date().toLocaleString('id-ID', {
    weekday: 'long', day: '2-digit', month: 'long', year: 'numeric'
  });
};

const fmtCurrency = (num) => {
  if (!num && num !== 0) return '-';
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0
  }).format(num).replace('Rp', '').trim();
};

// ─── Clay Card ────────────────────────────────────────────────────────────────
const ClayCard = ({ children, style, padding = 16 }) => (
  <motion.div
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.3 }}
    style={{
      background: `linear-gradient(145deg, ${C.white}, ${C.primaryTint})`,
      borderRadius: 20,
      padding: padding,
      boxShadow: '10px 10px 24px rgba(110, 46, 120, 0.1), -5px -5px 14px rgba(255, 255, 255, 0.95)',
      border: '1px solid rgba(139, 92, 246, 0.08)',
      ...style,
    }}
  >
    {children}
  </motion.div>
);

// ─── Clay Icon ────────────────────────────────────────────────────────────────
const ClayIcon = ({ icon: IconComp, color = C.primary, size = 32 }) => (
  <div
    style={{
      width: size,
      height: size,
      borderRadius: size * 0.25,
      background: `linear-gradient(145deg, ${color}15, ${color}05)`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      boxShadow: `3px 3px 8px ${color}15, -1px -1px 4px rgba(255, 255, 255, 0.9)`,
    }}
  >
    {typeof icon === 'string' ? (
      <span style={{ fontSize: size * 0.4 }}>{icon}</span>
    ) : (
      <IconComp size={size * 0.45} color={color} />
    )}
  </div>
);

// ─── Status Badge ─────────────────────────────────────────────────────────────
const StatusBadge = ({ status }) => {
  const config = {
    open: { bg: C.success + '15', color: C.success, text: '● Aktif', pulse: true },
    closed: { bg: C.n100, color: C.n500, text: 'Tutup', pulse: false },
    handover: { bg: C.warning + '15', color: C.warning, text: '● Dioper', pulse: true },
    'belum-buka': { bg: C.danger + '10', color: C.danger, text: 'Belum Aktif', pulse: false },
  };
  const c = config[status] || config.closed;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      padding: '6px 14px', borderRadius: 999, fontSize: 12, fontWeight: 600,
      background: c.bg, color: c.color,
    }}>
      {c.pulse && (
        <span style={{
          width: 8, height: 8, borderRadius: '50%', background: c.color,
          animation: 'pulse 2s infinite'
        }} />
      )}
      {c.text}
    </span>
  );
};

// ─── Glass Styles ─────────────────────────────────────────────────────────────
const useGlassStyles = () => {
  useEffect(() => {
    const styleId = 'shift-page-glass';
    if (!document.getElementById(styleId)) {
      const style = document.createElement('style');
      style.id = styleId;
      style.textContent = `
        :root { --glass-bg: #F3EEF7; }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `;
      document.head.appendChild(style);
    }
    return () => {
      const existing = document.getElementById(styleId);
      if (existing) existing.remove();
    };
  }, []);
};

// ─── Main Component ───────────────────────────────────────────────────────────
export default function KasirShiftPage({ navigate, goBack }) {
  useGlassStyles();
  const componentNavigate = navigate || ((path) => window.location.href = path);
  const componentGoBack = goBack || (() => window.history.back());
  const { isMobile, isTablet } = useResponsive();
  const { width } = useWindowSize();

  useEffect(() => {
    // Use responsive hooks if available
  }, [isMobile, isTablet, width]);

  const [activeTab, setActiveTab] = useState('status');
  const [shiftStatus, setShiftStatus] = useState(null);
  const [shiftSummary, setShiftSummary] = useState(null);
  const [subSessions, setSubSessions] = useState([]);
  const [recentTransactions, setRecentTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [elapsed, setElapsed] = useState('');

  // ── Modal States ───────────────────────────────────────────────────────────
  const [showBukaShift, setShowBukaShift] = useState(false);
  const [showGabungShift, setShowGabungShift] = useState(false);
  const [showTutup, setShowTutup] = useState(false);
  const [showTutupSubSession, setShowTutupSubSession] = useState(false);
  const [showHandover, setShowHandover] = useState(false);

  // ── Form States ────────────────────────────────────────────────────────────
  const [shiftType, setShiftType] = useState('full');
  const [openingCash, setOpeningCash] = useState('');
  const [closingCash, setClosingCash] = useState('');
  const [closeNotes, setCloseNotes] = useState('');
  const [handoverSaldo, setHandoverSaldo] = useState('');
  const [handoverKasModal, setHandoverKasModal] = useState('');
  const [handoverRevenue, setHandoverRevenue] = useState('');
  const [handoverNotes, setHandoverNotes] = useState('');
  const [subSessionCash, setSubSessionCash] = useState('');

  // ── Close/Handover Result ─────────────────────────────────────────────────
  const [closeResult, setCloseResult] = useState(null);

  // ── Load Data ──────────────────────────────────────────────────────────────
  const loadStatus = useCallback(async () => {
    try {
      const res = await axios.get('/api/shifts/status');
      setShiftStatus(res.data);
    } catch (e) {
      setShiftStatus(null);
    }
  }, []);

  const loadSummary = useCallback(async () => {
    setLoadingSummary(true);
    try {
      const res = await axios.get('/api/shifts/current-summary');
      setShiftSummary(res.data?.data || null);
    } catch (e) {
      setShiftSummary(null);
    } finally {
      setLoadingSummary(false);
    }
  }, []);

  const loadSubSessions = useCallback(async () => {
    if (!shiftStatus?.session?.id) {
      setSubSessions([]);
      return;
    }
    try {
      const res = await axios.get(`/api/shifts/sub-session/${shiftStatus.session.id}/all`);
      setSubSessions(res.data?.data || []);
    } catch (e) {
      setSubSessions([]);
    }
  }, [shiftStatus?.session?.id]);

  const loadRecentTransactions = useCallback(async () => {
    if (!shiftStatus?.session?.id) return;
    try {
      const res = await axios.get(`/api/transactions?session_id=${shiftStatus.session.id}&limit=10`);
      setRecentTransactions(res.data?.data || []);
    } catch (e) {
      // Silent fail
    }
  }, [shiftStatus?.session?.id]);

  const loadAll = useCallback(async () => {
    setLoading(true);
    await Promise.all([loadStatus(), loadSummary()]);
    setLoading(false);
  }, [loadStatus, loadSummary]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  useEffect(() => {
    if (shiftStatus?.session?.id) {
      loadSubSessions();
      loadRecentTransactions();
    }
  }, [shiftStatus?.session?.id, loadSubSessions, loadRecentTransactions]);

  // ── Elapsed Timer ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!shiftStatus?.session?.openedAt) return;
    const tick = () => setElapsed(fmtElapsed(shiftStatus.session.openedAt));
    tick();
    const id = setInterval(tick, 30000);
    return () => clearInterval(id);
  }, [shiftStatus?.session?.openedAt]);

  // ── Derived State ──────────────────────────────────────────────────────────
  const isOpen = !!shiftStatus?.isOpen && !shiftStatus?.bypass;
  const session = shiftStatus?.session;
  const subSession = shiftStatus?.subSession;
  const hasSubSession = !!subSession;
  const shiftOpt = SHIFT_OPTIONS.find(s => s.value === session?.shift) || SHIFT_OPTIONS[3];

  const cashPosition = shiftSummary ? {
    opening: shiftSummary.openingCash || 0,
    sales: shiftSummary.cashSales || 0,
    expenses: shiftSummary.totalExpense || 0,
    expected: shiftSummary.expectedCash || 0,
    total: shiftSummary.grandTotalPayments || 0,
    transactions: shiftSummary.totalTransactions || 0,
  } : { opening: 0, sales: 0, expenses: 0, expected: 0, total: 0, transactions: 0 };

  // ── Actions ─────────────────────────────────────────────────────────────────
  const handleBukaShift = async () => {
    setLoading(true);
    try {
      const res = await axios.post('/api/shifts/open', {
        openingCash: Number(String(openingCash).replace(/\D/g, '') || 0),
        shift: shiftType,
      });
      setOpeningCash('');
      setShowBukaShift(false);
      await loadAll();
      alertSuccess('Shift berhasil dibuka!');
    } catch (e) {
      alertError(e?.response?.data?.message || 'Gagal buka shift');
    } finally {
      setLoading(false);
    }
  };

  const handleGabungShift = async () => {
    if (!session?.id) {
      alertError('Tidak ada shift aktif untuk digabungkan.');
      return;
    }
    setLoading(true);
    try {
      await axios.post('/api/shifts/sub-session/open', {
        sessionId: session.id,
        beginningCash: Number(String(openingCash).replace(/\D/g, '') || 0),
      });
      setOpeningCash('');
      setShowGabungShift(false);
      await loadAll();
      alertSuccess('Berhasil bergabung dengan shift!');
    } catch (e) {
      alertError(e?.response?.data?.message || 'Gagal gabung shift');
    } finally {
      setLoading(false);
    }
  };

  const handleTutupShift = async () => {
    setLoading(true);
    try {
      const res = await axios.post('/api/shifts/close', {
        closingCash: Number(String(closingCash).replace(/\D/g, '') || 0),
        notes: closeNotes || null,
      });
      setCloseResult(res.data.data);
      setShowTutup(false);
      await loadAll();
    } catch (e) {
      alertError(e?.response?.data?.message || 'Gagal tutup shift');
    } finally {
      setLoading(false);
    }
  };

  const handleTutupSubSession = async () => {
    if (!subSession?.id) {
      alertError('Tidak ada sub-session aktif.');
      return;
    }
    setLoading(true);
    try {
      const res = await axios.post('/api/shifts/sub-session/close', {
        subSessionId: subSession.id,
        endingCash: Number(String(subSessionCash).replace(/\D/g, '') || 0),
      });
      setSubSessionCash('');
      setShowTutupSubSession(false);
      await loadAll();
      const d = res.data.data;
      if (d.variance === 0) {
        alertSuccess('Sub-session ditutup. Kas rapi!');
      } else {
        alertWarning(`Sub-session ditutup. Ada selisih Rp ${fmtCurrency(Math.abs(d.variance))}`);
      }
    } catch (e) {
      alertError(e?.response?.data?.message || 'Gagal tutup sub-session');
    } finally {
      setLoading(false);
    }
  };

  const handleHandover = async () => {
    const saldo = Number(String(handoverSaldo).replace(/\D/g, '') || 0);
    const kasModal = Number(String(handoverKasModal).replace(/\D/g, '') || 0);
    const revenue = Number(String(handoverRevenue).replace(/\D/g, '') || 0);

    if (saldo === 0 && kasModal === 0 && revenue === 0) {
      alertError('Isi minimal salah satu input (Saldo, Kas Modal, atau Revenue)');
      return;
    }

    setLoading(true);
    try {
      const total = saldo + kasModal + revenue;
      await axios.post('/api/shifts/handover', {
        handoverCash: total,
        handoverSaldo: saldo,
        handoverKasModal: kasModal,
        handoverRevenue: revenue,
        notes: handoverNotes || null,
      });
      setShowHandover(false);
      setHandoverSaldo('');
      setHandoverKasModal('');
      setHandoverRevenue('');
      setHandoverNotes('');
      await loadAll();
      alertSuccess('Shift berhasil dioper!');
    } catch (e) {
      alertError(e?.response?.data?.message || 'Gagal oper shift');
    } finally {
      setLoading(false);
    }
  };

  // ─── Render: Header ────────────────────────────────────────────────────────
  const renderHeader = () => (
    <ClayCard padding={isMobile ? 16 : 20} style={{ marginBottom: 12 }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
      }}>
        <StatusBadge status={isOpen ? (session?.status === 'handover' ? 'handover' : 'open') : 'belum-buka'} />
        <span style={{ fontSize: 12, color: C.n500, fontFamily: "'Poppins'" }}>{fmtDate()}</span>
      </div>

      {isOpen && session ? (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
            <span style={{ fontSize: 28 }}>{shiftOpt.icon}</span>
            <div>
              <div style={{ fontSize: 18, fontWeight: 700, color: C.n800, fontFamily: "'Poppins'" }}>
                Shift {shiftOpt.label}
              </div>
              <div style={{ fontSize: 12, color: C.n500, fontFamily: "'Poppins'" }}>
                {fmtTime(session.openedAt)}
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Badge variant="primary">{elapsed}</Badge>
            <Badge variant="secondary">{shiftOpt.jam}</Badge>
            {hasSubSession && (
              <Badge variant="success">Sub-Session Aktif</Badge>
            )}
          </div>
        </div>
      ) : (
        <div style={{ textAlign: 'center', padding: 12 }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>😴</div>
          <div style={{ fontSize: 14, fontWeight: 600, color: C.n700, fontFamily: "'Poppins'", marginBottom: 4 }}>
            Shift Belum Aktif
          </div>
          <div style={{ fontSize: 12, color: C.n500, fontFamily: "'Poppins'" }}>
            Buka atau gabung shift untuk mulai bertransaksi
          </div>
        </div>
      )}
    </ClayCard>
  );

  // ─── Render: Tabs ──────────────────────────────────────────────────────────
  const renderTabs = () => (
    <div style={{
      display: 'flex',
      gap: 6,
      marginBottom: 12,
      padding: 4,
      background: C.white,
      borderRadius: 14,
      boxShadow: '6px 6px 16px rgba(110, 46, 120, 0.08), -3px -3px 8px rgba(255, 255, 255, 0.95)',
    }}>
      {TABS.map(tab => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.id;
        return (
          <motion.button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            whileTap={{ scale: 0.95 }}
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 4,
              padding: '8px 8px',
              borderRadius: 10,
              border: 'none',
              background: isActive
                ? 'linear-gradient(145deg, ' + C.primary + ', ' + C.primaryDark + ')'
                : 'transparent',
              color: isActive ? C.white : C.n500,
              fontFamily: "'Poppins'",
              fontSize: 11,
              fontWeight: isActive ? 600 : 500,
              cursor: 'pointer',
              transition: 'all 0.2s ease',
            }}
          >
            <Icon size={14} color={isActive ? C.white : C.n500} />
            {!isMobile && tab.label}
          </motion.button>
        );
      })}
    </div>
  );

  // ─── Tab Content ────────────────────────────────────────────────────────────
  const renderTabContent = () => {
    switch (activeTab) {
      case 'status': return renderStatusTab();
      case 'kas': return renderKasTab();
      case 'subSession': return renderSubSessionTab();
      case 'riwayat': return renderRiwayatTab();
      default: return null;
    }
  };

  // ─── Tab: Status ────────────────────────────────────────────────────────────
  const renderStatusTab = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {isOpen && shiftSummary && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
          <StatBox label="Transaksi" value={shiftSummary.totalTransactions || 0} suffix="nota" color={C.primary} />
          <StatBox label="Omset" value={shiftSummary.totalOmset || 0} color={C.success} isCurrency />
          <StatBox label="Kas Tunai" value={shiftSummary.cashSales || 0} color="#F59E0B" isCurrency />
        </div>
      )}

      <ClayCard padding={16}>
        <div style={{ fontSize: 12, fontWeight: 600, color: C.n600, marginBottom: 12, fontFamily: "'Poppins'" }}>
          Aksi Cepat
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <ActionButton icon={<IconReceipt size={18} />} label="Lihat Semua Transaksi" onClick={() => componentNavigate('transaksi')} color={C.primary} />
          {isOpen && (
            <ActionButton icon={<IconRefresh size={18} />} label="Refresh Data" onClick={loadAll} color={C.n500} />
          )}
        </div>
      </ClayCard>
    </div>
  );

  // ─── Tab: Kas ────────────────────────────────────────────────────────────────
  const renderKasTab = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {isOpen && shiftSummary ? (
        <ClayCard padding={16}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: C.primary, fontFamily: "'Poppins'" }}>
                Posisi Kas Sekarang
              </div>
            </div>
            {loadingSummary ? (
              <span style={{ fontSize: 10, color: C.n400 }}>Memuat...</span>
            ) : (
              <motion.button whileTap={{ scale: 0.9 }} onClick={loadSummary} style={{
                background: C.n50, border: 'none', borderRadius: 8,
                padding: '6px 10px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4,
              }}>
                <IconRefresh size={14} color={C.primary} />
              </motion.button>
            )}
          </div>

          <div style={{ fontSize: 32, fontWeight: 800, color: C.n800, marginBottom: 16, fontFamily: "'Poppins'" }}>
            Rp {fmtCurrency(cashPosition.expected)}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <CashRow label="Modal Awal" value={cashPosition.opening} color={C.n600} />
            <CashRow label="Penjualan Tunai" value={cashPosition.sales} color={C.success} prefix="+" />
            <CashRow label="Pengeluaran" value={cashPosition.expenses} color={C.danger} prefix="-" />
            <div style={{ height: 1, background: C.n100, margin: '4px 0' }} />
            <CashRow label="Seharusnya Ada" value={cashPosition.expected} color={C.n800} bold />
          </div>
        </ClayCard>
      ) : (
        <ClayCard padding={24}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 40, marginBottom: 8 }}>💰</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: C.n700, fontFamily: "'Poppins'" }}>
              {isOpen ? 'Memuat data kas...' : 'Buka Shift Dulu'}
            </div>
            <div style={{ fontSize: 12, color: C.n500, marginTop: 4, fontFamily: "'Poppins'" }}>
              {isOpen ? 'Posisi kas akan muncul di sini' : 'Shift harus aktif untuk melihat posisi kas'}
            </div>
          </div>
        </ClayCard>
      )}

      {isOpen && shiftSummary?.paymentSummary?.length > 0 && (
        <PaymentBreakdownCard payments={shiftSummary.paymentSummary} title="Pembayaran per Metode" compact={false} />
      )}

      {isOpen && shiftSummary?.setorSummary?.hasPending && (
        <ClayCard padding={14}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <IconWarning size={24} color={C.warning} />
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: C.warning, fontFamily: "'Poppins'" }}>
                {shiftSummary.setorSummary.pendingCount} Setoran Pending
              </div>
              <div style={{ fontSize: 11, color: C.n600, fontFamily: "'Poppins'" }}>
                Total: Rp {fmtCurrency(shiftSummary.setorSummary.totalPending)}
              </div>
            </div>
          </div>
        </ClayCard>
      )}
    </div>
  );

  // ─── Tab: Sub-Session ────────────────────────────────────────────────────────
  const renderSubSessionTab = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {!session ? (
        <ClayCard padding={24}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 40, marginBottom: 8 }}>👥</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: C.n700, fontFamily: "'Poppins'" }}>
              Belum Ada Shift Utama
            </div>
            <div style={{ fontSize: 12, color: C.n500, marginTop: 4, fontFamily: "'Poppins'" }}>
              Buka shift utama terlebih dahulu
            </div>
          </div>
        </ClayCard>
      ) : (
        <>
          {/* Current User's Sub-Session */}
          {hasSubSession ? (
            <ClayCard padding={16} style={{ border: '2px solid ' + C.success + '30' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <IconPerson size={20} color={C.success} />
                  <span style={{ fontSize: 14, fontWeight: 600, color: C.n800, fontFamily: "'Poppins'" }}>Sub-Session Anda</span>
                </div>
                <Badge variant="success">Aktif</Badge>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
                <div style={{ background: C.n50, borderRadius: 8, padding: 10 }}>
                  <div style={{ fontSize: 10, color: C.n500, fontFamily: "'Poppins'" }}>Modal</div>
                  <div style={{ fontSize: 14, fontWeight: 600, fontFamily: "'Poppins'" }}>Rp {fmtCurrency(subSession.beginningCash)}</div>
                </div>
                <div style={{ background: C.n50, borderRadius: 8, padding: 10 }}>
                  <div style={{ fontSize: 10, color: C.n500, fontFamily: "'Poppins'" }}>Transaksi</div>
                  <div style={{ fontSize: 14, fontWeight: 600, fontFamily: "'Poppins'" }}>{subSession.transactionCount || 0} nota</div>
                </div>
              </div>
              <Btn variant="danger" size="sm" fullWidth onClick={() => setShowTutupSubSession(true)}>
                Tutup Sub-Session
              </Btn>
            </ClayCard>
          ) : (
            <ClayCard padding={16} style={{ border: '2px solid ' + C.warning + '30', background: C.warning + '08' }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: C.n800, fontFamily: "'Poppins'", marginBottom: 4 }}>
                  Belum Bergabung
                </div>
                <div style={{ fontSize: 12, color: C.n600, marginBottom: 12, fontFamily: "'Poppins'" }}>
                  Gabung shift untuk bisa bertransaksi
                </div>
                <Btn variant="warning" fullWidth onClick={() => setShowGabungShift(true)}>
                  Gabung Shift
                </Btn>
              </div>
            </ClayCard>
          )}

          {/* All Sub-Sessions */}
          {subSessions.length > 0 && (
            <>
              <div style={{ fontSize: 12, fontWeight: 600, color: C.n600, marginTop: 8, fontFamily: "'Poppins'" }}>
                Semua Sub-Session dalam Shift Ini
              </div>
              {subSessions.map((ss, i) => (
                <SubSessionCard key={ss.id} subSession={ss} index={i} />
              ))}
            </>
          )}
        </>
      )}
    </div>
  );

  // ─── Tab: Riwayat ───────────────────────────────────────────────────────────
  const renderRiwayatTab = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {recentTransactions.length > 0 ? (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: C.n600, fontFamily: "'Poppins'" }}>
              {recentTransactions.length} transaksi terakhir
            </span>
            <ActionButton label="Lihat Semua" onClick={() => componentNavigate('transaksi')} color={C.primary} size="sm" />
          </div>
          {recentTransactions.map((tx, i) => (
            <TransactionRow key={tx.id} transaction={tx} index={i} onClick={() => componentNavigate('transaksi_detail', { id: tx.id })} />
          ))}
        </>
      ) : (
        <ClayCard padding={32}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>📋</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: C.n700, fontFamily: "'Poppins'" }}>Belum Ada Transaksi</div>
            <div style={{ fontSize: 12, color: C.n500, marginTop: 4, fontFamily: "'Poppins'" }}>Transaksi akan muncul di sini</div>
          </div>
        </ClayCard>
      )}
    </div>
  );

  // ─── Action Buttons ─────────────────────────────────────────────────────────
  const renderActions = () => (
    <div style={{
      display: 'flex',
      gap: 10,
      padding: isMobile ? '12px 16px' : '16px',
      background: C.white,
      borderTop: '1px solid ' + C.n200,
      boxShadow: isMobile ? '0 -4px 12px rgba(0,0,0,0.08)' : 'none',
    }}>
      {!session ? (
        <motion.button
          whileTap={{ scale: 0.98 }}
          onClick={() => setShowBukaShift(true)}
          style={{
            flex: 1, height: 48, borderRadius: 14, border: 'none',
            background: 'linear-gradient(145deg, #16A34A, #15803D)',
            color: 'white', fontFamily: "'Poppins'", fontSize: 14, fontWeight: 600,
            cursor: 'pointer',
            boxShadow: '-4px -4px 10px rgba(255, 255, 255, 0.4), 5px 6px 14px rgba(21, 128, 61, 0.35)',
          }}
        >
          Buka Shift Sekarang
        </motion.button>
      ) : session.status === 'handover' ? (
        <div style={{ flex: 1, textAlign: 'center', padding: 12, background: C.warning + '15', borderRadius: 14 }}>
          <span style={{ fontSize: 12, color: C.warning, fontFamily: "'Poppins'" }}>Menunggu konfirmasi handover...</span>
        </div>
      ) : (
        <>
          {!hasSubSession && (
            <Btn variant="secondary" style={{ flex: 1 }} size="lg" onClick={() => setShowGabungShift(true)}>
              Gabung
            </Btn>
          )}
          <Btn variant="secondary" style={{ flex: 1 }} size="lg" onClick={() => setShowHandover(true)}>
            Oper
          </Btn>
          <Btn variant="danger" style={{ flex: 1 }} size="lg" onClick={() => setShowTutup(true)}>
            Tutup
          </Btn>
        </>
      )}
    </div>
  );

  // ─── Close Result Modal ─────────────────────────────────────────────────────
  const renderCloseResult = () => {
    if (!closeResult) return null;
    const isBalanced = closeResult.isBalanced || closeResult.difference === 0;
    return (
      <Modal visible={true} onClose={() => setCloseResult(null)} title="Hasil Tutup Shift">
        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <div style={{ fontSize: 48, marginBottom: 8 }}>{isBalanced ? '✅' : '⚠️'}</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: C.n800, fontFamily: "'Poppins'" }}>
            {isBalanced ? 'Kas Rapi!' : 'Ada Selisih Kas'}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
          <ResultBox label="Transaksi" value={closeResult.paymentSummary?.reduce((s, p) => s + p.count, 0) || 0} />
          <ResultBox label="Total Bayar" value={closeResult.paymentSummary?.reduce((s, p) => s + p.amount, 0) || 0} isCurrency />
          <ResultBox label="Kas Fisik" value={closeResult.closingCash} isCurrency />
          <ResultBox label="Seharusnya" value={closeResult.systemCash} isCurrency />
          <ResultBox label="Selisih" value={closeResult.difference} isCurrency color={isBalanced ? C.success : C.danger} />
        </div>

        {closeResult.pendingSetorWarning && (
          <div style={{ background: C.warning + '15', padding: 12, borderRadius: 10, marginBottom: 16 }}>
            <div style={{ fontSize: 12, color: C.warning, fontFamily: "'Poppins'" }}>{closeResult.pendingSetorWarning.message}</div>
          </div>
        )}

        <Btn variant="primary" fullWidth onClick={() => setCloseResult(null)}>Tutup</Btn>
      </Modal>
    );
  };

  // ─── Buka Shift Modal ────────────────────────────────────────────────────────
  const renderBukaShiftModal = () => (
    <Modal visible={showBukaShift} onClose={() => setShowBukaShift(false)} title="Buka Shift Baru">
      <div style={{ background: C.primaryTint, padding: 12, borderRadius: 10, marginBottom: 16, textAlign: 'center' }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: C.primary, fontFamily: "'Poppins'" }}>{fmtDate()}</div>
      </div>

      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: C.n700, marginBottom: 10, fontFamily: "'Poppins'" }}>Pilih Jenis Shift</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {SHIFT_OPTIONS.map(opt => (
            <motion.button key={opt.value} whileTap={{ scale: 0.95 }} onClick={() => setShiftType(opt.value)} style={{
              padding: '14px 12px', borderRadius: 12,
              border: `2px solid ${shiftType === opt.value ? C.primary : C.n200}`,
              background: shiftType === opt.value ? C.primaryTint : C.white,
              cursor: 'pointer', textAlign: 'center',
            }}>
              <div style={{ fontSize: 24, marginBottom: 4 }}>{opt.icon}</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: shiftType === opt.value ? C.primary : C.n700, marginBottom: 2, fontFamily: "'Poppins'" }}>{opt.label}</div>
              <div style={{ fontSize: 10, color: C.n500, fontFamily: "'Poppins'" }}>{opt.jam}</div>
            </motion.button>
          ))}
        </div>
      </div>

      <MoneyInput label="Modal Awal Kas Laci" value={openingCash} onChange={setOpeningCash} placeholder="0" />

      <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
        <Btn variant="secondary" style={{ flex: 1 }} onClick={() => setShowBukaShift(false)}>Batal</Btn>
        <Btn variant="success" style={{ flex: 1 }} loading={loading} onClick={handleBukaShift}>Buka Shift</Btn>
      </div>
    </Modal>
  );

  // ─── Gabung Shift Modal ─────────────────────────────────────────────────────
  const renderGabungShiftModal = () => (
    <Modal visible={showGabungShift} onClose={() => setShowGabungShift(false)} title="Gabung Shift">
      <div style={{ background: C.success + '15', padding: 12, borderRadius: 10, marginBottom: 16 }}>
        <div style={{ fontSize: 12, color: C.success, fontWeight: 600, fontFamily: "'Poppins'" }}>
          Bergabung dengan shift yang sudah ada
        </div>
        <div style={{ fontSize: 11, color: C.n600, marginTop: 4, fontFamily: "'Poppins'" }}>
          Shift {shiftOpt.label} • {session?.openedAt ? fmtTime(session.openedAt) : '-'}
        </div>
      </div>

      <MoneyInput label="Modal Awal Sub-Session" value={openingCash} onChange={setOpeningCash} placeholder="0" />

      <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
        <Btn variant="secondary" style={{ flex: 1 }} onClick={() => setShowGabungShift(false)}>Batal</Btn>
        <Btn variant="success" style={{ flex: 1 }} loading={loading} onClick={handleGabungShift}>Gabung Shift</Btn>
      </div>
    </Modal>
  );

  // ─── Tutup Shift Modal ─────────────────────────────────────────────────────
  const renderTutupModal = () => (
    <Modal visible={showTutup} onClose={() => setShowTutup(false)} title="Tutup Shift">
      <div style={{ background: C.n50, padding: 12, borderRadius: 10, marginBottom: 16 }}>
        <div style={{ fontSize: 12, color: C.n600, marginBottom: 4, fontFamily: "'Poppins'" }}>Seharusnya Ada</div>
        <div style={{ fontSize: 20, fontWeight: 700, color: C.n800, fontFamily: "'Poppins'" }}>Rp {fmtCurrency(cashPosition.expected)}</div>
      </div>

      <MoneyInput label="Total Uang Fisik di Laci" value={closingCash} onChange={setClosingCash} placeholder="0" />

      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: C.n700, marginBottom: 6, fontFamily: "'Poppins'" }}>Catatan (opsional)</div>
        <textarea value={closeNotes} onChange={e => setCloseNotes(e.target.value)} rows={2} placeholder="Contoh: selisih karena kembalian kurang" style={{
          width: '100%', padding: 12, borderRadius: 10, border: '1.5px solid ' + C.n200,
          fontFamily: 'Poppins', fontSize: 13, resize: 'none', boxSizing: 'border-box',
        }} />
      </div>

      <div style={{ display: 'flex', gap: 10 }}>
        <Btn variant="secondary" style={{ flex: 1 }} onClick={() => setShowTutup(false)}>Batal</Btn>
        <Btn variant="danger" style={{ flex: 1 }} loading={loading} onClick={handleTutupShift}>Konfirmasi Tutup</Btn>
      </div>
    </Modal>
  );

  // ─── Tutup Sub-Session Modal ────────────────────────────────────────────────
  const renderTutupSubSessionModal = () => (
    <Modal visible={showTutupSubSession} onClose={() => setShowTutupSubSession(false)} title="Tutup Sub-Session">
      <div style={{ background: C.n50, padding: 12, borderRadius: 10, marginBottom: 16 }}>
        <div style={{ fontSize: 12, color: C.n600, marginBottom: 4, fontFamily: "'Poppins'" }}>Kas Anda</div>
        <div style={{ fontSize: 20, fontWeight: 700, color: C.n800, fontFamily: "'Poppins'" }}>Rp {fmtCurrency(subSessionCash || subSession?.beginningCash)}</div>
      </div>

      <MoneyInput label="Total Uang Fisik" value={subSessionCash} onChange={setSubSessionCash} placeholder="0" />

      <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
        <Btn variant="secondary" style={{ flex: 1 }} onClick={() => setShowTutupSubSession(false)}>Batal</Btn>
        <Btn variant="danger" style={{ flex: 1 }} loading={loading} onClick={handleTutupSubSession}>Konfirmasi</Btn>
      </div>
    </Modal>
  );

  // ─── Handover Modal ─────────────────────────────────────────────────────────
  const renderHandoverModal = () => (
    <Modal visible={showHandover} onClose={() => setShowHandover(false)} title="Oper Shift">
      <div style={{ background: C.warning + '15', padding: 12, borderRadius: 10, marginBottom: 16 }}>
        <div style={{ fontSize: 12, color: C.warning, fontWeight: 600, fontFamily: "'Poppins'" }}>
          Serahkan kas ke penanggung jawab berikutnya
        </div>
      </div>

      <div style={{ background: C.n50, padding: 12, borderRadius: 10, marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
          <div>
            <div style={{ fontSize: 11, color: C.n600, fontFamily: "'Poppins'" }}>Seharusnya Ada</div>
            <div style={{ fontSize: 16, fontWeight: 700, fontFamily: "'Poppins'" }}>Rp {fmtCurrency(cashPosition.expected)}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 11, color: C.n600, fontFamily: "'Poppins'" }}>Revenue Shift Ini</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: C.success, fontFamily: "'Poppins'" }}>+Rp {fmtCurrency(cashPosition.revenue || 0)}</div>
          </div>
        </div>
      </div>

      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: C.n700, marginBottom: 6, fontFamily: "'Poppins'" }}>Saldo Terakhir *</div>
        <MoneyInput value={handoverSaldo} onChange={setHandoverSaldo} placeholder="0" />
      </div>

      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: C.n700, marginBottom: 6, fontFamily: "'Poppins'" }}>Kas Modal *</div>
        <MoneyInput value={handoverKasModal} onChange={setHandoverKasModal} placeholder="0" />
      </div>

      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: C.n700, marginBottom: 6, fontFamily: "'Poppins'" }}>Total Revenue *</div>
        <MoneyInput value={handoverRevenue} onChange={setHandoverRevenue} placeholder="0" />
      </div>

      <div style={{ background: C.success + '15', padding: 12, borderRadius: 10, marginBottom: 16, border: '1px solid ' + C.success + '30' }}>
        <div style={{ fontSize: 11, color: C.success, fontFamily: "'Poppins'" }}>Total yang Dioper (Otomatis)</div>
        <div style={{ fontSize: 20, fontWeight: 700, color: C.success, fontFamily: "'Poppins'" }}>
          Rp {fmtCurrency(
            parseInt(String(handoverSaldo).replace(/\D/g, '') || 0) +
            parseInt(String(handoverKasModal).replace(/\D/g, '') || 0) +
            parseInt(String(handoverRevenue).replace(/\D/g, '') || 0)
          )}
        </div>
      </div>

      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: C.n700, marginBottom: 6, fontFamily: "'Poppins'" }}>Catatan (Opsional)</div>
        <textarea value={handoverNotes} onChange={e => setHandoverNotes(e.target.value)} rows={2} placeholder="Contoh: ada PR yang belum di-approve" style={{
          width: '100%', padding: 12, borderRadius: 10, border: '1.5px solid ' + C.n200,
          fontFamily: 'Poppins', fontSize: 13, resize: 'none', boxSizing: 'border-box',
        }} />
      </div>

      <div style={{ display: 'flex', gap: 10 }}>
        <Btn variant="secondary" style={{ flex: 1 }} onClick={() => setShowHandover(false)}>Batal</Btn>
        <Btn variant="primary" style={{ flex: 1 }} loading={loading} onClick={handleHandover}>Oper Shift</Btn>
      </div>
    </Modal>
  );

  // ─── Main Render ────────────────────────────────────────────────────────────
  return (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column',
      background: 'var(--glass-bg, #F3EEF7)',
    }}>
      <TopBar title="Shift Kasir" subtitle="Kelola shift & kas" onBack={componentGoBack} />

      <div style={{
        flex: 1, overflowY: 'auto',
        padding: isMobile ? 12 : 16,
        paddingBottom: isMobile ? 100 : 16,
      }}>
        {loading && !shiftStatus ? (
          <div style={{ textAlign: 'center', padding: 40 }}>
            <div style={{ fontSize: 14, color: C.n500, fontFamily: "'Poppins'" }}>Memuat...</div>
          </div>
        ) : (
          <>
            {renderHeader()}
            {renderTabs()}
            {renderTabContent()}
          </>
        )}
      </div>

      {renderActions()}

      <AnimatePresence>
        {showBukaShift && renderBukaShiftModal()}
        {showGabungShift && renderGabungShiftModal()}
        {showTutup && renderTutupModal()}
        {showTutupSubSession && renderTutupSubSessionModal()}
        {showHandover && renderHandoverModal()}
        {closeResult && renderCloseResult()}
      </AnimatePresence>
    </div>
  );
}

// ─── Helper Components ────────────────────────────────────────────────────────

function StatBox({ label, value, suffix, color, isCurrency }) {
  return (
    <div style={{
      background: color + '12',
      borderRadius: 14,
      padding: '12px 10px',
      textAlign: 'center',
      boxShadow: '4px 4px 10px rgba(110, 46, 120, 0.08), -2px -2px 6px rgba(255, 255, 255, 0.95)',
    }}>
      <div style={{ fontSize: 10, color: C.n500, marginBottom: 4, fontFamily: "'Poppins'" }}>{label}</div>
      <div style={{ fontSize: 15, fontWeight: 800, color: color, fontFamily: "'Poppins'" }}>
        {isCurrency ? 'Rp ' + fmtCurrency(value) : value}
        {suffix && <span style={{ fontSize: 10, fontWeight: 500 }}> {suffix}</span>}
      </div>
    </div>
  );
}

function CashRow({ label, value, color, prefix = '', bold }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <span style={{ fontSize: 12, color, fontFamily: "'Poppins'" }}>{label}</span>
      <span style={{ fontSize: bold ? 14 : 13, fontWeight: bold ? 700 : 500, color, fontFamily: "'Poppins'" }}>
        {prefix}{value ? 'Rp ' + fmtCurrency(value) : '-'}
      </span>
    </div>
  );
}

function ActionButton({ icon, label, onClick, color, size = 'md' }) {
  return (
    <motion.button whileTap={{ scale: 0.98 }} onClick={onClick} style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: size === 'sm' ? '6px 0' : '10px 12px',
      background: 'transparent', border: 'none', borderRadius: 10,
      cursor: 'pointer', width: '100%', textAlign: 'left',
    }}>
      <div style={{
        width: 32, height: 32, borderRadius: 10,
        background: color + '12',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: '2px 2px 6px rgba(110, 46, 120, 0.08)',
      }}>
        {icon}
      </div>
      <span style={{ flex: 1, fontSize: size === 'sm' ? 11 : 13, fontWeight: 600, color, fontFamily: "'Poppins'" }}>{label}</span>
      <IconChevronRight size={16} color={C.n400} />
    </motion.button>
  );
}

function SubSessionCard({ subSession, index }) {
  const statusColors = {
    open: { bg: C.success + '15', color: C.success, text: 'Aktif' },
    closed: { bg: C.n100, color: C.n500, text: 'Tutup' },
    handed_over: { bg: C.warning + '15', color: C.warning, text: 'Dioper' },
  };
  const sc = statusColors[subSession.status] || statusColors.closed;

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.05 }}
      style={{
        background: `linear-gradient(145deg, ${C.white}, ${C.primaryTint})`,
        borderRadius: 16,
        padding: 14,
        boxShadow: '8px 8px 20px rgba(110, 46, 120, 0.08), -4px -4px 10px rgba(255, 255, 255, 0.95)',
        border: '1px solid rgba(139, 92, 246, 0.06)',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <IconPerson size={16} color={C.n500} />
          <span style={{ fontSize: 13, fontWeight: 600, fontFamily: "'Poppins'" }}>{subSession.cashierName || 'Kasir'}</span>
        </div>
        <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 999, background: sc.bg, color: sc.color, fontFamily: "'Poppins'" }}>
          {sc.text}
        </span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
        <div>
          <div style={{ fontSize: 9, color: C.n500, fontFamily: "'Poppins'" }}>Modal</div>
          <div style={{ fontSize: 11, fontWeight: 500, fontFamily: "'Poppins'" }}>Rp {fmtCurrency(subSession.beginningCash)}</div>
        </div>
        <div>
          <div style={{ fontSize: 9, color: C.n500, fontFamily: "'Poppins'" }}>Transaksi</div>
          <div style={{ fontSize: 11, fontWeight: 500, fontFamily: "'Poppins'" }}>{subSession.transactionCount || 0}</div>
        </div>
        <div>
          <div style={{ fontSize: 9, color: C.n500, fontFamily: "'Poppins'" }}>Selisih</div>
          <div style={{ fontSize: 11, fontWeight: 500, color: subSession.variance !== 0 ? C.danger : C.success, fontFamily: "'Poppins'" }}>
            {subSession.variance !== null ? 'Rp ' + fmtCurrency(subSession.variance) : '-'}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function TransactionRow({ transaction, index, onClick }) {
  const methodIcons = { cash: '💵', qris: '📱', transfer: '🏦', deposit: '👤' };

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.05 }}
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 12, padding: 12,
        background: `linear-gradient(145deg, ${C.white}, ${C.primaryTint})`,
        borderRadius: 14,
        boxShadow: '6px 6px 16px rgba(110, 46, 120, 0.08), -3px -3px 8px rgba(255, 255, 255, 0.95)',
        border: '1px solid rgba(139, 92, 246, 0.06)',
        cursor: 'pointer',
      }}
    >
      <div style={{ fontSize: 24 }}>{methodIcons[transaction.primary_payment_method] || '💳'}</div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: C.n800, fontFamily: "'Poppins'" }}>{transaction.transaction_no}</div>
        <div style={{ fontSize: 11, color: C.n500, fontFamily: "'Poppins'" }}>{transaction.customer_name || 'Customer'}</div>
      </div>
      <div style={{ textAlign: 'right' }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: C.n800, fontFamily: "'Poppins'" }}>Rp {fmtCurrency(transaction.total)}</div>
        <div style={{ fontSize: 10, color: C.n400, fontFamily: "'Poppins'" }}>
          {new Date(transaction.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', hour12: false })}
        </div>
      </div>
      <IconChevronRight size={16} color={C.n400} />
    </motion.div>
  );
}

function ResultBox({ label, value, isCurrency, color }) {
  return (
    <div style={{
      background: C.n50,
      borderRadius: 10,
      padding: '10px 12px',
      boxShadow: 'inset 2px 2px 4px rgba(110, 46, 120, 0.04)',
    }}>
      <div style={{ fontSize: 10, color: C.n500, marginBottom: 2, fontFamily: "'Poppins'" }}>{label}</div>
      <div style={{ fontSize: 14, fontWeight: 700, color: color || C.n800, fontFamily: "'Poppins'" }}>
        {isCurrency ? 'Rp ' + fmtCurrency(value) : value}
      </div>
    </div>
  );
}
