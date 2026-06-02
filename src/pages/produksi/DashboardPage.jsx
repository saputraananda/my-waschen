import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import axios from 'axios';
import { C } from '../../utils/theme';
import { STAGES } from '../../utils/helpers';
import { Avatar, Btn, SkeletonList, useAppRefresh } from '../../components/ui';
import { alertInfo } from '../../utils/alert';
import { useRealtimeMulti } from '../../utils/realtime';

// ════════════════════════════════════════════════════════════════════════════
// Design tokens — production-focused
// ════════════════════════════════════════════════════════════════════════════
const COLORS = {
  overdue:  { bg: '#FEF2F2', border: '#FCA5A5', text: '#991B1B', accent: '#DC2626', soft: '#FEE2E2' },
  urgent:   { bg: '#FFFBEB', border: '#FCD34D', text: '#92400E', accent: '#F59E0B', soft: '#FEF3C7' },
  warning:  { bg: '#EFF6FF', border: '#BFDBFE', text: '#1E40AF', accent: '#3B82F6', soft: '#DBEAFE' },
  normal:   { bg: '#F8FAFC', border: '#E2E8F0', text: '#475569', accent: '#64748B', soft: '#F1F5F9' },
  done:     { bg: '#F0FDF4', border: '#86EFAC', text: '#065F46', accent: '#10B981', soft: '#DCFCE7' },
  primary:  '#5B005F',
  express:  '#F59E0B',
  delivery: '#7C3AED',
};

const STAGE_ICONS = {
  Diterima: '📥',
  Cuci:     '🫧',
  Setrika:  '♨️',
  Packing:  '📦',
  Selesai:  '✅',
};

const STAGE_COLORS = {
  Diterima: '#3B82F6',
  Cuci:     '#06B6D4',
  Setrika:  '#F59E0B',
  Packing:  '#10B981',
  Selesai:  '#059669',
};

// ════════════════════════════════════════════════════════════════════════════
// Helpers
// ════════════════════════════════════════════════════════════════════════════
const getSLALevel = (estimatedDoneAt) => {
  if (!estimatedDoneAt) return null;
  const diffMin = (new Date(estimatedDoneAt) - Date.now()) / 60000;
  if (diffMin < 0)   return 'overdue';
  if (diffMin < 120) return 'urgent';
  if (diffMin < 360) return 'warning';
  return 'normal';
};

const formatSLA = (estimatedDoneAt) => {
  if (!estimatedDoneAt) return '—';
  const diffMin = Math.round((new Date(estimatedDoneAt) - Date.now()) / 60000);
  const abs = Math.abs(diffMin);
  if (diffMin < 0) {
    if (abs < 60) return `Telat ${abs}m`;
    return `Telat ${Math.floor(abs / 60)}j ${abs % 60}m`;
  }
  if (diffMin < 60) return `${diffMin}m lagi`;
  if (diffMin < 1440) return `${Math.floor(diffMin / 60)}j lagi`;
  return `${Math.round(diffMin / 1440)}h lagi`;
};

// ════════════════════════════════════════════════════════════════════════════
// Sub-components
// ════════════════════════════════════════════════════════════════════════════

