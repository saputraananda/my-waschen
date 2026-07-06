// ─────────────────────────────────────────────────────────────────────────────
// TodayTargetWidget — capaian harian kasir (dashboard widget)
// Redesigned: Premium claymorphism with 3D assets
// ─────────────────────────────────────────────────────────────────────────────
import { useState, useEffect } from 'react';
import axios from 'axios';
import { C } from '../utils/theme';
import { rp } from '../utils/helpers';

// Mood themes — Purple brand gradient with claymorphism
const MOOD_THEME = {
  great:   { gradient: `linear-gradient(145deg, ${C.primary}, ${C.primaryDark})`, icon: '🎉', label: 'Luar biasa!', accent: '#c084fc' },
  good:    { gradient: `linear-gradient(145deg, ${C.primary}, #5B21B6)`, icon: '💪', label: 'On track!', accent: '#a78bfa' },
  warning: { gradient: `linear-gradient(145deg, #92400E, #B45309)`, icon: '⚠️', label: 'Hampir sampai', accent: '#fbbf24' },
  low:     { gradient: `linear-gradient(145deg, #991B1B, #DC2626)`, icon: '📉', label: 'Perlu effort', accent: '#f87171' },
  zero:    { gradient: `linear-gradient(145deg, ${C.primary}, ${C.primaryDark})`, icon: '🔥', label: 'Mulai sekarang!', accent: '#E85D00' },
};

