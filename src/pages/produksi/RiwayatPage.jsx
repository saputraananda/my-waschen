import { useState, useCallback, useMemo } from 'react';
import axios from 'axios';
import { TopBar, SkeletonList, useAppRefresh, FilterModal, FilterSection, FilterChipGroup } from '../../components/ui';
import { C } from '../../utils/theme';
import { useInfiniteList } from '../../utils/useInfiniteList';
import { useRealtimeMulti } from '../../utils/realtime';
import {
  ProductionSearchBar,
  SectionLabel,
  ProductionEmptyState,
  RiwayatItemCard,
  PAGE_BG,
} from '../../components/ProductionShared';

const STAGE_DOTS = {
  Diterima: '#a78bfa',
  Cuci:     '#38bdf8',
  Setrika:  '#fbbf24',
  Packing:  '#4ade80',
  Selesai:  '#86efac',
};

// ─── Stats Banner ─────────────────────────────────────────────
function StatsBanner({ ready, done, total }) {
  return (
    <div style={{
      background: 'linear-gradient(135deg, #0F172A 0%, #1E293B 60%, #0C4A6E 100%)',
      padding: '14px 16px 16px',
      flexShrink: 0,
    }}>
      {/* Decorative orb */}
      <div style={{
        position: 'absolute', top: -20, right: -20,
        width: 120, height: 120, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(16,185,129,0.3), transparent 70%)',
        filter: 'blur(20px)', pointerEvents: 'none',
      }} />

      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{
          width: 38, height: 38, borderRadius: 12,
          background: 'rgba(255,255,255,0.15)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 20,
        }}>
          📚
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontFamily: 'Inter, system-ui', fontSize: 9, fontWeight: 600,
            color: 'rgba(255,255,255,0.55)', letterSpacing: '0.07em',
            textTransform: 'uppercase',
          }}>Riwayat Produksi</div>
          <div style={{
            fontFamily: 'Inter, system-ui', fontSize: 16, fontWeight: 600,
            color: '#ffffff', lineHeight: 1.2, marginTop: 1,
          }}>
            {total} item selesai
          </div>
        </div>
      </div>

      {/* Stat tiles */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 12 }}>
        <StatTile icon="✅" value={ready} label="Siap diambil" tone="green" />
        <StatTile icon="🎉" value={done}  label="Sudah diambil" tone="blue" />
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
      background: s.bg, border: `1px solid ${s.border}`,
      borderRadius: 12, padding: '8px 10px',
      display: 'flex', alignItems: 'center', gap: 8,
    }}>
      <span style={{ fontSize: 18 }}>{icon}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontFamily: 'Inter, system-ui', fontSize: 18, fontWeight: 600,
          color: s.text, lineHeight: 1,
        }}>{value}</div>
        <div style={{
          fontFamily: 'Inter, system-ui', fontSize: 9, fontWeight: 600,
          color: s.sub, marginTop: 2,
        }}>{label}</div>
      </div>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────