// ── Hero Header — compact dengan greeting + 3 KPI inline
function HeroHeader({ user, allActive, activeItemCount, urgentCount, overdueCount, onRefresh, onProfileClick }) {
  return (
    <div style={{
      background: 'linear-gradient(135deg, #0F172A 0%, #1E293B 50%, #0C4A6E 100%)',
      padding: '10px 16px 12px',
      flexShrink: 0,
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Decorative blur shapes */}
      <div style={{
        position: 'absolute', top: -40, right: -40,
        width: 140, height: 140, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(124,58,237,0.4), transparent 70%)',
        filter: 'blur(20px)', pointerEvents: 'none',
      }} />

      {/* Top row: greeting + avatar */}
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: 'Poppins', fontSize: 9, color: 'rgba(255,255,255,0.6)', letterSpacing: 0.4, fontWeight: 600 }}>
            🏭 {user?.outlet?.name || user?.outletName || 'Outlet'}
          </div>
          <div style={{ fontFamily: 'Poppins', fontSize: 15, fontWeight: 800, color: 'white', marginTop: 1, lineHeight: 1.15 }}>
            Hai, {user?.name?.split(' ')[0] || 'Tim'} <span style={{ fontSize: 13 }}>👋</span>
            <span style={{ fontFamily: 'Poppins', fontSize: 11, fontWeight: 500, color: 'rgba(255,255,255,0.65)', marginLeft: 6 }}>
              · {activeItemCount} layanan
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          <button
            onClick={onRefresh}
            aria-label="Refresh"
            style={{
              background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.18)',
              width: 32, height: 32, borderRadius: 16, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'white', padding: 0,
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <polyline points="23 4 23 10 17 10" />
              <path d="M20.49 15a9 9 0 11-2.12-9.36L23 10" />
            </svg>
          </button>
          <Avatar photo={user?.photo} initials={user?.avatar} size={32} onClick={onProfileClick} />
        </div>
      </div>

      {/* KPI cards row — compact horizontal */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, position: 'relative' }}>
        <KpiTile
          icon="📋"
          value={allActive.length}
          label="Nota"
          tone="white"
        />
        <KpiTile
          icon="🧺"
          value={activeItemCount}
          label="Layanan"
          tone="white"
        />
        <KpiTile
          icon={overdueCount > 0 ? '🔥' : urgentCount > 0 ? '⚠️' : '✓'}
          value={overdueCount + urgentCount}
          label={overdueCount > 0 ? 'Telat' : urgentCount > 0 ? 'Mendesak' : 'On Track'}
          tone={overdueCount > 0 ? 'red' : urgentCount > 0 ? 'amber' : 'green'}
        />
      </div>
    </div>
  );
}

function KpiTile({ icon, value, label, tone = 'white' }) {
  const styles = {
    white: { bg: 'rgba(255,255,255,0.10)', border: 'rgba(255,255,255,0.15)', text: 'white', sub: 'rgba(255,255,255,0.7)' },
    red:   { bg: 'rgba(239,68,68,0.20)',   border: 'rgba(252,165,165,0.35)', text: '#FEE2E2', sub: '#FECACA' },
    amber: { bg: 'rgba(245,158,11,0.20)',  border: 'rgba(252,211,77,0.35)',  text: '#FEF3C7', sub: '#FDE68A' },
    green: { bg: 'rgba(16,185,129,0.20)',  border: 'rgba(110,231,183,0.35)', text: '#D1FAE5', sub: '#A7F3D0' },
  };
  const s = styles[tone];
  return (
    <div style={{
      background: s.bg,
      border: `1px solid ${s.border}`,
      borderRadius: 10,
      padding: '6px 9px',
      backdropFilter: 'blur(10px)',
      WebkitBackdropFilter: 'blur(10px)',
      display: 'flex', alignItems: 'center', gap: 7,
    }}>
      <span style={{ fontSize: 15, flexShrink: 0 }}>{icon}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: 'Poppins', fontSize: 16, fontWeight: 800, color: s.text, lineHeight: 1 }}>{value}</div>
        <div style={{ fontFamily: 'Poppins', fontSize: 9, color: s.sub, fontWeight: 600, marginTop: 1 }}>{label}</div>
      </div>
    </div>
  );
}

