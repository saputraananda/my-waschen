import { useState, useCallback, useMemo } from 'react';
import axios from 'axios';
import { C } from '../../utils/theme';
import { TopBar, SearchBar, SkeletonList, useAppRefresh } from '../../components/ui';
import { useInfiniteList } from '../../utils/useInfiniteList';
import { useRealtimeMulti } from '../../utils/realtime';

// ════════════════════════════════════════════════════════════════════
// Design tokens
// ════════════════════════════════════════════════════════════════════
const STATUS = {
  ready: { label: 'Siap diambil',  emoji: '✅', bg: '#D1FAE5', fg: '#065F46', accent: '#10B981', soft: '#ECFDF5' },
  done:  { label: 'Sudah diambil', emoji: '🎉', bg: '#DBEAFE', fg: '#1E40AF', accent: '#3B82F6', soft: '#EFF6FF' },
};

// ════════════════════════════════════════════════════════════════════
// Helpers
// ════════════════════════════════════════════════════════════════════
const fmtDate = (v) => {
  if (!v) return '-';
  try { return new Date(v).toLocaleString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }); }
  catch { return String(v); }
};

const timeAgo = (v) => {
  if (!v) return '';
  const ms = Date.now() - new Date(v).getTime();
  const min = Math.floor(ms / 60000);
  if (min < 1) return 'baru saja';
  if (min < 60) return `${min}m lalu`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}j lalu`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}h lalu`;
  return fmtDate(v);
};

// ════════════════════════════════════════════════════════════════════
// Sub-components
// ════════════════════════════════════════════════════════════════════
function StatsBanner({ ready, done, total }) {
  return (
    <div style={{
      background: 'linear-gradient(135deg, #0F172A 0%, #1E293B 60%, #0C4A6E 100%)',
      borderRadius: 0,
      padding: '14px 16px 18px',
      position: 'relative', overflow: 'hidden',
      flexShrink: 0,
    }}>
      <div style={{
        position: 'absolute', top: -30, right: -30, width: 140, height: 140, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(16,185,129,0.35), transparent 70%)',
        filter: 'blur(20px)', pointerEvents: 'none',
      }} />
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{
          width: 38, height: 38, borderRadius: 12,
          background: 'rgba(255,255,255,0.15)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20,
        }}>📚</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: 'Poppins', fontSize: 9, color: 'rgba(255,255,255,0.6)', letterSpacing: 0.5, fontWeight: 600 }}>RIWAYAT PRODUKSI</div>
          <div style={{ fontFamily: 'Poppins', fontSize: 16, fontWeight: 800, color: 'white', lineHeight: 1.2, marginTop: 1 }}>
            {total} item selesai
          </div>
        </div>
      </div>

      {/* Stat tiles */}
      <div style={{ position: 'relative', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 12 }}>
        <StatTile icon="✅" value={ready} label="Siap diambil" tone="green" />
        <StatTile icon="🎉" value={done} label="Sudah diambil" tone="blue" />
      </div>
    </div>
  );
}

function StatTile({ icon, value, label, tone }) {
  const tones = {
    green: { bg: 'rgba(16,185,129,0.20)', border: 'rgba(110,231,183,0.35)', text: '#D1FAE5', sub: '#A7F3D0' },
    blue:  { bg: 'rgba(59,130,246,0.20)', border: 'rgba(147,197,253,0.35)', text: '#DBEAFE', sub: '#BFDBFE' },
  };
  const s = tones[tone];
  return (
    <div style={{
      background: s.bg, border: `1px solid ${s.border}`, borderRadius: 12, padding: '8px 10px',
      backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)',
      display: 'flex', alignItems: 'center', gap: 8,
    }}>
      <span style={{ fontSize: 18 }}>{icon}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: 'Poppins', fontSize: 18, fontWeight: 800, color: s.text, lineHeight: 1 }}>{value}</div>
        <div style={{ fontFamily: 'Poppins', fontSize: 9, color: s.sub, fontWeight: 600, marginTop: 2 }}>{label}</div>
      </div>
    </div>
  );
}

