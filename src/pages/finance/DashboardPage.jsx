import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { C } from '../../utils/theme';
import { rp } from '../../utils/helpers';
import { Avatar, Badge, StatCard, Btn, SectionHeader } from '../../components/ui';
import OutletDropdown from '../../components/ui/OutletDropdown';

// ── Mini Bar Chart Component (pure CSS, no libraries) ────────────────────────
const RevenueChart = ({ data }) => {
  if (!data || data.length === 0) return null;
  const maxRevenue = Math.max(...data.map((d) => d.revenue), 1);

  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 120, padding: '0 4px' }}>
      {data.map((d, i) => {
        const heightPct = Math.max((d.revenue / maxRevenue) * 100, 3);
        const isToday = i === data.length - 1;
        return (
          <div key={d.date} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
            <div style={{ fontFamily: 'Poppins', fontSize: 8, color: C.n600, fontWeight: 500, whiteSpace: 'nowrap' }}>
              {d.revenue > 0 ? `${(d.revenue / 1000).toFixed(0)}k` : ''}
            </div>
            <div
              style={{
                width: '100%',
                maxWidth: 32,
                height: `${heightPct}%`,
                borderRadius: '6px 6px 2px 2px',
                background: isToday
                  ? `linear-gradient(180deg, ${C.primary}, ${C.primarySoft})`
                  : `linear-gradient(180deg, ${C.primaryLight}, ${C.secondary}44)`,
                transition: 'height 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)',
                minHeight: 4,
                boxShadow: isToday ? `0 2px 8px ${C.primary}33` : 'none',
              }}
            />
            <div style={{ fontFamily: 'Poppins', fontSize: 9, color: isToday ? C.primary : C.n500, fontWeight: isToday ? 700 : 400 }}>
              {new Date(d.date).toLocaleDateString('id-ID', { weekday: 'narrow' })}
            </div>
          </div>
        );
      })}
    </div>
  );
};

// ── Trend Indicator ──────────────────────────────────────────────────────────
const TrendBadge = ({ current, previous, label }) => {
  if (previous === 0 && current === 0) return null;
  const pct = previous > 0 ? Math.round(((current - previous) / previous) * 100) : current > 0 ? 100 : 0;
  const isUp = pct >= 0;
  return (
    <span style={{
      fontFamily: 'Poppins', fontSize: 10, fontWeight: 600,
      color: isUp ? '#10B981' : '#EF4444',
      background: isUp ? '#DCFCE744' : '#FEE2E244',
      padding: '2px 8px', borderRadius: 999,
      display: 'inline-flex', alignItems: 'center', gap: 3,
    }}>
      {isUp ? '▲' : '▼'} {Math.abs(pct)}% {label}
    </span>
  );
};