// ── Stage Pipeline — show count per stage horizontally
function StagePipeline({ transactions }) {
  const stageCount = useMemo(() => {
    const counts = {};
    STAGES.forEach(s => counts[s] = 0);
    transactions.forEach(tx => {
      (tx.items || []).forEach(item => {
        if (item.isDone) return;
        const stage = item.currentStage || 'Diterima';
        if (counts[stage] !== undefined) counts[stage]++;
      });
    });
    return counts;
  }, [transactions]);

  const totalActive = Object.values(stageCount).reduce((s, n) => s + n, 0);
  if (totalActive === 0) return null;

  const stages = STAGES.slice(0, -1); // exclude 'Selesai'

  return (
    <div style={{
      background: 'white',
      borderRadius: 12,
      margin: '8px 16px 0',
      padding: '8px 12px',
      boxShadow: '0 2px 6px rgba(15,23,42,0.04)',
      border: `1px solid ${C.n100}`,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <div style={{ fontFamily: 'Poppins', fontSize: 9, fontWeight: 700, color: C.n500, letterSpacing: 0.5 }}>
          🚦 ALUR PRODUKSI
        </div>
        <div style={{ fontFamily: 'Poppins', fontSize: 10, fontWeight: 800, color: C.primary }}>
          {totalActive} layanan
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        {stages.map((s, i) => {
          const count = stageCount[s];
          const stageColor = STAGE_COLORS[s];
          const isActive = count > 0;
          return (
            <div key={s} style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 2 }}>
              <div style={{ flex: 1, textAlign: 'center' }}>
                <div style={{
                  width: 30, height: 30, margin: '0 auto 2px',
                  borderRadius: 9,
                  background: isActive ? `${stageColor}15` : C.n50,
                  border: `1.5px solid ${isActive ? stageColor : C.n200}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 14,
                  position: 'relative',
                }}>
                  {STAGE_ICONS[s]}
                  {count > 0 && (
                    <span style={{
                      position: 'absolute', top: -4, right: -4,
                      minWidth: 16, height: 16, padding: '0 3px',
                      borderRadius: 8, background: stageColor, color: 'white',
                      fontFamily: 'Poppins', fontSize: 9, fontWeight: 800,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      border: '1.5px solid white',
                    }}>
                      {count}
                    </span>
                  )}
                </div>
                <div style={{
                  fontFamily: 'Poppins', fontSize: 8.5, fontWeight: isActive ? 700 : 500,
                  color: isActive ? stageColor : C.n500,
                }}>
                  {s}
                </div>
              </div>
              {i < stages.length - 1 && (
                <div style={{
                  width: 6, height: 1, background: C.n200, flexShrink: 0, marginBottom: 12,
                  borderRadius: 1,
                }} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Item card — kompak & presisi
function ItemCard({ tx, item, onPress }) {
  const isDone = item.isDone;
  const stage = item.currentStage || 'Diterima';
  const isExpress = item.isExpress;
  const sla = isDone ? null : getSLALevel(tx.estimatedDoneAt);
  const slaC = sla ? COLORS[sla] : null;
  const stageColor = STAGE_COLORS[stage] || C.primary;

  const accent = isDone ? COLORS.done.accent
    : sla === 'overdue' ? COLORS.overdue.accent
    : sla === 'urgent' ? COLORS.urgent.accent
    : stageColor;

  // Stage progress count
  const stageIdx = STAGES.indexOf(stage);
  const totalStages = STAGES.length;
  const progressPct = isDone ? 100 : Math.max(0, Math.min(100, ((stageIdx + (item.progress?.length ? 0.5 : 0)) / totalStages) * 100));

  return (
    <button
      onClick={() => onPress(tx, item)}
      style={{
        width: '100%', textAlign: 'left',
        background: 'white',
        borderRadius: 12,
        padding: '10px 12px',
        border: `1.5px solid ${isDone ? COLORS.done.border : sla === 'overdue' ? COLORS.overdue.border : sla === 'urgent' ? COLORS.urgent.border : C.n100}`,
        boxShadow: isExpress
          ? `0 1px 6px rgba(245,158,11,0.14), inset 3px 0 0 ${COLORS.express}`
          : '0 1px 4px rgba(15,23,42,0.04)',
        cursor: 'pointer',
        position: 'relative',
        transition: 'transform 0.1s, box-shadow 0.1s',
        marginBottom: 6,
      }}
      onMouseDown={(e) => { e.currentTarget.style.transform = 'scale(0.99)'; }}
      onMouseUp={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        {/* Stage icon */}
        <div style={{
          width: 40, height: 40,
          borderRadius: 11,
          background: isDone ? COLORS.done.soft : `${accent}15`,
          border: `1.5px solid ${isDone ? COLORS.done.border : `${accent}30`}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 19, flexShrink: 0,
        }}>
          {STAGE_ICONS[stage] || '⬜'}
        </div>

        {/* Main info */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Service name + badges */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap', marginBottom: 1 }}>
            <span style={{
              fontFamily: 'Poppins', fontSize: 13, fontWeight: 700, color: C.n900,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%',
            }}>
              {item.name}
            </span>
            {isExpress && (
              <span style={{
                background: COLORS.express, color: 'white',
                fontFamily: 'Poppins', fontSize: 8, fontWeight: 800,
                padding: '1px 5px', borderRadius: 999,
              }}>⚡</span>
            )}
            {tx.pickupType === 'delivery' && (
              <span style={{
                background: '#F3E8FF', color: COLORS.delivery,
                fontFamily: 'Poppins', fontSize: 8, fontWeight: 700,
                padding: '1px 5px', borderRadius: 999,
              }}>🚗</span>
            )}
          </div>

          {/* Customer + qty */}
          <div style={{ fontFamily: 'Poppins', fontSize: 10.5, color: C.n600, display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 700, color: C.n800, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 140 }}>
              👤 {tx.customerName || 'Tanpa nama'}
            </span>
            <span style={{ color: C.n400 }}>·</span>
            <span style={{ fontWeight: 600 }}>{item.qty} {item.unit}</span>
          </div>

          {/* Stage progress */}
          <div style={{ marginTop: 5, display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ flex: 1, height: 3, borderRadius: 2, background: C.n100, overflow: 'hidden' }}>
              <div style={{
                width: `${progressPct}%`, height: '100%',
                background: isDone ? COLORS.done.accent : accent,
                borderRadius: 2, transition: 'width 0.4s',
              }} />
            </div>
            <span style={{
              fontFamily: 'Poppins', fontSize: 9, fontWeight: 700,
              color: isDone ? COLORS.done.accent : accent,
              flexShrink: 0,
            }}>
              {isDone ? '✓ Done' : stage}
            </span>
          </div>
        </div>

        {/* Right: SLA + arrow */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 5, flexShrink: 0 }}>
          {sla && slaC ? (
            <div style={{
              background: slaC.soft, color: slaC.text,
              padding: '2px 8px', borderRadius: 999,
              fontFamily: 'Poppins', fontSize: 9, fontWeight: 800,
              border: `1px solid ${slaC.border}`,
              whiteSpace: 'nowrap',
            }}>
              {sla === 'overdue' && '🔥 '}
              {formatSLA(tx.estimatedDoneAt)}
            </div>
          ) : isDone ? (
            <div style={{
              background: COLORS.done.soft, color: COLORS.done.text,
              padding: '2px 8px', borderRadius: 999,
              fontFamily: 'Poppins', fontSize: 9, fontWeight: 800,
              border: `1px solid ${COLORS.done.border}`,
            }}>
              ✓
            </div>
          ) : null}
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.n400} strokeWidth="2.5" strokeLinecap="round">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </div>
      </div>
    </button>
  );
}

// ── Section header (group items by SLA urgency)
function SectionHeader({ icon, label, count, accentColor, rightContent }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8,
      padding: '6px 4px',
      marginTop: 4,
    }}>
      <span style={{ fontSize: 14 }}>{icon}</span>
      <div style={{
        fontFamily: 'Poppins', fontSize: 11, fontWeight: 800,
        color: accentColor, letterSpacing: 0.5,
      }}>
        {label.toUpperCase()}
      </div>
      <div style={{
        background: accentColor, color: 'white',
        fontFamily: 'Poppins', fontSize: 10, fontWeight: 800,
        padding: '1px 8px', borderRadius: 999,
      }}>
        {count}
      </div>
      <div style={{ flex: 1, height: 1, background: `${accentColor}25`, marginLeft: 4 }} />
      {rightContent}
    </div>
  );
}

