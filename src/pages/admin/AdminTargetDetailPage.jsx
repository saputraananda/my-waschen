// ─────────────────────────────────────────────────────────────────────────────
// AdminTargetDetailPage — visualisasi capaian harian per outlet
// ─────────────────────────────────────────────────────────────────────────────
// Dibuat untuk orang awam — bahasa simpel, color-coded, no jargon.
// ─────────────────────────────────────────────────────────────────────────────
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { motion } from 'framer-motion';
import axios from 'axios';
import { TopBar, Select, Btn } from '../../components/ui';
import { C } from '../../utils/theme';
import { rp } from '../../utils/helpers';
import { useResponsive } from '../../utils/hooks';
import { GlowOrb, Sparkle, FloatingBubble } from '../../components/ui/PremiumAnimations';
import bubbleIcon from '../../assets/Decorative icon/bubble-1.webp';
import bubble2Icon from '../../assets/Decorative icon/bubble-2.webp';

// ─── Premium Card Style ──────────────────────────────────────────────────────
const PREMIUM_CARD = {
  background: 'linear-gradient(145deg, #FFFFFF, #F8F4FF)',
  boxShadow: '10px 10px 24px rgba(110, 46, 120, 0.1), -5px -5px 14px rgba(255, 255, 255, 0.95)',
  borderRadius: 18,
};

// ─── Skeleton Block ───────────────────────────────────────────────────────────
function SkeletonBlock({ height = 200, style = {} }) {
  return (
    <div style={{
      height,
      borderRadius: 18,
      background: 'linear-gradient(90deg, rgba(91,0,95,0.05) 25%, rgba(91,0,95,0.1) 50%, rgba(91,0,95,0.05) 75%)',
      backgroundSize: '200% 100%',
      animation: 'shimmer 1.5s infinite',
      marginBottom: 10,
      ...style,
    }} />
  );
}

const MONTHS = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];

const STATUS_META = {
  safe:     { color: C.success, bg: C.successBg, label: 'Tercapai',  icon: '✅' },
  warning:  { color: C.warning, bg: C.warningBg, label: 'Hampir',    icon: '⚠️' },
  missed:   { color: C.danger, bg: C.dangerBg, label: 'Kurang',    icon: '📉' },
  zero:     { color: C.n800, bg: C.n100, label: 'Kosong',    icon: '⊘' },
  pending:  { color: C.n300, bg: C.n50,  label: 'Belum', icon: '⏳' },
  no_target:{ color: C.n800, bg: C.n100, label: '-',        icon: '·' },
};

