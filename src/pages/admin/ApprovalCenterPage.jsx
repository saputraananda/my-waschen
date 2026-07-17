// ─────────────────────────────────────────────────────────────────────────────
// Admin: Approval Center (Unified)
// Semua tipe approval dalam satu view: Umum · Pengadaan · Kas Outlet
// ─────────────────────────────────────────────────────────────────────────────
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { motion } from 'framer-motion';
import axios from 'axios';
import { C, SHADOW } from '../../utils/theme';
import { rp, inPeriod } from '../../utils/helpers';
import { useIsMobile, useResponsive, useWindowSize } from '../../utils/hooks';
import { TopBar, Avatar, Btn, SearchBar, Chip, useAppRefresh, EmptyState, FilterIconButton, FilterModal, FilterSection, FilterChipGroup } from '../../components/ui';
import { alertError, alertSuccess } from '../../utils/alert';
import { resolveCashApproval } from '../../utils/outletCashApi';
import { FloatingBubble, Sparkle, GlowOrb } from '../../components/ui/PremiumAnimations';
import bubbleIcon from '../../assets/Decorative icon/bubble-1.webp';
import bubble2Icon from '../../assets/Decorative icon/bubble-2.webp';

// ─── Mini Sparkline ─────────────────────────────────────────────────────────
function MiniSparkline({ data = [], color = '#10B981', width = 50, height = 28 }) {
  if (!data || data.length < 2) {
    return <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <path d={`M0 ${height/2} L${width} ${height/2}`} stroke={color} strokeWidth="2" fill="none" />
    </svg>;
  }
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const points = data.map((d, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((d - min) / range) * (height - 4) - 2;
    return `${x},${y}`;
  }).join(' ');
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <polygon points={`0,${height} ${points} ${width},${height}`} fill={`${color}20`} />
      <polyline points={points} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" />
      <circle cx={width} cy={points.split(' ').pop().split(',')[1]} r="2.5" fill={color} />
    </svg>
  );
}

// ─── Premium Stat Card ───────────────────────────────────────────────────────
function PremiumStatCard({ icon, label, value, color = '#5B005F', sparkline = [] }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -2 }}
      style={{
        background: 'linear-gradient(145deg, #FFFFFF, #F8F7FC)',
        borderRadius: 12,
        padding: '10px 12px',
        boxShadow: '4px 4px 10px rgba(91, 0, 95, 0.06), -2px -2px 6px rgba(255, 255, 255, 0.95)',
        border: '1px solid rgba(91, 0, 95, 0.04)',
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontFamily: 'Poppins', fontSize: 9, fontWeight: 600, color }}>{label}</span>
        <MiniSparkline data={sparkline} color={color} width={40} height={24} />
      </div>
      <div style={{ fontFamily: 'Poppins', fontSize: 16, fontWeight: 800, color: '#1E293B' }}>{value}</div>
    </motion.div>
  );
}

// ─── Type configs ────────────────────────────────────────────────────────────
const TYPE_META = {
  all: {
    label: 'Semua',
    icon: '📊',
    color: C.primary,
    bgLight: C.primary + '15',
    borderColor: C.primary + '30',
  },
  general: {
    label: 'Umum',
    icon: '📋',
    color: C.primary,
    bgLight: C.primary + '15',
    borderColor: C.primary + '30',
    fields: ['description', 'amount'],
  },
  purchase: {
    label: 'Pengadaan',
    icon: '📦',
    color: C.info,
    bgLight: C.infoBg,
    borderColor: C.info + '30',
    fields: ['itemName', 'qty', 'unit', 'urgency', 'reason', 'estimatedPrice'],
  },
  cash_expense: {
    label: 'Kas Outlet',
    icon: '💰',
    color: C.success,
    bgLight: C.successBg,
    borderColor: C.success + '30',
    fields: ['category', 'description', 'amount', 'receiptPhoto'],
  },
};