export default function FinanceDashboardPage({ user, navigate }) {
  const [stats, setStats] = useState(null);
  const [chartData, setChartData] = useState([]);
  const [recentTx, setRecentTx] = useState([]);
  const [loading, setLoading] = useState(true);
  const [outletId, setOutletId] = useState('');

  const fetchStats = useCallback(async () => {
    setLoading(true);
    try {
      const params = outletId ? `?outletId=${outletId}` : '';
      const [statsRes, reportRes] = await Promise.all([
        axios.get(`/api/finance/stats${params}`),
        axios.get(`/api/finance/report?startDate=${get7DaysAgo()}&endDate=${getToday()}${outletId ? `&outletId=${outletId}` : ''}`),
      ]);

      if (statsRes?.data?.data) setStats(statsRes.data.data);

      if (reportRes?.data?.data?.daily) {
        // Ensure we have exactly 7 days of data (fill gaps)
        const dailyMap = {};
        reportRes.data.data.daily.forEach((d) => { dailyMap[d.date] = d; });

        const days = [];
        for (let i = 6; i >= 0; i--) {
          const d = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
          days.push(dailyMap[d] || { date: d, revenue: 0, txCount: 0 });
        }
        setChartData(days);
      }

      // Fetch recent transactions for preview
      try {
        const txRes = await axios.get(`/api/transactions?${outletId ? `outletId=${outletId}&` : ''}status=semua`);
        setRecentTx((txRes?.data?.data || []).slice(0, 5));
      } catch { /* ignore */ }
    } catch (err) {
      console.error('[FinanceDash] fetchStats error:', err);
    } finally {
      setLoading(false);
    }
  }, [outletId]);

  useEffect(() => { fetchStats(); }, [fetchStats]);

  // Yesterday stats for comparison
  const yesterdayRevenue = chartData.length >= 2 ? chartData[chartData.length - 2]?.revenue || 0 : 0;

  return (
    <div style={{ flex: 1, overflowY: 'auto', background: C.n50 }}>
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div style={{ background: 'linear-gradient(135deg, #1E3A5F, #0F172A)', padding: '16px 20px 28px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontFamily: 'Poppins', fontSize: 12, color: 'rgba(255,255,255,0.65)' }}>Selamat datang,</div>
            <div style={{ fontFamily: 'Poppins', fontSize: 18, fontWeight: 700, color: 'white' }}>{user.name.split(' ')[0]} 👋</div>
            <div style={{ fontFamily: 'Poppins', fontSize: 11, color: 'rgba(255,255,255,0.6)', marginTop: 2 }}>Finance · {user.outlet?.name || 'All Outlet'}</div>
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <button onClick={() => navigate('notifikasi')} style={{ width: 40, height: 40, borderRadius: 20, background: 'rgba(255,255,255,0.15)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', position: 'relative' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 01-3.46 0" /></svg>
              {stats?.pending?.count > 0 && (
                <div style={{ position: 'absolute', top: 6, right: 6, width: 10, height: 10, borderRadius: 5, background: '#EF4444', border: '2px solid #1E3A5F' }} />
              )}
            </button>
            <Avatar photo={user.photo} initials={user.avatar} size={40} onClick={() => navigate('profil')} />
          </div>
        </div>

        {/* Revenue highlight in header */}
        {!loading && stats && (
          <div style={{ marginTop: 16, background: 'rgba(255,255,255,0.08)', borderRadius: 14, padding: '14px 16px', backdropFilter: 'blur(8px)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontFamily: 'Poppins', fontSize: 10, color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Omset Hari Ini</div>
                <div style={{ fontFamily: 'Poppins', fontSize: 24, fontWeight: 700, color: 'white', marginTop: 2 }}>
                  {rp(stats.today.revenue)}
                </div>
                <div style={{ marginTop: 4 }}>
                  <TrendBadge current={stats.today.revenue} previous={yesterdayRevenue} label="vs kemarin" />
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontFamily: 'Poppins', fontSize: 28, fontWeight: 700, color: 'rgba(255,255,255,0.9)' }}>{stats.today.txCount}</div>
                <div style={{ fontFamily: 'Poppins', fontSize: 10, color: 'rgba(255,255,255,0.6)' }}>Transaksi</div>
              </div>
            </div>
          </div>
        )}
      </div>

      <div style={{ padding: '0 16px', marginTop: -12, paddingBottom: 16 }}>
        {/* ── Outlet selector ─────────────────────────────────────────── */}
        {stats?.outlets?.length > 1 && (
          <OutletDropdown value={outletId} onChange={setOutletId} outlets={stats.outlets} />
        )}

        {loading ? (
          <div style={{ textAlign: 'center', padding: 40, fontFamily: 'Poppins', fontSize: 13, color: C.n500 }}>Memuat data...</div>
        ) : stats && (
          <>
            {/* ── Stat Cards Row ─────────────────────────────────────── */}
            <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 4, marginBottom: 16, scrollbarWidth: 'none' }}>
              <StatCard label="Minggu Ini" value={rp(stats.week.revenue).replace('Rp ', 'Rp')} sub={`${stats.week.txCount} transaksi`} icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>} color="#0EA5E9" />
              <StatCard label="Bulan Ini" value={rp(stats.month.revenue).replace('Rp ', 'Rp')} sub={`${stats.month.txCount} transaksi`} icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21.21 15.89A10 10 0 118 2.83" /><path d="M22 12A10 10 0 0012 2v10z" /></svg>} color={C.success} />
              <StatCard
                label="Perlu Verifikasi"
                value={stats.pending.count}
                sub={stats.pending.count > 0 ? rp(stats.pending.amount) : 'Semua OK'}
                icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>}
                color={stats.pending.count > 0 ? C.warning : C.success}
                onClick={() => navigate('verifikasi_payment')}
              />
            </div>

            {/* ── Revenue Chart (7 Days) ─────────────────────────────── */}
            {chartData.length > 0 && (
              <div style={{ background: C.white, borderRadius: 16, padding: 16, marginBottom: 16, boxShadow: '0 2px 8px rgba(15,23,42,0.06)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                  <div style={{ fontFamily: 'Poppins', fontSize: 14, fontWeight: 600, color: C.n900 }}>📊 Trend Revenue 7 Hari</div>
                  <div style={{ fontFamily: 'Poppins', fontSize: 11, color: C.n500 }}>
                    Total: {rp(chartData.reduce((s, d) => s + d.revenue, 0))}
                  </div>
                </div>
                <RevenueChart data={chartData} />
              </div>
            )}

            {/* ── Pending verification alert ─────────────────────────── */}
            {stats.pending.count > 0 && (
              <div
                onClick={() => navigate('verifikasi_payment')}
                style={{
                  background: 'linear-gradient(135deg, #FEF3C7, #FDE68A44)',
                  borderRadius: 14, padding: '14px 16px', marginBottom: 16, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: 12,
                  border: '1px solid #F59E0B22',
                  transition: 'transform 0.2s',
                }}
              >
                <div style={{ width: 46, height: 46, borderRadius: 12, background: '#FBBF2422', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24 }}>💳</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: 'Poppins', fontSize: 13, fontWeight: 600, color: '#92400E' }}>
                    {stats.pending.count} pembayaran menunggu verifikasi
                  </div>
                  <div style={{ fontFamily: 'Poppins', fontSize: 11, color: '#B45309', marginTop: 2 }}>
                    Total: {rp(stats.pending.amount)}
                  </div>
                </div>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#92400E" strokeWidth="2" strokeLinecap="round"><polyline points="9 18 15 12 9 6" /></svg>
              </div>
            )}

            {/* ── Quick Menu ─────────────────────────────────────────── */}
            <div style={{ background: C.white, borderRadius: 16, padding: 16, marginBottom: 16, boxShadow: '0 2px 8px rgba(15,23,42,0.06)' }}>
              <div style={{ fontFamily: 'Poppins', fontSize: 14, fontWeight: 600, color: C.n900, marginBottom: 14 }}>Menu Finance</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 8 }}>
                {[
                  { label: 'Verifikasi', screen: 'verifikasi_payment', icon: '✅', color: C.success },
                  { label: 'Laporan', screen: 'laporan_keuangan', icon: '📊', color: '#0EA5E9' },
                  { label: 'Monitoring', screen: 'monitoring', icon: '📈', color: C.primary },
                  { label: 'Member', screen: 'daftar_member', icon: '👥', color: '#8B5CF6' },
                ].map((item) => (
                  <button key={item.label} onClick={() => navigate(item.screen)} style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                    padding: '12px 4px', borderRadius: 12, background: C.n50,
                    border: `1px solid ${C.n100}`, cursor: 'pointer',
                    transition: 'background 0.2s, transform 0.2s',
                  }}>
                    <div style={{ width: 38, height: 38, borderRadius: 10, background: `${item.color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>{item.icon}</div>
                    <span style={{ fontFamily: 'Poppins', fontSize: 10, fontWeight: 600, color: C.n900 }}>{item.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* ── Revenue Summary Card ───────────────────────────────── */}
            <div style={{ background: C.white, borderRadius: 16, padding: 16, marginBottom: 16, boxShadow: '0 2px 8px rgba(15,23,42,0.06)' }}>
              <div style={{ fontFamily: 'Poppins', fontSize: 14, fontWeight: 600, color: C.n900, marginBottom: 14 }}>Ringkasan Omset</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[
                  { label: 'Hari Ini', value: rp(stats.today.revenue), count: `${stats.today.txCount} transaksi`, color: C.primary, icon: '📅' },
                  { label: 'Minggu Ini', value: rp(stats.week.revenue), count: `${stats.week.txCount} transaksi`, color: '#0EA5E9', icon: '📆' },
                  { label: 'Bulan Ini', value: rp(stats.month.revenue), count: `${stats.month.txCount} transaksi`, color: C.success, icon: '🗓️' },
                ].map((item) => (
                  <div key={item.label} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '12px 14px', background: C.n50, borderRadius: 12,
                    borderLeft: `3px solid ${item.color}`,
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontSize: 16 }}>{item.icon}</span>
                      <div>
                        <div style={{ fontFamily: 'Poppins', fontSize: 12, fontWeight: 500, color: C.n600 }}>{item.label}</div>
                        <div style={{ fontFamily: 'Poppins', fontSize: 10, color: C.n500 }}>{item.count}</div>
                      </div>
                    </div>
                    <div style={{ fontFamily: 'Poppins', fontSize: 15, fontWeight: 700, color: item.color }}>{item.value}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* ── Recent Transactions ────────────────────────────────── */}
            {recentTx.length > 0 && (
              <div style={{ background: C.white, borderRadius: 16, padding: 16, marginBottom: 16, boxShadow: '0 2px 8px rgba(15,23,42,0.06)' }}>
                <SectionHeader title="Transaksi Terbaru" action={() => navigate('transaksi')} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {recentTx.map((tx) => (
                    <div key={tx.id} onClick={() => navigate('detail_transaksi', tx)} style={{
                      display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
                      background: C.n50, borderRadius: 12, cursor: 'pointer',
                      transition: 'background 0.2s',
                    }}>
                      <Avatar initials={tx.customerName?.split(' ').map((w) => w[0]).join('').slice(0, 2) || '??'} size={34} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontFamily: 'Poppins', fontSize: 12, fontWeight: 600, color: C.n900, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tx.customerName}</div>
                        <div style={{ fontFamily: 'Poppins', fontSize: 10, color: C.n600 }}>{tx.id} · {tx.date}</div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontFamily: 'Poppins', fontSize: 12, fontWeight: 700, color: C.primary }}>{rp(tx.total)}</div>
                        <Badge status={tx.status} small />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ── Date helpers ──────────────────────────────────────────────────────────────
function getToday() { return new Date().toISOString().slice(0, 10); }
function get7DaysAgo() { return new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10); }
