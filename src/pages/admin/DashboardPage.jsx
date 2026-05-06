import { useState, useEffect } from 'react';
import axios from 'axios';
import { C } from '../../utils/theme';
import { rp } from '../../utils/helpers';
import { Avatar, Badge, SectionHeader, StatCard } from '../../components/ui';

export default function AdminDashboardPage({ user, navigate }) {
  const [stats, setStats] = useState({
    total_omset: 0,
    total_transaksi: 0,
    pending_transactions: 0,
    total_customers: 0,
  });
  const [recent, setRecent] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [statsRes, txRes] = await Promise.all([
          axios.get('/api/dashboard/stats'),
          axios.get('/api/transactions'),
        ]);
        if (statsRes?.data?.data) setStats(statsRes.data.data);
        setRecent((txRes?.data?.data || []).slice(0, 5));
      } catch (error) {
        console.error('Failed to fetch dashboard data:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  return (
    <div style={{ flex: 1, overflowY: 'auto', background: C.n50 }}>
      <div style={{ background: `linear-gradient(135deg, #430046, #2D0030)`, padding: '16px 20px 24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontFamily: 'Poppins', fontSize: 12, color: 'rgba(255,255,255,0.65)' }}>Selamat datang,</div>
            <div style={{ fontFamily: 'Poppins', fontSize: 18, fontWeight: 700, color: 'white' }}>{user.name.split(' ')[0]} 👋</div>
            <div style={{ fontFamily: 'Poppins', fontSize: 11, color: 'rgba(255,255,255,0.6)', marginTop: 2 }}>Admin · {user.outlet?.name}</div>
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
        <div style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 4, marginBottom: 20, scrollbarWidth: 'none' }}>
          <StatCard label="Total Omset" value={rp(stats.total_omset).replace('Rp ', 'Rp')} icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" /></svg>} color={C.primary} />
          <StatCard label="Transaksi" value={stats.total_transaksi} icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /></svg>} color="#0EA5E9" />
          <StatCard label="In Progress" value={stats.pending_transactions} icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>} color={C.warning} />
          <StatCard label="Customer" value={stats.total_customers} icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" /></svg>} color={C.success} />
        </div>

        <div style={{ background: C.white, borderRadius: 16, padding: 16, marginBottom: 20, boxShadow: '0 2px 8px rgba(15,23,42,0.06)' }}>
          <div style={{ fontFamily: 'Poppins', fontSize: 14, fontWeight: 600, color: C.n900, marginBottom: 14 }}>Menu Admin</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {[
              { label: 'Manajemen User', screen: 'manajemen_user', icon: '👥', color: C.primary },
              { label: 'Manajemen Layanan', screen: 'manajemen_layanan', icon: '🧺', color: '#0EA5E9' },
              { label: 'Approval Center', screen: 'approval', icon: '✅', color: '#8B5CF6' },
              { label: 'Monitoring', screen: 'monitoring', icon: '📊', color: C.success },
            ].map((item) => (
              <button key={item.label} onClick={() => navigate(item.screen)} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: '14px 8px', borderRadius: 12, background: C.n50, border: `1px solid ${C.n100}`, cursor: 'pointer' }}>
                <div style={{ width: 44, height: 44, borderRadius: 12, background: `${item.color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>{item.icon}</div>
                <span style={{ fontFamily: 'Poppins', fontSize: 12, fontWeight: 600, color: C.n900 }}>{item.label}</span>
              </button>
            ))}
          </div>
        </div>

        <SectionHeader title="Transaksi Terbaru" action={() => navigate('transaksi')} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: 20, color: C.n500, fontFamily: 'Poppins', fontSize: 13 }}>Memuat...</div>
          ) : recent.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 20, color: C.n500, fontFamily: 'Poppins', fontSize: 13 }}>Belum ada transaksi</div>
          ) : (
            recent.map((tx) => (
              <div key={tx.id} onClick={() => navigate('detail_transaksi', tx)} style={{ background: C.white, borderRadius: 14, padding: '12px 14px', boxShadow: '0 2px 8px rgba(15,23,42,0.05)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12 }}>
                <Avatar initials={tx.customerName?.split(' ').map((w) => w[0]).join('').slice(0, 2) || '??'} size={38} />
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ fontFamily: 'Poppins', fontSize: 13, fontWeight: 600, color: C.n900 }}>{tx.customerName}</div>
                    <div style={{ fontFamily: 'Poppins', fontSize: 12, fontWeight: 600, color: C.n900 }}>{rp(tx.total)}</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3 }}>
                    <div style={{ fontFamily: 'Poppins', fontSize: 11, color: C.n600 }}>{tx.id}</div>
                    <Badge status={tx.status} small />
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
