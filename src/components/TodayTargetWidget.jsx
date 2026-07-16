// ─────────────────────────────────────────────────────────────────────────────
// TodayTargetWidget — Real-time target tracking widget for kasir dashboard
//
// Shows TWO metrics:
//   PROYEK = All orders (order_masuk) — opportunity tracking
//   REAL   = Only completed/ready — actual cash received
//
// Data Source: /api/targets/today-summary
// ─────────────────────────────────────────────────────────────────────────────
import { useState, useEffect } from 'react';
import axios from 'axios';
import { motion } from 'framer-motion';
import { C } from '../utils/theme';

const rp = (n) => {
  if (n == null) return 'Rp 0';
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(n);
};

const fmtK = (n) => {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}Jt`;
  if (n >= 1000) return `${(n / 1000).toFixed(0)}Rb`;
  return n.toString();
};

// Mood based on PROYEK achievement (more realistic for laundry)
const getMood = (todayProyek, dailyTarget, todayActual) => {
  if (todayProyek >= dailyTarget) return 'great';
  const pct = dailyTarget > 0 ? (todayProyek / dailyTarget) * 100 : 0;
  if (pct >= 80) return 'good';
  if (pct >= 50) return 'warning';
  if (todayActual > 0) return 'low';
  return 'zero';
};

const MOOD_THEME = {
  great: { gradient: `linear-gradient(145deg, #059669, #047857)`, icon: '🎉', label: 'Luar biasa!', accent: '#34d399' },
  good:  { gradient: `linear-gradient(145deg, #5B005F, #4D0051)`, icon: '💪', label: 'On track!', accent: '#a78bfa' },
  warning: { gradient: `linear-gradient(145deg, #92400E, #B45309)`, icon: '⚠️', label: 'Hampir sampai', accent: '#fbbf24' },
  low:   { gradient: `linear-gradient(145deg, #DC2626, #B91C1C)`, icon: '📉', label: 'Perlu effort', accent: '#f87171' },
  zero:  { gradient: `linear-gradient(145deg, #5B005F, #4D0051)`, icon: '🔥', label: 'Mulai sekarang!', accent: '#E85D00' },
};