function FilterChips({ statusFilter, setStatusFilter, period, setPeriod, stats }) {
  return (
    <div style={{ padding: '10px 16px 4px', flexShrink: 0 }}>
      {/* Status row */}
      <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 8, scrollbarWidth: 'none' }}>
        {[
          { key: 'all',   label: 'Semua', count: stats.total },
          { key: 'ready', label: '✅ Siap',     count: stats.ready },
          { key: 'done',  label: '🎉 Diambil',  count: stats.done },
        ].map(f => {
          const active = statusFilter === f.key;
          return (
            <button
              key={f.key}
              onClick={() => setStatusFilter(f.key)}
              style={{
                flexShrink: 0, padding: '6px 12px', borderRadius: 999,
                border: `1.5px solid ${active ? C.primary : C.n200}`,
                background: active ? `${C.primary}10` : 'white',
                fontFamily: 'Poppins', fontSize: 11, fontWeight: active ? 700 : 500,
                color: active ? C.primary : C.n700,
                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5,
              }}
            >
              {f.label}
              <span style={{
                background: active ? C.primary : C.n200,
                color: active ? 'white' : C.n600,
                fontFamily: 'Poppins', fontSize: 9, fontWeight: 800,
                padding: '0 5px', borderRadius: 999, minWidth: 16,
                textAlign: 'center', lineHeight: '14px',
              }}>{f.count}</span>
            </button>
          );
        })}
      </div>
      {/* Period row */}
      <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 6, scrollbarWidth: 'none' }}>
        {[
          { value: '7', label: '7 Hari' },
          { value: '30', label: '30 Hari' },
          { value: '90', label: '90 Hari' },
        ].map(p => {
          const active = period === p.value;
          return (
            <button
              key={p.value}
              onClick={() => setPeriod(p.value)}
              style={{
                flexShrink: 0, padding: '5px 12px', borderRadius: 999,
                border: `1px solid ${active ? C.n400 : C.n200}`,
                background: active ? C.n100 : 'transparent',
                fontFamily: 'Poppins', fontSize: 10, fontWeight: active ? 700 : 500,
                color: active ? C.n900 : C.n600,
                cursor: 'pointer',
              }}
            >
              {p.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ItemCard({ it, onPress }) {
  const status = STATUS[it.productionStatus] || STATUS.ready;
  return (
    <button
      onClick={onPress}
      style={{
        width: '100%', textAlign: 'left',
        background: 'white', borderRadius: 14,
        padding: '12px 14px', marginBottom: 10,
        border: `1.5px solid ${C.n100}`,
        boxShadow: it.isExpress
          ? `0 1px 6px rgba(245,158,11,0.18), inset 3px 0 0 #F59E0B`
          : '0 1px 4px rgba(15,23,42,0.04)',
        cursor: 'pointer', transition: 'transform 0.1s, box-shadow 0.1s',
        position: 'relative',
      }}
      onMouseDown={(e) => { e.currentTarget.style.transform = 'scale(0.99)'; }}
      onMouseUp={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
    >
      {/* Header row: nota + waktu */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, minWidth: 0 }}>
          <span style={{ fontFamily: 'Poppins', fontSize: 11, fontWeight: 700, color: C.primary }}>📋 {it.id}</span>
          {it.isExpress && (
            <span style={{
              background: '#FEF3C7', color: '#92400E',
              fontFamily: 'Poppins', fontSize: 9, fontWeight: 800,
              padding: '1px 6px', borderRadius: 999,
            }}>⚡ EXPRESS</span>
          )}
        </div>
        <span style={{ fontFamily: 'Poppins', fontSize: 9, color: C.n500 }}>{timeAgo(it.updatedAt)}</span>
      </div>

      {/* Main: icon + item name + qty + customer */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
        <div style={{
          width: 44, height: 44, borderRadius: 12, flexShrink: 0,
          background: status.soft, border: `1.5px solid ${status.bg}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20,
        }}>🧺</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontFamily: 'Poppins', fontSize: 14, fontWeight: 700, color: C.n900,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {it.itemName}
          </div>
          <div style={{ fontFamily: 'Poppins', fontSize: 11, color: C.n600, marginTop: 2, display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 600, color: C.n800 }}>{it.qty} {it.itemUnit || 'pcs'}</span>
            <span style={{ color: C.n400 }}>·</span>
            <span>👤 {it.customerName}</span>
          </div>
          {it.outletName && (
            <div style={{ fontFamily: 'Poppins', fontSize: 9, color: C.n500, marginTop: 2 }}>🏪 {it.outletName}</div>
          )}
        </div>
      </div>

      {/* Footer: status badge + foto indicators */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        gap: 8, marginTop: 10, paddingTop: 10, borderTop: `1px dashed ${C.n100}`,
      }}>
        <span style={{
          fontFamily: 'Poppins', fontSize: 10, fontWeight: 700,
          padding: '3px 10px', borderRadius: 999,
          background: status.bg, color: status.fg,
          display: 'inline-flex', alignItems: 'center', gap: 4,
        }}>
          {status.emoji} {status.label}
        </span>
        <div style={{ display: 'flex', gap: 4 }}>
          {it.production?.hasReceivePhoto && (
            <span title="Ada foto terima" style={{
              fontSize: 11, padding: '2px 6px', borderRadius: 999,
              background: '#EFF6FF', color: '#1E40AF',
              fontFamily: 'Poppins', fontWeight: 700,
            }}>📥</span>
          )}
          {it.production?.hasPackingPhoto && (
            <span title="Ada foto packing" style={{
              fontSize: 11, padding: '2px 6px', borderRadius: 999,
              background: '#F0FDF4', color: '#166534',
              fontFamily: 'Poppins', fontWeight: 700,
            }}>📦</span>
          )}
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.n400} strokeWidth="2.5" strokeLinecap="round" style={{ marginLeft: 2 }}>
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </div>
      </div>
    </button>
  );
}

// ════════════════════════════════════════════════════════════════════
// Main
// ════════════════════════════════════════════════════════════════════
export default function ProduksiRiwayatPage({ navigate, goBack }) {
  const [query, setQuery] = useState('');
  const [period, setPeriod] = useState('30');
  const [statusFilter, setStatusFilter] = useState('all');

  // Infinite scroll list
  const fetchPage = useCallback(async ({ page, pageSize, signal }) => {
    const res = await axios.get(`/api/transactions/production/history`, {
      params: { days: period, page, limit: pageSize },
      signal,
    });
    return {
      items: res?.data?.data || [],
      total: res?.data?.pagination?.total ?? null,
    };
  }, [period]);

  const list = useInfiniteList({
    fetchPage,
    pageSize: 30,
    deps: [period], // reset saat period berubah
  });

  // Pull-to-refresh
  useAppRefresh(() => list.refresh(), [list.refresh]);

  // Realtime: refresh saat ada photo/production update (kemungkinan ada item baru jadi ready)
  // atau payment:settled (mungkin pickup dilakukan setelah pelunasan)
  useRealtimeMulti(['production:photo', 'production:update', 'payment:settled'], () => {
    list.refresh();
  });

  const stats = useMemo(() => {
    let ready = 0, done = 0;
    list.items.forEach(it => {
      if (it.productionStatus === 'ready') ready++;
      else if (it.productionStatus === 'done') done++;
    });
    return { ready, done, total: list.total ?? list.items.length };
  }, [list.items, list.total]);

  // Client-side filtering on top of paged results (status & search)
  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    return list.items.filter(it => {
      if (statusFilter !== 'all' && it.productionStatus !== statusFilter) return false;
      if (!q) return true;
      return (
        (it.customerName || '').toLowerCase().includes(q) ||
        (it.id || '').toString().toLowerCase().includes(q) ||
        (it.itemName || '').toLowerCase().includes(q)
      );
    });
  }, [list.items, query, statusFilter]);

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#F8FAFC', overflow: 'hidden' }}>
      <TopBar title="Riwayat Produksi" onBack={goBack} />

      <StatsBanner ready={stats.ready} done={stats.done} total={stats.total} />

      <div style={{ padding: '12px 16px 0' }}>
        <SearchBar value={query} onChange={setQuery} placeholder="Cari customer / nota / nama item..." />
      </div>

      <FilterChips
        statusFilter={statusFilter}
        setStatusFilter={setStatusFilter}
        period={period}
        setPeriod={setPeriod}
        stats={stats}
      />

      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 16px 24px' }}>
        {list.loading && (
          <SkeletonList count={5} lines={2} />
        )}

        {!list.loading && list.error && (
          <div style={{ background: '#FEF2F2', padding: 16, borderRadius: 12, color: C.danger, fontFamily: 'Poppins', fontSize: 13, textAlign: 'center' }}>
            ⚠️ {list.error}
          </div>
        )}

        {!list.loading && !list.error && filtered.length === 0 && (
          <div style={{ textAlign: 'center', padding: '50px 24px' }}>
            <div style={{
              width: 72, height: 72, borderRadius: 22, margin: '0 auto 14px',
              background: 'linear-gradient(135deg, #F0FDF4, #D1FAE5)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32,
              boxShadow: '0 8px 24px rgba(16,185,129,0.15)',
            }}>📦</div>
            <div style={{ fontFamily: 'Poppins', fontSize: 15, fontWeight: 700, color: C.n900, marginBottom: 4 }}>
              {query ? 'Tidak ada hasil' : 'Belum ada item selesai'}
            </div>
            <div style={{ fontFamily: 'Poppins', fontSize: 12, color: C.n500, lineHeight: 1.5, maxWidth: 280, margin: '0 auto' }}>
              {query
                ? 'Coba kata kunci lain atau ubah filter.'
                : 'Item yang sudah selesai produksi akan muncul di sini.'}
            </div>
          </div>
        )}

        {!list.loading && filtered.map((it) => (
          <ItemCard
            key={`${it.transactionUuid}-${it.itemId}`}
            it={it}
            onPress={() => navigate('detail_riwayat_produksi', { id: it.id, transactionUuid: it.transactionUuid, itemId: it.itemId })}
          />
        ))}

        {/* Sentinel untuk auto-load saat scroll dekati bottom */}
        {list.hasMore && !list.loading && (
          <div ref={list.sentinelRef} style={{ padding: '14px 0', textAlign: 'center' }}>
            {list.loadingMore ? (
              <span style={{ fontFamily: 'Poppins', fontSize: 11, color: C.n500 }}>Memuat lebih banyak…</span>
            ) : (
              <span style={{ fontFamily: 'Poppins', fontSize: 11, color: C.n400 }}>·</span>
            )}
          </div>
        )}

        {!list.hasMore && list.items.length > 0 && (
          <div style={{ textAlign: 'center', padding: '14px 0', fontFamily: 'Poppins', fontSize: 10, color: C.n400 }}>
            ✓ Sudah ujung daftar
          </div>
        )}
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
