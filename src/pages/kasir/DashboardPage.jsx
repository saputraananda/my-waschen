import { useState, useEffect } from 'react';
import axios from 'axios';
import { C } from '../../utils/theme';
import { rp } from '../../utils/helpers';
import { Avatar, Badge, SectionHeader, StatCard } from '../../components/ui';

export default function KasirDashboardPage({ user, navigate }) {
  const [stats, setStats] = useState({ total: 0, express: 0, pending: 0, completed: 0 });
  const [recent, setRecent] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchStats = async () => {
      setLoading(true);
      try {
        const res = await axios.get('/api/transactions/dashboard/stats');
        if (res?.data?.data) {
          setStats(res.data.data.today);
          setRecent(res.data.data.recent || []);
        }
      } catch (error) {
        console.error('Failed to fetch dashboard stats:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);

  const QUICK = [
    { label: 'Nota Baru', icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>, screen: 'nota_step1', color: C.primary },
    { label: 'Cari Customer', icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>, screen: 'customer', color: '#0EA5E9' },
    { label: 'Pickup / Delivery', icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="1" y="3" width="15" height="13" /><polygon points="16 8 20 8 23 11 23 16 16 16 16 8" /><circle cx="5.5" cy="18.5" r="2.5" /><circle cx="18.5" cy="18.5" r="2.5" /></svg>, screen: 'transaksi', color: C.warning },
    { label: 'Riwayat', icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="1 4 1 10 7 10" /><path d="M3.51 15a9 9 0 1 0 .49-3.5" /></svg>, screen: 'transaksi', color: C.success },
  ];

  return (
    <div style={{ flex: 1, overflowY: 'auto', background: C.n50 }}>
      <div style={{ background: `linear-gradient(135deg, ${C.primary}, ${C.primaryDark})`, padding: '16px 20px 24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontFamily: 'Poppins', fontSize: 12, color: 'rgba(255,255,255,0.65)' }}>Hai,</div>
            <div style={{ fontFamily: 'Poppins', fontSize: 18, fontWeight: 700, color: 'white' }}>{user.name.split(' ')[0]} 👋</div>
            <div style={{ fontFamily: 'Poppins', fontSize: 11, color: 'rgba(255,255,255,0.6)', marginTop: 2 }}>{user.outlet?.name || 'Waschen Kemang'}</div>
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <button onClick={() => navigate('notifikasi')} style={{ width: 40, height: 40, borderRadius: 20, background: 'rgba(255,255,255,0.15)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', position: 'relative' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 01-3.46 0" /></svg>
              <div style={{ position: 'absolute', top: 8, right: 8, width: 8, height: 8, borderRadius: 4, background: C.danger, border: '2px solid white' }} />
            </button>
            <Avatar initials={user.avatar} size={40} />
          </div>
        </div>
      </div>

      <div style={{ padding: '0 16px', marginTop: -12, paddingBottom: 16 }}>
        <div style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 4, marginBottom: 20, scrollbarWidth: 'none' }}>
          <StatCard label="Transaksi Hari Ini" value={stats.total} icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><polyline points="14 2 14 8 20 8" /></svg>} color={C.primary} />
          <StatCard label="Express Aktif" value={stats.express} icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" /></svg>} color={C.warning} sub="⚡ Prioritas" />
          <StatCard label="In Progress" value={stats.pending} icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>} color="#0EA5E9" />
          <StatCard label="Selesai" value={stats.completed} icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="20 6 9 17 4 12" /></svg>} color={C.success} />
        </div>

        <div style={{ background: C.white, borderRadius: 16, padding: 16, marginBottom: 20, boxShadow: '0 2px 8px rgba(15,23,42,0.06)' }}>
          <div style={{ fontFamily: 'Poppins', fontSize: 14, fontWeight: 600, color: C.n900, marginBottom: 14 }}>Aksi Cepat</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {QUICK.map((q) => (
              <button key={q.label} onClick={() => navigate(q.screen)} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: '14px 8px', borderRadius: 12, background: C.n50, border: `1px solid ${C.n100}`, cursor: 'pointer' }}>
                <div style={{ width: 44, height: 44, borderRadius: 12, background: `${q.color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: q.color }}>{q.icon}</div>
                <span style={{ fontFamily: 'Poppins', fontSize: 12, fontWeight: 600, color: C.n900 }}>{q.label}</span>
              </button>
            ))}
          </div>
        </div>

        <SectionHeader title="Transaksi Terbaru" action={() => navigate('transaksi')} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: 20, color: C.n500, fontFamily: 'Poppins', fontSize: 13 }}>Memuat...</div>
          ) : recent.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 20, color: C.n500, fontFamily: 'Poppins', fontSize: 13 }}>Belum ada transaksi hari ini</div>
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
                    {tx.items?.some((i) => i.express) && <span style={{ background: '#FEF3C7', color: C.warning, fontFamily: 'Poppins', fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 999 }}>⚡ Express</span>}
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
