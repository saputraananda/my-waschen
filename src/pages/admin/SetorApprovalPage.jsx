import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../../utils/api';
import { C, SHADOW } from '../../utils/theme';
import { rp } from '../../utils/helpers';
import { TopBar, Btn, Select, SkeletonBar } from '../../components/ui';
import { useApp } from '../../context/AppContext';
import { useResponsive } from '../../utils/hooks';
import { FloatingBubble, Sparkle, GlowOrb } from '../../components/ui/PremiumAnimations';
import bubbleIcon from '../../assets/Decorative icon/bubble-1.webp';
import bubble2Icon from '../../assets/Decorative icon/bubble-2.webp';

const TABS = [
  { value: 'pending', label: '⏳ Pending' },
  { value: 'approved', label: '✅ Approved' },
  { value: 'rejected', label: '❌ Ditolak' },
];

const cardStyle = {
  background: 'linear-gradient(145deg, #FFFFFF, #F8F4FF)',
  boxShadow: '10px 10px 24px rgba(110, 46, 120, 0.1), -5px -5px 14px rgba(255, 255, 255, 0.95)',
  borderRadius: 18,
};

const shimmerKeyframes = `
  @keyframes shimmer {
    0% { background-position: -200% 0; }
    100% { background-position: 200% 0; }
  }
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
`;

