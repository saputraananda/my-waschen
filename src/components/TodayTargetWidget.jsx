// ─────────────────────────────────────────────────────────────────────────────
// TodayTargetWidget — capaian harian kasir (dashboard widget)
// ─────────────────────────────────────────────────────────────────────────────
// Bahasa awam, motivational, fokus ke hari ini.
// ─────────────────────────────────────────────────────────────────────────────
import { useState, useEffect } from 'react';
import axios from 'axios';
import { C } from '../utils/theme';
import { rp } from '../utils/helpers';

const MOOD_THEME = {
  great:   { bg: 'linear-gradient(135deg, #10B981, #059669)', icon: '🎉' },
  good:    { bg: 'linear-gradient(135deg, #3B82F6, #2563EB)', icon: '💪' },
  warning: { bg: 'linear-gradient(135deg, #F59E0B, #D97706)', icon: '⚠️' },
  low:     { bg: 'linear-gradient(135deg, #EF4444, #DC2626)', icon: '📉' },
  zero:    { bg: 'linear-gradient(135deg, #64748B, #475569)', icon: '🔥' },
};

export default function TodayTargetWidget({ onClick }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    axios.get('/api/targets/today-summary')
      .then(r => { if (!cancelled) setData(r?.data?.data); })
      .catch(() => { if (!cancelled) setData(null); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return (
      <div style={{
        height: 100, background: C.n100, borderRadius: 14, marginBottom: 12,
        animation: 'pulse 1.5s infinite',
      }} />
    );
  }

  // Belum ada target — tampilkan empty state simple, kalau onClick ada untuk navigate ke admin target page
  if (!data) {
    return (
      <div
        onClick={onClick}
        style={{
          background: 'white', borderRadius: 14, padding: '14px 16px',
          marginBottom: 12, boxShadow: '0 2px 8px rgba(15,23,42,0.05)',
          border: `1px dashed ${C.n200}`,
          cursor: onClick ? 'pointer' : 'default',
          display: 'flex', alignItems: 'center', gap: 12,
        }}
      >
        <span style={{ fontSize: 28 }}>🎯</span>
        <div>
          <div style={{ fontFamily: 'Poppins', fontSize: 12, fontWeight: 700, color: C.n800 }}>
            Belum ada target bulan ini
          </div>
          <div style={{ fontFamily: 'Poppins', fontSize: 10, color: C.n500, marginTop: 2 }}>
            Hubungi admin untuk set target outlet
          </div>
        </div>
      </div>
    );
  }

  const theme = MOOD_THEME[data.mood] || MOOD_THEME.good;
  const todayPctClamped = Math.min(100, Math.max(0, data.todayPct));

  return (
    <div
      onClick={onClick}
      style={{
        background: theme.bg, borderRadius: 14, padding: '14px 16px',
        marginBottom: 12, color: 'white',
        cursor: onClick ? 'pointer' : 'default',
        position: 'relative', overflow: 'hidden',
        boxShadow: '0 4px 14px rgba(15,23,42,0.12)',
      }}
    >
      <div style={{ position: 'absolute', top: -20, right: -20, width: 100, height: 100, borderRadius: '50%', background: 'radial-gradient(circle, rgba(255,255,255,0.18), transparent 70%)' }} />

      <div style={{ position: 'relative' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
          <div>
            <div style={{ fontFamily: 'Poppins', fontSize: 10, opacity: 0.85, fontWeight: 600, letterSpacing: 0.4 }}>
              🎯 TARGET HARI INI
            </div>
            <div style={{ fontFamily: 'Poppins', fontSize: 22, fontWeight: 800, marginTop: 2 }}>
              {rp(data.todayActual)}
              <span style={{ fontSize: 11, opacity: 0.85, fontWeight: 500, marginLeft: 6 }}>
                / {rp(data.dailyTarget)}
              </span>
            </div>
          </div>
          <div style={{
            background: 'rgba(255,255,255,0.25)', padding: '6px 12px',
            borderRadius: 999, fontFamily: 'Poppins', fontSize: 14, fontWeight: 800,
            display: 'flex', alignItems: 'center', gap: 4,
          }}>
            <span style={{ fontSize: 14 }}>{theme.icon}</span>
            {data.todayPct}%
          </div>
        </div>

        {/* Progress bar */}
        <div style={{
          background: 'rgba(255,255,255,0.18)', height: 6, borderRadius: 3,
          overflow: 'hidden',
        }}>
          <div style={{
            background: 'white', height: '100%',
            width: `${todayPctClamped}%`,
            borderRadius: 3, transition: 'width 0.6s ease',
          }} />
        </div>

        <div style={{
          fontFamily: 'Poppins', fontSize: 11, fontWeight: 600,
          marginTop: 10, lineHeight: 1.4, opacity: 0.95,
        }}>
          {data.message}
        </div>

        {/* Footer info */}
        <div style={{
          marginTop: 10, paddingTop: 10,
          borderTop: '1px solid rgba(255,255,255,0.18)',
          display: 'flex', justifyContent: 'space-between',
          fontFamily: 'Poppins', fontSize: 9, opacity: 0.85,
        }}>
          <span>Bulan ini: {data.monthPct}% ({rp(data.monthActual)})</span>
          <span>{data.todayTxCount} transaksi hari ini</span>
        </div>
      </div>
    </div>
  );
}