export default function AdminTargetDetailPage({ navigate, goBack, screenParams }) {
  const { isMobile } = useResponsive();
  const now = new Date();
  const [year, setYear] = useState(screenParams?.year || now.getFullYear());
  const [month, setMonth] = useState(screenParams?.month || (now.getMonth() + 1));
  const [outletId, setOutletId] = useState(screenParams?.outletId || '');
  const [outlets, setOutlets] = useState([]);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  // Load outlets
  const outletIdRef = useRef(outletId);
  useEffect(() => {
    outletIdRef.current = outletId;
  }, [outletId]);

  useEffect(() => {
    axios.get('/api/master/outlets').then(r => {
      const list = r?.data?.data || [];
      setOutlets(list);
      if (!outletIdRef.current && list.length) setOutletId(list[0].id);
    });
  }, []);

  const fetchProgress = useCallback(async () => {
    if (!outletId) return;
    setLoading(true);
    try {
      const res = await axios.get('/api/targets/daily-progress', {
        params: { outletId, year, month },
      });
      setData(res?.data?.data || null);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [outletId, year, month]);

  useEffect(() => { fetchProgress(); }, [fetchProgress]);

  const outletName = outlets.find(o => o.id === Number(outletId))?.name || '';

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#F3EEF7', overflow: 'hidden' }}>
      <style>{`
        @keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
        @keyframes floatA { 0%,100%{transform:translate(0,0) scale(1)} 50%{transform:translate(-14px,16px) scale(1.08)} }
        @keyframes twinkle { 0%,100%{opacity:0;transform:scale(0.4) rotate(0deg)} 50%{opacity:1;transform:scale(1) rotate(20deg)} }
      `}</style>

      {/* ── Premium Header ── */}
      <div style={{
        background: 'linear-gradient(135deg, #5B005F 0%, #4D0051 100%)',
        padding: '16px 20px 52px',
        position: 'relative',
        overflow: 'hidden',
      }}>
        <GlowOrb color="rgba(140, 76, 143, 0.4)" size={200} top="-60px" left="-30px" blur={50} />
        <GlowOrb color="rgba(249, 62, 17, 0.25)" size={150} top="40px" right="-40px" blur={40} />
        <Sparkle top="10%" left="15%" size={8} delay={0} color="#FFD700" />
        <Sparkle top="20%" left="80%" size={6} delay={0.5} color="#FF6B6B" />
        <Sparkle top="60%" left="25%" size={7} delay={1} color="#4ECDC4" />
        <FloatingBubble src={bubbleIcon} size={18} top="15%" left="5%" delay={0} opacity={0.4} />
        <FloatingBubble src={bubble2Icon} size={14} top="35%" right="8%" delay={0.5} opacity={0.35} />

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', position: 'relative', zIndex: 2 }}>
          <div>
            <div style={{ fontFamily: 'Poppins', fontSize: 20, fontWeight: 700, color: 'white', letterSpacing: '-0.3px' }}>
              Detail Capaian Target
            </div>
            <div style={{ fontFamily: 'Poppins', fontSize: 11, color: 'rgba(255,255,255,0.8)', marginTop: 4 }}>
              {data ? `${MONTHS[month - 1]} ${year} · ${outletName}` : 'Pilih outlet & periode'}
            </div>
          </div>
          {goBack && (
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={goBack}
              style={{
                background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.25)',
                borderRadius: 10, padding: '8px 12px', cursor: 'pointer', color: 'white',
              }}
            >
              ← Kembali
            </motion.button>
          )}
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '14px 16px 24px' }}>
        {/* Filter */}
        <div style={{ ...PREMIUM_CARD, padding: isMobile ? 10 : 12, marginBottom: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 8, marginBottom: 8 }}>
            <Select
              label="Tahun"
              value={year}
              onChange={(v) => setYear(Number(v))}
              options={[year - 1, year, year + 1].map(y => ({ value: y, label: String(y) }))}
            />
            <Select
              label="Bulan"
              value={month}
              onChange={(v) => setMonth(Number(v))}
              options={MONTHS.map((name, i) => ({ value: i + 1, label: name }))}
            />
          </div>
          <Select
            label="Outlet"
            value={outletId}
            onChange={(v) => setOutletId(Number(v))}
            options={outlets.map(o => ({ value: o.id, label: o.name }))}
          />
        </div>

        {loading && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <SkeletonBlock height={200} />
            <SkeletonBlock height={120} />
          </div>
        )}

        {!loading && (!data || data.monthlyTarget === 0) && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            style={{
              ...PREMIUM_CARD,
              padding: '40px 20px',
              textAlign: 'center',
            }}
          >
            <div style={{
              width: 64, height: 64, borderRadius: 20,
              background: 'linear-gradient(145deg, #F8F4FF, #FFFFFF)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '8px 8px 20px rgba(110, 46, 120, 0.12), -4px -4px 10px rgba(255, 255, 255, 0.95)',
              margin: '0 auto 16px'
            }}>
              <span style={{ fontSize: 28 }}>🎯</span>
            </div>
            <div style={{ fontFamily: 'Poppins', fontSize: 14, fontWeight: 600, color: C.n900, marginBottom: 6 }}>
              Belum ada target untuk periode ini
            </div>
            <div style={{ fontFamily: 'Poppins', fontSize: 12, color: C.n800, marginBottom: 16, lineHeight: 1.5 }}>
              Set target bulanan dulu di halaman Manajemen Target,<br />
              lalu balik ke sini untuk lihat detail capaian harian.
            </div>
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={() => navigate('admin_target')}
              style={{
                padding: '10px 24px',
                borderRadius: 14,
                border: 'none',
                background: `linear-gradient(135deg, ${C.primary}, ${C.primaryDark})`,
                color: 'white',
                fontFamily: 'Poppins',
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
                boxShadow: '0 4px 14px rgba(91, 0, 95, 0.25)',
              }}
            >
              Atur Target Sekarang
            </motion.button>
          </motion.div>
        )}

        {!loading && data && data.monthlyTarget > 0 && (
          <>
            {/* HERO — overall progress */}
            <HeroCard data={data} />

            {/* TODAY focus */}
            {data.summary && data.days.find(d => d.isToday) && (
              <TodayCard
                today={data.days.find(d => d.isToday)}
                summary={data.summary}
              />
            )}

            {/* CHART — daily bars */}
            <DailyChart data={data} />

            {/* SUMMARY STATS */}
            <SummaryStats summary={data.summary} />

            {/* DAILY TABLE */}
            <DailyTable days={data.days} />
          </>
        )}
      </div>
    </div>
  );
}