const URGENCY_META = {
  low:    { label: 'Rendah', color: C.success, bg: C.successBg },
  normal: { label: 'Normal', color: C.warning, bg: C.warningBg },
  high:   { label: 'Tinggi', color: C.danger, bg: C.dangerBg },
  urgent: { label: 'Urgent',  color: C.primary, bg: C.primaryTint },
};

const STATUS_META = {
  pending:  { label: 'Pending',    bg: C.warningBg, color: C.warningDark, border: C.warning },
  approved:  { label: 'Disetujui',  bg: C.successBg, color: C.successDark, border: C.success },
  rejected:  { label: 'Ditolak',   bg: C.dangerBg, color: C.dangerDark, border: C.danger },
  fulfilled:{ label: 'Tersimpan', bg: C.primaryTint, color: C.primary, border: C.primary },
};

// ─── Compact approval card (collapsed) ────────────────────────────────────────
function ApprovalCardCompact({ item, typeMeta, onApprove, onReject, actionLoading, expanded, onToggle }) {
  const isPending = item.status === 'pending';
  const statusMeta = STATUS_META[item.status] || STATUS_META.pending;
  const urgency = item.urgency ? URGENCY_META[item.urgency] : null;

  return (
    <motion.div
      onClick={onToggle}
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.99 }}
      style={{
        background: 'linear-gradient(145deg, #FFFFFF, #F8F7FC)',
        borderRadius: 14,
        borderLeft: `4px solid ${expanded ? typeMeta.color : typeMeta.borderColor}`,
        boxShadow: '6px 6px 14px rgba(91, 0, 95, 0.08), -3px -3px 10px rgba(255, 255, 255, 0.95)',
        border: '1px solid rgba(91, 0, 95, 0.04)',
        marginBottom: 10,
        overflow: 'hidden',
        cursor: 'pointer',
      }}
    >
      {/* Header row */}
      <div style={{ padding: '12px 14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {/* Type icon + avatar */}
          <div style={{
            width: 40, height: 40, borderRadius: 12,
            background: typeMeta.bgLight,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 18, flexShrink: 0,
            boxShadow: `0 2px 8px ${typeMeta.borderColor}40`,
          }}>
            {typeMeta.icon}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <span style={{ fontFamily: 'Poppins', fontSize: 13, fontWeight: 700, color: C.n900 }}>
                {item.requesterName || item.requester || item.submittedBy || '—'}
              </span>
              {urgency && (
                <span style={{
                  fontFamily: 'Poppins', fontSize: 9, fontWeight: 700,
                  background: urgency.bg, color: urgency.color,
                  padding: '1px 7px', borderRadius: 999,
                }}>
                  {urgency.label}
                </span>
              )}
            </div>
            <div style={{ fontFamily: 'Poppins', fontSize: 11, color: C.n500, marginTop: 1 }}>
              {item.outletName || item.outlet || ''} · {item.submittedAt || item.date || ''}
            </div>
          </div>
          {/* Status pill */}
          <span style={{
            fontFamily: 'Poppins', fontSize: 10, fontWeight: 700,
            background: statusMeta.bg, color: statusMeta.color,
            padding: '3px 10px', borderRadius: 999, flexShrink: 0,
          }}>
            {statusMeta.label}
          </span>
          {/* Expand indicator */}
          <svg
            width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={C.n400}
            strokeWidth="2" strokeLinecap="round"
            style={{ transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', flexShrink: 0 }}
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </div>

        {/* Description / item name (always visible) */}
        <div style={{ marginTop: 8, fontFamily: 'Poppins', fontSize: 12, color: C.n800, lineHeight: 1.5 }}>
          {item.itemName || item.description || item.category || '—'}
        </div>

        {/* Amount */}
        {(item.amount || item.totalAmount || item.estimatedPrice) && (
          <div style={{
            marginTop: 6, fontFamily: 'Poppins', fontSize: 16, fontWeight: 800,
            color: typeMeta.color,
          }}>
            {rp(item.amount || item.totalAmount || item.estimatedPrice)}
          </div>
        )}
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div style={{ borderTop: `1px solid ${C.n100}`, padding: '12px 14px', background: C.n50 }}>
          {/* Full description */}
          {item.description && (
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontFamily: 'Poppins', fontSize: 10, fontWeight: 700, color: C.n500, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 3 }}>Keterangan</div>
              <div style={{ fontFamily: 'Poppins', fontSize: 12, color: C.n800, lineHeight: 1.5 }}>{item.description}</div>
            </div>
          )}

          {/* Purchase request extra fields */}
          {item.qty && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
              {[
                { label: 'Jumlah', value: `${item.qty} ${item.unit || ''}` },
                { label: 'Estimasi Harga', value: item.estimatedPrice ? rp(item.estimatedPrice) : '—' },
                { label: 'Alasan', value: item.reason || '—' },
                { label: 'Diajukan', value: item.submittedAt || item.date || '—' },
              ].map(f => (
                <div key={f.label}>
                  <div style={{ fontFamily: 'Poppins', fontSize: 10, fontWeight: 700, color: C.n500, textTransform: 'uppercase', letterSpacing: 0.5 }}>{f.label}</div>
                  <div style={{ fontFamily: 'Poppins', fontSize: 12, color: C.n800, marginTop: 2 }}>{f.value}</div>
                </div>
              ))}
            </div>
          )}

          {/* Receipt photo for cash expense */}
          {item.receiptPhoto && (
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontFamily: 'Poppins', fontSize: 10, fontWeight: 700, color: C.n500, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>Bukti / Struk</div>
              <a href={item.receiptPhoto} target="_blank" rel="noopener noreferrer"
                style={{ display: 'inline-block' }}>
                <img
                  src={item.receiptPhoto}
                  alt="bukti"
                  style={{ width: 80, height: 80, objectFit: 'cover', borderRadius: 10, border: `2px solid ${C.n200}` }}
                  onError={e => { e.target.style.display = 'none'; }}
                />
              </a>
            </div>
          )}

          {/* Admin note (for rejected) */}
          {item.adminNote && (
            <div style={{ background: C.dangerBg, borderRadius: 8, padding: '8px 12px', marginBottom: 10 }}>
              <div style={{ fontFamily: 'Poppins', fontSize: 10, fontWeight: 700, color: C.dangerDark, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 3 }}>Alasan Penolakan</div>
              <div style={{ fontFamily: 'Poppins', fontSize: 12, color: C.dangerDark }}>{item.adminNote}</div>
            </div>
          )}

          {/* Fulfilled amount for purchase requests */}
          {item.fulfilledAmount != null ? (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: C.primaryTint, borderRadius: 8, padding: '8px 12px', marginBottom: 10 }}>
              <span style={{ fontFamily: 'Poppins', fontSize: 11, color: C.primary }}>Realisasi</span>
              <span style={{ fontFamily: 'Poppins', fontSize: 13, fontWeight: 700, color: C.primary }}>{rp(item.fulfilledAmount)}</span>
            </div>
          ) : null}

          {/* Action buttons (pending only) */}
          {isPending && (
            <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
              <Btn
                variant="danger"
                onClick={(e) => { e.stopPropagation(); onReject(item); }}
                loading={actionLoading === item.id + '_reject'}
                style={{ flex: 1 }}
                size="sm"
              >
                ❌ Tolak
              </Btn>
              <Btn
                variant="success"
                onClick={(e) => { e.stopPropagation(); onApprove(item); }}
                loading={actionLoading === item.id + '_approve'}
                style={{ flex: 1 }}
                size="sm"
              >
                ✅ Setujui
              </Btn>
            </div>
          )}
        </div>
      )}
    </motion.div>
  );
}

