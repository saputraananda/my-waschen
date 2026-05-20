import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { C, T } from '../../utils/theme';
import { rp } from '../../utils/helpers';
import { Avatar, StatCard, Select } from '../../components/ui';
import { useApp } from '../../context/AppContext';
import { alertWarning } from '../../utils/alert';

export default function AdminDashboardPage({ user, navigate }) {
  const { adminOutletId, setAdminOutletId } = useApp();
  const [outlets, setOutlets] = useState([]);
  const [period, setPeriod] = useState('all');
  const [showCompare, setShowCompare] = useState(false);
  const [stats, setStats] = useState({
    total_omset: 0,
    total_transaksi: 0,
    total_pelunasan: 0,
    omset_today: 0,
    pelunasan_today: 0,
    transaksi_today: 0,
    omset_month: 0,
    pelunasan_month: 0,
    transaksi_month: 0,
    pending_transactions: 0,
    total_customers: 0,
    outlet_comparison: null,
  });
  const [statsError, setStatsError] = useState('');
  const [periodAlerts, setPeriodAlerts] = useState([]); // periods closing across outlets

  useEffect(() => {
    axios.get('/api/master/outlets').then((r) => {
      const list = r?.data?.data || [];
      setOutlets(list);
      if (!adminOutletId && list.length > 0) setAdminOutletId('_all');
    }).catch(() => setOutlets([]));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const outletId = adminOutletId;
  const setOutletId = setAdminOutletId;

  const fetchStats = useCallback(async () => {
    if (!outletId) return;
    setStatsError('');
    try {
      const q = new URLSearchParams({ period });
      if (outletId !== '_all') q.set('outletId', outletId);
      const shouldCompare = outletId === '_all'
        ? (period === 'today' || period === 'month')
        : showCompare && (period === 'today' || period === 'month');
      if (shouldCompare) q.set('compare', '1');
      const statsRes = await axios.get(`/api/dashboard/stats?${q.toString()}`);
      if (statsRes?.data?.data) setStats(statsRes.data.data);
    } catch (error) {
      const msg = error?.response?.data?.message || 'Gagal memuat statistik.';
      setStatsError(msg);
      console.error('Failed to fetch dashboard data:', error);
    }
  }, [outletId, period, showCompare]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  useEffect(() => {
    if (!outlets.length) return;
    // Ambil alert period untuk semua outlet (atau outlet terpilih)
    const targets = outletId && outletId !== '_all'
      ? outlets.filter(o => o.id === outletId)
      : outlets;
    Promise.all(
      targets.map(o =>
        axios.get(`/api/periods/current?outletId=${o.id}`)
          .then(r => ({ outlet: o, data: r?.data?.data }))
          .catch(() => null)
      )
    ).then(results => {
      const alerts = results.filter(r => r && r.data && !r.data.alreadyClosed && r.data.daysLeft <= 3);
      setPeriodAlerts(alerts);
    }).catch(() => {});
  }, [outlets, outletId]);

  return (
    <div style={{ flex: 1, overflowY: 'auto', background: C.n50 }}>
      <div style={{ background: `linear-gradient(135deg, ${C.primaryDark}, #2D0030)`, padding: '16px 20px 24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontFamily: 'Poppins', fontSize: 12, color: 'rgba(255,255,255,0.65)' }}>Selamat datang,</div>
            <div style={{ fontFamily: 'Poppins', fontSize: 18, fontWeight: 700, color: 'white' }}>{user.name.split(' ')[0]} 👋</div>
            <div style={{ fontFamily: 'Poppins', fontSize: 11, color: 'rgba(255,255,255,0.6)', marginTop: 2 }}>
              Admin{outletId && outletId !== '_all' ? ` · ${outlets.find(o => o.id === outletId)?.name || 'Outlet'}` : ' · Semua outlet'}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <button onClick={() => navigate('notifikasi')} style={{ width: 40, height: 40, borderRadius: 20, background: 'rgba(255,255,255,0.15)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 01-3.46 0" /></svg>
            </button>
            <Avatar photo={user.photo} initials={user.avatar} size={40} onClick={() => navigate('profil')} />
          </div>
        </div>
      </div>

      {/* Alert tutup buku */}
      {periodAlerts.length > 0 && (
        <div style={{ padding: '8px 16px 0' }}>
          {periodAlerts.map(({ outlet, data }) => (
            <div key={outlet.id} style={{ background: data.daysLeft <= 1 ? '#FEE2E2' : '#FEF3C7', borderRadius: 12, padding: '10px 14px', marginBottom: 8, display: 'flex', alignItems: 'flex-start', gap: 10, border: `1.5px solid ${data.daysLeft <= 1 ? '#FCA5A5' : '#FDE68A'}` }}>
              <span style={{ fontSize: 16, flexShrink: 0 }}>{data.daysLeft <= 1 ? '🚨' : '⚠️'}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: 'Poppins', fontSize: 12, fontWeight: 700, color: data.daysLeft <= 1 ? '#991B1B' : '#92400E' }}>
                  Tutup Buku {data.periodLabel} — {outlet.name}
                </div>
                <div style={{ fontFamily: 'Poppins', fontSize: 11, color: data.daysLeft <= 1 ? '#7F1D1D' : '#78350F' }}>
                  {data.daysLeft === 0 ? 'Hari ini terakhir!' : `${data.daysLeft} hari lagi`} · {new Date(data.periodEnd).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                </div>
              </div>
              <button
                onClick={() => navigate('admin_period_close')}
                style={{ background: data.daysLeft <= 1 ? '#991B1B' : '#92400E', border: 'none', borderRadius: 8, cursor: 'pointer', color: 'white', fontFamily: 'Poppins', fontSize: 11, fontWeight: 700, padding: '4px 10px' }}
              >Tutup</button>
            </div>
          ))}
        </div>
      )}

      <div style={{ padding: '0 16px', marginTop: -12, paddingBottom: 16 }}>
        <div style={{ ...T.card, marginBottom: 12 }}>
          <Select
            label="Outlet"
            value={outletId}
            onChange={(val) => setOutletId(val)}
            placeholder="— Pilih outlet —"
            options={[
              { value: '_all', label: '📊 Semua Outlet (Akumulasi)' },
              ...outlets.map((o) => ({ value: o.id, label: o.name })),
            ]}
          />
          <div style={{ fontFamily: 'Poppins', fontSize: 11, color: C.n600, marginTop: 8, lineHeight: 1.45 }}>
            {outletId === '_all'
              ? 'Menampilkan data akumulasi dari semua outlet.'
              : 'Statistik omset dan transaksi di bawah mengikuti outlet yang dipilih.'}
          </div>
        </div>

        {statsError && (
          <div style={{ background: '#FEF2F2', color: C.danger, padding: 12, borderRadius: 12, fontFamily: 'Poppins', fontSize: 13, marginBottom: 12 }}>
            {statsError}
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
          {[
            { id: 'today', label: 'Hari ini' },
            { id: 'month', label: 'Bulan ini' },
            { id: 'all', label: 'Akumulasi' },
          ].map((p) => {
            const active = period === p.id;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => setPeriod(p.id)}
                style={{
                  padding: '8px 14px',
                  borderRadius: 999,
                  border: active ? `2px solid ${C.primary}` : '2px solid transparent',
                  background: active ? `${C.primary}12` : 'transparent',
                  fontFamily: 'Poppins',
                  fontSize: 12,
                  fontWeight: active ? 700 : 500,
                  cursor: 'pointer',
                  color: active ? C.primary : C.n600,
                }}
              >
                {p.label}
              </button>
            );
          })}
        </div>

        {(period === 'today' || period === 'month') && outletId !== '_all' && (
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontFamily: 'Poppins', fontSize: 12, color: C.n700, marginBottom: 12 }}>
            <input type="checkbox" checked={showCompare} onChange={(e) => setShowCompare(e.target.checked)} />
            Bandingkan semua outlet (omset periode sama)
          </label>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, paddingBottom: 4, marginBottom: 4 }}>
          <StatCard
            label={period === 'today' ? 'Total Transaksi Hari Ini' : period === 'month' ? 'Total Transaksi Bulan Ini' : 'Total Transaksi (Akumulasi)'}
            value={rp(period === 'today' ? stats.omset_today : period === 'month' ? stats.omset_month : stats.total_omset).replace('Rp ', 'Rp')}
            icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><polyline points="14 2 14 8 20 8" /></svg>}
            color={C.primary}
            sub={`Nilai semua nota${outletId === '_all' ? ' · semua outlet' : ''}`}
          />
          <StatCard
            label={period === 'today' ? 'Total Pelunasan Hari Ini' : period === 'month' ? 'Total Pelunasan Bulan Ini' : 'Total Pelunasan (Akumulasi)'}
            value={rp(period === 'today' ? stats.pelunasan_today : period === 'month' ? stats.pelunasan_month : stats.total_pelunasan).replace('Rp ', 'Rp')}
            icon={<span style={{ fontFamily: 'Poppins', fontSize: 16, fontWeight: 800 }}>Rp</span>}
            color={C.success}
            sub="Uang yang sudah diterima"
          />
        </div>
        {/* Piutang row */}
        {(() => {
          const trx = period === 'today' ? stats.omset_today : period === 'month' ? stats.omset_month : stats.total_omset;
          const lun = period === 'today' ? stats.pelunasan_today : period === 'month' ? stats.pelunasan_month : stats.total_pelunasan;
          const piutang = Math.max(0, trx - lun);
          return piutang > 0 ? (
            <div style={{ background: '#FEF3C7', border: '1.5px solid #FDE68A', borderRadius: 12, padding: '10px 14px', marginBottom: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#92400E" strokeWidth="2.5" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                <span style={{ fontFamily: 'Poppins', fontSize: 12, fontWeight: 600, color: '#92400E' }}>Piutang (belum terbayar)</span>
              </div>
              <span style={{ fontFamily: 'Poppins', fontSize: 13, fontWeight: 700, color: '#92400E' }}>{rp(piutang)}</span>
            </div>
          ) : null;
        })()}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, paddingBottom: 4, marginBottom: 20 }}>
          <StatCard
            label={period === 'today' ? 'Nota hari ini' : period === 'month' ? 'Nota bulan ini' : 'Nota (akumulasi)'}
            value={period === 'today' ? stats.transaksi_today : period === 'month' ? stats.transaksi_month : stats.total_transaksi}
            icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>}
            color={C.info}
            sub={outletId === '_all' ? 'Semua outlet' : undefined}
          />
          <StatCard label="In Progress" value={stats.pending_transactions} icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>} color={C.warning} />
          <StatCard label="Customer" value={stats.total_customers} icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" /></svg>} color={C.success} />
        </div>

        {((showCompare && outletId !== '_all') || outletId === '_all') && stats.outlet_comparison && stats.outlet_comparison.length > 0 && (
          <div style={{ background: C.white, borderRadius: 16, padding: 14, marginBottom: 20, boxShadow: '0 2px 8px rgba(15,23,42,0.06)' }}>
            <div style={{ fontFamily: 'Poppins', fontSize: 14, fontWeight: 600, color: C.n900, marginBottom: 10 }}>
              Per outlet ({period === 'today' ? 'hari ini' : 'bulan ini'})
            </div>
            {stats.outlet_comparison.map((o) => (
              <div key={o.outletId} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: `1px solid ${C.n100}`, fontFamily: 'Poppins', fontSize: 12 }}>
                <span>{o.outletName}</span>
                <span style={{ fontWeight: 600 }}>{rp(o.omset).replace('Rp ', 'Rp')} · {o.transaksi} trx</span>
              </div>
            ))}
          </div>
        )}

        <div style={{ background: C.white, borderRadius: 16, padding: 16, marginBottom: 20, boxShadow: '0 2px 8px rgba(15,23,42,0.06)' }}>
          <div style={{ fontFamily: 'Poppins', fontSize: 14, fontWeight: 600, color: C.n900, marginBottom: 14 }}>Menu Admin</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
            {[
              { label: 'Shift kasir', screen: 'admin_shift', icon: '🕐', color: '#6366F1' },
              { label: 'Laporan pusat', screen: 'admin_laporan', icon: '📈', color: C.info },
              { label: 'Manajemen User', screen: 'manajemen_user', icon: '👥', color: C.primary },
              { label: 'Manajemen Layanan', screen: 'manajemen_layanan', icon: '🧺', color: '#14B8A6' },
              { label: 'Approval Center', screen: 'approval', icon: '✅', color: '#8B5CF6' },
              { label: 'Monitoring operasional', screen: 'monitoring', icon: '📊', color: C.success },
              { label: 'Manajemen promo', screen: 'admin_promo', icon: '🏷️', color: '#F59E0B' },
              { label: 'Stok & inventaris', screen: 'admin_stok', icon: '📦', color: '#0D9488' },
              { label: 'Rekap Pendapatan', screen: 'rekap_pendapatan', icon: '💰', color: '#059669' },
              { label: 'Info Outlet', screen: 'info_outlet', icon: '🏪', color: '#EC4899', needsOutlet: true },
              { label: 'General Report', screen: 'general_report', icon: '📋', color: '#7C3AED' },
              { label: 'Capaian Target', screen: 'admin_target', icon: '🎯', color: '#EA580C' },
              { label: 'Tutup Buku', screen: 'admin_period_close', icon: '📒', color: '#6366F1' },
              { label: 'Comparison', screen: 'comparison_report', icon: '⚖️', color: '#0891B2' },
              { label: 'Forecast', screen: 'forecast', icon: '🔮', color: '#7C3AED' },
            ].map((item) => (
              <button key={item.label} onClick={() => {
                if (item.needsOutlet) {
                  if (outletId && outletId !== '_all') navigate(item.screen, { outletId });
                  else if (outletId === '_all' && outlets.length > 0) navigate(item.screen, { outletId: outlets[0].id });
                  else alertWarning('Pilih outlet terlebih dahulu.');
                } else {
                  navigate(item.screen, outletId && outletId !== '_all' ? { outletId } : undefined);
                }
              }} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: '14px 8px', borderRadius: 12, background: C.n50, border: `1px solid ${C.n100}`, cursor: 'pointer' }}>
                <div style={{ width: 44, height: 44, borderRadius: 12, background: `${item.color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>{item.icon}</div>
                <span style={{ fontFamily: 'Poppins', fontSize: 12, fontWeight: 600, color: C.n900 }}>{item.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div style={{ background: C.white, borderRadius: 16, padding: '16px 16px 18px', boxShadow: '0 2px 8px rgba(15,23,42,0.06)' }}>
          <div style={{ fontFamily: 'Poppins', fontSize: 14, fontWeight: 600, color: C.n900, marginBottom: 8 }}>Data & pelaporan</div>
          <p style={{ fontFamily: 'Poppins', fontSize: 12, color: C.n600, lineHeight: 1.5, margin: '0 0 14px' }}>
            Pembuatan nota dan transaksi kasir tidak dibuka dari sini. Gunakan <strong>Laporan pusat</strong> untuk omset, filter outlet, agregasi harian/bulanan, dan grafik ringkas; <strong>Monitoring operasional</strong> untuk pantauan antrian dan status.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <button type="button" onClick={() => navigate('admin_laporan')} style={{ width: '100%', padding: '12px 14px', borderRadius: 12, border: 'none', cursor: 'pointer', fontFamily: 'Poppins', fontSize: 13, fontWeight: 600, color: 'white', background: `linear-gradient(135deg, ${C.primary}, #2563EB)` }}>
              Buka laporan pusat
            </button>
            <button type="button" onClick={() => navigate('monitoring')} style={{ width: '100%', padding: '12px 14px', borderRadius: 12, border: `1.5px solid ${C.n200}`, cursor: 'pointer', fontFamily: 'Poppins', fontSize: 13, fontWeight: 600, color: C.n800, background: C.n50 }}>
              Monitoring operasional
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
