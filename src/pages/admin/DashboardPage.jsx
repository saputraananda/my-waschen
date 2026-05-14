import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { C } from '../../utils/theme';
import { rp } from '../../utils/helpers';
import { Avatar, StatCard } from '../../components/ui';

export default function AdminDashboardPage({ user, navigate }) {
  const [outlets, setOutlets] = useState([]);
  const [outletId, setOutletId] = useState('');
  const [period, setPeriod] = useState('all');
  const [showCompare, setShowCompare] = useState(false);
  const [stats, setStats] = useState({
    total_omset: 0,
    total_transaksi: 0,
    omset_today: 0,
    transaksi_today: 0,
    omset_month: 0,
    transaksi_month: 0,
    pending_transactions: 0,
    total_customers: 0,
    outlet_comparison: null,
  });
  const [statsError, setStatsError] = useState('');

  useEffect(() => {
    axios.get('/api/master/outlets').then((r) => setOutlets(r?.data?.data || [])).catch(() => setOutlets([]));
  }, []);

  const fetchStats = useCallback(async () => {
    if (!outletId) {
      setStatsError('Pilih outlet untuk memuat omset dan transaksi.');
      return;
    }
    setStatsError('');
    try {
      const q = new URLSearchParams({ outletId, period });
      if (showCompare && (period === 'today' || period === 'month')) q.set('compare', '1');
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

  return (
    <div style={{ flex: 1, overflowY: 'auto', background: C.n50 }}>
      <div style={{ background: `linear-gradient(135deg, #430046, #2D0030)`, padding: '16px 20px 24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontFamily: 'Poppins', fontSize: 12, color: 'rgba(255,255,255,0.65)' }}>Selamat datang,</div>
            <div style={{ fontFamily: 'Poppins', fontSize: 18, fontWeight: 700, color: 'white' }}>{user.name.split(' ')[0]} 👋</div>
            <div style={{ fontFamily: 'Poppins', fontSize: 11, color: 'rgba(255,255,255,0.6)', marginTop: 2 }}>Admin · filter outlet wajib</div>
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <button onClick={() => navigate('notifikasi')} style={{ width: 40, height: 40, borderRadius: 20, background: 'rgba(255,255,255,0.15)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 01-3.46 0" /></svg>
            </button>
            <Avatar photo={user.photo} initials={user.avatar} size={40} onClick={() => navigate('profil')} />
          </div>
        </div>
      </div>

      <div style={{ padding: '0 16px', marginTop: -12, paddingBottom: 16 }}>
        <div style={{ background: C.white, borderRadius: 14, padding: 14, marginBottom: 12, boxShadow: '0 2px 8px rgba(15,23,42,0.06)' }}>
          <div style={{ fontFamily: 'Poppins', fontSize: 12, fontWeight: 600, color: C.n800, marginBottom: 8 }}>Outlet</div>
          <select
            value={outletId}
            onChange={(e) => setOutletId(e.target.value)}
            style={{ width: '100%', height: 44, borderRadius: 10, border: `1.5px solid ${C.n300}`, fontFamily: 'Poppins', fontSize: 14 }}
          >
            <option value="">— Pilih outlet —</option>
            {outlets.map((o) => (
              <option key={o.id} value={o.id}>{o.name}</option>
            ))}
          </select>
          <div style={{ fontFamily: 'Poppins', fontSize: 11, color: C.n600, marginTop: 8, lineHeight: 1.45 }}>
            Statistik omset dan transaksi di bawah mengikuti outlet yang dipilih.
          </div>
        </div>

        {statsError && (
          <div style={{ background: '#FEF2F2', color: '#991B1B', padding: 12, borderRadius: 12, fontFamily: 'Poppins', fontSize: 13, marginBottom: 12 }}>
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

        {(period === 'today' || period === 'month') && (
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontFamily: 'Poppins', fontSize: 12, color: C.n700, marginBottom: 12 }}>
            <input type="checkbox" checked={showCompare} onChange={(e) => setShowCompare(e.target.checked)} />
            Bandingkan semua outlet (omset periode sama)
          </label>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, paddingBottom: 4, marginBottom: 20 }}>
          <StatCard
            label={period === 'today' ? 'Omset hari ini' : period === 'month' ? 'Omset bulan ini' : 'Omset (akumulasi)'}
            value={rp(period === 'today' ? stats.omset_today : period === 'month' ? stats.omset_month : stats.total_omset).replace('Rp ', 'Rp')}
            icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" /></svg>}
            color={C.primary}
          />
          <StatCard
            label={period === 'today' ? 'Transaksi hari ini' : period === 'month' ? 'Transaksi bulan ini' : 'Transaksi (akumulasi)'}
            value={period === 'today' ? stats.transaksi_today : period === 'month' ? stats.transaksi_month : stats.total_transaksi}
            icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /></svg>}
            color="#0EA5E9"
          />
          <StatCard label="In Progress" value={stats.pending_transactions} icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>} color={C.warning} />
          <StatCard label="Customer" value={stats.total_customers} icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" /></svg>} color={C.success} />
        </div>

        {showCompare && stats.outlet_comparison && stats.outlet_comparison.length > 0 && (
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
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {[
              { label: 'Shift kasir', screen: 'admin_shift', icon: '🕐', color: '#6366F1' },
              { label: 'Laporan pusat', screen: 'admin_laporan', icon: '📈', color: '#0EA5E9' },
              { label: 'Manajemen User', screen: 'manajemen_user', icon: '👥', color: C.primary },
              { label: 'Manajemen Layanan', screen: 'manajemen_layanan', icon: '🧺', color: '#14B8A6' },
              { label: 'Approval Center', screen: 'approval', icon: '✅', color: '#8B5CF6' },
              { label: 'Monitoring operasional', screen: 'monitoring', icon: '📊', color: C.success },
              { label: 'Manajemen promo', screen: 'admin_promo', icon: '🏷️', color: '#F59E0B' },
              { label: 'Stok & inventaris', screen: 'admin_stok', icon: '📦', color: '#0D9488' },
              { label: 'Rekap Pendapatan', screen: 'rekap_pendapatan', icon: '💰', color: '#059669' },
              { label: 'Info Outlet', screen: 'info_outlet', icon: '🏪', color: '#EC4899', needsOutlet: true },
            ].map((item) => (
              <button key={item.label} onClick={() => item.needsOutlet ? (outletId ? navigate(item.screen, { outletId }) : alert('Pilih outlet terlebih dahulu.')) : navigate(item.screen)} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: '14px 8px', borderRadius: 12, background: C.n50, border: `1px solid ${C.n100}`, cursor: 'pointer' }}>
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