// ─── Reject modal ────────────────────────────────────────────────────────────
function RejectModal({ visible, item, typeMeta, onConfirm, onClose, loading }) {
  const [reason, setReason] = useState('');
  if (!visible || !item) return null;
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9500,
      background: 'rgba(15,23,42,0.55)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 20,
    }}
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: C.white, borderRadius: 20, padding: '28px 24px',
          width: '100%', maxWidth: 380,
          boxShadow: SHADOW.xl,
          animation: 'scaleIn 0.2s ease-out',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: C.dangerBg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>❌</div>
          <div>
            <div style={{ fontFamily: 'Poppins', fontSize: 16, fontWeight: 800, color: C.n900 }}>Tolak {typeMeta.label}</div>
            <div style={{ fontFamily: 'Poppins', fontSize: 12, color: C.n500, marginTop: 2 }}>
              {item.itemName || item.description || item.category || 'Item ini'}
            </div>
          </div>
        </div>
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontFamily: 'Poppins', fontSize: 12, fontWeight: 600, color: C.n700, marginBottom: 8 }}>Alasan penolakan (wajib)</div>
          <textarea
            value={reason}
            onChange={e => setReason(e.target.value)}
            placeholder="Jelaskan alasan penolakan..."
            rows={3}
            style={{
              width: '100%', borderRadius: 12, padding: '12px 14px',
              border: `1.5px solid ${reason ? C.danger : C.n300}`,
              fontFamily: 'Poppins', fontSize: 13, color: C.n900,
              background: C.white, outline: 'none', resize: 'none',
              boxSizing: 'border-box', lineHeight: 1.5,
            }}
          />
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <Btn variant="secondary" onClick={onClose} style={{ flex: 1 }}>Batal</Btn>
          <Btn
            variant="danger"
            onClick={() => onConfirm(item.id, reason)}
            loading={loading}
            disabled={!reason.trim()}
            style={{ flex: 1 }}
          >
            Konfirmasi Tolak
          </Btn>
        </div>
      </div>
      <style>{`@keyframes scaleIn { from { opacity: 0; transform: scale(0.92); } to { opacity: 1; transform: scale(1); } }`}</style>
    </div>
  );
}

