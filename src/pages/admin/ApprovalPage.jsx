import { useState, useCallback, useMemo, useEffect } from 'react';
import { motion } from 'framer-motion';
import axios from 'axios';
import { C } from '../../utils/theme';
import { rp, inPeriod } from '../../utils/helpers';
import { useResponsive } from '../../utils/hooks';
import { TopBar, ProfileAvatar, Btn, SearchBar, Chip, useAppRefresh } from '../../components/ui';
import { useInfiniteList } from '../../utils/useInfiniteList';
import { alertError } from '../../utils/alert';
import { FloatingBubble, Sparkle, GlowOrb } from '../../components/ui/PremiumAnimations';
import bubbleIcon from '../../assets/Decorative icon/bubble-1.webp';
import bubble2Icon from '../../assets/Decorative icon/bubble-2.webp';

const TYPE_LABELS = {
  topup_deposit: 'Top Up Deposit',
  reschedule: 'Reschedule',
  diskon: 'Diskon',
  pembatalan: 'Pembatalan',
};

const STATUS_META = {
  pending:   { label: 'Pending',    bg: C.warningBg, color: C.warningDark, border: C.warning },
  approved:  { label: 'Disetujui',  bg: C.successBg, color: C.successDark, border: C.success },
  rejected:  { label: 'Ditolak',    bg: C.dangerBg, color: C.dangerDark, border: C.danger },
};

const SkeletonBlock = ({ height = 40, style }) => (
  <div style={{
    height, borderRadius: 14,
    background: `linear-gradient(90deg, ${C.n100} 0%, ${C.n200} 50%, ${C.n100} 100%)`,
    backgroundSize: '200% 100%',
    animation: 'shimmer 1.5s infinite',
    ...style,
  }}>
    <style>{`@keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }`}</style>
  </div>
);

