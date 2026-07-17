import { useState, useCallback, useMemo, useEffect } from 'react';
import axios from 'axios';
import { C, SHADOW } from '../../utils/theme';
import { rp, inPeriod } from '../../utils/helpers';
import { useIsMobile, useResponsive, useWindowSize } from '../../utils/hooks';
import { TopBar, ProfileAvatar, Btn, SearchBar, Chip, useAppRefresh } from '../../components/ui';
import { useInfiniteList } from '../../utils/useInfiniteList';
import { alertError } from '../../utils/alert';

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

export default function ApprovalPage({ goBack }) {
  const isMobile = useIsMobile();
  const [actionLoading, setActionLoading] = useState(null);
  const [statusFilter, setStatusFilter] = useState('semua');
  const [query, setQuery] = useState('');
  const [periodFilter, setPeriodFilter] = useState('all');
  const [showSection, setShowSection] = useState('approvals'); // 'approvals' | 'pengadaan'

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

  // Fetch purchase requests pending count
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

  // Import PurchaseRequestsPageContent untuk nested view
  const PurchaseRequestsView = useMemo(() => {
    try {
      const { PurchaseRequestsPageContent } = require('./PurchaseRequestsPage');
      return PurchaseRequestsPageContent;
    } catch (e) {
      return null;
    }
  }, []);

  // Show pengadaan page if section is 'pengadaan'
  if (showSection === 'pengadaan' && PurchaseRequestsView) {
    return <PurchaseRequestsView 
      goBack={() => setShowSection('approvals')} 
      pageTitle="Approval Pengadaan Barang"
      filterModalTitle="Filter Pengadaan"
    />;
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: C.n50, overflow: 'hidden' }}>
      <TopBar title="Approval Center" subtitle={`${totalAllPending} menunggu approval`} onBack={goBack} />

      <div style={{ flex: 1, overflowY: 'auto', padding: '10px 16px 24px' }}>
        {/* Responsive wrapper for section tabs */}
        <style>{`
          @media (max-width: 400px) {
            .approval-section-tabs {
              gap: 4px !important;
            }
          }
          @media (max-width: 480px) {
            .approval-card-header {
              flex-direction: column !important;
              gap: 8px !important;
            }
            .approval-card-actions {
              flex-direction: row !important;
              width: 100% !important;
            }
            .approval-card-actions > * {
              flex: 1 !important;
            }
            .approval-filter-chips {
              flex-wrap: wrap !important;
            }
          }
        `}</style>

        {/* Section Tabs - Approvals vs Pengadaan */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 12, background: C.white, borderRadius: 12, padding: 8, boxShadow: SHADOW.sm, className: 'approval-section-tabs' }}>
          <button
            onClick={() => setShowSection('approvals')}
            style={{
              flex: 1, padding: '10px 12px', borderRadius: 10,
              border: 'none',
              background: showSection === 'approvals' ? `linear-gradient(135deg, ${C.primary}, ${C.primaryDark})` : 'transparent',
              color: showSection === 'approvals' ? 'white' : C.n700,
              fontFamily: 'Poppins', fontSize: 12, fontWeight: 600,
              cursor: 'pointer',
              boxShadow: showSection === 'approvals' ? SHADOW.sm : 'none',
              transition: 'all 0.2s',
              position: 'relative',
            }}
          >
            📋 Umum
            {totalPending > 0 && (
              <span style={{
                position: 'absolute', top: 4, right: 4,
                width: 20, height: 20, borderRadius: 10,
                background: showSection === 'approvals' ? 'rgba(255,255,255,0.3)' : C.danger,
                color: showSection === 'approvals' ? 'white' : 'white',
                fontFamily: 'Poppins', fontSize: 10, fontWeight: 700,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>{totalPending}</span>
            )}
          </button>
          <button
            onClick={() => setShowSection('pengadaan')}
            style={{
              flex: 1, padding: '10px 12px', borderRadius: 10,
              border: 'none',
              background: showSection === 'pengadaan' ? `linear-gradient(135deg, ${C.primary}, ${C.primaryDark})` : 'transparent',
              color: showSection === 'pengadaan' ? 'white' : C.n700,
              fontFamily: 'Poppins', fontSize: 12, fontWeight: 600,
              cursor: 'pointer',
              boxShadow: showSection === 'pengadaan' ? SHADOW.sm : 'none',
              transition: 'all 0.2s',
              position: 'relative',
            }}
          >
            📦 Pengadaan
            {pengadaanPendingCount > 0 && (
              <span style={{
                position: 'absolute', top: 4, right: 4,
                width: 20, height: 20, borderRadius: 10,
                background: showSection === 'pengadaan' ? 'rgba(255,255,255,0.3)' : C.danger,
                color: showSection === 'pengadaan' ? 'white' : 'white',
                fontFamily: 'Poppins', fontSize: 10, fontWeight: 700,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>{pengadaanPendingCount}</span>
            )}
          </button>
        </div>

        <SearchBar value={query} onChange={setQuery} placeholder="Cari requester, tipe, atau alasan..." />

        <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingTop: 10, paddingBottom: 6, scrollbarWidth: 'none' }} className="approval-filter-chips">
          {[
            { value: 'semua', label: 'Semua' },
            { value: 'pending', label: 'Pending' },
            { value: 'approved', label: 'Disetujui' },
            { value: 'rejected', label: 'Ditolak' },
          ].map((s) => (
            <Chip key={s.value} label={s.label} active={statusFilter === s.value} onClick={() => setStatusFilter(s.value)} />
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 10, scrollbarWidth: 'none' }}>
          {[
            { value: 'all', label: 'Semua Waktu' },
            { value: 'today', label: 'Hari Ini' },
            { value: '7d', label: '7 Hari' },
            { value: '30d', label: '30 Hari' },
          ].map((p) => (
            <Chip key={p.value} label={p.label} active={periodFilter === p.value} onClick={() => setPeriodFilter(p.value)} />
          ))}
        </div>

        {(pendingList.loading && historyList.loading) && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '40%', gap: 12 }}>
            <div style={{ width: 40, height: 40, border: `3px solid ${C.n200}`, borderTop: `3px solid ${C.primary}`, borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
            <span style={{ fontFamily: 'Poppins', fontSize: 13, color: C.n700 }}>Memuat data...</span>
          </div>
        )}

        {/* Pending section */}
        {(statusFilter === 'semua' || statusFilter === 'pending') && filteredPending.length > 0 && (
          <>
            <div style={{ fontFamily: 'Poppins', fontSize: 11, fontWeight: 600, color: C.n600, marginBottom: 10, letterSpacing: 0.5 }}>
              MENUNGGU PERSETUJUAN ({filteredPending.length})
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 }}>
              {filteredPending.map((a) => (
                <div key={a.id} style={{
                  background: C.white, borderRadius: 16, padding: '14px 16px',
                  boxShadow: SHADOW.md, borderLeft: `4px solid ${C.warning}`,
                  transition: 'all 0.2s ease',
                }} className="approval-card-header">
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
                  <div style={{ background: C.n50, borderRadius: 12, padding: '10px 14px', marginBottom: 12 }}>
                    <div style={{ fontFamily: 'Poppins', fontSize: 13, color: C.n900, lineHeight: 1.5 }}>{a.description}</div>
                    {a.amount && (
                      <div style={{ fontFamily: 'Poppins', fontSize: 14, fontWeight: 600, color: C.primary, marginTop: 6 }}>{rp(a.amount)}</div>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <div style={{ display: 'flex', gap: 10 }} className="approval-card-actions">
                    <Btn variant="danger" onClick={() => handleReject(a.id)} loading={actionLoading === a.id + '_reject'} style={{ flex: 1 }} size="sm">Tolak</Btn>
                    <Btn variant="success" onClick={() => handleApprove(a.id)} loading={actionLoading === a.id + '_approve'} style={{ flex: 1 }} size="sm">Setujui</Btn>
                  </div>
                </div>
              ))}
            </div>
            {pendingList.hasMore && (
              <div ref={pendingList.sentinelRef} style={{ padding: '8px 0', textAlign: 'center' }}>
                {pendingList.loadingMore && (
                  <span style={{ fontFamily: 'Poppins', fontSize: 11, color: C.n500 }}>Memuat lebih banyak…</span>
                )}
              </div>
            )}

        {/* History section */}
        {statusFilter !== 'pending' && filteredHistory.length > 0 && (
          <>
            <div style={{ fontFamily: 'Poppins', fontSize: 11, fontWeight: 600, color: C.n600, marginBottom: 10, letterSpacing: 0.5 }}>
              SUDAH DIPROSES
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {filteredHistory.map((a) => {
                const sm = STATUS_META[a.status] || STATUS_META.pending;
                return (
                  <div key={a.id} style={{
                    background: C.white, borderRadius: 14, padding: '12px 14px',
                    boxShadow: SHADOW.sm, borderLeft: `4px solid ${sm.border}`,
                    transition: 'all 0.2s ease',
                  }}>
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
                  </div>
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

        {!pendingList.loading && !historyList.loading && filteredPending.length === 0 && filteredHistory.length === 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 24px', gap: 12 }}>
            <div style={{ width: 64, height: 64, borderRadius: 20, background: `${C.success}14`, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 4px 14px ${C.success}18` }}>
              <span style={{ fontSize: 28 }}>✅</span>
            </div>
            <div style={{ fontFamily: 'Poppins', fontSize: 16, fontWeight: 600, color: C.n800 }}>Semua beres!</div>
            <div style={{ fontFamily: 'Poppins', fontSize: 13, color: C.n500, textAlign: 'center' }}>Tidak ada data yang sesuai filter</div>
          </div>
        )}
      </div>
    </div>
  );
}