// ─── Main ApprovalCenter Page ─────────────────────────────────────────────────
export default function ApprovalCenterPage({ goBack }) {
  // ── State ──────────────────────────────────────────────────────────────
  const isMobile = useIsMobile();
  const [activeTab, setActiveTab]       = useState('all');    // 'all' | 'general' | 'purchase' | 'cash_expense'
  const [statusFilter, setStatusFilter] = useState('pending');
  const [periodFilter, setPeriodFilter]  = useState('all');
  const [query, setQuery]              = useState('');
  const [expandedId, setExpandedId]      = useState(null);
  const [actionLoading, setActionLoading] = useState(null);
  const [showFilter, setShowFilter] = useState(false);

  // ── Unified data fetch ──────────────────────────────────────────────────
  const [generalApprovals, setGeneralApprovals]     = useState([]);
  const [purchaseApprovals, setPurchaseApprovals]   = useState([]);
  const [cashApprovals, setCashApprovals]           = useState([]);
  const [generalLoading, setGeneralLoading]         = useState(true);
  const [purchaseLoading, setPurchaseLoading]       = useState(true);
  const [cashLoading, setCashLoading]             = useState(true);

  const fetchGeneral = useCallback(async () => {
    setGeneralLoading(true);
    try {
      const params = { status: statusFilter, limit: 100 };
      const r = await axios.get('/api/approvals', { params });
      setGeneralApprovals(r?.data?.data || []);
    } catch (err) { console.error('[fetchGeneral] Error:', err); } finally { setGeneralLoading(false); }
  }, [statusFilter]);

  const fetchPurchase = useCallback(async () => {
    setPurchaseLoading(true);
    try {
      const statusMap = { pending: 'pending', approved: 'approved', rejected: 'rejected' };
      const params = { status: statusMap[statusFilter] || statusFilter, limit: 100 };
      const r = await axios.get('/api/purchase-requests', { params });
      setPurchaseApprovals(r?.data?.data || []);
    } catch (err) { console.error('[fetchPurchase] Error:', err); } finally { setPurchaseLoading(false); }
  }, [statusFilter]);

  const fetchCash = useCallback(async () => {
    setCashLoading(true);
    try {
      const statusMap = { pending: 'pending', approved: 'approved', rejected: 'rejected' };
      const params = { status: statusMap[statusFilter] || statusFilter, limit: 100 };
      const r = await axios.get('/api/outlet-cash/approvals', { params });
      setCashApprovals(r?.data?.data || []);
    } catch (err) { console.error('[fetchCash] Error:', err); } finally { setCashLoading(false); }
  }, [statusFilter]);

  useEffect(() => { fetchGeneral(); }, [fetchGeneral]);
  useEffect(() => { fetchPurchase(); }, [fetchPurchase]);
  useEffect(() => { fetchCash(); }, [fetchCash]);
  useAppRefresh(() => { fetchGeneral(); fetchPurchase(); fetchCash(); });

  // ── Compute counts ────────────────────────────────────────────────────
  const pendingGeneral  = generalApprovals.filter(a => a.status === 'pending').length;
  const pendingPurchase = purchaseApprovals.filter(a => a.status === 'pending').length;
  const pendingCash    = cashApprovals.filter(a => a.status === 'pending').length;
  const totalPending   = pendingGeneral + pendingPurchase + pendingCash;

  // ── Unified feed ─────────────────────────────────────────────────────
  const feed = useMemo(() => {
    const q = query.trim().toLowerCase();
    const periodOk = (date) => inPeriod(date, periodFilter);

    const buildItem = (src, type) => ({
      ...src,
      _type: type,
      submittedAt: src.date || src.submittedAt || src.createdAt,
    });

    let items = [];
    if (activeTab === 'all' || activeTab === 'general') {
      items.push(...generalApprovals
        .filter(a => !statusFilter || statusFilter === 'all' || statusFilter === 'pending' || a.status === statusFilter)
        .filter(a => periodOk(a.date))
        .filter(a => !q || (a.requesterName || a.requester || '').toLowerCase().includes(q)
          || (a.description || '').toLowerCase().includes(q)
          || (a.type || '').toLowerCase().includes(q))
        .map(a => buildItem(a, 'general')));
    }
    if (activeTab === 'all' || activeTab === 'purchase') {
      items.push(...purchaseApprovals
        .filter(a => !statusFilter || statusFilter === 'all' || statusFilter === 'pending' || a.status === statusFilter)
        .filter(a => periodOk(a.date || a.createdAt))
        .filter(a => !q || (a.itemName || '').toLowerCase().includes(q)
          || (a.requesterName || a.submittedBy || '').toLowerCase().includes(q)
          || (a.reason || '').toLowerCase().includes(q))
        .map(a => buildItem(a, 'purchase')));
    }
    if (activeTab === 'all' || activeTab === 'cash_expense') {
      items.push(...cashApprovals
        .filter(a => !statusFilter || statusFilter === 'all' || statusFilter === 'pending' || a.status === statusFilter)
        .filter(a => periodOk(a.date || a.submittedAt))
        .filter(a => !q || (a.description || a.category || '').toLowerCase().includes(q)
          || (a.requesterName || a.submittedBy || '').toLowerCase().includes(q))
        .map(a => buildItem(a, 'cash_expense')));
    }

    // Sort: pending first, then by date desc
    items.sort((a, b) => {
      if (a.status === 'pending' && b.status !== 'pending') return -1;
      if (a.status !== 'pending' && b.status === 'pending') return 1;
      return new Date(b.submittedAt || 0) - new Date(a.submittedAt || 0);
    });

    return items;
  }, [generalApprovals, purchaseApprovals, cashApprovals, activeTab, statusFilter, periodFilter, query]);

  const isLoading = generalLoading || purchaseLoading || cashLoading;

  // ── Actions ──────────────────────────────────────────────────────────
  const handleApprove = async (item) => {
    const key = item.id + '_approve';
    setActionLoading(key);
    try {
      if (item._type === 'general') {
        await axios.put(`/api/approvals/${item.id}`, { status: 'approved' });
      } else if (item._type === 'purchase') {
        await axios.patch(`/api/purchase-requests/${item.id}`, { action: 'approve' });
      } else if (item._type === 'cash_expense') {
        await resolveCashApproval(item.id, 'approve');
      }
      alertSuccess('Berhasil disetujui');
      fetchGeneral(); fetchPurchase(); fetchCash();
    } catch (err) {
      alertError(err?.response?.data?.message || 'Gagal menyetujui.');
    } finally {
      setActionLoading(null);
    }
  };

  const [rejectTarget, setRejectTarget] = useState(null);
  const [rejectLoading, setRejectLoading] = useState(false);

  const handleReject = (item) => setRejectTarget(item);
  const confirmReject = async (id, reason) => {
    if (!reason.trim()) return;
    setRejectLoading(true);
    try {
      const item = feed.find(f => f.id === id);
      if (item?._type === 'general') {
        await axios.put(`/api/approvals/${id}`, { status: 'rejected', adminNote: reason });
      } else if (item?._type === 'purchase') {
        await axios.patch(`/api/purchase-requests/${id}`, { action: 'reject', adminNote: reason });
      } else if (item?._type === 'cash_expense') {
        await resolveCashApproval(id, 'reject', reason);
      }
      alertSuccess('Berhasil ditolak');
      setRejectTarget(null);
      fetchGeneral(); fetchPurchase(); fetchCash();
    } catch (err) {
      alertError(err?.response?.data?.message || 'Gagal menolak.');
    } finally {
      setRejectLoading(false);
    }
  };

  const rejectMeta = rejectTarget ? TYPE_META[rejectTarget._type] : TYPE_META.general;

  // ── Stat cards ───────────────────────────────────────────────────────
  const StatCard = ({ type, count, active }) => {
    const meta = TYPE_META[type];
    return (
      <button
        onClick={() => setActiveTab(active ? type : 'all')}
        style={{
          flex: 1,
          background: active ? meta.bgLight : C.white,
          border: `1.5px solid ${active ? meta.borderColor : C.n200}`,
          borderRadius: 14,
          padding: '12px 10px',
          cursor: 'pointer',
          boxShadow: active ? `0 4px 14px ${meta.borderColor}30` : SHADOW.sm,
          transition: 'all 0.2s ease',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 4,
          minWidth: 0,
        }}
      >
        <span style={{ fontSize: 22 }}>{meta.icon}</span>
        <span style={{
          fontFamily: 'Poppins', fontSize: 18, fontWeight: 800,
          color: active ? meta.color : C.n800,
          lineHeight: 1,
        }}>
          {count}
        </span>
        <span style={{
          fontFamily: 'Poppins', fontSize: 9, fontWeight: 600,
          color: active ? meta.color : C.n500,
          textAlign: 'center',
        }}>
          {type === 'all' ? 'Semua' : meta.label}
        </span>
      </button>
    );
  };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#F8F4FF', overflow: 'hidden' }}>
      {/* ── Premium Header ── */}
      <div style={{
        background: 'linear-gradient(135deg, #5B005F 0%, #4D0051 100%)',
        padding: '16px 20px 20px',
        position: 'relative',
        overflow: 'hidden',
        flexShrink: 0,
      }}>
        <GlowOrb color="rgba(140, 76, 143, 0.4)" size={200} top="-60px" left="-30px" blur={50} />
        <GlowOrb color="rgba(249, 62, 17, 0.25)" size={150} top="40px" right="-40px" blur={40} />
        <Sparkle top="10%" left="15%" size={8} delay={0} color="#FFD700" />
        <Sparkle top="20%" left="80%" size={6} delay={0.5} color="#FF6B6B" />
        <Sparkle top="60%" left="25%" size={7} delay={1} color="#4ECDC4" />
        <FloatingBubble src={bubbleIcon} size={18} top="15%" left="5%" delay={0} opacity={0.4} />
        <FloatingBubble src={bubble2Icon} size={14} top="35%" right="8%" delay={0.5} opacity={0.35} />

        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', position: 'relative' }}>
          <div>
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              style={{ fontFamily: 'Poppins', fontSize: 18, fontWeight: 800, color: 'white', letterSpacing: '-0.5px' }}
            >
              Approval Center
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              style={{ fontFamily: 'Poppins', fontSize: 11, color: 'rgba(255,255,255,0.8)', marginTop: 4 }}
            >
              {totalPending > 0 ? `${totalPending} menunggu persetujuan` : 'Semua sudah diproses'}
            </motion.div>
          </div>
          {goBack && (
            <button
              onClick={goBack}
              style={{
                background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.25)',
                borderRadius: 10, padding: '8px 12px', cursor: 'pointer', color: 'white',
              }}
            >
              ← Kembali
            </button>
          )}
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '14px 16px 24px' }}>

        {/* Premium Stats Grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 8,
          marginBottom: 14,
        }} className="approval-stats-grid">
          <PremiumStatCard label="📊 Total" value={totalPending} color={C.primary} sparkline={[5, 8, 6, totalPending || 1]} />
          <PremiumStatCard label="📋 Umum" value={pendingGeneral} color={C.primary} sparkline={[1, 2, 1, pendingGeneral || 1]} />
          <PremiumStatCard label="📦 Pengadaan" value={pendingPurchase} color={C.info} sparkline={[2, 3, 2, pendingPurchase || 1]} />
          <PremiumStatCard label="💰 Kas Outlet" value={pendingCash} color={C.success} sparkline={[1, 2, 1, pendingCash || 1]} />
        </div>

        {/* Responsive: stack stats on mobile */}
        <style>{`
          @media (max-width: 480px) {
            .approval-stats-grid {
              grid-template-columns: repeat(2, 1fr) !important;
            }
          }
          @media (max-width: 360px) {
            .approval-stats-grid {
              grid-template-columns: 1fr !important;
            }
          }
        `}</style>

        {/* Search & Filter Header */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 44px', gap: 8, marginBottom: 10 }} className="approval-filter-row">
          <SearchBar
            value={query}
            onChange={setQuery}
            placeholder="Cari requester, item, atau keterangan..."
            compact
          />
          <FilterIconButton
            onClick={() => setShowFilter(true)}
            activeCount={[
              statusFilter !== 'pending',
              periodFilter !== 'all',
            ].filter(Boolean).length}
          />
        </div>

        {/* Type tabs */}
        <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 10, scrollbarWidth: 'none' }}>
          {[
            { v: 'all', l: 'Semua' },
            { v: 'general', l: 'Umum' },
            { v: 'purchase', l: 'Pengadaan' },
            { v: 'cash_expense', l: 'Kas Outlet' },
          ].map(t => (
            <button
              key={t.v}
              onClick={() => setActiveTab(t.v)}
              style={{
                flexShrink: 0,
                padding: '8px 14px',
                borderRadius: 999,
                border: 'none',
                background: activeTab === t.v ? C.primary : C.n50,
                fontFamily: 'Poppins',
                fontSize: 12,
                fontWeight: activeTab === t.v ? 600 : 500,
                color: activeTab === t.v ? 'white' : C.n600,
                cursor: 'pointer',
              }}
            >
              {t.l}
              {t.v === 'general' && pendingGeneral > 0 && (
                <span style={{ background: 'rgba(255,255,255,0.25)', padding: '1px 5px', borderRadius: 999, fontSize: 10, marginLeft: 4 }}>
                  {pendingGeneral}
                </span>
              )}
              {t.v === 'purchase' && pendingPurchase > 0 && (
                <span style={{ background: 'rgba(255,255,255,0.25)', padding: '1px 5px', borderRadius: 999, fontSize: 10, marginLeft: 4 }}>
                  {pendingPurchase}
                </span>
              )}
              {t.v === 'cash_expense' && pendingCash > 0 && (
                <span style={{ background: 'rgba(255,255,255,0.25)', padding: '1px 5px', borderRadius: 999, fontSize: 10, marginLeft: 4 }}>
                  {pendingCash}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Loading */}
        {isLoading && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '30vh', gap: 12 }}>
            <div style={{ width: 36, height: 36, border: `3px solid ${C.n200}`, borderTopColor: C.primary, borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
            <span style={{ fontFamily: 'Poppins', fontSize: 12, color: C.n500 }}>Memuat approval...</span>
          </div>
        )}

        {/* Empty */}
        {!isLoading && feed.length === 0 && (
          <div style={{ padding: '48px 24px', textAlign: 'center' }}>
            <div style={{ width: 72, height: 72, borderRadius: 24, background: C.successBg, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px', fontSize: 32 }}>
              ✅
            </div>
            <div style={{ fontFamily: 'Poppins', fontSize: 15, fontWeight: 700, color: C.n800, marginBottom: 6 }}>Semua approval beres!</div>
            <div style={{ fontFamily: 'Poppins', fontSize: 13, color: C.n500 }}>Tidak ada approval yang menunggu di periode ini.</div>
          </div>
        )}

        {/* Feed */}
        {!isLoading && feed.map(item => {
          const typeMeta = TYPE_META[item._type];
          return (
            <ApprovalCardCompact
              key={`${item._type}-${item.id}`}
              item={item}
              typeMeta={typeMeta}
              expanded={expandedId === `${item._type}-${item.id}`}
              onToggle={() => setExpandedId(prev => prev === `${item._type}-${item.id}` ? null : `${item._type}-${item.id}`)}
              onApprove={handleApprove}
              onReject={handleReject}
              actionLoading={actionLoading}
            />
          );
        })}
        {/* Responsive modal for mobile */}
        <style>{`
          @media (max-width: 480px) {
            .approval-modal-content {
              margin: 10px !important;
              max-width: calc(100% - 20px) !important;
            }
            .approval-filter-row {
              grid-template-columns: 1fr !important;
            }
          }
        `}</style>
      </div>

      {/* Reject modal */}
      <RejectModal
        visible={!!rejectTarget}
        item={rejectTarget}
        typeMeta={rejectMeta}
        onConfirm={confirmReject}
        onClose={() => setRejectTarget(null)}
        loading={rejectLoading}
      />

      {/* Filter Modal */}
      <FilterModal
        visible={showFilter}
        onClose={() => setShowFilter(false)}
        title="Filter Approval"
        onApply={() => setShowFilter(false)}
        onReset={() => {
          setStatusFilter('pending');
          setPeriodFilter('all');
        }}
      >
        <FilterSection title="Status">
          <FilterChipGroup
            options={[
              { value: 'all', label: 'Semua' },
              { value: 'pending', label: 'Pending' },
              { value: 'approved', label: 'Disetujui' },
              { value: 'rejected', label: 'Ditolak' },
            ]}
            selected={statusFilter}
            onChange={(val) => setStatusFilter(val)}
            multiple={false}
          />
        </FilterSection>

        <FilterSection title="Periode">
          <FilterChipGroup
            options={[
              { value: 'all', label: 'Semua Waktu' },
              { value: 'today', label: 'Hari Ini' },
              { value: '7d', label: '7 Hari' },
              { value: '30d', label: '30 Hari' },
            ]}
            selected={periodFilter}
            onChange={(val) => setPeriodFilter(val)}
            multiple={false}
          />
        </FilterSection>
      </FilterModal>
    </div>
  );
}
