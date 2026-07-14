// ─────────────────────────────────────────────────────────────────────────────
// KasApprovalPage — admin approve/reject pengeluaran kas operasional outlet
// ─────────────────────────────────────────────────────────────────────────────
import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import { C, SHADOW } from '../../utils/theme';
import { rp } from '../../utils/helpers';
import { useIsMobile, useResponsive, useWindowSize } from '../../utils/hooks';
import { TopBar, Btn, Modal, Textarea, Chip, useAppRefresh } from '../../components/ui';
import { alertError, alertSuccess } from '../../utils/alert';
import { getCashApprovals, resolveCashApproval, CATEGORY_META } from '../../utils/outletCashApi';
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

const fmtDate = (v) => {
  if (!v) return '-';
  try { return new Date(v).toLocaleString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }); }
  catch { return '-'; }
};

export default function KasApprovalPage({ goBack }) {
  const [statusFilter, setStatusFilter] = useState('pending');
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(null);
  const [rejectModal, setRejectModal] = useState(null);
  const [rejectReason, setRejectReason] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getCashApprovals(statusFilter);
      setItems(data);
    } catch (err) {
      // Error handled silently
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => { fetchData(); }, [fetchData]);
  useAppRefresh(() => fetchData(), [fetchData]);

  const handleApprove = async (id) => {
    setActionLoading(`${id}_approve`);
    try {
      await resolveCashApproval(id, 'approve');
      alertSuccess('Pengeluaran kas disetujui. Saldo dipotong.');
      await fetchData();
    } catch (err) {
      alertError(err?.response?.data?.message || 'Gagal approve pengeluaran kas.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async () => {
    if (!rejectReason.trim()) {
      alertError('Alasan tolak wajib diisi.');
      return;
    }
    setActionLoading(`${rejectModal}_reject`);
    try {
      await resolveCashApproval(rejectModal, 'reject', rejectReason.trim());
      alertSuccess('Pengeluaran kas ditolak.');
      setRejectModal(null);
      setRejectReason('');
      await fetchData();
    } catch (err) {
      alertError(err?.response?.data?.message || 'Gagal tolak pengeluaran kas.');
    } finally {
      setActionLoading(null);
    }
  };

  const pending = useMemo(() => items.filter(it => it.status === 'pending'), [items]);
  const approved = useMemo(() => items.filter(it => it.status === 'approved'), [items]);
  const rejected = useMemo(() => items.filter(it => it.status === 'rejected'), [items]);

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#F8F4FF', overflow: 'hidden' }}>
      <style>{`
        @media (max-width: 480px) {
          .kas-stats-grid { grid-template-columns: repeat(2, 1fr) !important; }
          .kas-card-header { flex-direction: column !important; gap: 10px !important; }
          .kas-card-actions { flex-direction: row !important; width: 100% !important; }
          .kas-card-actions > * { flex: 1 !important; }
        }
      `}</style>
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
              Approval Kas Outlet
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              style={{ fontFamily: 'Poppins', fontSize: 11, color: 'rgba(255,255,255,0.8)', marginTop: 4 }}
            >
              {pending.length} pengeluaran menunggu persetujuan
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
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 10,
          marginBottom: 14,
        }} className="kas-stats-grid">
          <PremiumStatCard label="⏳ Pending" value={pending.length} color={C.warning} sparkline={[2, 4, 3, pending.length || 1]} />
          <PremiumStatCard label="✅ Disetujui" value={approved.length} color={C.success} sparkline={[1, 3, 2, approved.length || 1]} />
          <PremiumStatCard label="❌ Ditolak" value={rejected.length} color={C.danger} sparkline={[0, 1, 1, rejected.length || 1]} />
        </div>

        <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
          {[
            { value: 'pending', label: 'Pending' },
            { value: 'approved', label: 'Disetujui' },
            { value: 'rejected', label: 'Ditolak' },
          ].map(s => (
            <Chip key={s.value} label={s.label} active={statusFilter === s.value} onClick={() => setStatusFilter(s.value)} />
          ))}
        </div>

        {loading && (
          <div style={{ textAlign: 'center', padding: 30, fontFamily: 'Poppins', fontSize: 12, color: C.n600 }}>
            Memuat…
          </div>
        )}

        {!loading && items.length === 0 && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            style={{
              textAlign: 'center',
              padding: '60px 20px',
              background: 'linear-gradient(145deg, #FFFFFF, #F8F7FC)',
              borderRadius: 16,
              boxShadow: '6px 6px 14px rgba(91, 0, 95, 0.06)',
              border: '1px solid rgba(91, 0, 95, 0.04)',
            }}
          >
            <div style={{ fontSize: 48, marginBottom: 12 }}>✨</div>
            <div style={{ fontFamily: 'Poppins', fontSize: 14, fontWeight: 600, color: '#1E293B' }}>
              {statusFilter === 'pending' ? 'Tidak ada pengeluaran pending' : `Tidak ada pengeluaran ${statusFilter}`}
            </div>
            <div style={{ fontFamily: 'Poppins', fontSize: 11, color: '#94A3B8', marginTop: 4 }}>Semua sudah diproses</div>
          </motion.div>
        )}

        {!loading && items.map(it => {
          const cat = CATEGORY_META[it.category] || CATEGORY_META.other;
          return (
            <motion.div
              key={it.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              whileHover={{ y: -2 }}
              style={{
                background: 'linear-gradient(145deg, #FFFFFF, #F8F7FC)',
                borderRadius: 14,
                padding: '14px 16px',
                marginBottom: 10,
                boxShadow: '6px 6px 14px rgba(91, 0, 95, 0.08), -3px -3px 10px rgba(255, 255, 255, 0.95)',
                border: '1px solid rgba(91, 0, 95, 0.04)',
                borderLeft: `4px solid ${it.status === 'pending' ? C.warning : it.status === 'approved' ? C.success : C.danger}`,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10, gap: 10, flexWrap: 'wrap' }} className="kas-card-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{
                    width: 42, height: 42, borderRadius: 11, flexShrink: 0,
                    background: `${cat.color}15`, border: `1px solid ${cat.color}30`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20,
                  }}>{cat.icon}</div>
                  <div>
                    <div style={{ fontFamily: 'Poppins', fontSize: 13, fontWeight: 600, color: C.n900 }}>
                      {cat.label}
                    </div>
                    <div style={{ fontFamily: 'Poppins', fontSize: 11, color: C.n600, marginTop: 1 }}>
                      🏪 {it.outletName} · 👤 {it.requesterName}
                    </div>
                  </div>
                </div>
                <div style={{ fontFamily: 'Poppins', fontSize: 16, fontWeight: 600, color: C.danger }}>
                  {rp(it.amount)}
                </div>
              </div>

              <div style={{ background: C.n50, borderRadius: 10, padding: '8px 12px', marginBottom: 10 }}>
                <div style={{ fontFamily: 'Poppins', fontSize: 11, color: C.n800 }}>
                  📝 {it.description}
                </div>
              </div>

              {it.receiptPhotoUrl && (
                <a href={it.receiptPhotoUrl} target="_blank" rel="noreferrer" style={{ display: 'inline-block', marginBottom: 10 }}>
                  <img src={it.receiptPhotoUrl} alt="bon" style={{ width: 70, height: 70, borderRadius: 8, objectFit: 'cover', border: `1px solid ${C.n200}` }} />
                </a>
              )}

              <div style={{ fontFamily: 'Poppins', fontSize: 10, color: C.n600, marginBottom: 10 }}>
                Diajukan: {fmtDate(it.requestedAt)}
                {it.resolverName && ` · Diproses oleh ${it.resolverName}`}
                {it.resolvedAt && ` · ${fmtDate(it.resolvedAt)}`}
              </div>

              {it.status === 'rejected' && it.rejectReason && (
                <div style={{ background: C.dangerBg, borderRadius: 8, padding: '8px 12px', marginBottom: 10, fontFamily: 'Poppins', fontSize: 11, color: C.dangerDark }}>
                  ❌ Alasan tolak: {it.rejectReason}
                </div>
              )}

              {it.status === 'pending' && (
                <div style={{ display: 'flex', gap: 8 }} className="kas-card-actions">
                  <Btn
                    variant="danger"
                    onClick={() => { setRejectModal(it.id); setRejectReason(''); }}
                    loading={actionLoading === `${it.id}_reject`}
                    style={{ flex: 1 }}
                    size="sm"
                  >Tolak</Btn>
                  <Btn
                    variant="success"
                    onClick={() => handleApprove(it.id)}
                    loading={actionLoading === `${it.id}_approve`}
                    style={{ flex: 1 }}
                    size="sm"
                  >Setujui</Btn>
                </div>
              )}

              {it.status !== 'pending' && (
                <div style={{
                  display: 'inline-block',
                  fontFamily: 'Poppins', fontSize: 10, fontWeight: 600,
                  padding: '3px 10px', borderRadius: 999,
                  background: it.status === 'approved' ? C.successBg : C.dangerBg,
                  color: it.status === 'approved' ? C.successDark : C.dangerDark,
                }}>
                  {it.status === 'approved' ? '✓ Disetujui' : '✗ Ditolak'}
                </div>
              )}
            </motion.div>
          );
        })}
      </div>

      <Modal visible={!!rejectModal} onClose={() => setRejectModal(null)} title="Tolak Pengeluaran Kas">
        <div style={{ padding: '8px 18px 18px' }}>
          <Textarea
            label="Alasan menolak"
            value={rejectReason}
            onChange={setRejectReason}
            rows={4}
            placeholder="Contoh: Bukti tidak jelas, atau nominal terlalu besar untuk kebutuhan harian"
          />
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <Btn variant="secondary" onClick={() => setRejectModal(null)} style={{ flex: 1 }}>Batal</Btn>
            <Btn variant="danger" onClick={handleReject} disabled={!rejectReason.trim()} style={{ flex: 1 }}>
              Tolak
            </Btn>
          </div>
        </div>
      </Modal>
    </div>
  );
}
