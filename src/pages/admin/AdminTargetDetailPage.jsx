// ─────────────────────────────────────────────────────────────────────────────
// AdminTargetDetailPage — visualisasi capaian harian per outlet
// ─────────────────────────────────────────────────────────────────────────────
// Dibuat untuk orang awam — bahasa simpel, color-coded, no jargon.
// ─────────────────────────────────────────────────────────────────────────────
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import axios from 'axios';
import { TopBar, Select, Btn } from '../../components/ui';
import { C, SHADOW } from '../../utils/theme';
import { rp } from '../../utils/helpers';
import { useResponsive } from '../../utils/hooks';

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
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: C.n50, overflow: 'hidden' }}>
      <TopBar
        title="Detail Capaian Target"
        subtitle={data ? `${MONTHS[month - 1]} ${year} · ${outletName}` : 'Pilih outlet & periode'}
        onBack={goBack}
      />

      <div style={{ flex: 1, overflowY: 'auto', padding: '14px 16px 24px' }}>
        {/* Filter */}
        <div style={{ background: 'white', borderRadius: 12, padding: isMobile ? 10 : 12, marginBottom: 14, boxShadow: SHADOW.sm }}>
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
          <div style={{ textAlign: 'center', padding: 30, fontFamily: 'Poppins', color: C.n800 }}>
            Memuat capaian...
          </div>
        )}

        {!loading && (!data || data.monthlyTarget === 0) && (
          <div style={{
            background: 'white', borderRadius: 16, padding: '40px 20px',
            textAlign: 'center', boxShadow: SHADOW.sm,
          }}>
            <div style={{ fontSize: 56, marginBottom: 12 }}>🎯</div>
            <div style={{ fontFamily: 'Poppins', fontSize: 14, fontWeight: 600, color: C.n900, marginBottom: 6 }}>
              Belum ada target untuk periode ini
            </div>
            <div style={{ fontFamily: 'Poppins', fontSize: 12, color: C.n800, marginBottom: 16, lineHeight: 1.5 }}>
              Set target bulanan dulu di halaman Manajemen Target,<br />
              lalu balik ke sini untuk lihat detail capaian harian.
            </div>
            <Btn variant="primary" onClick={() => navigate('admin_target')}>
              Atur Target Sekarang
            </Btn>
          </div>
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
    <div style={{
      background: isOnTrack
        ? `linear-gradient(135deg, ${C.success}, ${C.successDark})`
        : `linear-gradient(135deg, ${C.info}, ${C.primaryDark})`,
      borderRadius: 16, padding: '20px 22px', color: 'white',
      marginBottom: 14, position: 'relative', overflow: 'hidden',
    }}>
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
          <div style={{
            background: 'white', height: '100%', borderRadius: 5,
            width: `${Math.min(100, progressPct)}%`,
            transition: 'width 0.6s ease',
          }} />
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
          <div style={{
            marginTop: 14, padding: '10px 12px',
            background: 'rgba(255,255,255,0.18)', borderRadius: 10,
          }}>
            <div style={{ fontFamily: 'Poppins', fontSize: 11, opacity: 0.9 }}>
              📌 Sisa {daysLeft} hari, butuh masuk lagi:
            </div>
            <div style={{ fontFamily: 'Poppins', fontSize: 18, fontWeight: 600, marginTop: 2 }}>
              {rp(remaining)}
            </div>
            <div style={{ fontFamily: 'Poppins', fontSize: 10, opacity: 0.85, marginTop: 2 }}>
              ≈ {rp(requiredDailyForRest)} per hari supaya target tercapai
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── TODAY ─────────────────────────────────────────────────────────────────
function TodayCard({ today, summary }) {
  const meta = STATUS_META[today.status] || STATUS_META.no_target;
  const diffPositive = today.diff >= 0;

  return (
    <div style={{
      background: 'white', borderRadius: 14, padding: '14px 16px', marginBottom: 14,
      boxShadow: SHADOW.sm,
      border: `2px solid ${meta.color}30`,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <div style={{
          width: 36, height: 36, borderRadius: 10, background: meta.bg,
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
        <div style={{ background: C.n50, borderRadius: 10, padding: '10px 12px' }}>
          <div style={{ fontFamily: 'Poppins', fontSize: 9, color: C.n800, fontWeight: 600 }}>TARGET HARI INI</div>
          <div style={{ fontFamily: 'Poppins', fontSize: 14, fontWeight: 600, color: C.n900 }}>{rp(today.target)}</div>
        </div>
        <div style={{ background: C.n50, borderRadius: 10, padding: '10px 12px' }}>
          <div style={{ fontFamily: 'Poppins', fontSize: 9, color: C.n800, fontWeight: 600 }}>SUDAH MASUK</div>
          <div style={{ fontFamily: 'Poppins', fontSize: 14, fontWeight: 600, color: meta.color }}>{rp(today.actual)}</div>
          <div style={{ fontFamily: 'Poppins', fontSize: 9, color: C.n800 }}>{today.txCount} transaksi</div>
        </div>
      </div>

      {today.target > 0 && (
        <div style={{
          marginTop: 10, padding: '8px 12px',
          background: meta.bg, borderRadius: 8,
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
          borderRadius: 8,
          fontFamily: 'Poppins', fontSize: 10,
          color: summary.cumulativeGap >= 0 ? C.successDark : C.dangerDark,
          lineHeight: 1.4,
        }}>
          📊 <strong>Akumulasi sebulan:</strong> {summary.cumulativeGap >= 0 ? 'Lebih cepat' : 'Tertinggal'}
          {' '}{rp(Math.abs(summary.cumulativeGap))} dari rata-rata harian.
        </div>
      )}
    </div>
  );
}

// ─── DAILY CHART (pure CSS bar chart) ──────────────────────────────────────
function DailyChart({ data }) {
  const maxActual = Math.max(...data.days.map(d => d.actual), data.dailyTarget * 1.5);

  return (
    <div style={{
      background: 'white', borderRadius: 14, padding: '14px 16px', marginBottom: 14,
      boxShadow: SHADOW.sm,
    }}>
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
    </div>
  );
}

// ─── SUMMARY STATS ─────────────────────────────────────────────────────────
function SummaryStats({ summary }) {
  return (
    <div style={{
      background: 'white', borderRadius: 14, padding: '14px 16px', marginBottom: 14,
      boxShadow: SHADOW.sm,
    }}>
      <div style={{ fontFamily: 'Poppins', fontSize: 12, fontWeight: 600, color: C.n900, marginBottom: 12 }}>
        📈 Ringkasan Hari
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : '1fr 1fr 1fr 1fr', gap: 8 }}>
        {[
          { label: 'Tercapai', value: summary.safeDays, color: C.success, icon: '✅' },
          { label: 'Hampir', value: summary.warningDays, color: C.warning, icon: '⚠️' },
          { label: 'Kurang', value: summary.missedDays, color: C.danger, icon: '📉' },
          { label: 'Kosong', value: summary.zeroDays, color: C.n800, icon: '⊘' },
        ].map(s => (
          <div key={s.label} style={{
            background: `${s.color}10`, borderRadius: 10, padding: '10px 8px',
            textAlign: 'center',
          }}>
            <div style={{ fontSize: 18 }}>{s.icon}</div>
            <div style={{ fontFamily: 'Poppins', fontSize: 18, fontWeight: 600, color: s.color, marginTop: 2 }}>
              {s.value}
            </div>
            <div style={{ fontFamily: 'Poppins', fontSize: 9, color: C.n800, fontWeight: 600 }}>
              {s.label}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── DAILY TABLE ───────────────────────────────────────────────────────────
function DailyTable({ days }) {
  // Show only days that already passed (& today)
  const visibleDays = days.filter(d => d.isPast || d.isToday).reverse();

  return (
    <div style={{
      background: 'white', borderRadius: 14, padding: '14px 16px',
      boxShadow: SHADOW.sm,
    }}>
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
              width: 40, height: 40, borderRadius: 10,
              background: d.isToday ? `${meta.color}25` : meta.bg,
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
    </div>
  );
}