export default function RiwayatPage({ navigate, goBack }) {
  const [query, setQuery]             = useState('');
  const [period, setPeriod]           = useState('30');
  const [statusFilter, setStatusFilter] = useState('all');
  const [stageFilter, setStageFilter]   = useState('all');
  const [showFilter, setShowFilter] = useState(false);

  const fetchPage = useCallback(async ({ page, pageSize, signal }) => {
    const res = await axios.get('/api/transactions/production/history', {
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
    deps: [period],
  });

  // Pull-to-refresh
  useAppRefresh(() => list.refresh());

  // Realtime refresh
  useRealtimeMulti(
    ['production:update', 'production:photo', 'payment:settled'],
    () => list.refresh()
  );

  // Client-side filter (search + stage + status)
  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    return list.items.filter(it => {
      if (statusFilter !== 'all') {
        const targetStatus = statusFilter === 'ready' ? 'ready' : 'done';
        if (it.productionStatus !== targetStatus) return false;
      }
      if (stageFilter !== 'all' && (it.currentStage || 'Selesai') !== stageFilter) return false;
      if (!q) return true;
      return (
        (it.customerName || '').toLowerCase().includes(q) ||
        String(it.id || '').toLowerCase().includes(q) ||
        (it.itemName || '').toLowerCase().includes(q)
      );
    });
  }, [list.items, query, statusFilter, stageFilter]);

  // Stats derived from FILTERED items (bukan dari all fetched items)
  const stats = useMemo(() => {
    let ready = 0, done = 0;
    filtered.forEach(it => {
      if (it.productionStatus === 'ready') ready++;
      else if (it.productionStatus === 'done') done++;
    });
    return {
      ready,
      done,
      total: filtered.length,
    };
  }, [filtered]);

  const handleItemPress = (it) => {
    navigate('detail_riwayat_produksi', {
      id: it.id,
      transactionUuid: it.transactionUuid,
      itemId: it.itemId,
    });
  };

  // ── render ──────────────────────────────────────────────────
  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      height: '100%', background: PAGE_BG,
      fontFamily: 'Inter, system-ui',
    }}>

      {/* Topbar */}
      <TopBar
        title="Riwayat Produksi"
        onBack={goBack}
      />

      {/* Stats banner */}
      <StatsBanner ready={stats.ready} done={stats.done} total={stats.total} />

      {/* Search & Filter Header */}
      <div style={{ background: 'white', padding: '8px 14px 10px', borderBottom: `1px solid ${C.n100}` }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10 }}>
          <div style={{
            flex: 1,
            background: C.n50,
            borderRadius: 10,
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '8px 12px',
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
              stroke={C.n400} strokeWidth="2" strokeLinecap="round">
              <circle cx="11" cy="11" r="8"/>
              <line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Cari customer, no nota, atau nama item…"
              style={{
                flex: 1, border: 'none', background: 'transparent',
                fontFamily: 'Poppins', fontSize: 13,
                color: C.n900, outline: 'none',
              }}
            />
            {query && (
              <button
                onClick={() => setQuery('')}
                style={{
                  border: 'none', background: 'none', cursor: 'pointer',
                  padding: 0, display: 'flex', alignItems: 'center',
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                  stroke={C.n400} strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18"/>
                  <line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            )}
          </div>
          <button
            onClick={() => setShowFilter(true)}
            aria-label="Filter"
            style={{
              width: 44,
              height: 44,
              borderRadius: 10,
              border: `1.5px solid ${C.n200}`,
              background: 'white',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: C.n600,
              flexShrink: 0,
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="4" y1="6" x2="14" y2="6" />
              <line x1="20" y1="6" x2="18" y2="6" />
              <circle cx="16" cy="6" r="2" />
              <line x1="4" y1="12" x2="6" y2="12" />
              <line x1="20" y1="12" x2="10" y2="12" />
              <circle cx="8" cy="12" r="2" />
              <line x1="4" y1="18" x2="12" y2="18" />
              <line x1="20" y1="18" x2="16" y2="18" />
              <circle cx="14" cy="18" r="2" />
            </svg>
          </button>
        </div>

        {/* Quick stage tabs */}
        <div style={{
          display: 'flex', gap: 6, overflowX: 'auto',
          scrollbarWidth: 'none', paddingBottom: 2,
        }}>
          {[
            { key: 'all', label: 'Semua' },
            { key: 'Diterima', label: 'Diterima' },
            { key: 'Cuci', label: 'Cuci' },
            { key: 'Setrika', label: 'Setrika' },
            { key: 'Packing', label: 'Packing' },
            { key: 'Selesai', label: 'Selesai' },
          ].map(p => {
            const active = stageFilter === p.key;
            return (
              <button
                key={p.key}
                onClick={() => setStageFilter(p.key)}
                style={{
                  flexShrink: 0,
                  padding: '6px 12px',
                  borderRadius: 999,
                  border: 'none',
                  background: active ? C.primary : C.n50,
                  fontFamily: 'Poppins',
                  fontSize: 12,
                  fontWeight: active ? 600 : 500,
                  color: active ? 'white' : C.n600,
                  cursor: 'pointer',
                }}
              >
                {p.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 14px 80px' }}>
        <SectionLabel label="Riwayat Selesai" count={filtered.length} />

        {list.loading ? (
          <SkeletonList count={5} />
        ) : list.error ? (
          <div style={{
            background: C.validationErrorBg, padding: 16, borderRadius: 12,
            fontFamily: 'Inter, system-ui', fontSize: 13, color: C.danger,
            textAlign: 'center',
          }}>
            Gagal memuat: {list.error}
          </div>
        ) : filtered.length === 0 ? (
          <ProductionEmptyState
            title={query ? 'Tidak ada hasil' : getEmptyTitle(period, statusFilter, stageFilter)}
            sub={getEmptySub(query, period, statusFilter, stageFilter)}
          />
        ) : (
          filtered.map((it, idx) => (
            <RiwayatItemCard
              key={`${it.id || it.transactionUuid || ''}-${it.itemId || idx}`}
              it={it}
              onPress={() => handleItemPress(it)}
            />
          ))
        )}

        {/* Infinite scroll sentinel */}
        {list.hasMore && !list.loading && (
          <div ref={list.sentinelRef} style={{ padding: '14px 0', textAlign: 'center' }}>
            <span style={{
              fontFamily: 'Inter, system-ui', fontSize: 11, color: C.n400,
            }}>
              {list.loadingMore ? 'Memuat lebih banyak…' : '·'}
            </span>
          </div>
        )}

        {!list.hasMore && list.items.length > 0 && (
          <div style={{
            textAlign: 'center', padding: '14px 0 8px',
            fontFamily: 'Inter, system-ui', fontSize: 10, color: '#9ca3af',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          }}>
            <div style={{ width: 5, height: 5, borderRadius: '50%', background: C.success }} />
            Sudah akhir daftar
          </div>
        )}
      </div>

      {/* Filter Modal */}
      <FilterModal
        visible={showFilter}
        onClose={() => setShowFilter(false)}
        title="Filter Riwayat"
        onApply={() => setShowFilter(false)}
        onReset={() => {
          setStatusFilter('all');
          setStageFilter('all');
          setPeriod('30');
        }}
      >
        <FilterSection title="Status">
          <FilterChipGroup
            options={[
              { value: 'all', label: 'Semua' },
              { value: 'ready', label: 'Siap Diambil' },
              { value: 'done', label: 'Sudah Lunas' },
            ]}
            selected={statusFilter}
            onChange={(val) => setStatusFilter(val)}
            multiple={false}
          />
        </FilterSection>

        <FilterSection title="Periode">
          <FilterChipGroup
            options={[
              { value: '7', label: '7 Hari' },
              { value: '30', label: '30 Hari' },
              { value: '90', label: '90 Hari' },
              { value: 'all', label: 'Semua' },
            ]}
            selected={period}
            onChange={(val) => setPeriod(val)}
            multiple={false}
          />
        </FilterSection>
      </FilterModal>
    </div>
  );
}


// ─── Empty State Helpers ──────────────────────────────────────
function getEmptyTitle(period, statusFilter, stageFilter) {
  if (statusFilter !== 'all') return 'Tidak ada item';
  if (stageFilter !== 'all') return `Belum ada item di tahap ${stageFilter}`;
  return 'Belum ada item selesai';
}

function getEmptySub(query, period, statusFilter, stageFilter) {
  if (query) return 'Coba kata kunci lain atau ubah filter.';
  
  const periodText = period === '7' ? '7 hari terakhir' :
                     period === '30' ? '30 hari terakhir' :
                     period === '90' ? '90 hari terakhir' : 'periode ini';
  
  if (statusFilter !== 'all' || stageFilter !== 'all') {
    return `Belum ada item sesuai filter dalam ${periodText}. Coba ubah filter atau periode.`;
  }
  
  return `Belum ada item selesai dalam ${periodText}. Coba pilih periode lebih lama.`;
}