export default function ApprovalPage({ goBack }) {
  const { isMobile } = useResponsive();
  const [actionLoading, setActionLoading] = useState(null);
  const [statusFilter, setStatusFilter] = useState('semua');
  const [query, setQuery] = useState('');
  const [periodFilter, setPeriodFilter] = useState('all');
  const [showSection, setShowSection] = useState('approvals');

  const pendingList = useInfiniteList({
    fetchPage: useCallback(async ({ page, pageSize, signal }) => {
      const res = await axios.get('/api/approvals', {
        params: { status: 'pending', page, limit: pageSize },
        signal,
      });
      return {
        items: res?.data?.data || [],
        total: res?.data?.pagination?.total ?? null,
      };
    }, []),
    pageSize: 50,
    deps: [],
  });

  const [pengadaanPendingCount, setPengadaanPendingCount] = useState(0);

  useEffect(() => {
    axios.get('/api/purchase-requests/summary')
      .then(res => {
        const summary = res?.data?.data || [];
        const total = summary.reduce((acc, s) => acc + (s.pendingCount || 0), 0);
        setPengadaanPendingCount(total);
      })
      .catch(() => setPengadaanPendingCount(0));
  }, []);

  const historyStatus = statusFilter === 'approved' || statusFilter === 'rejected'
    ? statusFilter
    : '';

  const historyList = useInfiniteList({
    fetchPage: useCallback(async ({ page, pageSize, signal }) => {
      const params = { page, limit: pageSize };
      if (historyStatus) params.status = historyStatus;
      const res = await axios.get('/api/approvals', { params, signal });
      const items = (res?.data?.data || []).filter(a => a.status !== 'pending');
      return {
        items,
        total: res?.data?.pagination?.total ?? null,
      };
    }, [historyStatus]),
    pageSize: 30,
    deps: [historyStatus],
    enabled: statusFilter !== 'pending',
  });

  useAppRefresh(() => {
    pendingList.refresh();
    historyList.refresh();
  }, [pendingList.refresh, historyList.refresh]);

  const filteredPending = useMemo(() => {
    if (statusFilter !== 'semua' && statusFilter !== 'pending') return [];
    const q = query.trim().toLowerCase();
    return pendingList.items.filter((a) => {
      const matchQuery = !q
        ? true
        : (a.requester || '').toLowerCase().includes(q)
          || (a.description || '').toLowerCase().includes(q)
          || (a.type || '').toLowerCase().includes(q);
      return matchQuery && inPeriod(a.date, periodFilter);
    });
  }, [pendingList.items, query, periodFilter, statusFilter, inPeriod]);

  const filteredHistory = useMemo(() => {
    if (statusFilter === 'pending') return [];
    const q = query.trim().toLowerCase();
    return historyList.items.filter((a) => {
      const matchQuery = !q
        ? true
        : (a.requester || '').toLowerCase().includes(q)
          || (a.description || '').toLowerCase().includes(q)
          || (a.type || '').toLowerCase().includes(q);
      return matchQuery && inPeriod(a.date, periodFilter);
    });
  }, [historyList.items, query, periodFilter, statusFilter, inPeriod]);

  const handleApprove = async (id) => {
    setActionLoading(id + '_approve');
    try {
      await axios.put(`/api/approvals/${id}`, { status: 'approved' });
      pendingList.refresh();
      historyList.refresh();
    } catch (error) {
      alertError(error?.response?.data?.message || 'Gagal menyetujui.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (id) => {
    setActionLoading(id + '_reject');
    try {
      await axios.put(`/api/approvals/${id}`, { status: 'rejected' });
      pendingList.refresh();
      historyList.refresh();
    } catch (error) {
      alertError(error?.response?.data?.message || 'Gagal menolak.');
    } finally {
      setActionLoading(null);
    }
  };

  const totalPending = pendingList.total ?? pendingList.items.length;
  const totalAllPending = totalPending + pengadaanPendingCount;

  const PurchaseRequestsView = useMemo(() => {
    try {
      const { PurchaseRequestsPageContent } = require('./PurchaseRequestsPage');
      return PurchaseRequestsPageContent;
    } catch (e) {
      return null;
    }
  }, []);

  if (showSection === 'pengadaan' && PurchaseRequestsView) {
    return <PurchaseRequestsView
      goBack={() => setShowSection('approvals')}
      pageTitle="Approval Pengadaan Barang"
      filterModalTitle="Filter Pengadaan"
    />;
  }

  return (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column',
      background: 'var(--glass-bg)', overflow: 'hidden'
    }}>
      {/* ── Premium Header ── */}
      <div style={{
        background: 'linear-gradient(135deg, #5B005F 0%, #4D0051 100%)',
        padding: '14px 16px 32px',
        position: 'relative', overflow: 'hidden', flexShrink: 0,
      }}>
        <GlowOrb color="rgba(140, 76, 143, 0.4)" size={200} top="-60px" left="-30px" blur={50} />
        <GlowOrb color="rgba(249, 62, 17, 0.25)" size={150} top="30px" right="-40px" blur={40} />
        <Sparkle top="10%" left="15%" size={7} delay={0} />
        <Sparkle top="25%" left="80%" size={5} delay={0.5} />
        <Sparkle top="60%" left="30%" size={6} delay={1} />
        <FloatingBubble src={bubbleIcon} size={16} top="20%" left="5%" delay={0} opacity={0.4} />
        <FloatingBubble src={bubble2Icon} size={12} top="40%" right="8%" delay={0.5} opacity={0.3} />

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'relative' }}>
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
              {totalAllPending > 0 ? `${totalAllPending} menunggu approval` : 'Semua sudah diproses'}
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

      <div style={{
        flex: 1, overflowY: 'auto',
        padding: '14px 16px 24px',
        marginTop: -14,
        position: 'relative', zIndex: 1,
      }}>
        {/* Section Tabs */}
        <div style={{
          display: 'flex', gap: 8, marginBottom: 12,
          background: `linear-gradient(145deg, ${C.white}, ${C.primaryTint})`,
          borderRadius: 14, padding: 6,
          boxShadow: '8px 8px 20px rgba(110, 46, 120, 0.1), -4px -4px 12px rgba(255, 255, 255, 0.95)',
          border: `1px solid rgba(139, 92, 246, 0.08)`,
        }}>
          {[
            { value: 'approvals', label: '📋 Umum', count: totalPending },
            { value: 'pengadaan', label: '📦 Pengadaan', count: pengadaanPendingCount },
          ].map(s => (
            <motion.button
              key={s.value}
              onClick={() => setShowSection(s.value)}
              whileTap={{ scale: 0.97 }}
              style={{
                flex: 1, padding: '10px 12px', borderRadius: 10,
                border: 'none',
                background: showSection === s.value
                  ? 'linear-gradient(145deg, #5B005F, #8C4C8F)'
                  : 'transparent',
                color: showSection === s.value ? 'white' : C.n700,
                fontFamily: 'Poppins', fontSize: 12, fontWeight: 600,
                cursor: 'pointer',
                position: 'relative',
                boxShadow: showSection === s.value ? '0 4px 12px rgba(91,0,95,0.3)' : 'none',
              }}
            >
              {s.label}
              {s.count > 0 && (
                <span style={{
                  position: 'absolute', top: 4, right: 4,
                  width: 18, height: 18, borderRadius: 9,
                  background: showSection === s.value ? 'rgba(255,255,255,0.3)' : C.danger,
                  color: 'white',
                  fontFamily: 'Poppins', fontSize: 9, fontWeight: 700,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {s.count > 99 ? '99+' : s.count}
                </span>
              )}
            </motion.button>
          ))}
        </div>

        <SearchBar value={query} onChange={setQuery} placeholder="Cari requester, tipe, atau alasan..." />

        {/* Filter chips */}
        <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingTop: 10, paddingBottom: 6, scrollbarWidth: 'none' }}>
          {[
            { value: 'semua', label: 'Semua' },
            { value: 'pending', label: 'Pending' },
            { value: 'approved', label: 'Disetujui' },
            { value: 'rejected', label: 'Ditolak' },
          ].map((s) => (
            <motion.button
              key={s.value}
              onClick={() => setStatusFilter(s.value)}
              whileTap={{ scale: 0.95 }}
              style={{
                padding: '6px 12px', borderRadius: 999,
                border: 'none',
                background: statusFilter === s.value ? C.primary : C.white,
                color: statusFilter === s.value ? 'white' : C.n600,
                fontFamily: 'Poppins', fontSize: 11, fontWeight: 600,
                cursor: 'pointer',
                boxShadow: statusFilter === s.value ? '0 4px 12px rgba(91,0,95,0.25)' : '2px 2px 6px rgba(0,0,0,0.06)',
                flexShrink: 0,
              }}
            >
              {s.label}
            </motion.button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 10, scrollbarWidth: 'none' }}>
          {[
            { value: 'all', label: 'Semua Waktu' },
            { value: 'today', label: 'Hari Ini' },
            { value: '7d', label: '7 Hari' },
            { value: '30d', label: '30 Hari' },
          ].map((p) => (
            <motion.button
              key={p.value}
              onClick={() => setPeriodFilter(p.value)}
              whileTap={{ scale: 0.95 }}
              style={{
                padding: '5px 10px', borderRadius: 999,
                border: 'none',
                background: periodFilter === p.value ? C.info : C.white,
                color: periodFilter === p.value ? 'white' : C.n500,
                fontFamily: 'Poppins', fontSize: 10, fontWeight: 600,
                cursor: 'pointer',
                boxShadow: periodFilter === p.value ? '0 4px 10px rgba(8,145,178,0.25)' : '2px 2px 6px rgba(0,0,0,0.06)',
                flexShrink: 0,
              }}
            >
              {p.label}
            </motion.button>
          ))}
        </div>

        {/* Loading */}
        {(pendingList.loading && historyList.loading) && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 8 }}>
            {[1, 2, 3].map(i => <SkeletonBlock key={i} height={120} />)}
          </div>
        )}

        {/* Pending section */}
        {(statusFilter === 'semua' || statusFilter === 'pending') && filteredPending.length > 0 && (
          <>
            <div style={{
              fontFamily: 'Poppins', fontSize: 10, fontWeight: 700, color: C.n500,
              marginBottom: 10, letterSpacing: 0.5, textTransform: 'uppercase',
            }}>
              MENUNGGU PERSETUJUAN ({filteredPending.length})
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 }}>
              {filteredPending.map((a, idx) => (
                <motion.div
                  key={a.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.04 }}
                  whileHover={{ y: -2 }}
                  style={{
                    background: `linear-gradient(145deg, ${C.white}, ${C.primaryTint})`,
                    borderRadius: 18, padding: '14px 16px',
                    boxShadow: '8px 8px 20px rgba(110, 46, 120, 0.1), -4px -4px 12px rgba(255, 255, 255, 0.95)',
                    border: `1px solid rgba(139, 92, 246, 0.08)`,
                    borderLeft: `4px solid ${C.warning}`,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10, flexWrap: 'wrap' }}>
                    <ProfileAvatar user={{ name: a.requester, photo: a.requesterPhoto }} size={40} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontFamily: 'Poppins', fontSize: 14, fontWeight: 600, color: C.n900 }}>{a.requester}</div>
                      <div style={{ fontFamily: 'Poppins', fontSize: 11, color: C.n500, marginTop: 1 }}>{a.date}</div>
                    </div>
                    <span style={{
                      background: C.warningBg, color: C.warningDark,
                      fontFamily: 'Poppins', fontSize: 10, fontWeight: 600,
                      padding: '3px 10px', borderRadius: 999,
                    }}>
                      {TYPE_LABELS[a.type] || a.type}
                    </span>
                  </div>
                  <div style={{
                    background: `linear-gradient(145deg, ${C.white}, ${C.n50})`,
                    borderRadius: 12, padding: '10px 14px', marginBottom: 12,
                    boxShadow: '2px 2px 6px rgba(110,46,120,0.06)',
                  }}>
                    <div style={{ fontFamily: 'Poppins', fontSize: 13, color: C.n900, lineHeight: 1.5 }}>{a.description}</div>
                    {a.amount && (
                      <div style={{ fontFamily: 'Poppins', fontSize: 15, fontWeight: 700, color: C.primary, marginTop: 6 }}>{rp(a.amount)}</div>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <Btn variant="danger" onClick={() => handleReject(a.id)} loading={actionLoading === a.id + '_reject'} style={{ flex: 1 }} size="sm">Tolak</Btn>
                    <Btn variant="success" onClick={() => handleApprove(a.id)} loading={actionLoading === a.id + '_approve'} style={{ flex: 1 }} size="sm">Setujui</Btn>
                  </div>
                </motion.div>
              ))}
            </div>
            {pendingList.hasMore && (
              <div ref={pendingList.sentinelRef} style={{ padding: '8px 0', textAlign: 'center' }}>
                {pendingList.loadingMore && (
                  <span style={{ fontFamily: 'Poppins', fontSize: 11, color: C.n500 }}>Memuat lebih banyak…</span>
                )}
              </div>
            )}
          </>
        )}

        {/* History section */}
        {statusFilter !== 'pending' && filteredHistory.length > 0 && (
          <>
            <div style={{
              fontFamily: 'Poppins', fontSize: 10, fontWeight: 700, color: C.n500,
              marginBottom: 10, letterSpacing: 0.5, textTransform: 'uppercase',
            }}>
              SUDAH DIPROSES
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {filteredHistory.map((a, idx) => {
                const sm = STATUS_META[a.status] || STATUS_META.pending;
                return (
                  <motion.div
                    key={a.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.04 }}
                    whileHover={{ y: -2 }}
                    style={{
                      background: `linear-gradient(145deg, ${C.white}, ${C.primaryTint})`,
                      borderRadius: 14, padding: '12px 14px',
                      boxShadow: '6px 6px 16px rgba(110, 46, 120, 0.08), -3px -3px 10px rgba(255, 255, 255, 0.95)',
                      border: `1px solid rgba(139, 92, 246, 0.06)`,
                      borderLeft: `4px solid ${sm.border}`,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div>
                        <div style={{ fontFamily: 'Poppins', fontSize: 13, fontWeight: 600, color: C.n900 }}>{a.requester}</div>
                        <div style={{ fontFamily: 'Poppins', fontSize: 11, color: C.n500, marginTop: 1 }}>{TYPE_LABELS[a.type] || a.type} · {a.date}</div>
                      </div>
                      <span style={{
                        background: sm.bg, color: sm.color,
                        fontFamily: 'Poppins', fontSize: 10, fontWeight: 600,
                        padding: '3px 10px', borderRadius: 999,
                      }}>
                        {sm.label}
                      </span>
                    </div>
                  </motion.div>
                );
              })}
            </div>
            {historyList.hasMore && (
              <div ref={historyList.sentinelRef} style={{ padding: '14px 0', textAlign: 'center' }}>
                {historyList.loadingMore ? (
                  <span style={{ fontFamily: 'Poppins', fontSize: 11, color: C.n500 }}>Memuat lebih banyak…</span>
                ) : (
                  <span style={{ fontFamily: 'Poppins', fontSize: 11, color: C.n500 }}>·</span>
                )}
              </div>
            )}
            {!historyList.hasMore && historyList.items.length > 0 && (
              <div style={{ textAlign: 'center', padding: '14px 0', fontFamily: 'Poppins', fontSize: 10, color: C.n500 }}>
                ✓ Sudah ujung daftar
              </div>
            )}
          </>
        )}

        {/* Empty state */}
        {!pendingList.loading && !historyList.loading && filteredPending.length === 0 && filteredHistory.length === 0 && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              justifyContent: 'center', padding: '60px 24px', gap: 12,
              background: `linear-gradient(145deg, ${C.white}, ${C.primaryTint})`,
              borderRadius: 20,
              boxShadow: '10px 10px 24px rgba(110, 46, 120, 0.1), -5px -5px 14px rgba(255, 255, 255, 0.95)',
              border: `1px solid rgba(139, 92, 246, 0.08)`,
            }}
          >
            <div style={{
              width: 64, height: 64, borderRadius: 20,
              background: C.successBg,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 28,
              boxShadow: `0 4px 14px ${C.success}20`,
            }}>
              ✅
            </div>
            <div style={{ fontFamily: 'Poppins', fontSize: 16, fontWeight: 700, color: C.n800 }}>Semua beres!</div>
            <div style={{ fontFamily: 'Poppins', fontSize: 13, color: C.n500, textAlign: 'center' }}>Tidak ada data yang sesuai filter</div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
