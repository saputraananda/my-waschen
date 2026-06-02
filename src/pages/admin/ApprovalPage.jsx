import { useState, useCallback, useMemo } from 'react';
import axios from 'axios';
import { C } from '../../utils/theme';
import { rp } from '../../utils/helpers';
import { TopBar, Avatar, Btn, SearchBar, Chip, useAppRefresh } from '../../components/ui';
import { useInfiniteList } from '../../utils/useInfiniteList';

const TYPE_LABELS = {
  topup_deposit: 'Top Up Deposit',
  reschedule: 'Reschedule',
  diskon: 'Diskon',
  pembatalan: 'Pembatalan',
};

export default function ApprovalPage({ goBack }) {
  const [actionLoading, setActionLoading] = useState(null);
  const [statusFilter, setStatusFilter] = useState('semua');
  const [query, setQuery] = useState('');
  const [periodFilter, setPeriodFilter] = useState('all');

  const inPeriod = (dateValue) => {
    if (periodFilter === 'all') return true;
    const d = new Date(dateValue);
    if (Number.isNaN(d.getTime())) return false;
    const now = new Date();
    if (periodFilter === 'today') return d.toDateString() === now.toDateString();
    const diffDays = Math.floor((now - d) / 86400000);
    if (periodFilter === '7d') return diffDays <= 7;
    if (periodFilter === '30d') return diffDays <= 30;
    return true;
  };

  // ── Pending list — tampilkan semua tanpa pagination (jarang banyak)
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

  // ── History list — pagination & infinite scroll (untuk approved/rejected)
  const historyStatus = statusFilter === 'approved' || statusFilter === 'rejected'
    ? statusFilter
    : ''; // '' = semua non-pending (server-side filter)

  const historyList = useInfiniteList({
    fetchPage: useCallback(async ({ page, pageSize, signal }) => {
      const params = { page, limit: pageSize };
      if (historyStatus) params.status = historyStatus;
      const res = await axios.get('/api/approvals', { params, signal });
      // Filter out pending (kalau status filter kosong, server return all)
      const items = (res?.data?.data || []).filter(a => a.status !== 'pending');
      return {
        items,
        total: res?.data?.pagination?.total ?? null,
      };
    }, [historyStatus]),
    pageSize: 30,
    deps: [historyStatus],
    enabled: statusFilter !== 'pending', // skip kalau cuma mau lihat pending
  });

  // Pull-to-refresh
  useAppRefresh(() => {
    pendingList.refresh();
    historyList.refresh();
  }, [pendingList.refresh, historyList.refresh]);

  // Client-side search & period filter
  const filteredPending = useMemo(() => {
    if (statusFilter !== 'semua' && statusFilter !== 'pending') return [];
    const q = query.trim().toLowerCase();
    return pendingList.items.filter((a) => {
      const matchQuery = !q
        ? true
        : (a.requester || '').toLowerCase().includes(q)
          || (a.description || '').toLowerCase().includes(q)
          || (a.type || '').toLowerCase().includes(q);
      return matchQuery && inPeriod(a.date);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingList.items, query, periodFilter, statusFilter]);

  const filteredHistory = useMemo(() => {
    if (statusFilter === 'pending') return [];
    const q = query.trim().toLowerCase();
    return historyList.items.filter((a) => {
      const matchQuery = !q
        ? true
        : (a.requester || '').toLowerCase().includes(q)
          || (a.description || '').toLowerCase().includes(q)
          || (a.type || '').toLowerCase().includes(q);
      return matchQuery && inPeriod(a.date);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [historyList.items, query, periodFilter, statusFilter]);

  const handleApprove = async (id) => {
    setActionLoading(id + '_approve');
    try {
      await axios.put(`/api/approvals/${id}`, { status: 'approved' });
      pendingList.refresh();
      historyList.refresh();
    } catch (error) {
      console.error('Failed to approve:', error);
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
      console.error('Failed to reject:', error);
    } finally {
      setActionLoading(null);
    }
  };

  const totalPending = pendingList.total ?? pendingList.items.length;

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: C.n50, overflow: 'hidden' }}>
      <TopBar title="Approval Center" subtitle={`${totalPending} menunggu`} onBack={goBack} />

      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 16px' }}>
        <SearchBar value={query} onChange={setQuery} placeholder="Cari requester, tipe, atau alasan..." />
        <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingTop: 10, paddingBottom: 10, scrollbarWidth: 'none' }}>
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
            <span style={{ fontFamily: 'Poppins', fontSize: 13, color: C.n500 }}>Memuat data...</span>
          </div>
        )}

        {/* Pending section */}
        {(statusFilter === 'semua' || statusFilter === 'pending') && filteredPending.length > 0 && (
          <>
            <div style={{ fontFamily: 'Poppins', fontSize: 13, fontWeight: 600, color: C.n600, marginBottom: 12 }}>
              MENUNGGU PERSETUJUAN ({filteredPending.length})
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 }}>
              {filteredPending.map((a) => (
                <div key={a.id} style={{ background: C.white, borderRadius: 16, padding: '14px 16px', boxShadow: '0 2px 8px rgba(15,23,42,0.07)', borderLeft: `4px solid ${C.warning}` }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                    <Avatar initials={a.requester?.split(' ').map((w) => w[0]).join('').slice(0, 2) || 'US'} size={36} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontFamily: 'Poppins', fontSize: 13, fontWeight: 600, color: C.n900 }}>{a.requester}</div>
                      <div style={{ fontFamily: 'Poppins', fontSize: 11, color: C.n600 }}>{a.date}</div>
                    </div>
                    <span style={{ background: '#FEF3C7', color: C.warning, fontFamily: 'Poppins', fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 999 }}>{TYPE_LABELS[a.type] || a.type}</span>
                  </div>
                  <div style={{ background: C.n50, borderRadius: 10, padding: '10px 12px', marginBottom: 12 }}>
                    <div style={{ fontFamily: 'Poppins', fontSize: 12, color: C.n900 }}>{a.description}</div>
                    {a.amount && <div style={{ fontFamily: 'Poppins', fontSize: 13, fontWeight: 700, color: C.primary, marginTop: 4 }}>{rp(a.amount)}</div>}
                  </div>
                  <div style={{ display: 'flex', gap: 10 }}>
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
          </>
        )}

        {/* History section */}
        {statusFilter !== 'pending' && filteredHistory.length > 0 && (
          <>
            <div style={{ fontFamily: 'Poppins', fontSize: 13, fontWeight: 600, color: C.n600, marginBottom: 12 }}>
              SUDAH DIPROSES
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {filteredHistory.map((a) => (
                <div key={a.id} style={{ background: C.white, borderRadius: 14, padding: '12px 14px', boxShadow: '0 2px 8px rgba(15,23,42,0.05)', opacity: 0.85 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                      <div style={{ fontFamily: 'Poppins', fontSize: 13, fontWeight: 600, color: C.n900 }}>{a.requester}</div>
                      <div style={{ fontFamily: 'Poppins', fontSize: 11, color: C.n600 }}>{TYPE_LABELS[a.type] || a.type} · {a.date}</div>
                    </div>
                    <span style={{
                      background: a.status === 'approved' ? '#DCFCE7' : '#FEE2E2',
                      color: a.status === 'approved' ? C.success : C.danger,
                      fontFamily: 'Poppins', fontSize: 10, fontWeight: 700, padding: '3px 10px', borderRadius: 999,
                    }}>
                      {a.status === 'approved' ? 'Disetujui' : 'Ditolak'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
            {historyList.hasMore && (
              <div ref={historyList.sentinelRef} style={{ padding: '14px 0', textAlign: 'center' }}>
                {historyList.loadingMore ? (
                  <span style={{ fontFamily: 'Poppins', fontSize: 11, color: C.n500 }}>Memuat lebih banyak…</span>
                ) : (
                  <span style={{ fontFamily: 'Poppins', fontSize: 11, color: C.n400 }}>·</span>
                )}
              </div>
            )}
            {!historyList.hasMore && historyList.items.length > 0 && (
              <div style={{ textAlign: 'center', padding: '14px 0', fontFamily: 'Poppins', fontSize: 10, color: C.n400 }}>
                ✓ Sudah ujung daftar
              </div>
            )}
          </>
        )}

        {!pendingList.loading && !historyList.loading && filteredPending.length === 0 && filteredHistory.length === 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 24px', gap: 12 }}>
            <div style={{ fontSize: 48 }}>✅</div>
            <div style={{ fontFamily: 'Poppins', fontSize: 16, fontWeight: 600, color: C.n900 }}>Semua beres!</div>
            <div style={{ fontFamily: 'Poppins', fontSize: 13, color: C.n600, textAlign: 'center' }}>Tidak ada data yang sesuai filter</div>
          </div>
        )}
      </div>
    </div>
  );
}