const TARGET_BADGE = {
  great:   { bg: '#34d399', color: '#fff' },
  good:    { bg: '#a78bfa', color: '#fff' },
  warning: { bg: '#fbbf24', color: '#1a1a1a' },
  low:     { bg: '#f87171', color: '#fff' },
  zero:    { bg: '#E85D00', color: '#fff' },
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
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        style={{
          height: 160,
          background: 'linear-gradient(145deg, #FFFFFF, #F8F4FF)',
          borderRadius: 24,
          marginBottom: 12,
          boxShadow: '6px 6px 16px rgba(60, 10, 99, 0.1), -4px -4px 12px rgba(255, 255, 255, 0.9)',
        }}
      />
    );
  }

  // Empty state — no target set
  if (!data) {
    return (
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
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
            Target belum di-set
          </div>
          <div style={{ fontFamily: 'Poppins', fontSize: 12, color: C.n500, marginTop: 4 }}>
            Hubungi admin untuk set target outlet
          </div>
        </div>
        <div style={{
          width: 32,
          height: 32,
          borderRadius: 10,
          background: 'linear-gradient(145deg, #F3E8FF, #EDE7F6)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={C.n400} strokeWidth="2" strokeLinecap="round">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </div>
      </motion.div>
    );
  }

  const {
    dailyTarget = 0,
    todayActual = 0,       // REAL: cash received
    todayProyek = 0,       // PROYEK: all orders
    todayProyekPending = 0,
    todayTxCount = 0,
    todayAllTxCount = 0,
    monthlyTarget = 0,
    monthActual = 0,        // REAL: cash received
    monthProyek = 0,        // PROYEK: all orders
    monthProyekPending = 0,
    monthPct = 0,
    monthProyekPct = 0,
  } = data;

  const mood = getMood(todayProyek, dailyTarget, todayActual);
  const theme = MOOD_THEME[mood] || MOOD_THEME.zero;
  const badge = TARGET_BADGE[mood] || TARGET_BADGE.zero;

  // Progress based on PROYEK (more realistic)
  const proyekPct = dailyTarget > 0 ? Math.min(100, Math.round((todayProyek / dailyTarget) * 100)) : 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
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
      {/* Decorative circles */}
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

      <div style={{ position: 'relative' }}>
        {/* Header */}
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
            <div style={{ fontFamily: 'Poppins', fontSize: 22, fontWeight: 700, marginTop: 4 }}>
              {rp(todayProyek)}
              <span style={{ fontSize: 12, opacity: 0.75, fontWeight: 400, marginLeft: 8 }}>
                / {rp(dailyTarget)}
              </span>
            </div>
          </div>

          {/* Mood Badge */}
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.2, type: 'spring', stiffness: 300, damping: 20 }}
            style={{
              background: badge.bg,
              color: badge.color,
              padding: '8px 14px',
              borderRadius: 14,
              fontFamily: 'Poppins',
              fontSize: 13,
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <span style={{ fontSize: 15 }}>{theme.icon}</span>
            {proyekPct}%
          </motion.div>
        </div>

        {/* Progress bar */}
        <div style={{
          background: 'rgba(255,255,255,0.15)',
          height: 10,
          borderRadius: 5,
          overflow: 'hidden',
        }}>
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${proyekPct}%` }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
            style={{
              background: `linear-gradient(90deg, ${theme.accent}, #E85D00)`,
              height: '100%',
              borderRadius: 5,
            }}
          />
        </div>

        {/* Motivational message */}
        <div style={{
          fontFamily: 'Poppins',
          fontSize: 11,
          fontWeight: 600,
          marginTop: 10,
          opacity: 0.9,
          color: theme.accent,
        }}>
          {theme.icon} {data.messageProyek || theme.label}
        </div>

        {/* Stats Row */}
        <div style={{
          marginTop: 14,
          paddingTop: 12,
          borderTop: '1px solid rgba(255,255,255,0.15)',
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 8,
        }}>
          {/* Proyek (Order Masuk) */}
          <div style={{
            background: 'rgba(255,255,255,0.1)',
            borderRadius: 10,
            padding: '8px 10px',
            textAlign: 'center',
          }}>
            <div style={{ fontFamily: 'Poppins', fontSize: 14, fontWeight: 700 }}>
              {rp(todayProyek)}
            </div>
            <div style={{ fontFamily: 'Poppins', fontSize: 9, opacity: 0.8, marginTop: 2 }}>
              📥 Proyek
            </div>
          </div>

          {/* Real (Cash Received) */}
          <div style={{
            background: 'rgba(255,255,255,0.1)',
            borderRadius: 10,
            padding: '8px 10px',
            textAlign: 'center',
          }}>
            <div style={{ fontFamily: 'Poppins', fontSize: 14, fontWeight: 700 }}>
              {rp(todayActual)}
            </div>
            <div style={{ fontFamily: 'Poppins', fontSize: 9, opacity: 0.8, marginTop: 2 }}>
              💰 Real
            </div>
          </div>

          {/* Pending */}
          <div style={{
            background: 'rgba(255,255,255,0.1)',
            borderRadius: 10,
            padding: '8px 10px',
            textAlign: 'center',
          }}>
            <div style={{ fontFamily: 'Poppins', fontSize: 14, fontWeight: 700 }}>
              {rp(todayProyekPending)}
            </div>
            <div style={{ fontFamily: 'Poppins', fontSize: 9, opacity: 0.8, marginTop: 2 }}>
              ⏳ Pending
            </div>
          </div>
        </div>

        {/* Monthly Stats Row */}
        <div style={{
          marginTop: 8,
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 8,
        }}>
          <div style={{
            background: 'rgba(255,255,255,0.08)',
            borderRadius: 10,
            padding: '8px 10px',
            textAlign: 'center',
          }}>
            <div style={{ fontFamily: 'Poppins', fontSize: 14, fontWeight: 700 }}>
              {monthProyekPct}%
            </div>
            <div style={{ fontFamily: 'Poppins', fontSize: 9, opacity: 0.7, marginTop: 2 }}>
              Proyek Bulanan
            </div>
          </div>
          <div style={{
            background: 'rgba(255,255,255,0.08)',
            borderRadius: 10,
            padding: '8px 10px',
            textAlign: 'center',
          }}>
            <div style={{ fontFamily: 'Poppins', fontSize: 14, fontWeight: 700 }}>
              {rp(monthProyek)}
            </div>
            <div style={{ fontFamily: 'Poppins', fontSize: 9, opacity: 0.7, marginTop: 2 }}>
              Total Bulan
            </div>
          </div>
          <div style={{
            background: 'rgba(255,255,255,0.08)',
            borderRadius: 10,
            padding: '8px 10px',
            textAlign: 'center',
          }}>
            <div style={{ fontFamily: 'Poppins', fontSize: 14, fontWeight: 700 }}>
              {todayAllTxCount}
            </div>
            <div style={{ fontFamily: 'Poppins', fontSize: 9, opacity: 0.7, marginTop: 2 }}>
              Transaksi
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