// ── Filter toggle icons — buat tab switcher Aktif/Selesai
function FilterToggle({ filter, setFilter, activeCount, doneCount }) {
  const items = [
    { key: 'aktif',   icon: '📋', count: activeCount, title: 'Aktif' },
    { key: 'selesai', icon: '✅', count: doneCount,   title: 'Selesai' },
  ];
  return (
    <div style={{ display: 'flex', gap: 5, flexShrink: 0 }}>
      {items.map(it => {
        const isActive = filter === it.key;
        return (
          <button
            key={it.key}
            onClick={() => setFilter(it.key)}
            title={it.title}
            style={{
              display: 'flex', alignItems: 'center', gap: 4,
              padding: '5px 10px', borderRadius: 999,
              border: `1.5px solid ${isActive ? C.primary : C.n200}`,
              background: isActive ? `${C.primary}12` : 'white',
              cursor: 'pointer', flexShrink: 0,
              transition: 'all 0.15s',
              minHeight: 30,
            }}
          >
            <span style={{ fontSize: 15, lineHeight: 1 }}>{it.icon}</span>
            {it.count > 0 && (
              <span style={{
                fontFamily: 'Poppins', fontSize: 11, fontWeight: 800,
                color: isActive ? C.primary : C.n600,
                lineHeight: 1,
              }}>
                {it.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

// ── Empty state
function EmptyState({ filter, lastRefresh }) {
  return (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      padding: '60px 24px', textAlign: 'center',
    }}>
      <div style={{
        width: 80, height: 80, borderRadius: 24,
        background: 'linear-gradient(135deg, #ECFDF5, #D1FAE5)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        marginBottom: 16, fontSize: 38,
        boxShadow: '0 8px 24px rgba(16,185,129,0.15)',
      }}>
        {filter === 'aktif' ? '✨' : '📋'}
      </div>
      <div style={{ fontFamily: 'Poppins', fontSize: 18, fontWeight: 800, color: C.n900, marginBottom: 6 }}>
        {filter === 'aktif' ? 'Semua selesai!' : 'Belum ada data'}
      </div>
      <div style={{ fontFamily: 'Poppins', fontSize: 13, color: C.n500, lineHeight: 1.5, maxWidth: 280 }}>
        {filter === 'aktif'
          ? 'Tidak ada antrian aktif saat ini. Order baru akan muncul otomatis di sini.'
          : 'Tidak ada data yang sesuai filter.'}
      </div>
      {lastRefresh && (
        <div style={{ fontFamily: 'Poppins', fontSize: 10, color: C.n400, marginTop: 14 }}>
          Diperbarui {lastRefresh.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
        </div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// Main Dashboard
// ════════════════════════════════════════════════════════════════════════════
export default function ProduksiDashboardPage({ user, navigate }) {
  const [filter, setFilter] = useState('aktif');
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [lastRefresh, setLastRefresh] = useState(null);
  const [workstation, setWorkstation] = useState(() => localStorage.getItem('produksi_workstation') || 'Semua');
  const prevTxIds = useRef(new Set());

  const handleWorkstationChange = (ws) => {
    setWorkstation(ws);
    localStorage.setItem('produksi_workstation', ws);
  };

  const fetchQueue = useCallback(async (silent = false) => {
    if (!silent) { setError(null); setLoading(true); }
    try {
      const res = await axios.get('/api/transactions/production/queue');
      const data = res?.data?.data || [];

      if (silent && data.length > 0) {
        const currentIds = new Set(data.map(t => t.id));
        const hasNew = data.some(t => !prevTxIds.current.has(t.id) && t.status === 'baru');
        if (hasNew && prevTxIds.current.size > 0) {
          alertInfo('Cucian baru saja ditambahkan oleh kasir.', { title: 'Order Baru Masuk!' });
        }
        prevTxIds.current = currentIds;
      } else if (!silent) {
        prevTxIds.current = new Set(data.map(t => t.id));
      }

      setTransactions(data);
      setLastRefresh(new Date());
    } catch (err) {
      console.error('Failed to fetch production queue:', err);
      if (!silent) setError('Gagal memuat data. Tap untuk coba lagi.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchQueue();
    const interval = setInterval(() => fetchQueue(true), 30000);
    return () => clearInterval(interval);
  }, [fetchQueue]);

  // Pull-to-refresh
  useAppRefresh(() => fetchQueue(), [fetchQueue]);

  // Realtime: refresh saat checkout / photo / production update
  useRealtimeMulti(['transaction:checkout', 'production:photo', 'production:update'], () => {
    fetchQueue(true); // silent refresh — ga show loading
  });

  // Derived state
  const allActive = useMemo(() =>
    transactions.filter(t => {
      const items = t.items || [];
      return items.length === 0 || !items.every(i => i.isDone);
    }),
    [transactions]
  );

  const allDone = useMemo(() =>
    transactions.filter(t => {
      const items = t.items || [];
      return items.length > 0 && items.every(i => i.isDone);
    }),
    [transactions]
  );

  // Total active items
  const activeItemCount = useMemo(() =>
    allActive.reduce((s, t) => s + (t.items || []).filter(i => !i.isDone).length, 0),
    [allActive]
  );

  // Total done items (per layanan, bukan per nota) — dipakai counter banner & FilterToggle konsisten
  const doneItemCount = useMemo(() =>
    transactions.reduce((s, t) => s + (t.items || []).filter(i => i.isDone).length, 0),
    [transactions]
  );

  // Urgent & overdue counts (per item)
  const { urgentCount, overdueCount } = useMemo(() => {
    let urgent = 0, overdue = 0;
    allActive.forEach(tx => {
      const sla = getSLALevel(tx.estimatedDoneAt);
      if (sla === 'overdue') overdue += (tx.items || []).filter(i => !i.isDone).length;
      else if (sla === 'urgent') urgent += (tx.items || []).filter(i => !i.isDone).length;
    });
    return { urgentCount: urgent, overdueCount: overdue };
  }, [allActive]);

  // Build flat list of items with tx context, with workstation filter
  const flatItems = useMemo(() => {
    const sourceTx = filter === 'aktif' ? allActive
      : filter === 'selesai' ? allDone
      : transactions;

    const items = [];
    sourceTx.forEach(tx => {
      (tx.items || []).forEach(item => {
        // Filter by workstation: only show items that match current stage
        if (workstation !== 'Semua' && !item.isDone) {
          if (item.currentStage !== workstation) return;
        }
        // For "selesai" filter, show all done items (regardless of workstation)
        // For "aktif", skip done items
        if (filter === 'aktif' && item.isDone) return;
        items.push({ tx, item });
      });
    });
    return items;
  }, [filter, allActive, allDone, transactions, workstation]);

  // Group items by urgency level
  const groupedItems = useMemo(() => {
    const groups = { overdue: [], urgent: [], warning: [], normal: [], done: [] };
    flatItems.forEach(({ tx, item }) => {
      if (item.isDone) {
        groups.done.push({ tx, item });
        return;
      }
      // Express always goes to highest active group it qualifies for
      const sla = getSLALevel(tx.estimatedDoneAt);
      if (sla === 'overdue') groups.overdue.push({ tx, item });
      else if (sla === 'urgent') groups.urgent.push({ tx, item });
      else if (sla === 'warning') groups.warning.push({ tx, item });
      else groups.normal.push({ tx, item });
    });

    // Within each group, sort: express first, then by deadline
    Object.keys(groups).forEach(k => {
      groups[k].sort((a, b) => {
        const aExp = !!a.item.isExpress;
        const bExp = !!b.item.isExpress;
        if (aExp !== bExp) return aExp ? -1 : 1;
        const aTime = a.tx.estimatedDoneAt ? new Date(a.tx.estimatedDoneAt).getTime() : Infinity;
        const bTime = b.tx.estimatedDoneAt ? new Date(b.tx.estimatedDoneAt).getTime() : Infinity;
        return aTime - bTime;
      });
    });

    return groups;
  }, [flatItems]);

  const onItemPress = (tx, item) => navigate('detail_item_produksi', { ...tx, item });

  // Workstation chips with badge counts
  const workstationOptions = ['Semua', 'Cuci', 'Setrika', 'Packing'];
  const workstationCounts = useMemo(() => {
    const counts = { Semua: 0, Cuci: 0, Setrika: 0, Packing: 0 };
    allActive.forEach(tx => {
      (tx.items || []).forEach(item => {
        if (item.isDone) return;
        counts.Semua += 1;
        if (counts[item.currentStage] !== undefined) counts[item.currentStage]++;
      });
    });
    return counts;
  }, [allActive]);

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#F8FAFC', overflow: 'hidden' }}>
      <HeroHeader
        user={user}
        allActive={allActive}
        activeItemCount={activeItemCount}
        urgentCount={urgentCount}
        overdueCount={overdueCount}
        onRefresh={() => fetchQueue()}
        onProfileClick={() => navigate('profil')}
      />

      {/* Stage pipeline visualization — cuma di mode "Semua" supaya focus mode lebih bersih */}
      {filter === 'aktif' && workstation === 'Semua' && <StagePipeline transactions={allActive} />}

      {/* Workstation chips — kompak, ikon-utama */}
      <div style={{ padding: '6px 16px 4px', flexShrink: 0 }}>
        <div style={{ display: 'flex', gap: 6, overflowX: 'auto', scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' }}>
          {workstationOptions.map(ws => {
            const isActive = workstation === ws;
            const count = workstationCounts[ws] || 0;
            const stageColor = ws === 'Semua' ? C.primary : (STAGE_COLORS[ws] || C.primary);
            return (
              <button
                key={ws}
                onClick={() => handleWorkstationChange(ws)}
                style={{
                  flexShrink: 0,
                  padding: '5px 10px',
                  borderRadius: 999,
                  border: `1.5px solid ${isActive ? stageColor : C.n200}`,
                  background: isActive ? `${stageColor}10` : 'white',
                  cursor: 'pointer',
                  fontFamily: 'Poppins', fontSize: 11,
                  fontWeight: isActive ? 700 : 500,
                  color: isActive ? stageColor : C.n700,
                  display: 'flex', alignItems: 'center', gap: 4,
                  transition: 'all 0.15s',
                }}
              >
                {ws !== 'Semua' && <span style={{ fontSize: 12 }}>{STAGE_ICONS[ws]}</span>}
                {ws}
                {count > 0 && (
                  <span style={{
                    background: isActive ? stageColor : C.n200,
                    color: isActive ? 'white' : C.n600,
                    fontFamily: 'Poppins', fontSize: 9, fontWeight: 800,
                    padding: '0 5px', borderRadius: 999, minWidth: 16,
                    textAlign: 'center', lineHeight: '14px',
                  }}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* List */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 16px 24px', display: 'flex', flexDirection: 'column' }}>
        {loading && (
          <SkeletonList count={4} lines={3} />
        )}

        {!loading && error && (
          <div style={{
            flex: 1, display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            padding: '60px 24px', gap: 12, textAlign: 'center',
          }}>
            <div style={{ width: 56, height: 56, borderRadius: 28, background: '#FEE2E2', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: 24 }}>⚠️</span>
            </div>
            <div style={{ fontFamily: 'Poppins', fontSize: 14, fontWeight: 700, color: C.n900 }}>Gagal Memuat Data</div>
            <div style={{ fontFamily: 'Poppins', fontSize: 12, color: C.n600 }}>{error}</div>
            <Btn variant="primary" onClick={() => fetchQueue()} style={{ marginTop: 8 }}>Coba Lagi</Btn>
          </div>
        )}

        {!loading && !error && flatItems.length === 0 && (
          <>
            {/* Toggle tetap accessible biar user bisa balik ke filter lain */}
            {(filter !== 'aktif' || allDone.length > 0) && (
              <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '6px 4px 0' }}>
                <FilterToggle
                  filter={filter}
                  setFilter={setFilter}
                  activeCount={activeItemCount}
                  doneCount={doneItemCount}
                />
              </div>
            )}
            <EmptyState filter={filter} lastRefresh={lastRefresh} />
          </>
        )}

        {!loading && !error && flatItems.length > 0 && filter === 'aktif' && workstation !== 'Semua' && (() => {
          // Focus mode: cuma 1 stage. Card di-sort by SLA (overdue → urgent → warning → normal),
          // tanpa section heading kompleks. Heading 1 baris simpel + FilterToggle.
          const stageColor = STAGE_COLORS[workstation] || C.primary;
          return (
            <>
              <SectionHeader
                icon={STAGE_ICONS[workstation]}
                label={`STATION ${workstation.toUpperCase()}`}
                count={flatItems.length}
                accentColor={stageColor}
                rightContent={
                  <FilterToggle
                    filter={filter}
                    setFilter={setFilter}
                    activeCount={activeItemCount}
                    doneCount={doneItemCount}
                  />
                }
              />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4 }}>
                {[...flatItems]
                  .sort((a, b) => {
                    // Express duluan
                    if (!!a.item.isExpress !== !!b.item.isExpress) return a.item.isExpress ? -1 : 1;
                    // Lalu deadline
                    const aT = a.tx.estimatedDoneAt ? new Date(a.tx.estimatedDoneAt).getTime() : Infinity;
                    const bT = b.tx.estimatedDoneAt ? new Date(b.tx.estimatedDoneAt).getTime() : Infinity;
                    return aT - bT;
                  })
                  .map(({ tx, item }) => (
                    <ItemCard key={`${tx.id}-${item.itemId}`} tx={tx} item={item} onPress={onItemPress} />
                  ))}
              </div>
            </>
          );
        })()}

        {!loading && !error && flatItems.length > 0 && filter === 'aktif' && workstation === 'Semua' && (() => {
          // Tentukan section pertama yang akan dapat FilterToggle inline
          const firstSection = groupedItems.overdue.length > 0 ? 'overdue'
            : groupedItems.urgent.length > 0 ? 'urgent'
            : groupedItems.warning.length > 0 ? 'warning'
            : 'normal';
          const toggle = (
            <FilterToggle
              filter={filter}
              setFilter={setFilter}
              activeCount={activeItemCount}
              doneCount={doneItemCount}
            />
          );
          return (
          <>
            {/* Overdue section */}
            {groupedItems.overdue.length > 0 && (
              <>
                <SectionHeader
                  icon="🔥"
                  label="TELAT — SEGERA SELESAIKAN"
                  count={groupedItems.overdue.length}
                  accentColor={COLORS.overdue.accent}
                  rightContent={firstSection === 'overdue' ? toggle : null}
                />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
                  {groupedItems.overdue.map(({ tx, item }) => (
                    <ItemCard key={`${tx.id}-${item.itemId}`} tx={tx} item={item} onPress={onItemPress} />
                  ))}
                </div>
              </>
            )}

            {/* Urgent section */}
            {groupedItems.urgent.length > 0 && (
              <>
                <SectionHeader
                  icon="⚠️"
                  label="MENDESAK — < 2 JAM"
                  count={groupedItems.urgent.length}
                  accentColor={COLORS.urgent.accent}
                  rightContent={firstSection === 'urgent' ? toggle : null}
                />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
                  {groupedItems.urgent.map(({ tx, item }) => (
                    <ItemCard key={`${tx.id}-${item.itemId}`} tx={tx} item={item} onPress={onItemPress} />
                  ))}
                </div>
              </>
            )}

            {/* Warning section */}
            {groupedItems.warning.length > 0 && (
              <>
                <SectionHeader
                  icon="⏰"
                  label="HARI INI"
                  count={groupedItems.warning.length}
                  accentColor={COLORS.warning.accent}
                  rightContent={firstSection === 'warning' ? toggle : null}
                />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
                  {groupedItems.warning.map(({ tx, item }) => (
                    <ItemCard key={`${tx.id}-${item.itemId}`} tx={tx} item={item} onPress={onItemPress} />
                  ))}
                </div>
              </>
            )}

            {/* Normal section */}
            {groupedItems.normal.length > 0 && (
              <>
                <SectionHeader
                  icon="📋"
                  label="ANTRIAN BERIKUTNYA"
                  count={groupedItems.normal.length}
                  accentColor={C.n500}
                  rightContent={firstSection === 'normal' ? toggle : null}
                />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
                  {groupedItems.normal.map(({ tx, item }) => (
                    <ItemCard key={`${tx.id}-${item.itemId}`} tx={tx} item={item} onPress={onItemPress} />
                  ))}
                </div>
              </>
            )}
          </>
          );
        })()}

        {!loading && !error && flatItems.length > 0 && filter !== 'aktif' && (
          <>
            <SectionHeader
              icon="✅"
              label="SELESAI"
              count={flatItems.length}
              accentColor={COLORS.done.accent}
              rightContent={
                <FilterToggle
                  filter={filter}
                  setFilter={setFilter}
                  activeCount={activeItemCount}
                  doneCount={doneItemCount}
                />
              }
            />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {flatItems.map(({ tx, item }) => (
                <ItemCard key={`${tx.id}-${item.itemId}`} tx={tx} item={item} onPress={onItemPress} />
              ))}
            </div>
          </>
        )}

        {lastRefresh && flatItems.length > 0 && (
          <div style={{
            textAlign: 'center', fontFamily: 'Poppins', fontSize: 10,
            color: C.n400, padding: '14px 0 8px',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
          }}>
            <span style={{
              width: 6, height: 6, borderRadius: '50%', background: COLORS.done.accent,
              animation: 'pulse 2s infinite',
            }} />
            Auto-refresh aktif · {lastRefresh.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
          </div>
        )}
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(0.9); }
        }
      `}</style>
    </div>
  );
}
