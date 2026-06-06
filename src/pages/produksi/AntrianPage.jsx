import { useState, useEffect, useCallback, useMemo } from 'react';
import axios from 'axios';
import { C } from '../../utils/theme';
import { TopBar, Avatar, SkeletonList, useAppRefresh, SearchBar } from '../../components/ui';
import { useRealtimeMulti } from '../../utils/realtime';
import { STAGES } from '../../utils/helpers';

const STAGE_ICONS = {
  'Diterima': '📥', 'Cuci': '🫧',
  'Setrika': '♨️', 'Packing': '📦', 'Selesai': '✅',
};

const STAGE_COLORS = {
  'Diterima': '#3B82F6', 'Cuci': '#06B6D4',
  'Setrika': '#F59E0B', 'Packing': '#8B5CF6', 'Selesai': '#10B981',
};

const STAGE_DB_TO_LABEL = {
  'received': 'Diterima', 'waiting': 'Diterima',
  'washing': 'Cuci', 'drying': 'Cuci',
  'ironing': 'Setrika', 'qc': 'Setrika',
  'packing': 'Packing', 'ready': 'Selesai', 'done': 'Selesai',
};

// Filter tabs — tanpa info kasir/payment
const FILTER_TABS = [
  { key: 'all', label: 'Semua', icon: '📋' },
  { key: 'urgent', label: 'Mendesak', icon: '🔥' },
  { key: 'today', label: 'Hari Ini', icon: '⏰' },
];

const STAGE_FILTERS = [
  { key: 'all', label: 'Semua Tahap' },
  { key: 'Diterima', label: '📥 Diterima' },
  { key: 'Cuci', label: '🫧 Cuci' },
  { key: 'Setrika', label: '♨️ Setrika' },
  { key: 'Packing', label: '📦 Packing' },
];

const formatSLA = (estimatedDoneAt) => {
  if (!estimatedDoneAt) return null;
  const diffMin = Math.round((new Date(estimatedDoneAt) - Date.now()) / 60000);
  const abs = Math.abs(diffMin);
  if (diffMin < 0) {
    if (abs < 60) return { text: `Telat ${abs}m`, color: '#DC2626', bg: '#FEE2E2', icon: '🔴' };
    return { text: `Telat ${Math.floor(abs / 60)}j`, color: '#DC2626', bg: '#FEE2E2', icon: '🔴' };
  }
  if (diffMin < 60) return { text: `${diffMin}m lagi`, color: '#92400E', bg: '#FEF3C7', icon: '⚠️' };
  if (diffMin < 360) return { text: `${Math.floor(diffMin / 60)}j lagi`, color: '#1E40AF', bg: '#DBEAFE', icon: '⏰' };
  if (diffMin < 1440) return { text: `${Math.floor(diffMin / 60)}j lagi`, color: '#475569', bg: '#F1F5F9', icon: '🕐' };
  return { text: `${Math.round(diffMin / 1440)}h lagi`, color: '#475569', bg: '#F1F5F9', icon: '📆' };
};

