import { useState, useEffect } from 'react';
import axios from 'axios';
import { C } from '../../utils/theme';
import { rp } from '../../utils/helpers';
import { Avatar, Badge, SectionHeader } from '../../components/ui';

const WIB_FORMATTER = new Intl.DateTimeFormat('id-ID', { timeZone: 'Asia/Jakarta', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
const WIB_TIME = new Intl.DateTimeFormat('id-ID', { timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
const SHIFT_LABEL = { pagi: 'Pagi', siang: 'Siang', malam: 'Malam', full: 'Full Day' };

const STATUS_META = {
  baru:             { label: 'Baru',       color: '#2563EB', bg: '#EFF6FF' },
  diproses:         { label: 'Proses',     color: '#D97706', bg: '#FFFBEB' },
  selesai:          { label: 'Selesai',    color: '#059669', bg: '#ECFDF5' },
  siap_diambil:     { label: 'Siap Ambil', color: '#7C3AED', bg: '#F5F3FF' },
  selesai_diambil:  { label: 'Diambil',   color: '#64748B', bg: '#F1F5F9' },
  dibatalkan:       { label: 'Batal',      color: '#DC2626', bg: '#FEF2F2' },
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
  const [stats, setStats] = useState({ total: 0, omset: 0, express: 0, pending: 0, completed: 0 });
  const [recent, setRecent] = useState([]);
  const [loading, setLoading] = useState(false);
  const [clock, setClock] = useState(() => {
    const n = new Date();
    return { date: WIB_FORMATTER.format(n), time: WIB_TIME.format(n) };
  });
  const [shift, setShift] = useState(null);
  const [elapsed, setElapsed] = useState('');

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

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [resStats, resShift] = await Promise.all([
          axios.get('/api/transactions/dashboard/stats'),
          axios.get('/api/shifts/status'),
        ]);
        if (resStats?.data?.data) {
          setStats(resStats.data.data.today);
          setRecent(resStats.data.data.recent || []);
        }
        if (resShift?.data?.success !== false) setShift(resShift.data);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const shiftOpen = shift?.isOpen || shift?.bypass;

  const QUICK = [
    { label: 'Nota Baru',    icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>, action: () => shiftOpen ? navigate('nota_step1') : navigate('kasir_shift'), color: C.primary },
    { label: 'Antrian',      icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>, action: () => navigate('kasir_antrian'), color: '#0EA5E9', badge: stats.pending > 0 ? stats.pending : null },
    { label: 'Siap Ambil',   icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></svg>, action: () => navigate('kasir_siap_ambil'), color: C.success },
    { label: 'Cari Nota',    icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>, action: () => navigate('transaksi'), color: '#7C3AED' },
    { label: 'Top Up',       icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>, action: () => navigate('topup_deposit', {}), color: '#EC4899' },
    { label: 'Customer',     icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>, action: () => navigate('customer'), color: '#0EA5E9' },
    { label: 'Transaksi',    icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="1 4 1 10 7 10" /><path d="M3.51 15a9 9 0 1 0 .49-3.5" /></svg>, action: () => navigate('transaksi'), color: C.success },
    { label: 'Shift',        icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>, action: () => navigate('kasir_shift'), color: C.warning },
    { label: 'Stok Bahan',   icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" /><polyline points="3.27 6.96 12 12.01 20.73 6.96" /><line x1="12" y1="22.08" x2="12" y2="12" /></svg>, action: () => navigate('kasir_stok_bahan'), color: '#64748B' },
  ];

  const STAT_ITEMS = [
    { label: 'Transaksi', value: stats.total,     color: C.primary,  icon: '🧾' },
    { label: 'Omset',     value: rp(stats.omset), color: C.success,  icon: '💰', wide: true },
    { label: 'Proses',    value: stats.pending,   color: '#0EA5E9',  icon: '⏳' },
    { label: 'Express',   value: stats.express,   color: C.warning,  icon: '⚡' },
    { label: 'Selesai',   value: stats.completed, color: C.success,  icon: '✅' },
  ];

  return (
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
          <div style={{ display: 'flex', alignItems: 'stretch', gap: 12 }}>
            {/* Omset */}
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                <div style={{ width: 28, height: 28, borderRadius: 8, background: `${C.primary}15`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.primary} strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>
                </div>
                <span style={{ fontFamily: 'Poppins', fontSize: 11, fontWeight: 600, color: C.n600 }}>Omset Hari Ini</span>
              </div>
              <div style={{ fontFamily: 'Poppins', fontSize: 22, fontWeight: 800, color: C.primary, letterSpacing: '-0.5px' }}>
                {loading ? '—' : rp(stats.omset)}
              </div>
              <div style={{ fontFamily: 'Poppins', fontSize: 10, color: C.n500, marginTop: 3 }}>Total pendapatan masuk</div>
            </div>
            {/* Divider */}
            <div style={{ width: 1, background: C.n100, flexShrink: 0 }} />
            {/* Transaksi */}
            <div style={{ flexShrink: 0, textAlign: 'center', minWidth: 76 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginBottom: 6 }}>
                <div style={{ width: 28, height: 28, borderRadius: 8, background: '#0EA5E915', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#0EA5E9" strokeWidth="2.5" strokeLinecap="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                </div>
                <span style={{ fontFamily: 'Poppins', fontSize: 11, fontWeight: 600, color: C.n600 }}>Nota</span>
              </div>
              <div style={{ fontFamily: 'Poppins', fontSize: 26, fontWeight: 800, color: C.n900 }}>
                {loading ? '—' : stats.total}
              </div>
              <div style={{ fontFamily: 'Poppins', fontSize: 10, color: C.n500, marginTop: 3 }}>transaksi dibuat</div>
            </div>
          </div>

          {/* Mini stat row */}
          <div style={{ display: 'flex', gap: 0, marginTop: 12, borderTop: `1px solid ${C.n100}`, paddingTop: 10 }}>
            {[
              { label: 'Express', desc: 'Layanan kilat', val: stats.express, color: C.warning, icon: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg> },
              { label: 'Proses',  desc: 'Sedang dikerjakan', val: stats.pending, color: '#0EA5E9', icon: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg> },
              { label: 'Selesai', desc: 'Siap diambil', val: stats.completed, color: C.success, icon: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg> },
            ].map((s, i) => (
              <div key={s.label} style={{ flex: 1, textAlign: 'center', borderRight: i < 2 ? `1px solid ${C.n100}` : 'none', padding: '0 4px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 3, marginBottom: 3, color: s.color }}>
                  {s.icon}
                  <span style={{ fontFamily: 'Poppins', fontSize: 10, fontWeight: 600, color: s.color }}>{s.label}</span>
                </div>
                <div style={{ fontFamily: 'Poppins', fontSize: 16, fontWeight: 700, color: s.color }}>{s.val}</div>
                <div style={{ fontFamily: 'Poppins', fontSize: 9, color: C.n400, marginTop: 2 }}>{s.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={{ padding: '0 16px', paddingBottom: 20 }}>

        {/* ── QUICK ACTIONS ── */}
        <div style={{ background: C.white, borderRadius: 16, padding: 16, marginBottom: 16, boxShadow: '0 2px 8px rgba(15,23,42,0.06)' }}>
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
  );
}