// ─── HERO ──────────────────────────────────────────────────────────────────
function HeroCard({ data }) {
  const { monthlyTarget, summary } = data;
  const { totalActual, progressPct, remaining, daysLeft, requiredDailyForRest, isOnTrack } = summary;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      style={{
        background: isOnTrack
          ? `linear-gradient(135deg, ${C.success}, ${C.successDark})`
          : `linear-gradient(135deg, ${C.info}, ${C.primaryDark})`,
        borderRadius: 18, padding: '20px 22px', color: 'white',
        marginBottom: 14, position: 'relative', overflow: 'hidden',
        boxShadow: '0 8px 24px rgba(110, 46, 120, 0.2)',
      }}
    >
      <div style={{ position: 'absolute', top: -30, right: -30, width: 140, height: 140, borderRadius: '50%', background: 'radial-gradient(circle, rgba(255,255,255,0.15), transparent 70%)' }} />
      <div style={{ position: 'relative' }}>
        <div style={{ fontFamily: 'Poppins', fontSize: 11, opacity: 0.85, fontWeight: 600, letterSpacing: 0.4 }}>
          {isOnTrack ? '🎯 ON TRACK' : '🚀 BUTUH KEJAR-KEJARAN'}
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 6 }}>
          <span style={{ fontFamily: 'Poppins', fontSize: 32, fontWeight: 600 }}>{progressPct}%</span>
          <span style={{ fontFamily: 'Poppins', fontSize: 12, opacity: 0.85 }}>tercapai</span>
        </div>

        {/* Big progress bar */}
        <div style={{
          background: 'rgba(255,255,255,0.18)', height: 10, borderRadius: 5,
          overflow: 'hidden', marginTop: 10,
        }}>
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${Math.min(100, progressPct)}%` }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
            style={{
              background: 'white', height: '100%', borderRadius: 5,
            }}
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginTop: 16 }}>
          <div>
            <div style={{ fontFamily: 'Poppins', fontSize: 9, opacity: 0.8 }}>Sudah Masuk</div>
            <div style={{ fontFamily: 'Poppins', fontSize: isMobile ? 14 : 16, fontWeight: 600 }}>{rp(totalActual)}</div>
          </div>
          <div>
            <div style={{ fontFamily: 'Poppins', fontSize: 9, opacity: 0.8 }}>Target Bulan Ini</div>
            <div style={{ fontFamily: 'Poppins', fontSize: isMobile ? 14 : 16, fontWeight: 600 }}>{rp(monthlyTarget)}</div>
          </div>
        </div>

        {remaining > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            style={{
              marginTop: 14, padding: '10px 12px',
              background: 'rgba(255,255,255,0.18)', borderRadius: 12,
            }}
          >
            <div style={{ fontFamily: 'Poppins', fontSize: 11, opacity: 0.9 }}>
              📌 Sisa {daysLeft} hari, butuh masuk lagi:
            </div>
            <div style={{ fontFamily: 'Poppins', fontSize: 18, fontWeight: 600, marginTop: 2 }}>
              {rp(remaining)}
            </div>
            <div style={{ fontFamily: 'Poppins', fontSize: 10, opacity: 0.85, marginTop: 2 }}>
              ≈ {rp(requiredDailyForRest)} per hari supaya target tercapai
            </div>
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}

// ─── TODAY ─────────────────────────────────────────────────────────────────
function TodayCard({ today, summary }) {
  const meta = STATUS_META[today.status] || STATUS_META.no_target;
  const diffPositive = today.diff >= 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 }}
      style={{
        ...PREMIUM_CARD,
        padding: '14px 16px', marginBottom: 14,
        border: `2px solid ${meta.color}30`,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <div style={{
          width: 40, height: 40, borderRadius: 12,
          background: 'linear-gradient(145deg, #FFFFFF, #F8F4FF)',
          boxShadow: '4px 4px 10px rgba(110, 46, 120, 0.1), -2px -2px 6px rgba(255, 255, 255, 0.95)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18,
        }}>{meta.icon}</div>
        <div>
          <div style={{ fontFamily: 'Poppins', fontSize: 11, color: C.n800, fontWeight: 600 }}>
            HARI INI · TANGGAL {today.day}
          </div>
          <div style={{ fontFamily: 'Poppins', fontSize: 14, fontWeight: 600, color: meta.color }}>
            {meta.label} target
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 10 }}>
        <div style={{ background: 'linear-gradient(145deg, #F8F4FF, #FFFFFF)', borderRadius: 10, padding: '10px 12px', boxShadow: '4px 4px 10px rgba(110, 46, 120, 0.08), -2px -2px 6px rgba(255, 255, 255, 0.95)' }}>
          <div style={{ fontFamily: 'Poppins', fontSize: 9, color: C.n800, fontWeight: 600 }}>TARGET HARI INI</div>
          <div style={{ fontFamily: 'Poppins', fontSize: 14, fontWeight: 600, color: C.n900 }}>{rp(today.target)}</div>
        </div>
        <div style={{ background: 'linear-gradient(145deg, #F8F4FF, #FFFFFF)', borderRadius: 10, padding: '10px 12px', boxShadow: '4px 4px 10px rgba(110, 46, 120, 0.08), -2px -2px 6px rgba(255, 255, 255, 0.95)' }}>
          <div style={{ fontFamily: 'Poppins', fontSize: 9, color: C.n800, fontWeight: 600 }}>SUDAH MASUK</div>
          <div style={{ fontFamily: 'Poppins', fontSize: 14, fontWeight: 600, color: meta.color }}>{rp(today.actual)}</div>
          <div style={{ fontFamily: 'Poppins', fontSize: 9, color: C.n800 }}>{today.txCount} transaksi</div>
        </div>
      </div>

      {today.target > 0 && (
        <div style={{
          marginTop: 10, padding: '8px 12px',
          background: meta.bg, borderRadius: 10,
          fontFamily: 'Poppins', fontSize: 11, color: meta.color, fontWeight: 600,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <span>{diffPositive ? 'Surplus' : 'Selisih'}</span>
          <span>{diffPositive ? '+' : ''}{rp(today.diff)} ({today.diffPct >= 0 ? '+' : ''}{today.diffPct}%)</span>
        </div>
      )}

      {summary?.cumulativeGap !== undefined && (
        <div style={{
          marginTop: 8, padding: '8px 12px',
          background: summary.cumulativeGap >= 0 ? C.successBg : C.dangerBg,
          borderRadius: 10,
          fontFamily: 'Poppins', fontSize: 10,
          color: summary.cumulativeGap >= 0 ? C.successDark : C.dangerDark,
          lineHeight: 1.4,
        }}>
          📊 <strong>Akumulasi sebulan:</strong> {summary.cumulativeGap >= 0 ? 'Lebih cepat' : 'Tertinggal'}
          {' '}{rp(Math.abs(summary.cumulativeGap))} dari rata-rata harian.
        </div>
      )}
    </motion.div>
  );
}

// ─── DAILY CHART (pure CSS bar chart) ──────────────────────────────────────
function DailyChart({ data }) {
  const maxActual = Math.max(...data.days.map(d => d.actual), data.dailyTarget * 1.5);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.15 }}
      style={{
        ...PREMIUM_CARD,
        padding: '14px 16px', marginBottom: 14,
      }}
    >
      <div style={{ fontFamily: 'Poppins', fontSize: 12, fontWeight: 600, color: C.n900, marginBottom: 4 }}>
        📊 Capaian Harian
      </div>
      <div style={{ fontFamily: 'Poppins', fontSize: 10, color: C.n800, marginBottom: 12 }}>
        Garis putus = target harian {rp(data.dailyTarget)}
      </div>

      <div style={{ position: 'relative', height: 140, marginTop: 8 }}>
        {/* Target line */}
        <div style={{
          position: 'absolute', left: 0, right: 0,
          bottom: `${(data.dailyTarget / maxActual) * 100}%`,
          height: 1, borderTop: `1.5px dashed ${C.n600}`,
          zIndex: 1,
        }} />

        {/* Bars */}
        <div style={{
          display: 'flex', alignItems: 'flex-end', gap: 2,
          height: '100%', position: 'relative', zIndex: 2,
        }}>
          {data.days.map(d => {
            const meta = STATUS_META[d.status] || STATUS_META.no_target;
            const heightPct = maxActual > 0 ? (d.actual / maxActual) * 100 : 0;
            return (
              <div
                key={d.day}
                title={`Tgl ${d.day}: ${rp(d.actual)}`}
                style={{
                  flex: 1, minHeight: 2,
                  height: `${Math.max(2, heightPct)}%`,
                  background: meta.color,
                  borderRadius: '2px 2px 0 0',
                  opacity: d.isFuture ? 0.25 : 1,
                  border: d.isToday ? `2px solid ${C.n800}` : 'none',
                  transition: 'all 0.4s ease',
                }}
              />
            );
          })}
        </div>
      </div>

      {/* Day labels (every 5 days) */}
      <div style={{ display: 'flex', gap: 2, marginTop: 6 }}>
        {data.days.map(d => (
          <div key={d.day} style={{
            flex: 1, textAlign: 'center',
            fontFamily: 'Poppins', fontSize: 8,
            color: d.isToday ? C.primary : C.n800,
            fontWeight: d.isToday ? 700 : 400,
          }}>
            {d.day % 5 === 0 || d.day === 1 || d.isToday ? d.day : ''}
          </div>
        ))}
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: 12, marginTop: 12, flexWrap: 'wrap', fontFamily: 'Poppins', fontSize: 9 }}>
        {Object.entries(STATUS_META).filter(([k]) => k !== 'no_target' && k !== 'pending').map(([k, m]) => (
          <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 8, height: 8, background: m.color, borderRadius: 2 }} />
            <span style={{ color: C.n800 }}>{m.label}</span>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

// ─── SUMMARY STATS ─────────────────────────────────────────────────────────
function SummaryStats({ summary }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
      style={{
        ...PREMIUM_CARD,
        padding: '14px 16px', marginBottom: 14,
      }}
    >
      <div style={{ fontFamily: 'Poppins', fontSize: 12, fontWeight: 600, color: C.n900, marginBottom: 12 }}>
        📈 Ringkasan Hari
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
        {[
          { label: 'Tercapai', value: summary.safeDays, color: C.success, icon: '✅' },
          { label: 'Hampir', value: summary.warningDays, color: C.warning, icon: '⚠️' },
          { label: 'Kurang', value: summary.missedDays, color: C.danger, icon: '📉' },
          { label: 'Kosong', value: summary.zeroDays, color: C.n800, icon: '⊘' },
        ].map(s => (
          <motion.div
            key={s.label}
            whileHover={{ y: -2 }}
            style={{
              background: `${s.color}10`, borderRadius: 12, padding: '10px 8px',
              textAlign: 'center',
              boxShadow: '4px 4px 10px rgba(110, 46, 120, 0.08), -2px -2px 6px rgba(255, 255, 255, 0.95)',
            }}
          >
            <div style={{ fontSize: 18 }}>{s.icon}</div>
            <div style={{ fontFamily: 'Poppins', fontSize: 18, fontWeight: 600, color: s.color, marginTop: 2 }}>
              {s.value}
            </div>
            <div style={{ fontFamily: 'Poppins', fontSize: 9, color: C.n800, fontWeight: 600 }}>
              {s.label}
            </div>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}

// ─── DAILY TABLE ───────────────────────────────────────────────────────────
function DailyTable({ days }) {
  // Show only days that already passed (& today)
  const visibleDays = days.filter(d => d.isPast || d.isToday).reverse();

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.25 }}
      style={{
        ...PREMIUM_CARD,
        padding: '14px 16px',
      }}
    >
      <div style={{ fontFamily: 'Poppins', fontSize: 12, fontWeight: 600, color: C.n900, marginBottom: 12 }}>
        📅 Detail Per Hari
      </div>

      {visibleDays.length === 0 ? (
        <div style={{ fontFamily: 'Poppins', fontSize: 12, color: C.n800, textAlign: 'center', padding: 20 }}>
          Belum ada hari yang lewat di bulan ini.
        </div>
      ) : visibleDays.map(d => {
        const meta = STATUS_META[d.status] || STATUS_META.no_target;
        return (
          <div key={d.day} style={{
            display: 'flex', alignItems: 'center', gap: 12,
            padding: '10px 0', borderTop: d.day !== visibleDays[0].day ? `1px solid ${C.n100}` : 'none',
          }}>
            <div style={{
              width: 44, height: 44, borderRadius: 12,
              background: 'linear-gradient(145deg, #FFFFFF, #F8F4FF)',
              boxShadow: '4px 4px 10px rgba(110, 46, 120, 0.08), -2px -2px 6px rgba(255, 255, 255, 0.95)',
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center',
              border: d.isToday ? `2px solid ${meta.color}` : 'none',
              flexShrink: 0,
            }}>
              <div style={{ fontFamily: 'Poppins', fontSize: 14, fontWeight: 600, color: meta.color, lineHeight: 1 }}>
                {d.day}
              </div>
              <div style={{ fontSize: 9, marginTop: 1 }}>{meta.icon}</div>
            </div>

            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <div style={{ fontFamily: 'Poppins', fontSize: 12, fontWeight: 600, color: C.n900 }}>
                  {rp(d.actual)}
                  {d.isToday && (
                    <span style={{ fontSize: 9, color: C.primary, marginLeft: 6, fontWeight: 600 }}>HARI INI</span>
                  )}
                </div>
                <div style={{
                  fontFamily: 'Poppins', fontSize: 11, fontWeight: 600,
                  color: d.diff >= 0 ? C.successDark : C.dangerDark,
                }}>
                  {d.diff >= 0 ? '+' : ''}{rp(d.diff)}
                </div>
              </div>
              <div style={{ fontFamily: 'Poppins', fontSize: 10, color: C.n800, marginTop: 2 }}>
                Target: {rp(d.target)} · {d.txCount} transaksi · <span style={{ color: meta.color, fontWeight: 600 }}>{meta.label}</span>
              </div>
              {/* Mini progress bar */}
              <div style={{
                height: 4, background: C.n100, borderRadius: 2,
                overflow: 'hidden', marginTop: 6,
              }}>
                <div style={{
                  height: '100%',
                  width: `${Math.min(100, d.target > 0 ? (d.actual / d.target) * 100 : 0)}%`,
                  background: meta.color, borderRadius: 2,
                }} />
              </div>
            </div>
          </div>
        );
      })}
    </motion.div>
  );
}
