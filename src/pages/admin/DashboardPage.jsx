import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { C, T } from '../../utils/theme';
import { rp } from '../../utils/helpers';
import { Avatar, StatCard, Select, useAppRefresh } from '../../components/ui';
import { useApp } from '../../context/AppContext';
import { alertWarning } from '../../utils/alert';

export default function AdminDashboardPage({ user, navigate }) {
  const { adminOutletId, setAdminOutletId } = useApp();
  const [outlets, setOutlets] = useState([]);
  const [period, setPeriod] = useState('today');
  const [stats, setStats] = useState({
    total_omset: 0, total_transaksi: 0, total_pelunasan: 0,
    omset_today: 0, pelunasan_today: 0, transaksi_today: 0,
    omset_month: 0, pelunasan_month: 0, transaksi_month: 0,
    pending_transactions: 0, total_customers: 0, outlet_comparison: null,
  });
  const [statsError, setStatsError] = useState('');
  const [periodAlerts, setPeriodAlerts] = useState([]);

  useEffect(() => {
    axios.get('/api/master/outlets').then((r) => {
      const list = r?.data?.data || [];
      setOutlets(list);
      if (!adminOutletId && list.length > 0) setAdminOutletId('_all');
    }).catch(() => setOutlets([]));
  }, []);

  const outletId = adminOutletId;
  const setOutletId = setAdminOutletId;

  const fetchStats = useCallback(async () => {
    if (!outletId) return;
    setStatsError('');
    try {
      const q = new URLSearchParams({ period });
      if (outletId !== '_all') q.set('outletId', outletId);
      if (outletId === '_all' && (period === 'today' || period === 'month')) q.set('compare', '1');
      const statsRes = await axios.get(`/api/dashboard/stats?${q.toString()}`);
      if (statsRes?.data?.data) setStats(statsRes.data.data);
    } catch (error) {
      setStatsError(error?.response?.data?.message || 'Gagal memuat statistik.');
    }
  }, [outletId, period]);

  useEffect(() => { fetchStats(); }, [fetchStats]);

  // Pull-to-refresh
  useAppRefresh(() => fetchStats(), [fetchStats]);

  useEffect(() => {
    if (!outlets.length) return;
    const targets = outletId && outletId !== '_all' ? outlets.filter(o => o.id === outletId) : outlets;
    Promise.all(
      targets.map(o => axios.get(`/api/periods/current?outletId=${o.id}`).then(r => ({ outlet: o, data: r?.data?.data })).catch(() => null))
    ).then(results => {
      setPeriodAlerts(results.filter(r => r && r.data && !r.data.alreadyClosed && r.data.daysLeft <= 3));
    }).catch(() => {});
  }, [outlets, outletId]);

  // Computed
  const omset = period === 'today' ? stats.omset_today : period === 'month' ? stats.omset_month : stats.total_omset;
  const pelunasan = period === 'today' ? stats.pelunasan_today : period === 'month' ? stats.pelunasan_month : stats.total_pelunasan;
  const transaksi = period === 'today' ? stats.transaksi_today : period === 'month' ? stats.transaksi_month : stats.total_transaksi;
  const piutang = Math.max(0, omset - pelunasan);
  const periodLabel = period === 'today' ? 'Hari Ini' : period === 'month' ? 'Bulan Ini' : 'Akumulasi';

  return (
    <div style={{ flex: 1, overflowY: 'auto', background: C.n50 }}>
      {/* Header */}
      <div style={{ background: `linear-gradient(135deg, ${C.primaryDark}, #2D0030)`, padding: '16px 20px 28px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontFamily: 'Poppins', fontSize: 11, color: 'rgba(255,255,255,0.6)' }}>Selamat datang,</div>
            <div style={{ fontFamily: 'Poppins', fontSize: 18, fontWeight: 700, color: 'white' }}>{user.name.split(' ')[0]} 👋</div>
            <div style={{ fontFamily: 'Poppins', fontSize: 11, color: 'rgba(255,255,255,0.55)', marginTop: 2 }}>
              Admin{outletId && outletId !== '_all' ? ` · ${outlets.find(o => o.id === outletId)?.name || ''}` : ' · Semua outlet'}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button onClick={() => navigate('notifikasi')} style={{ width: 38, height: 38, borderRadius: 19, background: 'rgba(255,255,255,0.12)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/></svg>
            </button>
            <Avatar photo={user.photo} initials={user.avatar} size={38} onClick={() => navigate('profil')} />
          </div>
        </div>
      </div>

      <div style={{ padding: '0 16px', marginTop: -14, paddingBottom: 20 }}>

        {/* Alert tutup buku */}
        {periodAlerts.length > 0 && (
          <div style={{ marginBottom: 10 }}>
            {periodAlerts.map(({ outlet, data }) => (
              <div key={outlet.id} style={{ background: data.daysLeft <= 1 ? '#FEE2E2' : '#FEF3C7', borderRadius: 12, padding: '10px 12px', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 8, border: `1.5px solid ${data.daysLeft <= 1 ? '#FCA5A5' : '#FDE68A'}` }}>
                <span style={{ fontSize: 14 }}>{data.daysLeft <= 1 ? '🚨' : '⚠️'}</span>
                <div style={{ flex: 1, fontFamily: 'Poppins', fontSize: 11, color: data.daysLeft <= 1 ? '#991B1B' : '#92400E' }}>
                  <strong>{outlet.name}</strong> — tutup buku {data.daysLeft === 0 ? 'hari ini!' : `${data.daysLeft} hari lagi`}
                </div>
                <button onClick={() => navigate('admin_period_close')} style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'Poppins', fontSize: 10, fontWeight: 700, color: data.daysLeft <= 1 ? '#991B1B' : '#92400E', textDecoration: 'underline' }}>Tutup</button>
              </div>
            ))}
          </div>
        )}

        {/* Outlet + Period selector */}
        <div style={{ ...T.card, padding: '12px 14px', marginBottom: 12 }}>
          <Select
            label="Outlet"
            value={outletId}
            onChange={(val) => setOutletId(val)}
            options={[
              { value: '_all', label: '📊 Semua Outlet (Akumulasi)' },
              ...outlets.map((o) => ({ value: o.id, label: o.name })),
            ]}
          />
          <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
            {['today', 'month', 'all'].map((p) => {
              const active = period === p;
              const label = p === 'today' ? 'Hari ini' : p === 'month' ? 'Bulan ini' : 'Akumulasi';
              return (
                <button key={p} onClick={() => setPeriod(p)} style={{
                  flex: 1, padding: '7px 0', borderRadius: 8, border: 'none',
                  background: active ? C.primary : C.n100,
                  color: active ? 'white' : C.n600,
                  fontFamily: 'Poppins', fontSize: 11, fontWeight: active ? 700 : 500, cursor: 'pointer',
                }}>{label}</button>
              );
            })}
          </div>
        </div>

        {statsError && (
          <div style={{ background: '#FEF2F2', color: C.danger, padding: 10, borderRadius: 10, fontFamily: 'Poppins', fontSize: 12, marginBottom: 10 }}>{statsError}</div>
        )}

        {/* KPI Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
          <StatCard label={`Omset ${periodLabel}`} value={rp(omset)} icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>} color={C.primary} />
          <StatCard label="Pelunasan" value={rp(pelunasan)} icon={<span style={{ fontFamily: 'Poppins', fontSize: 14, fontWeight: 800 }}>Rp</span>} color={C.success} />
        </div>
        {piutang > 0 && (
          <div style={{ background: '#FEF3C7', border: '1px solid #FDE68A', borderRadius: 10, padding: '8px 12px', marginBottom: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontFamily: 'Poppins', fontSize: 11, fontWeight: 600, color: '#92400E' }}>⚠️ Piutang</span>
            <span style={{ fontFamily: 'Poppins', fontSize: 12, fontWeight: 700, color: '#92400E' }}>{rp(piutang)}</span>
          </div>
        )}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 14 }}>
          <div style={{ background: 'white', borderRadius: 12, padding: '10px', textAlign: 'center', border: `1px solid ${C.n100}` }}>
            <div style={{ fontFamily: 'Poppins', fontSize: 18, fontWeight: 800, color: C.info }}>{transaksi}</div>
            <div style={{ fontFamily: 'Poppins', fontSize: 9, color: C.n500, fontWeight: 600 }}>NOTA</div>
          </div>
          <div style={{ background: 'white', borderRadius: 12, padding: '10px', textAlign: 'center', border: `1px solid ${C.n100}` }}>
            <div style={{ fontFamily: 'Poppins', fontSize: 18, fontWeight: 800, color: C.warning }}>{stats.pending_transactions}</div>
            <div style={{ fontFamily: 'Poppins', fontSize: 9, color: C.n500, fontWeight: 600 }}>PROSES</div>
          </div>
          <div style={{ background: 'white', borderRadius: 12, padding: '10px', textAlign: 'center', border: `1px solid ${C.n100}` }}>
            <div style={{ fontFamily: 'Poppins', fontSize: 18, fontWeight: 800, color: C.success }}>{stats.total_customers}</div>
            <div style={{ fontFamily: 'Poppins', fontSize: 9, color: C.n500, fontWeight: 600 }}>CUSTOMER</div>
          </div>
        </div>

        {/* Outlet comparison */}
        {stats.outlet_comparison && stats.outlet_comparison.length > 0 && (
          <div style={{ background: 'white', borderRadius: 14, padding: '12px 14px', marginBottom: 14, border: `1px solid ${C.n100}` }}>
            <div style={{ fontFamily: 'Poppins', fontSize: 11, fontWeight: 700, color: C.n600, marginBottom: 8 }}>PERBANDINGAN OUTLET</div>
            {stats.outlet_comparison.map((o) => (
              <div key={o.outletId} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: `1px solid ${C.n50}`, fontFamily: 'Poppins', fontSize: 11 }}>
                <span style={{ color: C.n700 }}>{o.outletName}</span>
                <span style={{ fontWeight: 700, color: C.primary }}>{rp(o.omset)} · {o.transaksi} tx</span>
              </div>
            ))}
          </div>
        )}

        {/* ═══ MENU UTAMA — Konsolidasi ═══ */}
        <div style={{ background: 'white', borderRadius: 16, padding: '14px 16px', marginBottom: 12, border: `1px solid ${C.n100}` }}>
          <div style={{ fontFamily: 'Poppins', fontSize: 12, fontWeight: 700, color: C.n700, marginBottom: 12 }}>Manajemen</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {[
              { label: 'User & Pegawai', screen: 'manajemen_user', icon: '👥', color: C.primary },
              { label: 'Layanan & Harga', screen: 'manajemen_layanan', icon: '🧺', color: '#14B8A6' },
              { label: 'Outlet', screen: 'manajemen_outlet', icon: '🏪', color: '#0D9488' },
              { label: 'Target & Capaian', screen: 'admin_target', icon: '🎯', color: '#EA580C' },
            ].map((item) => (
              <button key={item.label} onClick={() => navigate(item.screen)} style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '12px', borderRadius: 12,
                background: C.n50, border: `1px solid ${C.n100}`, cursor: 'pointer', textAlign: 'left',
              }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: `${item.color}14`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>{item.icon}</div>
                <span style={{ fontFamily: 'Poppins', fontSize: 12, fontWeight: 600, color: C.n800 }}>{item.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Laporan & Analitik */}
        <div style={{ background: 'white', borderRadius: 16, padding: '14px 16px', marginBottom: 12, border: `1px solid ${C.n100}` }}>
          <div style={{ fontFamily: 'Poppins', fontSize: 12, fontWeight: 700, color: C.n700, marginBottom: 12 }}>Laporan & Analitik</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {[
              { label: 'Laporan Outlet', desc: 'Revenue, payment mix, top services per outlet', screen: 'laporan_per_outlet', icon: '📊', color: '#7C3AED' },
              { label: 'Laporan Pusat', desc: 'Executive summary semua outlet', screen: 'admin_laporan', icon: '📈', color: C.info },
              { label: 'Perbandingan Periode', desc: 'Bandingkan 2 periode side-by-side', screen: 'comparison_report', icon: '⚖️', color: '#0891B2' },
              { label: 'Forecast', desc: 'Prediksi revenue berdasarkan tren', screen: 'forecast', icon: '🔮', color: '#7C3AED' },
              { label: 'Rekap Pendapatan', desc: 'Detail pemasukan per metode bayar', screen: 'rekap_pendapatan', icon: '💰', color: '#059669' },
            ].map((item) => (
              <button key={item.label} onClick={() => navigate(item.screen)} style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', borderRadius: 12,
                background: C.n50, border: `1px solid ${C.n100}`, cursor: 'pointer', textAlign: 'left', width: '100%',
              }}>
                <div style={{ width: 34, height: 34, borderRadius: 9, background: `${item.color}14`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>{item.icon}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: 'Poppins', fontSize: 12, fontWeight: 600, color: C.n800 }}>{item.label}</div>
                  <div style={{ fontFamily: 'Poppins', fontSize: 10, color: C.n500 }}>{item.desc}</div>
                </div>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.n400} strokeWidth="2" strokeLinecap="round"><polyline points="9 18 15 12 9 6"/></svg>
              </button>
            ))}
          </div>
        </div>

        {/* Operasional */}
        <div style={{ background: 'white', borderRadius: 16, padding: '14px 16px', marginBottom: 12, border: `1px solid ${C.n100}` }}>
          <div style={{ fontFamily: 'Poppins', fontSize: 12, fontWeight: 700, color: C.n700, marginBottom: 12 }}>Operasional</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
            {[
              { label: 'Approval', screen: 'approval', icon: '✅', color: '#8B5CF6' },
              { label: 'Shift Kasir', screen: 'admin_shift', icon: '🕐', color: '#6366F1' },
              { label: 'Promo & SLA', screen: 'admin_promo', icon: '🏷️', color: '#F59E0B' },
              { label: 'Inventaris', screen: 'admin_stok', icon: '📦', color: '#0D9488' },
              { label: 'Tutup Buku', screen: 'admin_period_close', icon: '📒', color: '#6366F1' },
              { label: 'Kas Outlet', screen: 'kas_outlet', icon: '💼', color: '#10B981' },
              { label: 'Approval Kas', screen: 'kas_approval', icon: '🧾', color: '#EF4444' },
              { label: 'Approval Pengadaan', screen: 'approval_pengadaan_barang', icon: '📦', color: '#F97316' },
            ].map((item) => (
              <button key={item.label} onClick={() => navigate(item.screen)} style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, padding: '12px 6px', borderRadius: 12,
                background: C.n50, border: `1px solid ${C.n100}`, cursor: 'pointer',
              }}>
                <div style={{ width: 34, height: 34, borderRadius: 9, background: `${item.color}14`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>{item.icon}</div>
                <span style={{ fontFamily: 'Poppins', fontSize: 10, fontWeight: 600, color: C.n700, textAlign: 'center' }}>{item.label}</span>
              </button>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