export default function ProduksiAntrianPage({ navigate, goBack }) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [stageFilter, setStageFilter] = useState('all');

  const fetchQueue = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get('/api/transactions/production/queue?limit=100');
      setOrders(res?.data?.data || []);
    } catch (err) {
      console.error('[ProduksiAntrian]', err);
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchQueue(); }, [fetchQueue]);

  // Auto-refresh every 30s
  useEffect(() => {
    const interval = setInterval(fetchQueue, 30000);
    return () => clearInterval(interval);
  }, [fetchQueue]);

  // Pull-to-refresh
  useAppRefresh(() => fetchQueue(), [fetchQueue]);

  // Realtime: refresh saat ada checkout baru, photo saved, atau production update
  useRealtimeMulti(['transaction:checkout', 'production:photo', 'production:update'], () => {
    fetchQueue();
  });

  // Build flat item list (per-layanan, bukan per-nota)
  // Include semua tahap termasuk Selesai — frontend yang filter by stage
  const items = useMemo(() => {
    const result = [];
    for (const tx of orders) {
      const txItems = tx.items || [];
      for (const item of txItems) {
        // currentStage berasal dari backend (sudah dihitung dari progress logs)
        const stageLabel = item.currentStage
          || STAGE_DB_TO_LABEL[item.productionStatus]
          || 'Diterima';
        result.push({
          txId: tx.id,
          txNo: tx.transactionNo || tx.id,
          customerName: tx.customerName,
          customerInitials: (tx.customerName || '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase(),
          isExpress: tx.isExpress || item.isExpress,
          estimatedDoneAt: tx.estimatedDoneAt,
          createdAt: tx.createdAt,
          itemId: item.itemId || item.id,
          itemName: item.serviceName || item.name,
          qty: item.qty,
          unit: item.unit,
          stage: stageLabel,
          isDone: item.isDone || stageLabel === 'Selesai',
          progress: item.progress || [],
          packingDone: item.packingDone || 0,
          packingNeeded: item.packingNeeded || 1,
          tx,
          item,
        });
      }
    }
    return result;
  }, [orders]);

  const filteredItems = useMemo(() => {
    let result = items;

    // Default: hide yang sudah Selesai kecuali user filter eksplisit
    if (stageFilter !== 'Selesai' && stageFilter !== 'all_with_done') {
      result = result.filter(i => !i.isDone && i.stage !== 'Selesai');
    }

    // Search filter
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(i =>
        (i.customerName || '').toLowerCase().includes(q) ||
        (i.txNo || '').toLowerCase().includes(q) ||
        (i.itemName || '').toLowerCase().includes(q)
      );
    }

    // Urgent filter
    if (filter === 'urgent') {
      result = result.filter(i => {
        const sla = formatSLA(i.estimatedDoneAt);
        return sla && (sla.color === '#DC2626' || sla.color === '#92400E');
      });
    } else if (filter === 'today') {
      const today = new Date().toDateString();
      result = result.filter(i => {
        if (!i.estimatedDoneAt) return false;
        return new Date(i.estimatedDoneAt).toDateString() === today;
      });
    }

    // Stage filter
    if (stageFilter !== 'all' && stageFilter !== 'all_with_done') {
      result = result.filter(i => i.stage === stageFilter);
    }

    // Sort: express first, then by SLA urgency (ascending estimated done at)
    result.sort((a, b) => {
      if (a.isExpress && !b.isExpress) return -1;
      if (!a.isExpress && b.isExpress) return 1;
      const aTime = a.estimatedDoneAt ? new Date(a.estimatedDoneAt).getTime() : Infinity;
      const bTime = b.estimatedDoneAt ? new Date(b.estimatedDoneAt).getTime() : Infinity;
      return aTime - bTime;
    });

    return result;
  }, [items, search, filter, stageFilter]);

  // Stats per stage (termasuk Selesai untuk visibility)
  const stageStats = useMemo(() => {
    const stats = { Diterima: 0, Cuci: 0, Setrika: 0, Packing: 0, Selesai: 0 };
    for (const i of items) {
      if (stats[i.stage] != null) stats[i.stage]++;
    }
    return stats;
  }, [items]);

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: C.n50, overflow: 'hidden' }}>
      <TopBar
        title="Antrian Produksi"
        subtitle={`${filteredItems.length} layanan dalam antrian`}
        onBack={goBack}
      />

      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px 20px' }}>

        {/* Search */}
        <div style={{ position: 'relative', marginBottom: 10 }}>
          <SearchBar
            value={search}
            onChange={setSearch}
            placeholder="Cari customer, no nota, atau layanan…"
          />
        </div>

        {/* Quick filter tabs */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 10, overflowX: 'auto', scrollbarWidth: 'none' }}>
          {FILTER_TABS.map(t => {
            const active = filter === t.key;
            return (
              <button
                key={t.key}
                onClick={() => setFilter(t.key)}
                style={{
                  flexShrink: 0, padding: '6px 14px', borderRadius: 999,
                  border: `1.5px solid ${active ? C.primary : C.n200}`,
                  background: active ? `${C.primary}12` : 'white',
                  fontFamily: 'Poppins', fontSize: 11, fontWeight: active ? 700 : 500,
                  color: active ? C.primary : C.n600, cursor: 'pointer',
                }}
              >
                {t.icon} {t.label}
              </button>
            );
          })}
        </div>

        {/* Stage stats — pipeline visual */}
        <div style={{ background: 'white', borderRadius: 12, padding: '10px 12px', marginBottom: 10, border: `1px solid ${C.n100}`, display: 'flex', alignItems: 'center', gap: 6 }}>
          {STAGES.map((stage, idx) => {
            const count = stageStats[stage] || 0;
            const isActive = stageFilter === stage;
            const isLast = idx === STAGES.length - 1;
            return (
              <div key={stage} style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
                <button
                  onClick={() => setStageFilter(isActive ? 'all' : stage)}
                  style={{
                    flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
                    padding: '6px 4px', borderRadius: 8,
                    border: 'none', cursor: 'pointer',
                    background: isActive ? `${STAGE_COLORS[stage]}14` : 'transparent',
                    transition: 'all 0.15s',
                  }}
                >
                  <div style={{
                    width: 28, height: 28, borderRadius: 14,
                    background: count > 0 ? STAGE_COLORS[stage] : C.n100,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontFamily: 'Poppins', fontSize: 11, fontWeight: 800,
                    color: count > 0 ? 'white' : C.n400,
                    boxShadow: isActive ? `0 0 0 3px ${STAGE_COLORS[stage]}30` : 'none',
                  }}>
                    {count}
                  </div>
                  <span style={{ fontFamily: 'Poppins', fontSize: 9, fontWeight: 600, color: count > 0 ? STAGE_COLORS[stage] : C.n500 }}>{stage}</span>
                </button>
                {!isLast && <div style={{ width: 8, height: 1, background: C.n200, flexShrink: 0 }} />}
              </div>
            );
          })}
        </div>

        {/* List */}
        {loading && (
          <SkeletonList count={4} lines={2} />
        )}

        {!loading && filteredItems.length === 0 && (
          <div style={{ textAlign: 'center', padding: 32, background: 'white', borderRadius: 14 }}>
            <div style={{ fontSize: 36, marginBottom: 8 }}>🎉</div>
            <div style={{ fontFamily: 'Poppins', fontSize: 13, fontWeight: 700, color: C.n700 }}>Tidak ada antrian</div>
            <div style={{ fontFamily: 'Poppins', fontSize: 11, color: C.n500, marginTop: 4 }}>Semua layanan sudah ditangani</div>
          </div>
        )}

        {!loading && filteredItems.map((it) => {
          const sla = formatSLA(it.estimatedDoneAt);
          const stageColor = STAGE_COLORS[it.stage] || C.primary;
          const isPackingStage = it.stage === 'Packing';
          const packingPct = isPackingStage ? Math.round((it.packingDone / Math.max(1, it.packingNeeded)) * 100) : 0;

          return (
            <div
              key={`${it.txId}-${it.itemId}`}
              onClick={() => navigate('detail_item_produksi', { ...it.tx, item: it.item })}
              style={{
                background: 'white', borderRadius: 14, padding: '12px 14px',
                marginBottom: 8, cursor: 'pointer',
                boxShadow: '0 2px 8px rgba(15,23,42,0.05)',
                borderLeft: `4px solid ${stageColor}`,
                position: 'relative', overflow: 'hidden',
              }}
            >
              {it.isExpress && (
                <div style={{ position: 'absolute', top: 8, right: 8, background: '#FEF3C7', color: '#92400E', fontFamily: 'Poppins', fontSize: 9, fontWeight: 800, padding: '2px 8px', borderRadius: 999 }}>
                  ⚡ EXPRESS
                </div>
              )}

              {/* Customer info */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <Avatar initials={it.customerInitials} size={36} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: 'Poppins', fontSize: 13, fontWeight: 700, color: C.n900, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {it.customerName}
                  </div>
                  <div style={{ fontFamily: 'Poppins', fontSize: 10, color: C.n500 }}>
                    Nota {it.txNo}
                  </div>
                </div>
              </div>

              {/* Layanan */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', background: `${stageColor}08`, borderRadius: 8, marginBottom: 8 }}>
                <span style={{ fontSize: 18 }}>{STAGE_ICONS[it.stage]}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: 'Poppins', fontSize: 13, fontWeight: 700, color: C.n900 }}>{it.itemName}</div>
                  <div style={{ fontFamily: 'Poppins', fontSize: 10, color: C.n600 }}>
                    {it.qty} {it.unit} · Tahap: <strong style={{ color: stageColor }}>{it.stage}</strong>
                    {isPackingStage && it.packingNeeded > 1 && (
                      <span style={{ marginLeft: 6 }}>· 📦 {it.packingDone}/{it.packingNeeded}</span>
                    )}
                  </div>
                </div>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.n400} strokeWidth="2" strokeLinecap="round" style={{ flexShrink: 0 }}>
                  <polyline points="9 18 15 12 9 6"/>
                </svg>
              </div>

              {/* SLA badge */}
              {sla && (
                <div style={{
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                  padding: '3px 10px', borderRadius: 999,
                  background: sla.bg, color: sla.color,
                  fontFamily: 'Poppins', fontSize: 10, fontWeight: 700,
                }}>
                  {sla.icon} {sla.text}
                </div>
              )}

              {/* Mini progress bar */}
              <div style={{ marginTop: 8, height: 4, background: C.n100, borderRadius: 2, overflow: 'hidden' }}>
                <div style={{
                  height: '100%',
                  width: `${(it.progress.length / 4) * 100}%`,
                  background: stageColor,
                  borderRadius: 2,
                  transition: 'width 0.4s',
                }} />
              </div>
            </div>
          );
        })}

        {/* Auto-refresh indicator */}
        <div style={{ textAlign: 'center', fontFamily: 'Poppins', fontSize: 10, color: C.n400, padding: '8px 0', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
          <span style={{ width: 6, height: 6, borderRadius: 3, background: '#10B981', display: 'inline-block', animation: 'pulse 2s infinite' }} />
          Auto-refresh aktif setiap 30 detik
        </div>
      </div>
    </div>
  );
}