// Target badge styles
const TARGET_BADGE = {
  great:   { bg: '#c084fc', color: '#1a1a1a' },
  good:    { bg: '#a78bfa', color: '#1a1a1a' },
  warning: { bg: '#fbbf24', color: '#1a1a1a' },
  low:     { bg: '#f87171', color: '#1a1a1a' },
  zero:    { bg: '#E85D00', color: 'white' },
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
        height: 140,
        background: 'linear-gradient(145deg, #FFFFFF, #F8F4FF)',
        borderRadius: 24,
        marginBottom: 12,
        boxShadow: '6px 6px 16px rgba(60, 10, 99, 0.1), -4px -4px 12px rgba(255, 255, 255, 0.9)',
        animation: 'pulse 1.5s infinite',
      }} />
    );
  }

  // Empty state — card elevated dengan shadow dan claymorphism
  if (!data) {
    return (
      <div
        onClick={onClick}
        style={{
          background: 'linear-gradient(145deg, #FFFFFF, #F8F4FF)',
          borderRadius: 24,
          padding: '18px 20px',
          marginBottom: 12,
          boxShadow: '6px 6px 16px rgba(60, 10, 99, 0.1), -4px -4px 12px rgba(255, 255, 255, 0.9)',
          cursor: onClick ? 'pointer' : 'default',
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          border: '1px solid rgba(124, 58, 237, 0.1)',
        }}
      >
        {/* Claymorphism icon container */}
        <div style={{
          width: 56,
          height: 56,
          borderRadius: 16,
          background: 'linear-gradient(145deg, #F3E8FF, #EDE7F6)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '4px 4px 10px rgba(60, 10, 99, 0.1), -2px -2px 8px rgba(255, 255, 255, 0.9)',
          fontSize: 28,
        }}>
          🎯
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: 'Poppins', fontSize: 14, fontWeight: 600, color: C.n800 }}>
            Belum ada target bulan ini
          </div>
          <div style={{ fontFamily: 'Poppins', fontSize: 12, color: C.n500, marginTop: 4 }}>
            Hubungi admin untuk set target outlet
          </div>
        </div>
        {/* Arrow indicator */}
        <div style={{
          width: 32,
          height: 32,
          borderRadius: 10,
          background: 'linear-gradient(145deg, #F3E8FF, #EDE7F6)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '2px 2px 6px rgba(60, 10, 99, 0.08), -1px -1px 4px rgba(255, 255, 255, 0.9)',
        }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={C.n400} strokeWidth="2" strokeLinecap="round">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </div>
      </div>
    );
  }

  const mood = data.mood || 'zero';
  const theme = MOOD_THEME[mood] || MOOD_THEME.zero;
  const badge = TARGET_BADGE[mood] || TARGET_BADGE.zero;
  const todayPctClamped = Math.min(100, Math.max(0, data.todayPct));

  return (
    <div
      onClick={onClick}
      style={{
        background: theme.gradient,
        borderRadius: 24,
        padding: '20px 22px',
        marginBottom: 12,
        color: 'white',
        cursor: onClick ? 'pointer' : 'default',
        position: 'relative',
        overflow: 'hidden',
        boxShadow: '8px 8px 20px rgba(60, 10, 99, 0.25), -4px -4px 12px rgba(255, 255, 255, 0.15)',
      }}
    >
      {/* Decorative circles - claymorphism effect */}
      <div style={{
        position: 'absolute',
        top: -30,
        right: -30,
        width: 120,
        height: 120,
        borderRadius: 60,
        background: 'rgba(255,255,255,0.1)',
        filter: 'blur(20px)',
      }} />
      <div style={{
        position: 'absolute',
        bottom: -40,
        right: 60,
        width: 100,
        height: 100,
        borderRadius: 50,
        background: 'rgba(255,255,255,0.06)',
        filter: 'blur(15px)',
      }} />
      {/* Orange accent */}
      <div style={{
        position: 'absolute',
        top: 20,
        right: 80,
        width: 40,
        height: 40,
        borderRadius: 20,
        background: 'rgba(232, 93, 0, 0.2)',
        filter: 'blur(10px)',
      }} />

      <div style={{ position: 'relative' }}>
        {/* Header row */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
          <div>
            <div style={{
              fontFamily: 'Poppins',
              fontSize: 11,
              color: theme.accent,
              fontWeight: 600,
              opacity: 0.95,
              letterSpacing: '0.5px',
              textTransform: 'uppercase',
            }}>
              🎯 Target Hari Ini
            </div>
            <div style={{ fontFamily: 'Poppins', fontSize: 24, fontWeight: 700, marginTop: 4, letterSpacing: '-0.5px' }}>
              {rp(data.todayActual)}
              <span style={{ fontSize: 13, opacity: 0.75, fontWeight: 400, marginLeft: 8 }}>
                / {rp(data.dailyTarget)}
              </span>
            </div>
          </div>

          {/* Claymorphism badge */}
          <div style={{
            background: badge.bg,
            color: badge.color,
            padding: '8px 16px',
            borderRadius: 16,
            fontFamily: 'Poppins',
            fontSize: 14,
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            boxShadow: `4px 4px 10px rgba(0,0,0,0.15), -2px -2px 6px rgba(255,255,255,0.1)`,
          }}>
            <span style={{ fontSize: 16 }}>{theme.icon}</span>
            {data.todayPct}%
          </div>
        </div>

        {/* Progress bar - claymorphism style */}
        <div style={{
          background: 'rgba(255,255,255,0.15)',
          height: 10,
          borderRadius: 5,
          overflow: 'hidden',
          boxShadow: 'inset 2px 2px 4px rgba(0,0,0,0.1)',
        }}>
          <div style={{
            background: `linear-gradient(90deg, ${theme.accent}, #E85D00)`,
            height: '100%',
            width: `${todayPctClamped}%`,
            borderRadius: 5,
            transition: 'width 0.6s ease',
            boxShadow: `0 0 12px ${theme.accent}60`,
          }} />
        </div>

        {/* Motivational message */}
        <div style={{
          fontFamily: 'Poppins',
          fontSize: 12,
          fontWeight: 600,
          marginTop: 14,
          opacity: 0.95,
          color: theme.accent,
        }}>
          {theme.icon} {data.message || theme.label}
        </div>

        {/* Footer stats - claymorphism cards */}
        <div style={{
          marginTop: 16,
          paddingTop: 14,
          borderTop: '1px solid rgba(255,255,255,0.15)',
          display: 'flex',
          gap: 12,
        }}>
          <div style={{
            flex: 1,
            background: 'rgba(255,255,255,0.1)',
            borderRadius: 12,
            padding: '10px 12px',
            textAlign: 'center',
            boxShadow: 'inset 2px 2px 4px rgba(0,0,0,0.1)',
          }}>
            <div style={{ fontFamily: 'Poppins', fontSize: 16, fontWeight: 700 }}>{data.monthPct}%</div>
            <div style={{ fontFamily: 'Poppins', fontSize: 9, opacity: 0.8, marginTop: 2 }}>Bulan Ini</div>
          </div>
          <div style={{
            flex: 1,
            background: 'rgba(255,255,255,0.1)',
            borderRadius: 12,
            padding: '10px 12px',
            textAlign: 'center',
            boxShadow: 'inset 2px 2px 4px rgba(0,0,0,0.1)',
          }}>
            <div style={{ fontFamily: 'Poppins', fontSize: 16, fontWeight: 700 }}>{rp(data.monthActual)}</div>
            <div style={{ fontFamily: 'Poppins', fontSize: 9, opacity: 0.8, marginTop: 2 }}>Total Bulan</div>
          </div>
          <div style={{
            flex: 1,
            background: 'rgba(255,255,255,0.1)',
            borderRadius: 12,
            padding: '10px 12px',
            textAlign: 'center',
            boxShadow: 'inset 2px 2px 4px rgba(0,0,0,0.1)',
          }}>
            <div style={{ fontFamily: 'Poppins', fontSize: 16, fontWeight: 700 }}>{data.todayTxCount}</div>
            <div style={{ fontFamily: 'Poppins', fontSize: 9, opacity: 0.8, marginTop: 2 }}>Transaksi</div>
          </div>
        </div>
      </div>
    </div>
  );
}