function SetorApprovalPage({ goBack }) {
  const { isMobile } = useResponsive();
  const { user } = useApp();
  const [activeTab, setActiveTab] = useState('pending');
  const [deposits, setDeposits] = useState([]);
  const [loading, setLoading] = useState(false);
  const [rejectingId, setRejectingId] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [outletFilter, setOutletFilter] = useState('');
  const [outlets, setOutlets] = useState([]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const params = { status: activeTab, limit: 100 };
      if (outletFilter) params.outlet_id = outletFilter;
      const res = await api.get('/api/cash-deposits/pending', { params });
      setDeposits(res?.data?.data || []);
    } catch (err) { console.error('Error loading data:', err); }
    finally { setLoading(false); }
  }, [activeTab, outletFilter]);

  useEffect(() => { loadData(); }, [loadData]);

  // Load outlets for filter
  useEffect(() => {
    api.get('/api/master/outlets').then(r => {
      setOutlets([{ value: '', label: 'Semua Outlet' }, ...(r?.data?.data || []).map(o => ({ value: String(o.id), label: o.name }))]);
    }).catch((err) => { console.error('Error loading outlets:', err); });
  }, []);

  const handleApprove = async (id) => {
    if (!confirm('Approve setor ini?')) return;
    try {
      await api.patch(`/api/cash-deposits/${id}/approve`);
      loadData();
    } catch (err) {
      alert(err.response?.data?.message || 'Gagal approve.');
    }
  };

  const handleReject = async (id) => {
    if (!rejectReason.trim() || rejectReason.trim().length < 3) {
      alert('Alasan penolakan minimal 3 karakter.');
      return;
    }
    try {
      await api.patch(`/api/cash-deposits/${id}/reject`, { reason: rejectReason });
      setRejectingId(null);
      setRejectReason('');
      loadData();
    } catch (err) {
      alert(err.response?.data?.message || 'Gagal reject.');
    }
  };

  const fmtDate = (d) => {
    if (!d) return '—';
    try { return new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }); }
    catch { return d; }
  };

  const fmtTime = (d) => {
    if (!d) return '';
    try { return new Date(d).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }); }
    catch { return ''; }
  };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#F3EEF7', overflow: 'hidden' }}>
      <style>{shimmerKeyframes}</style>

      {/* Premium Header */}
      <div style={{
        background: 'linear-gradient(135deg, #5B005F 0%, #4D0051 100%)',
        position: 'relative',
        overflow: 'hidden',
        paddingTop: 8,
        paddingBottom: 16,
      }}>
        <GlowOrb color="#E040FB" size={120} opacity={0.15} top="-20px" right="-20px" />
        <GlowOrb color="#FF6D00" size={80} opacity={0.1} bottom="-10px" left="20%" />
        <FloatingBubble src={bubbleIcon} size={28} top="12px" right="60px" />
        <FloatingBubble src={bubble2Icon} size={22} top="28px" right="20px" delay={0.5} />
        <Sparkle color="#FFD700" size={16} top="8px" left="40%" delay={0.2} />
        <Sparkle color="#FFFFFF" size={12} top="32px" left="25%" delay={0.8} />

        <TopBar title="Approval Setor Tunai" subtitle="Verifikasi penyetoran kas kasir" onBack={goBack} isPremium />
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 0, padding: '0 16px', background: 'linear-gradient(145deg, #FFFFFF, #F8F4FF)', borderBottom: '1px solid #E8DDF0', overflowX: 'auto' }}>
        {TABS.map(tab => (
          <motion.button
            key={tab.value}
            onClick={() => setActiveTab(tab.value)}
            whileTap={{ scale: 0.97 }}
            style={{
              flex: 1, padding: '12px 0', border: 'none', background: 'transparent', cursor: 'pointer',
              fontFamily: 'Poppins', fontSize: 12, fontWeight: activeTab === tab.value ? 600 : 400,
              color: activeTab === tab.value ? '#5B005F' : '#9E9E9E',
              borderBottom: activeTab === tab.value ? '2px solid #5B005F' : '2px solid transparent',
              transition: 'all 0.2s',
            }}
          >
            {tab.label}
          </motion.button>
        ))}
      </div>

      {/* Filter */}
      {outlets.length > 1 && (
        <div style={{ padding: '12px 16px 0' }}>
          <Select
            value={outletFilter}
            onChange={v => setOutletFilter(v)}
            options={outlets}
          />
        </div>
      )}

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 16, overflowX: 'hidden' }}>
        <div style={{ maxWidth: 540, margin: '0 auto' }}>

          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[1, 2, 3].map(i => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.1 }}
                  style={{
                    ...cardStyle,
                    padding: 16,
                    background: `linear-gradient(90deg, #F0E6F5 25%, #FFFFFF 50%, #F0E6F5 75%)`,
                    backgroundSize: '200% 100%',
                    animation: 'shimmer 1.5s infinite',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                    <div>
                      <div style={{ width: 100, height: 20, background: '#E8DDF0', borderRadius: 6, marginBottom: 6 }} />
                      <div style={{ width: 140, height: 12, background: '#EDE4F0', borderRadius: 4 }} />
                    </div>
                    <div style={{ width: 80, height: 12, background: '#EDE4F0', borderRadius: 4 }} />
                  </div>
                  <div style={{ width: '100%', height: 40, background: '#F5F0FA', borderRadius: 8, marginBottom: 10 }} />
                  <div style={{ display: 'flex', gap: 8 }}>
                    <div style={{ flex: 1, height: 32, background: '#EDE4F0', borderRadius: 8 }} />
                    <div style={{ flex: 1, height: 32, background: '#EDE4F0', borderRadius: 8 }} />
                  </div>
                </motion.div>
              ))}
            </div>
          ) : deposits.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              style={{ ...cardStyle, textAlign: 'center', padding: 40 }}
            >
              <div style={{ fontSize: 40, marginBottom: 12 }}>📭</div>
              <div style={{ fontFamily: 'Poppins', fontSize: 14, fontWeight: 500, color: '#5B005F' }}>
                Tidak ada setor {activeTab}
              </div>
            </motion.div>
          ) : (
            <AnimatePresence mode="popLayout">
              {deposits.map((d, idx) => (
                <motion.div
                  key={d.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ delay: idx * 0.04 }}
                  style={{ ...cardStyle, padding: 16, marginBottom: 12 }}
                >
                  {/* Header */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                    <div>
                      <div style={{ fontFamily: 'Poppins', fontSize: 15, fontWeight: 700, color: '#1A1A1A' }}>{rp(d.amount)}</div>
                      <div style={{ fontFamily: 'Poppins', fontSize: 11, color: '#757575' }}>
                        {d.cashierName} · {d.outletName}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontFamily: 'Poppins', fontSize: 11, color: '#757575' }}>{fmtDate(d.depositDate)}</div>
                      <div style={{ fontFamily: 'Poppins', fontSize: 10, color: '#9E9E9E' }}>{fmtTime(d.createdAt)}</div>
                    </div>
                  </div>

                  {/* Notes */}
                  {d.notes && (
                    <div style={{ fontFamily: 'Poppins', fontSize: 11, color: '#5B005F', background: '#F3EEF7', borderRadius: 8, padding: '8px 10px', marginBottom: 10 }}>
                      📝 {d.notes}
                    </div>
                  )}

                  {/* PIC Info */}
                  {d.picName && (
                    <div style={{
                      background: 'rgba(91, 0, 95, 0.08)',
                      borderRadius: 6,
                      padding: '4px 10px',
                      marginBottom: 10,
                      fontFamily: 'Poppins',
                      fontSize: 10,
                      color: '#5B005F',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                    }}>
                      👤 PIC: <strong>{d.picName}</strong>
                    </div>
                  )}

                  {/* Proof photo */}
                  {d.proofPhotoUrl && (
                    <div style={{ marginBottom: 10, borderRadius: 10, overflow: 'hidden', border: '1px solid #E8DDF0', maxHeight: 200 }}>
                      <img src={d.proofPhotoUrl} alt="proof" style={{ width: '100%', maxHeight: 200, objectFit: 'cover' }} />
                    </div>
                  )}

                  {/* Rejection reason */}
                  {d.status === 'rejected' && d.rejectionReason && (
                    <div style={{ fontFamily: 'Poppins', fontSize: 11, color: '#D32F2F', background: '#FFEBEE', borderRadius: 8, padding: '8px 10px', marginBottom: 10 }}>
                      ❌ Alasan: {d.rejectionReason}
                    </div>
                  )}

                  {/* Approved info */}
                  {d.status === 'approved' && d.approvedByName && (
                    <div style={{ fontFamily: 'Poppins', fontSize: 11, color: '#2E7D32', background: '#E8F5E9', borderRadius: 8, padding: '8px 10px', marginBottom: 10 }}>
                      ✅ Disetujui oleh {d.approvedByName} · {fmtDate(d.approvedAt)}
                    </div>
                  )}

                  {/* Action buttons (pending only) */}
                  {d.status === 'pending' && (
                    <div style={{ marginTop: 12 }}>
                      {rejectingId === d.id ? (
                        <div>
                          <textarea
                            value={rejectReason}
                            onChange={e => setRejectReason(e.target.value)}
                            placeholder="Alasan penolakan (wajib diisi)"
                            rows={2}
                            style={{
                              width: '100%', boxSizing: 'border-box', borderRadius: 8,
                              border: '1.5px solid #E8DDF0', padding: 10,
                              fontFamily: 'Poppins', fontSize: 12, marginBottom: 8, resize: 'vertical',
                              background: '#FAFAFA',
                            }}
                          />
                          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                            <motion.button whileTap={{ scale: 0.97 }} onClick={() => { setRejectingId(null); setRejectReason(''); }} style={{ flex: 1, padding: '8px 16px', borderRadius: 10, border: '1.5px solid #E8DDF0', background: '#FFFFFF', fontFamily: 'Poppins', fontSize: 12, cursor: 'pointer' }}>Batal</motion.button>
                            <motion.button whileTap={{ scale: 0.97 }} onClick={() => handleReject(d.id)} style={{ flex: 1, padding: '8px 16px', borderRadius: 10, border: 'none', background: '#D32F2F', color: '#FFFFFF', fontFamily: 'Poppins', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Konfirmasi Tolak</motion.button>
                          </div>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                          <motion.button whileTap={{ scale: 0.97 }} onClick={() => setRejectingId(d.id)} style={{ flex: 1, padding: '8px 16px', borderRadius: 10, border: '1.5px solid #D32F2F', background: '#FFFFFF', color: '#D32F2F', fontFamily: 'Poppins', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                            ❌ Tolak
                          </motion.button>
                          <motion.button whileTap={{ scale: 0.97 }} onClick={() => handleApprove(d.id)} style={{ flex: 1, padding: '8px 16px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg, #5B005F 0%, #7B0078 100%)', color: '#FFFFFF', fontFamily: 'Poppins', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                            ✅ Approve
                          </motion.button>
                        </div>
                      )}
                    </div>
                  )}
                </motion.div>
              ))}
            </AnimatePresence>
          )}
        </div>
      </div>
    </div>
  );
}

export default SetorApprovalPage;
