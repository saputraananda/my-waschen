import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { C } from '../../utils/theme';
import { rp } from '../../utils/helpers';
import { TopBar, Avatar, Btn, SearchBar, Chip } from '../../components/ui';

export default function ApprovalPage({ navigate }) {
  const [approvals, setApprovals] = useState([]);
  const [loading, setLoading] = useState(false);
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

  const TYPE_LABELS = {
    topup_deposit: 'Top Up Deposit',
    reschedule: 'Reschedule',
    diskon: 'Diskon',
    pembatalan: 'Pembatalan',
  };

  const fetchApprovals = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get('/api/approvals');
      setApprovals(res?.data?.data || []);
    } catch (error) {
      console.error('Failed to fetch approvals:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchApprovals();
  }, [fetchApprovals]);

  const handleApprove = async (id) => {
    setActionLoading(id + '_approve');
    try {
      await axios.put(`/api/approvals/${id}`, { status: 'approved' });
      await fetchApprovals();
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
      await fetchApprovals();
    } catch (error) {
      console.error('Failed to reject:', error);
    } finally {
      setActionLoading(null);
    }
  };

  const filtered = approvals.filter((a) => {
    const matchStatus = statusFilter === 'semua' ? true : a.status === statusFilter;
    const q = query.trim().toLowerCase();
    const matchQuery = !q
      ? true
      : (a.requester || '').toLowerCase().includes(q)
        || (a.description || '').toLowerCase().includes(q)
        || (a.type || '').toLowerCase().includes(q);
    const matchPeriod = inPeriod(a.date);
    return matchStatus && matchQuery && matchPeriod;
  });

  const pending = filtered.filter((a) => a.status === 'pending');
  const done = filtered.filter((a) => a.status !== 'pending');

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: C.n50, overflow: 'hidden' }}>
      <TopBar title="Approval Center" subtitle={`${pending.length} menunggu`} onBack={() => navigate('dashboard')} />

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

        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '50%', gap: 12 }}>
            <div style={{ width: 40, height: 40, border: `3px solid ${C.n200}`, borderTop: `3px solid ${C.primary}`, borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
            <span style={{ fontFamily: 'Poppins', fontSize: 13, color: C.n500 }}>Memuat data...</span>
          </div>
        ) : null}

        {!loading && pending.length > 0 && (
          <>
            <div style={{ fontFamily: 'Poppins', fontSize: 13, fontWeight: 600, color: C.n600, marginBottom: 12 }}>MENUNGGU PERSETUJUAN</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 }}>
              {pending.map((a) => (
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
          </>
        )}

        {!loading && done.length > 0 && (
          <>
            <div style={{ fontFamily: 'Poppins', fontSize: 13, fontWeight: 600, color: C.n600, marginBottom: 12 }}>SUDAH DIPROSES</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {done.map((a) => (
                <div key={a.id} style={{ background: C.white, borderRadius: 14, padding: '12px 14px', boxShadow: '0 2px 8px rgba(15,23,42,0.05)', opacity: 0.7 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                      <div style={{ fontFamily: 'Poppins', fontSize: 13, fontWeight: 600, color: C.n900 }}>{a.requester}</div>
                      <div style={{ fontFamily: 'Poppins', fontSize: 11, color: C.n600 }}>{TYPE_LABELS[a.type] || a.type} · {a.date}</div>
                    </div>
                    <span style={{
                      background: a.status === 'approved' ? '#DCFCE7' : '#FEE2E2',
                      color: a.status === 'approved' ? C.success : C.danger,
                      fontFamily: 'Poppins', fontSize: 10, fontWeight: 700, padding: '3px 10px', borderRadius: 999
                    }}>
                      {a.status === 'approved' ? 'Disetujui' : 'Ditolak'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {!loading && filtered.length === 0 && (
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
