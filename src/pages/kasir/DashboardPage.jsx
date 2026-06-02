import { useState, useEffect, useRef, useMemo } from 'react';
import axios from 'axios';
import { C, T } from '../../utils/theme';
import { rp } from '../../utils/helpers';
import { Avatar, Badge, SectionHeader, useAppRefresh } from '../../components/ui';
import TodayTargetWidget from '../../components/TodayTargetWidget';
import { useRealtimeMulti } from '../../utils/realtime';

const WIB_FORMATTER = new Intl.DateTimeFormat('id-ID', { timeZone: 'Asia/Jakarta', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
const WIB_TIME = new Intl.DateTimeFormat('id-ID', { timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
const SHIFT_LABEL = { pagi: 'Pagi', siang: 'Siang', malam: 'Malam', full: 'Full Day' };

const STATUS_META = {
  baru: { label: 'Baru', color: '#2563EB', bg: '#EFF6FF' },
  diproses: { label: 'Proses', color: '#D97706', bg: '#FFFBEB' },
  selesai: { label: 'Selesai', color: C.success, bg: '#ECFDF5' },
  siap_diambil: { label: 'Siap Ambil', color: '#7C3AED', bg: '#F5F3FF' },
  selesai_diambil: { label: 'Diambil', color: C.n500, bg: '#F1F5F9' },
  dibatalkan: { label: 'Batal', color: C.danger, bg: '#FEF2F2' },
};

function fmtElapsed(openedAt) {
  if (!openedAt) return '';
  const ms = Date.now() - new Date(openedAt).getTime();
  if (ms < 0) return '';
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  return h > 0 ? `${h}j ${m}m` : `${m}m`;
}

function fmtTime(v) {
  if (!v) return '';
  return new Date(v).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit', hour12: false });
}

export default function KasirDashboardPage({ user, navigate }) {
  const [stats, setStats] = useState({ total: 0, omset: 0, totalPelunasan: 0, express: 0, pending: 0, completed: 0 });
  const [activeQueue, setActiveQueue] = useState({ total: 0, process: 0, ready: 0 });
  const [recent, setRecent] = useState([]);
  const [loading, setLoading] = useState(false);
  const [target, setTarget] = useState(null);
  const [periodAlert, setPeriodAlert] = useState(null);
  const [alertDismissed, setAlertDismissed] = useState(false);
  const [clock, setClock] = useState(() => {
    const n = new Date();
    return { date: WIB_FORMATTER.format(n), time: WIB_TIME.format(n) };
  });
  const [shift, setShift] = useState(null);
  const [elapsed, setElapsed] = useState('');

  // ── Top Up: customer picker (advanced search + filter) ───────────────────
  const [topupSheet, setTopupSheet] = useState(false);
  const [topupSearch, setTopupSearch] = useState('');
  const [topupFilter, setTopupFilter] = useState('all'); // all, member, has_deposit
  const [topupList, setTopupList] = useState([]);
  const [topupLookup, setTopupLookup] = useState([]);
  const [topupLoading, setTopupLoading] = useState(false);
  const [topupSearching, setTopupSearching] = useState(false);
  const topupDebounce = useRef(null);

  const TOPUP_FILTERS = [
    { key: 'all', label: 'Semua', icon: '👥' },
    { key: 'member', label: 'Member', icon: '⭐' },
    { key: 'has_deposit', label: 'Ada Saldo', icon: '💰' },
  ];

  const openTopupSheet = () => {
    setTopupSearch('');
    setTopupFilter('all');
    setTopupLookup([]);
    setTopupSheet(true);
    setTopupLoading(true);
    axios.get('/api/customers?limit=300&sort=name_asc')
      .then((r) => setTopupList(r?.data?.data || []))
      .catch(() => setTopupList([]))
      .finally(() => setTopupLoading(false));
  };

  useEffect(() => {
    if (!topupSheet) return;
    clearTimeout(topupDebounce.current);
    if (!topupSearch.trim()) {
      setTopupLookup([]);
      setTopupSearching(false);
      return;
    }
    topupDebounce.current = setTimeout(async () => {
      setTopupSearching(true);
      try {
        const res = await axios.get(`/api/customers/lookup?q=${encodeURIComponent(topupSearch)}&limit=30`);
        setTopupLookup(res?.data?.data || []);
      } catch { setTopupLookup([]); }
      finally { setTopupSearching(false); }
    }, 250);
    return () => clearTimeout(topupDebounce.current);
  }, [topupSearch, topupSheet]);

  const topupDisplayList = useMemo(() => {
    let base = topupSearch.trim() ? topupLookup : topupList;
    if (topupFilter === 'member') {
      base = base.filter((c) => c.isMember || c.membershipStatus === 'active');
    } else if (topupFilter === 'has_deposit') {
      base = base.filter((c) => Number(c.depositBalance ?? c.deposit ?? 0) > 0);
    }
    return base;
  }, [topupSearch, topupLookup, topupList, topupFilter]);

  const selectTopupCustomer = (c) => {
    setTopupSheet(false);
    navigate('topup_deposit', c);
  };

  useEffect(() => {
    const tick = () => {
      const n = new Date();
      setClock({ date: WIB_FORMATTER.format(n), time: WIB_TIME.format(n) });
      if (shift?.isOpen && shift.session?.openedAt) setElapsed(fmtElapsed(shift.session.openedAt));
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [shift]);

  const loadDashboard = async () => {
    setLoading(true);
    try {
      const [resStats, resShift, resTarget] = await Promise.all([
        axios.get('/api/transactions/dashboard/stats'),
        axios.get('/api/shifts/status'),
        axios.get('/api/targets/progress').catch(() => null),
      ]);
      if (resStats?.data?.data) {
        setStats(resStats.data.data.today);
        setActiveQueue(resStats.data.data.active || { total: 0, process: 0, ready: 0 });
        setRecent(resStats.data.data.recent || []);
      }
      if (resShift?.data?.success !== false) setShift(resShift.data);
      if (resTarget?.data?.data) setTarget(resTarget.data.data);

      // Ambil info periode untuk alert tutup buku
      try {
        const resPeriod = await axios.get('/api/periods/current');
        const pd = resPeriod?.data?.data;
        if (pd && !pd.alreadyClosed && pd.daysLeft <= 3) {
          const dismissKey = `period_alert_dismissed_${pd.periodStart}`;
          if (!sessionStorage.getItem(dismissKey)) setPeriodAlert(pd);
        }
      } catch (_) { }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadDashboard(); }, []);

  // Pull-to-refresh
  useAppRefresh(() => loadDashboard(), []);

  // Realtime: refresh dashboard saat ada checkout baru / payment masuk / cash low
  useRealtimeMulti(['transaction:checkout', 'payment:settled', 'cash:low'], () => {
    loadDashboard();
  });

  const shiftOpen = shift?.isOpen || shift?.bypass;

  const QUICK = [
    { label: 'Nota Baru', icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>, action: () => shiftOpen ? navigate('nota_step1') : navigate('kasir_shift'), color: C.primary },
    { label: 'Antrian & Nota', icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" /><line x1="3" y1="6" x2="3.01" y2="6" /><line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" /></svg>, action: () => navigate('transaksi'), color: '#7C3AED', badge: activeQueue.total > 0 ? activeQueue.total : null },
    { label: 'Customer', icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 00-3-3.87" /><path d="M16 3.13a4 4 0 010 7.75" /></svg>, action: () => navigate('customer'), color: '#0EA5E9' },
    { label: 'Top Up', icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="2" y="5" width="20" height="14" rx="2" /><line x1="2" y1="10" x2="22" y2="10" /></svg>, action: () => openTopupSheet(), color: '#EC4899' },
    { label: 'Laporan', icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M3 3v18h18" /><path d="M7 14l4-4 4 4 6-6" /></svg>, action: () => navigate('kasir_laporan'), color: '#16A34A' },
    { label: 'Shift', icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>, action: () => navigate('kasir_shift'), color: C.warning },
    { label: 'Kelola Layanan', icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" /></svg>, action: () => navigate('kelola_layanan_outlet'), color: '#14B8A6' },
    { label: 'Kas Outlet', icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"/><path d="M3 5v14a2 2 0 0 0 2 2h16v-5"/><path d="M18 12a2 2 0 0 0 0 4h4v-4Z"/></svg>, action: () => navigate('kas_outlet'), color: '#10B981' },
    { label: 'Request Barang', icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/><line x1="9" y1="14" x2="15" y2="14"/><line x1="12" y1="11" x2="12" y2="17"/></svg>, action: () => navigate('request_barang'), color: '#F97316' },
  ];

  const STAT_ITEMS = [
    { label: 'Transaksi', value: stats.total, color: C.primary, icon: '🧾' },
    { label: 'Omset', value: rp(stats.omset), color: C.success, icon: '💰', wide: true },
    { label: 'Proses', value: stats.pending, color: C.info, icon: '⏳' },
    { label: 'Express', value: stats.express, color: C.warning, icon: '⚡' },
    { label: 'Selesai', value: stats.completed, color: C.success, icon: '✅' },
  ];

  return (
    <>
      <div style={{ flex: 1, overflowY: 'auto', background: C.n50 }}>

        {/* ── HEADER ── */}
        <div style={{ background: `linear-gradient(140deg, ${C.primary} 0%, ${C.primaryDark || '#3B0040'} 100%)`, padding: '18px 20px 40px', position: 'relative', overflow: 'hidden' }}>
          {/* decorative circle */}
          <div style={{ position: 'absolute', top: -30, right: -30, width: 140, height: 140, borderRadius: 70, background: 'rgba(255,255,255,0.06)', pointerEvents: 'none' }} />
          <div style={{ position: 'absolute', bottom: -40, left: -20, width: 100, height: 100, borderRadius: 50, background: 'rgba(255,255,255,0.04)', pointerEvents: 'none' }} />

          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', position: 'relative' }}>
            <div>
              <div style={{ fontFamily: 'Poppins', fontSize: 11, color: 'rgba(255,255,255,0.6)' }}>{clock.date}</div>
              <div style={{ fontFamily: 'Poppins', fontSize: 22, fontWeight: 800, color: 'white', marginTop: 2, letterSpacing: '-0.3px' }}>
                Halo, {user.name.split(' ')[0]} 👋
              </div>
              <div style={{ fontFamily: 'Poppins', fontSize: 12, color: 'rgba(255,255,255,0.7)', marginTop: 2 }}>
                {user.outlet?.name || 'Waschen'} · <span style={{ fontWeight: 700, color: 'rgba(255,255,255,0.9)' }}>{clock.time} WIB</span>
              </div>

              {/* Shift badge */}
              <div style={{ marginTop: 10 }}>
                {shift ? (
                  <div
                    onClick={() => navigate('kasir_shift')}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: shiftOpen ? 'rgba(5,150,105,0.85)' : 'rgba(220,38,38,0.75)', padding: '5px 12px', borderRadius: 999, cursor: 'pointer', backdropFilter: 'blur(4px)' }}
                  >
                    <span style={{ width: 6, height: 6, borderRadius: 3, background: 'white', display: 'inline-block', ...(shiftOpen ? { animation: 'pulse 2s ease-in-out infinite' } : {}) }} />
                    <span style={{ fontFamily: 'Poppins', fontSize: 11, fontWeight: 700, color: 'white' }}>
                      {shift.bypass ? 'Akses Khusus' : shiftOpen ? `Shift · ${fmtTime(shift.session?.openedAt)}` : 'Shift Tutup — Ketuk untuk buka'}
                    </span>
                    {shiftOpen && elapsed && (
                      <span style={{ fontFamily: 'Poppins', fontSize: 10, color: 'rgba(255,255,255,0.8)', borderLeft: '1px solid rgba(255,255,255,0.3)', paddingLeft: 6 }}>
                        ⏱ {elapsed}
                      </span>
                    )}
                  </div>
                ) : (
                  <div style={{ height: 28, width: 120, borderRadius: 999, background: 'rgba(255,255,255,0.1)' }} />
                )}
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <button onClick={() => navigate('notifikasi')} style={{ width: 38, height: 38, borderRadius: 19, background: 'rgba(255,255,255,0.15)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', position: 'relative' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 01-3.46 0" /></svg>
                <div style={{ position: 'absolute', top: 7, right: 7, width: 7, height: 7, borderRadius: 4, background: C.danger, border: '1.5px solid white' }} />
              </button>
              <Avatar photo={user.photo} initials={user.avatar} size={38} onClick={() => navigate('profil')} />
            </div>
          </div>
        </div>

        {/* ── OMSET HERO CARD ── */}
        <div style={{ padding: '0 16px', marginTop: -18, position: 'relative', zIndex: 2 }}>
          <div style={{ background: C.white, borderRadius: 18, padding: '20px 18px 16px', boxShadow: '0 4px 24px rgba(15,23,42,0.13)', marginBottom: 14 }}>
            {/* Top row: Total Transaksi + Divider + Total Pelunasan */}
            <div style={{ display: 'flex', alignItems: 'stretch', gap: 0, marginBottom: 12 }}>
              {/* Total Transaksi */}
              <div style={{ flex: 1, paddingRight: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 5 }}>
                  <div style={{ width: 24, height: 24, borderRadius: 7, background: `${C.primary}15`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={C.primary} strokeWidth="2.5" strokeLinecap="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><polyline points="14 2 14 8 20 8" /></svg>
                  </div>
                  <span style={{ fontFamily: 'Poppins', fontSize: 10, fontWeight: 600, color: C.n500 }}>Total Transaksi</span>
                </div>
                <div style={{ fontFamily: 'Poppins', fontSize: 19, fontWeight: 800, color: C.primary, letterSpacing: '-0.5px' }}>
                  {loading ? '—' : rp(stats.omset)}
                </div>
                <div style={{ fontFamily: 'Poppins', fontSize: 9, color: C.n400, marginTop: 2 }}>Nilai semua nota hari ini</div>
              </div>
              <div style={{ width: 1, background: C.n100, flexShrink: 0, alignSelf: 'stretch' }} />
              {/* Total Pelunasan */}
              <div style={{ flex: 1, paddingLeft: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 5 }}>
                  <div style={{ width: 24, height: 24, borderRadius: 7, background: `${C.success}15`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={C.success} strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" /></svg>
                  </div>
                  <span style={{ fontFamily: 'Poppins', fontSize: 10, fontWeight: 600, color: C.n500 }}>Total Pelunasan</span>
                </div>
                <div style={{ fontFamily: 'Poppins', fontSize: 19, fontWeight: 800, color: C.success, letterSpacing: '-0.5px' }}>
                  {loading ? '—' : rp(stats.totalPelunasan)}
                </div>
                <div style={{ fontFamily: 'Poppins', fontSize: 9, color: C.n400, marginTop: 2 }}>Uang sudah diterima kasir</div>
              </div>
            </div>

            {/* Piutang bar */}
            {!loading && stats.omset > 0 && (
              <div style={{ background: C.n50, borderRadius: 10, padding: '7px 12px', marginBottom: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={C.warning} strokeWidth="2.5" strokeLinecap="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
                  <span style={{ fontFamily: 'Poppins', fontSize: 10, fontWeight: 600, color: C.n600 }}>Belum terbayar (piutang)</span>
                </div>
                <span style={{ fontFamily: 'Poppins', fontSize: 11, fontWeight: 700, color: stats.omset - stats.totalPelunasan > 0 ? C.warning : C.success }}>
                  {rp(Math.max(0, stats.omset - stats.totalPelunasan))}
                </span>
              </div>
            )}

            {/* Nota count inline */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <div style={{ width: 22, height: 22, borderRadius: 6, background: `${C.info}15`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={C.info} strokeWidth="2.5" strokeLinecap="round"><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /></svg>
              </div>
              <span style={{ fontFamily: 'Poppins', fontSize: 11, color: C.n600 }}>
                <strong style={{ color: C.n900 }}>{loading ? '—' : stats.total}</strong> nota dibuat hari ini
              </span>
            </div>

            {/* Mini stat row — tap untuk ke halaman terkait */}
            <div style={{ display: 'flex', gap: 0, marginTop: 12, borderTop: `1px solid ${C.n100}`, paddingTop: 10 }}>
              {[
                { label: 'Express', desc: 'Layanan kilat', val: stats.express, color: C.warning, onClick: () => navigate('transaksi', { onlyExpress: true, period: 'today', status: 'semua' }), icon: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" /></svg> },
                { label: 'Proses', desc: 'Sedang dikerjakan', val: stats.pending, color: C.info, onClick: () => navigate('transaksi', { status: 'proses' }), icon: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg> },
                { label: 'Selesai', desc: 'Siap diambil', val: stats.completed, color: C.success, onClick: () => navigate('transaksi', { status: 'selesai', pickupFilter: 'belum_diambil' }), icon: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12" /></svg> },
              ].map((s, i) => (
                <button
                  key={s.label}
                  type="button"
                  onClick={s.onClick}
                  style={{
                    flex: 1, textAlign: 'center', borderRight: i < 2 ? `1px solid ${C.n100}` : 'none',
                    padding: '4px 4px 2px', border: 'none', background: 'transparent', cursor: 'pointer',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 3, marginBottom: 3, color: s.color }}>
                    {s.icon}
                    <span style={{ fontFamily: 'Poppins', fontSize: 10, fontWeight: 600, color: s.color }}>{s.label}</span>
                  </div>
                  <div style={{ fontFamily: 'Poppins', fontSize: 16, fontWeight: 700, color: s.color }}>{loading ? '—' : s.val}</div>
                  <div style={{ fontFamily: 'Poppins', fontSize: 9, color: C.n400, marginTop: 2 }}>{s.desc}</div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ── ALERT TUTUP BUKU ── */}
        {periodAlert && !alertDismissed && (
          <div style={{ padding: '0 16px', marginTop: 4, marginBottom: 2 }}>
            <div style={{ background: periodAlert.daysLeft <= 1 ? '#FEE2E2' : '#FEF3C7', borderRadius: 14, padding: '12px 14px', display: 'flex', alignItems: 'flex-start', gap: 10, boxShadow: '0 2px 8px rgba(15,23,42,0.08)', border: `1.5px solid ${periodAlert.daysLeft <= 1 ? '#FCA5A5' : '#FDE68A'}` }}>
              <div style={{ fontSize: 20, flexShrink: 0, marginTop: 1 }}>{periodAlert.daysLeft <= 1 ? '🚨' : '⚠️'}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: 'Poppins', fontSize: 12, fontWeight: 700, color: periodAlert.daysLeft <= 1 ? '#991B1B' : '#92400E' }}>
                  {periodAlert.daysLeft === 0 ? 'Hari ini terakhir!' : `${periodAlert.daysLeft} hari lagi tutup buku`}
                </div>
                <div style={{ fontFamily: 'Poppins', fontSize: 11, color: periodAlert.daysLeft <= 1 ? '#7F1D1D' : '#78350F', marginTop: 2 }}>
                  Periode <strong>{periodAlert.periodLabel}</strong> berakhir {periodAlert.daysLeft === 0 ? 'hari ini' : `${periodAlert.daysLeft} hari lagi`}. Hubungi admin untuk tutup buku.
                </div>
              </div>
              <button
                onClick={() => {
                  setAlertDismissed(true);
                  sessionStorage.setItem(`period_alert_dismissed_${periodAlert.periodStart}`, '1');
                }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: periodAlert.daysLeft <= 1 ? '#991B1B' : '#92400E', fontSize: 18, padding: '0 2px', flexShrink: 0, lineHeight: 1 }}
              >×</button>
            </div>
          </div>
        )}

        {/* ── TODAY TARGET WIDGET (capaian harian dengan motivational tone) ── */}
        <div style={{ padding: '0 16px', marginTop: 2 }}>
          <TodayTargetWidget />
        </div>

        {/* ── TARGET CAPAIAN CARD ── */}
        {target && (
          <div style={{ padding: '0 16px', marginBottom: 14, marginTop: 2 }}>
            <div style={{
              background: 'white', borderRadius: 16, padding: '14px 16px', boxShadow: '0 2px 10px rgba(15,23,42,0.08)', border: `2px solid ${target.pct >= 100 ? '#059669' : target.pct >= 80 ? '#10B981' : target.pct >= 50 ? '#F59E0B' : '#EF4444'
                }20`
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <div>
                  <div style={{ fontFamily: 'Poppins', fontSize: 12, fontWeight: 700, color: C.n700 }}>🎯 Capaian Target Bulan Ini</div>
                  <div style={{ fontFamily: 'Poppins', fontSize: 10, color: C.n500 }}>{target.monthName} {target.year}</div>
                </div>
                <div style={{
                  background: target.pct >= 100 ? '#DCFCE7' : target.pct >= 80 ? '#D1FAE5' : target.pct >= 50 ? '#FEF3C7' : '#FEE2E2',
                  padding: '4px 12px', borderRadius: 999
                }}>
                  <span style={{
                    fontFamily: 'Poppins', fontSize: 14, fontWeight: 900,
                    color: target.pct >= 100 ? '#059669' : target.pct >= 80 ? '#10B981' : target.pct >= 50 ? '#F59E0B' : '#EF4444'
                  }}>
                    {target.pct}%
                  </span>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
                <div style={{ flex: 1, background: C.n50, borderRadius: 10, padding: '8px 12px' }}>
                  <div style={{ fontFamily: 'Poppins', fontSize: 9, fontWeight: 700, color: C.n500, letterSpacing: 0.5 }}>REALISASI</div>
                  <div style={{
                    fontFamily: 'Poppins', fontSize: 13, fontWeight: 800,
                    color: target.pct >= 100 ? '#059669' : target.pct >= 50 ? '#F59E0B' : '#EF4444'
                  }}>
                    {rp(target.actualAmount)}
                  </div>
                </div>
                <div style={{ flex: 1, background: C.n50, borderRadius: 10, padding: '8px 12px' }}>
                  <div style={{ fontFamily: 'Poppins', fontSize: 9, fontWeight: 700, color: C.n500, letterSpacing: 0.5 }}>TARGET</div>
                  <div style={{ fontFamily: 'Poppins', fontSize: 13, fontWeight: 800, color: C.n700 }}>{rp(target.targetAmount)}</div>
                </div>
              </div>
              {/* Progress bar */}
              <div style={{ height: 8, background: C.n100, borderRadius: 4, overflow: 'hidden' }}>
                <div style={{
                  height: '100%', width: `${Math.min(100, target.pct)}%`,
                  background: target.pct >= 100 ? '#059669' : target.pct >= 80 ? '#10B981' : target.pct >= 50 ? '#F59E0B' : '#EF4444',
                  borderRadius: 4, transition: 'width 0.6s ease'
                }} />
              </div>
              {target.pct >= 100 && (
                <div style={{ fontFamily: 'Poppins', fontSize: 11, fontWeight: 700, color: '#059669', textAlign: 'center', marginTop: 8 }}>
                  🎉 Target tercapai! Semangat terus!
                </div>
              )}
              {target.notes && (
                <div style={{ fontFamily: 'Poppins', fontSize: 10, color: '#92400E', marginTop: 8 }}>📝 {target.notes}</div>
              )}
            </div>
          </div>
        )}

        <div style={{ padding: '0 16px', paddingBottom: 20 }}>

          {/* ── QUICK ACTIONS ── */}
          <div style={{ ...T.card, marginBottom: 16 }}>
            <div style={{ fontFamily: 'Poppins', fontSize: 14, fontWeight: 600, color: C.n900, marginBottom: 14 }}>Aksi Cepat</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {QUICK.map((q) => (
                <button
                  key={q.label}
                  onClick={q.action}
                  style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: '14px 8px', borderRadius: 12, background: C.n50, border: `1px solid ${C.n100}`, cursor: 'pointer', position: 'relative' }}
                >
                  <div style={{ position: 'relative', display: 'inline-flex' }}>
                    <div style={{ width: 44, height: 44, borderRadius: 12, background: `${q.color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: q.color }}>{q.icon}</div>
                    {q.badge && (
                      <div style={{ position: 'absolute', top: -4, right: -4, minWidth: 18, height: 18, borderRadius: 9, background: C.danger, border: '2px solid white', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 3px', boxSizing: 'border-box' }}>
                        <span style={{ fontFamily: 'Poppins', fontSize: 9, fontWeight: 700, color: 'white' }}>{q.badge}</span>
                      </div>
                    )}
                  </div>
                  <span style={{ fontFamily: 'Poppins', fontSize: 12, fontWeight: 600, color: C.n900 }}>{q.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* ── RECENT TRANSACTIONS ── */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <span style={{ fontFamily: 'Poppins', fontSize: 13, fontWeight: 700, color: C.n900 }}>Transaksi Terbaru</span>
            <button onClick={() => navigate('transaksi')} style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'Poppins', fontSize: 12, fontWeight: 600, color: C.primary }}>Lihat semua →</button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {loading ? (
              <div style={{ textAlign: 'center', padding: 24, color: C.n500, fontFamily: 'Poppins', fontSize: 13 }}>Memuat...</div>
            ) : recent.length === 0 ? (
              <div style={{ background: C.white, borderRadius: 14, padding: 24, textAlign: 'center' }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>📋</div>
                <div style={{ fontFamily: 'Poppins', fontSize: 13, color: C.n500 }}>Belum ada transaksi hari ini</div>
                <button onClick={() => shiftOpen ? navigate('nota_step1') : navigate('kasir_shift')} style={{ marginTop: 12, background: C.primary, color: 'white', border: 'none', borderRadius: 10, padding: '8px 20px', fontFamily: 'Poppins', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                  {shiftOpen ? 'Buat nota pertama' : 'Buka shift dulu'}
                </button>
              </div>
            ) : (
              recent.map((tx) => {
                const sm = STATUS_META[tx.status] || { label: tx.status, color: C.n500, bg: C.n100 };
                const initials = tx.customerName?.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase() || '??';
                return (
                  <div
                    key={tx.id}
                    onClick={() => navigate('detail_transaksi', tx)}
                    style={{ background: C.white, borderRadius: 14, padding: '11px 14px', boxShadow: '0 1px 6px rgba(15,23,42,0.07)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 11 }}
                  >
                    {/* Avatar */}
                    <div style={{ width: 40, height: 40, borderRadius: 12, background: `${C.primary}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <span style={{ fontFamily: 'Poppins', fontSize: 13, fontWeight: 700, color: C.primary }}>{initials}</span>
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                        <span style={{ fontFamily: 'Poppins', fontSize: 13, fontWeight: 600, color: C.n900, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tx.customerName}</span>
                        <span style={{ fontFamily: 'Poppins', fontSize: 13, fontWeight: 700, color: C.n900, flexShrink: 0 }}>{rp(tx.total)}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 4 }}>
                        <span style={{ fontFamily: 'Poppins', fontSize: 10, color: C.n500 }}>{tx.id}</span>
                        {tx.items?.some((i) => i.express) && (
                          <span style={{ background: '#FEF3C7', color: '#92400E', fontFamily: 'Poppins', fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 999 }}>⚡</span>
                        )}
                        <span style={{ fontFamily: 'Poppins', fontSize: 10, fontWeight: 600, color: sm.color, background: sm.bg, padding: '1px 7px', borderRadius: 999, marginLeft: 2 }}>{sm.label}</span>
                      </div>
                    </div>

                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.n300} strokeWidth="2" strokeLinecap="round"><polyline points="9 18 15 12 9 6" /></svg>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* ── Top Up: Customer Picker Bottom Sheet (Advanced) ── */}
      {topupSheet && (
        <>
          <div
            onClick={() => setTopupSheet(false)}
            style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)', zIndex: 300 }}
          />
          <div
            style={{
              position: 'fixed', bottom: 0, left: 0, right: 0,
              background: C.white, borderRadius: '20px 20px 0 0',
              padding: '16px 20px 36px',
              boxShadow: '0 -8px 32px rgba(15,23,42,0.15)',
              zIndex: 301,
              maxHeight: '80vh', display: 'flex', flexDirection: 'column',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Handle */}
            <div style={{ width: 40, height: 4, borderRadius: 2, background: C.n200, margin: '0 auto 14px' }} />

            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: '#EC489918', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ fontSize: 18 }}>💳</span>
                </div>
                <div>
                  <div style={{ fontFamily: 'Poppins', fontSize: 15, fontWeight: 700, color: C.n900 }}>Top Up Deposit</div>
                  <div style={{ fontFamily: 'Poppins', fontSize: 10, color: C.n500 }}>Pilih customer untuk top up saldo</div>
                </div>
              </div>
              <button onClick={() => setTopupSheet(false)} style={{ width: 30, height: 30, borderRadius: 8, border: 'none', background: C.n100, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.n600} strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>

            {/* Search */}
            <div style={{ position: 'relative', marginBottom: 10 }}>
              <svg style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}
                width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={C.n400} strokeWidth="2" strokeLinecap="round">
                <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                value={topupSearch}
                onChange={(e) => setTopupSearch(e.target.value)}
                placeholder="Cari nama, nomor HP, atau alamat…"
                style={{
                  width: '100%', height: 44, borderRadius: 12,
                  border: `1.5px solid ${C.n200}`, background: C.n50,
                  fontFamily: 'Poppins', fontSize: 13,
                  paddingLeft: 36, paddingRight: 12, boxSizing: 'border-box', outline: 'none',
                }}
              />
              {topupSearching && (
                <div style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', width: 16, height: 16, border: `2px solid ${C.n200}`, borderTopColor: C.primary, borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
              )}
            </div>

            {/* Filter chips — replaces old alphabet filter */}
            <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
              {TOPUP_FILTERS.map((f) => {
                const isActive = topupFilter === f.key;
                return (
                  <button
                    key={f.key}
                    type="button"
                    onClick={() => setTopupFilter(f.key)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 5,
                      padding: '6px 12px', borderRadius: 999,
                      border: `1.5px solid ${isActive ? '#7C3AED' : C.n200}`,
                      background: isActive ? '#7C3AED12' : C.white,
                      fontFamily: 'Poppins', fontSize: 11, fontWeight: isActive ? 700 : 500,
                      color: isActive ? '#7C3AED' : C.n600, cursor: 'pointer',
                      transition: 'all 0.15s',
                    }}
                  >
                    <span style={{ fontSize: 12 }}>{f.icon}</span>
                    {f.label}
                  </button>
                );
              })}
            </div>

            {/* Count indicator */}
            <div style={{ fontFamily: 'Poppins', fontSize: 10, fontWeight: 700, color: C.n400, letterSpacing: 0.5, marginBottom: 8 }}>
              {topupLoading ? 'Memuat…' : `${topupDisplayList.length} customer ditemukan`}
            </div>

            {/* Customer list */}
            <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
              {topupLoading && (
                <div style={{ textAlign: 'center', padding: 20 }}>
                  <div style={{ width: 28, height: 28, border: `3px solid ${C.n200}`, borderTopColor: '#EC4899', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 8px' }} />
                  <span style={{ fontFamily: 'Poppins', fontSize: 12, color: C.n500 }}>Memuat customer…</span>
                </div>
              )}
              {!topupLoading && !topupSearching && topupDisplayList.length === 0 && (
                <div style={{ textAlign: 'center', padding: '24px 0' }}>
                  <div style={{ fontSize: 32, marginBottom: 8 }}>🔍</div>
                  <div style={{ fontFamily: 'Poppins', fontSize: 13, fontWeight: 600, color: C.n600, marginBottom: 4 }}>Customer tidak ditemukan</div>
                  <div style={{ fontFamily: 'Poppins', fontSize: 11, color: C.n500, marginBottom: 12 }}>Coba ubah filter atau kata kunci pencarian</div>
                  <button
                    type="button"
                    onClick={() => { setTopupSheet(false); navigate('tambah_customer'); }}
                    style={{ background: C.primary, color: 'white', border: 'none', borderRadius: 10, padding: '10px 18px', fontFamily: 'Poppins', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
                  >
                    + Tambah Customer Baru
                  </button>
                </div>
              )}
              {topupDisplayList.map((c) => {
                const dep = Number(c.depositBalance ?? c.deposit ?? 0);
                const isMember = c.isMember || c.membershipStatus === 'active';
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => selectTopupCustomer(c)}
                    style={{
                      width: '100%', display: 'flex', alignItems: 'center', gap: 12,
                      padding: '10px 12px', borderRadius: 12, border: 'none',
                      background: C.white, cursor: 'pointer', textAlign: 'left',
                      marginBottom: 6, boxShadow: '0 1px 4px rgba(15,23,42,0.06)',
                      transition: 'background 0.1s',
                    }}
                  >
                    <div style={{ width: 40, height: 40, borderRadius: 10, background: isMember ? '#7C3AED14' : `${C.primary}14`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, position: 'relative' }}>
                      <span style={{ fontFamily: 'Poppins', fontSize: 13, fontWeight: 700, color: isMember ? '#7C3AED' : C.primary }}>
                        {(c.name || '?').split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()}
                      </span>
                      {isMember && (
                        <span style={{ position: 'absolute', top: -2, right: -2, fontSize: 10 }}>⭐</span>
                      )}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontFamily: 'Poppins', fontSize: 13, fontWeight: 600, color: C.n900, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</span>
                        {isMember && (
                          <span style={{ fontFamily: 'Poppins', fontSize: 9, fontWeight: 700, color: '#7C3AED', background: '#7C3AED14', padding: '1px 5px', borderRadius: 999 }}>MEMBER</span>
                        )}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 2 }}>
                        <span style={{ fontFamily: 'Poppins', fontSize: 11, color: C.n500 }}>{c.phone || '-'}</span>
                        {dep > 0 && (
                          <span style={{ fontFamily: 'Poppins', fontSize: 10, fontWeight: 700, color: '#059669', background: '#DCFCE7', padding: '1px 6px', borderRadius: 999 }}>
                            💰 {rp(dep)}
                          </span>
                        )}
                      </div>
                    </div>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={C.n400} strokeWidth="2" strokeLinecap="round"><polyline points="9 18 15 12 9 6" /></svg>
                  </button>
                );
              })}
            </div>

            {/* Footer: tambah customer baru */}
            <button
              type="button"
              onClick={() => { setTopupSheet(false); navigate('tambah_customer'); }}
              style={{
                marginTop: 10, width: '100%', height: 44, borderRadius: 12,
                border: `1.5px dashed ${C.n300}`, background: 'transparent',
                fontFamily: 'Poppins', fontSize: 13, fontWeight: 600, color: C.n600, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              Customer Baru
            </button>
          </div>
        </>
      )}
    </>
  );
}
