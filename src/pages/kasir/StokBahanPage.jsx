// ─────────────────────────────────────────────────────────────────────────────
// StokBahanPage — Inventaris (Kasir / Frontliner)
// Read-only monitoring: lihat stok, ajukan pengadaan saat menipis/habis.
// Design: Glass Morphism — glass header strip, compact cards, minimal chrome.
// ─────────────────────────────────────────────────────────────────────────────
import { useState, useCallback, useEffect, useMemo } from 'react';
import axios from 'axios';
import { rp } from '../../utils/helpers';
import { Modal, Input, useAppRefresh, EmptyState } from '../../components/ui';
import { useApp } from '../../context/AppContext';
import { alertError, alertSuccess, alertWarning } from '../../utils/alert';

// ─── Design Tokens (mirrors the mockup) ─────────────────────────────────────
const TOKENS = {
  purpleDeep:   '#3B0B47',
  purpleMid:    '#5C1A6B',
  magenta:      '#C0247D',
  mintDeep:     '#1F9E75',
  coralDeep:    '#B82848',
  goldDeep:     '#B8811A',
  bg:           '#F3EEF7',
  glassStrong:  'rgba(255,255,255,0.75)',
  ink:          '#2B1130',
  inkSoft:      '#7A6584',
};

const STOCK_META = {
  aman:    { label: 'Stok aman',    valColor: '#1F9E75', barColor: '#5FD9AE' },
  menipis: { label: 'Stok menipis', valColor: '#B8811A', barColor: '#E0A93B' },
  habis:   { label: 'Stok habis',   valColor: '#B82848', barColor: '#F0466B' },
};

const REQ_STATUS_META = {
  pending:   { label: 'Menunggu',    bg: 'rgba(184,129,26,0.15)',  fg: '#B8811A', icon: '⏳' },
  revised:   { label: 'Revisi',      bg: 'rgba(184,129,26,0.15)',  fg: '#B8811A', icon: '↩️' },
  approved:  { label: 'Disetujui',   bg: 'rgba(95,217,174,0.15)',  fg: '#1F9E75', icon: '✅' },
  fulfilled: { label: 'Selesai',      bg: 'rgba(95,217,174,0.15)',  fg: '#1F9E75', icon: '🎉' },
  rejected:  { label: 'Ditolak',     bg: 'rgba(184,40,72,0.15)',   fg: '#B82848', icon: '❌' },
  cancelled: { label: 'Batal',       bg: 'rgba(122,101,132,0.12)', fg: '#7A6584',  icon: '⊘' },
};

const ACTIVE_STATUSES = ['pending', 'revised', 'approved'];

const fmtDate = (v) => {
  if (!v) return '-';
  try { return new Date(v).toLocaleString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }); }
  catch { return '-'; }
};

const CATEGORIES = [
  { key: 'all', label: 'Semua' },
  { key: 'deterjen', label: 'Deterjen' },
  { key: 'pewangi', label: 'Pewangi' },
  { key: 'plastik', label: 'Plastik & Packing' },
  { key: 'peralatan', label: 'Peralatan' },
];

const TABS = [
  { key: 'stok', label: 'Stok' },
  { key: 'pengajuan', label: 'Pengajuan' },
];

const SKELETON_STYLE = { borderRadius: 14, marginBottom: 12, height: 88 };

export default function StokBahanPage({ goBack, navigate, screenParams }) {
  const { user } = useApp();
  const [pageTab, setPageTab] = useState('stok');
  const [rows, setRows] = useState([]);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [reqLoading, setReqLoading] = useState(true);
  const [fetchError, setFetchError] = useState(null);
  const [reqError, setReqError] = useState(null);
  const [search, setSearch] = useState('');
  const [reqSearch, setReqSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [showRequestForm, setShowRequestForm] = useState(false);
  const [requestItem, setRequestItem] = useState(null);

  const outletId = user?.outletId;

  const loadStock = useCallback(async (fresh = false) => {
    if (!outletId) { setRows([]); setLoading(false); return; }
    setLoading(true);
    setFetchError(null);
    try {
      const config = fresh ? { params: { _t: Date.now() } } : {};
      const res = await axios.get(`/api/inventory/stock?outletId=${outletId}`, config);
      setRows(res?.data?.data || []);
    } catch (err) {
      setFetchError(err?.response?.data?.message || 'Gagal memuat stok.');
    } finally {
      setLoading(false);
    }
  }, [outletId]);

  const loadRequests = useCallback(async (fresh = false) => {
    if (!outletId) { setRequests([]); setReqLoading(false); return; }
    setReqLoading(true);
    setReqError(null);
    try {
      const params = { page: 1, limit: 100 };
      if (fresh) params._t = Date.now();
      const res = await axios.get('/api/purchase-requests', { params });
      setRequests(res?.data?.data || []);
    } catch (err) {
      setReqError(err?.response?.data?.message || 'Gagal memuat pengajuan.');
    } finally {
      setReqLoading(false);
    }
  }, [outletId]);

  const refreshAll = useCallback(async (fresh = false) => {
    await Promise.all([loadStock(fresh), loadRequests(fresh)]);
  }, [loadStock, loadRequests]);

  useEffect(() => { refreshAll(); }, [refreshAll]);
  useAppRefresh(() => refreshAll(true), [refreshAll]);

  // Broadcast alert count to BottomNav
  useEffect(() => {
    const lowCount = rows.filter(r => Number(r.stockQty) <= Number(r.minStock) && Number(r.stockQty) > 0).length;
    window.dispatchEvent(new CustomEvent('stok:alert-count', { detail: { count: lowCount } }));
  }, [rows]);

  // Stats
  const stats = useMemo(() => {
    const total = rows.length;
    const lowCount = rows.filter(r => Number(r.stockQty) <= Number(r.minStock) && Number(r.stockQty) > 0).length;
    const emptyCount = rows.filter(r => Number(r.stockQty) === 0).length;
    return { total, lowCount, emptyCount };
  }, [rows]);

  const reqStats = useMemo(() => ({
    aktif: requests.filter(r => ACTIVE_STATUSES.includes(r.status)).length,
    action: requests.filter(r => r.status === 'revised').length,
    total: requests.length,
  }), [requests]);

  // Active request map by inventory
  const requestByInventoryId = useMemo(() => {
    const map = new Map();
    const priority = { revised: 0, pending: 1, approved: 2 };
    for (const r of requests) {
      if (!r.inventoryId || !ACTIVE_STATUSES.includes(r.status)) continue;
      const prev = map.get(r.inventoryId);
      if (!prev || (priority[r.status] ?? 9) < (priority[prev.status] ?? 9)) {
        map.set(r.inventoryId, r);
      }
    }
    return map;
  }, [requests]);

  // Filtered rows
  const filtered = useMemo(() => {
    let result = rows;
    const q = search.trim().toLowerCase();
    if (q) {
      result = result.filter(r =>
        (r.name || '').toLowerCase().includes(q) ||
        (r.itemCode || '').toLowerCase().includes(q) ||
        (r.categoryName || '').toLowerCase().includes(q)
      );
    }
    if (category !== 'all') {
      result = result.filter(r => {
        const cat = (r.categoryName || '').toLowerCase();
        if (category === 'deterjen') return cat.includes('deterjen');
        if (category === 'pewangi') return cat.includes('pewangi') || cat.includes('pewang');
        if (category === 'plastik') return cat.includes('plastik') || cat.includes('packing') || cat.includes('kantong');
        if (category === 'peralatan') return cat.includes('peralatan') || cat.includes('hanger') || cat.includes('alat');
        return true;
      });
    }
    return result;
  }, [rows, search, category]);

  const filteredRequests = useMemo(() => {
    let result = requests;
    const q = reqSearch.trim().toLowerCase();
    if (q) {
      result = result.filter(r =>
        (r.itemName || '').toLowerCase().includes(q) ||
        (r.brand || '').toLowerCase().includes(q)
      );
    }
    return result;
  }, [requests, reqSearch]);

  const handleQuickRequest = (item) => {
    setRequestItem(item);
    setShowRequestForm(true);
  };

  const closeRequestForm = () => {
    setShowRequestForm(false);
    setRequestItem(null);
  };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: TOKENS.bg, overflow: 'hidden', minHeight: '100vh' }}>

      {/* HEADER */}
      <PageHeader stats={stats} goBack={goBack} pageTab={pageTab} onTabChange={setPageTab} reqActionNeeded={reqStats.action > 0} />

      {/* SUMMARY STRIP (floats over header) */}
      <SummaryStrip stats={stats} />

      {/* SEARCH */}
      <SearchBar stokSearch={search} onStokSearch={setSearch} reqSearch={reqSearch} onReqSearch={setReqSearch} pageTab={pageTab} />

      {/* CATEGORY CHIPS (Stok tab only) */}
      {pageTab === 'stok' && (
        <CategoryChips value={category} onChange={setCategory} />
      )}

      {/* MAIN LIST */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px 100px', WebkitOverflowScrolling: 'touch' }}>
        {pageTab === 'stok' ? (
          <>
            {loading && <SkeletonList count={4} height={88} style={SKELETON_STYLE} />}

            {!loading && fetchError && (
              <ErrorPanel message={fetchError} onRetry={() => loadStock(true)} />
            )}

            {!loading && !fetchError && filtered.length === 0 && (
              <EmptyState
                type="inventory"
                title={search ? 'Tidak Ditemukan' : 'Belum Ada Data'}
                message={search ? 'Coba kata kunci lain' : 'Data inventaris akan muncul di sini'}
                suggestion=""
                illustrationSize={80}
              />
            )}

            {!loading && !fetchError && <StockGroupedView
              rows={filtered}
              activeRequestById={requestByInventoryId}
              onAjukan={handleQuickRequest}
            />}

          </>
        ) : (
          <>
            {reqLoading && <SkeletonList count={3} height={100} style={SKELETON_STYLE} />}

            {!reqLoading && reqError && (
              <ErrorPanel message={reqError} onRetry={() => loadRequests(true)} />
            )}

            {!reqLoading && !reqError && filteredRequests.length === 0 && (
              <EmptyState
                type="orders"
                title={reqSearch ? 'Tidak Ditemukan' : 'Belum Ada Pengajuan'}
                message={reqSearch ? 'Coba kata kunci lain' : 'Pengajuan barang akan muncul di sini'}
                suggestion=""
                illustrationSize={80}
              />
            )}

            {!reqLoading && !reqError && filteredRequests.map(r => (
              <RequestCard key={r.id} item={r} />
            ))}
          </>
        )}
      </div>

      {/* QUICK REQUEST MODAL */}
      {showRequestForm && requestItem && (
        <QuickRequestModal
          item={requestItem}
          onClose={closeRequestForm}
          onSuccess={() => {
            closeRequestForm();
            refreshAll(true);
          }}
        />
      )}
    </div>
  );
}

// ─── SKELETON LIST ─────────────────────────────────────────────────────────────
function SkeletonList({ count = 3, height = 80, style = {} }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} style={{
          borderRadius: 14,
          marginBottom: 12,
          height,
          background: 'linear-gradient(90deg, rgba(59,11,71,0.06) 25%, rgba(59,11,71,0.1) 50%, rgba(59,11,71,0.06) 75%)',
          backgroundSize: '200% 100%',
          animation: 'shimmer 1.5s infinite',
          ...style,
        }} />
      ))}
      <style>{`@keyframes shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}`}</style>
    </>
  );
}

// ─── PAGE HEADER ───────────────────────────────────────────────────────────────
function PageHeader({ stats, goBack, pageTab, onTabChange, reqActionNeeded }) {
  return (
    <div style={{
      position: 'relative',
      padding: '24px 16px 56px',
      background: `radial-gradient(circle at 85% -10%, rgba(232,90,168,0.55) 0%, transparent 55%), radial-gradient(circle at -10% 20%, rgba(95,217,174,0.25) 0%, transparent 45%), linear-gradient(155deg, ${TOKENS.purpleDeep} 0%, ${TOKENS.purpleMid} 55%, #4A1259 100%)`,
      overflow: 'hidden',
    }}>
      {/* Blob decorations */}
      <div style={{ position: 'absolute', width: 160, height: 160, background: 'radial-gradient(circle, rgba(232,90,168,0.55) 0%, transparent 70%)', top: -50, right: -30, borderRadius: '50%', animation: 'floatB 11s ease-in-out infinite', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', width: 130, height: 130, background: 'radial-gradient(circle, rgba(95,217,174,0.35) 0%, transparent 70%)', bottom: -30, left: -40, borderRadius: '50%', animation: 'floatC 16s ease-in-out infinite', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', width: 80, height: 80, background: 'radial-gradient(circle, rgba(255,255,255,0.18) 0%, transparent 70%)', top: 20, left: '55%', borderRadius: '50%', animation: 'floatA 9s ease-in-out infinite', pointerEvents: 'none' }} />

      {/* Sparkles */}
      <div style={{ position: 'absolute', width: 14, top: 20, right: 60, animation: 'twinkle 3.2s ease-in-out infinite', pointerEvents: 'none', zIndex: 1 }}>
        <svg viewBox="0 0 24 24" width="14" height="14" fill="#fff" style={{ filter: 'drop-shadow(0 0 4px rgba(255,255,255,0.9))' }}>
          <path d="M12 0 L14.2 9.8 L24 12 L14.2 14.2 L12 24 L9.8 14.2 L0 12 L9.8 9.8 Z" />
        </svg>
      </div>
      <div style={{ position: 'absolute', width: 8, top: 55, right: 25, animation: 'twinkle 3.2s ease-in-out 1.1s infinite', pointerEvents: 'none', zIndex: 1 }}>
        <svg viewBox="0 0 24 24" width="8" height="8" fill="#fff" style={{ filter: 'drop-shadow(0 0 4px rgba(255,255,255,0.9))' }}>
          <path d="M12 0 L14.2 9.8 L24 12 L14.2 14.2 L12 24 L9.8 14.2 L0 12 L9.8 9.8 Z" />
        </svg>
      </div>
      <div style={{ position: 'absolute', width: 10, top: 12, left: '28%', animation: 'twinkle 3.2s ease-in-out 2s infinite', pointerEvents: 'none', zIndex: 1 }}>
        <svg viewBox="0 0 24 24" width="10" height="10" fill="#fff" style={{ filter: 'drop-shadow(0 0 4px rgba(255,255,255,0.9))' }}>
          <path d="M12 0 L14.2 9.8 L24 12 L14.2 14.2 L12 24 L9.8 14.2 L0 12 L9.8 9.8 Z" />
        </svg>
      </div>

      {/* Back button + title */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', position: 'relative', zIndex: 2 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            onClick={goBack}
            style={{
              width: 36, height: 36, borderRadius: 12,
              background: 'rgba(255,255,255,0.14)',
              border: '1px solid rgba(255,255,255,0.25)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', backdropFilter: 'blur(6px)',
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5M12 5l-7 7 7 7" />
            </svg>
          </button>
          <div>
            <div style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 700, fontSize: 22, color: '#fff' }}>Inventaris</div>
            <div style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 12, color: 'rgba(255,255,255,0.65)', fontWeight: 500, marginTop: 2 }}>
              Pendataan stok barang outlet
            </div>
          </div>
        </div>

        {/* Tab switcher */}
        <div style={{
          display: 'flex', gap: 4,
          background: 'rgba(255,255,255,0.12)',
          borderRadius: 14,
          padding: 4,
          backdropFilter: 'blur(8px)',
          border: '1px solid rgba(255,255,255,0.2)',
          alignSelf: 'center',
        }}>
          {TABS.map(t => {
            const active = pageTab === t.key;
            return (
              <button
                key={t.key}
                onClick={() => onTabChange(t.key)}
                style={{
                  padding: '7px 16px',
                  borderRadius: 10,
                  border: 'none',
                  background: active ? 'rgba(255,255,255,0.22)' : 'transparent',
                  color: active ? '#fff' : 'rgba(255,255,255,0.65)',
                  fontFamily: "'Plus Jakarta Sans', sans-serif",
                  fontSize: 12,
                  fontWeight: active ? 700 : 600,
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  position: 'relative',
                }}
              >
                {t.label}
                {t.key === 'pengajuan' && reqActionNeeded && (
                  <span style={{
                    position: 'absolute', top: 2, right: 4,
                    width: 8, height: 8, borderRadius: '50%',
                    background: '#F0466B',
                  }} />
                )}
              </button>
            );
          })}
        </div>
      </div>

      <style>{`
        @keyframes floatA { 0%,100%{transform:translate(0,0) scale(1)} 50%{transform:translate(-14px,16px) scale(1.08)} }
        @keyframes floatB { 0%,100%{transform:translate(0,0) scale(1)} 50%{transform:translate(18px,-12px) scale(1.1)} }
        @keyframes floatC { 0%,100%{transform:translate(0,0) scale(1)} 50%{transform:translate(16px,10px) scale(0.95)} }
        @keyframes twinkle { 0%,100%{opacity:0;transform:scale(0.4) rotate(0deg)} 50%{opacity:1;transform:scale(1) rotate(20deg)} }
      `}</style>
    </div>
  );
}

// ─── SUMMARY STRIP ─────────────────────────────────────────────────────────────
function SummaryStrip({ stats }) {
  return (
    <div style={{
      position: 'relative',
      zIndex: 3,
      margin: '-36px 16px 0',
      background: TOKENS.glassStrong,
      backdropFilter: 'blur(18px) saturate(160%)',
      WebkitBackdropFilter: 'blur(18px) saturate(160%)',
      border: '1px solid rgba(255,255,255,0.6)',
      borderRadius: 20,
      padding: '14px 12px',
      display: 'grid',
      gridTemplateColumns: 'repeat(3, 1fr)',
      boxShadow: `0 16px 32px -14px rgba(59,11,71,0.28), inset 0 1px 0 rgba(255,255,255,0.8)`,
    }}>
      <div style={{ textAlign: 'center', padding: '0 4px', borderRight: '1px solid rgba(59,11,71,0.08)' }}>
        <div style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 800, fontSize: 17, color: TOKENS.ink }}>{stats.total}</div>
        <div style={{ fontSize: 9.5, color: TOKENS.inkSoft, fontWeight: 600, marginTop: 2 }}>Total item</div>
      </div>
      <div style={{ textAlign: 'center', padding: '0 4px', borderRight: '1px solid rgba(59,11,71,0.08)' }}>
        <div style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 800, fontSize: 17, color: TOKENS.goldDeep }}>{stats.lowCount}</div>
        <div style={{ fontSize: 9.5, color: TOKENS.inkSoft, fontWeight: 600, marginTop: 2 }}>Stok menipis</div>
      </div>
      <div style={{ textAlign: 'center', padding: '0 4px' }}>
        <div style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 800, fontSize: 17, color: TOKENS.coralDeep }}>{stats.emptyCount}</div>
        <div style={{ fontSize: 9.5, color: TOKENS.inkSoft, fontWeight: 600, marginTop: 2 }}>Stok habis</div>
      </div>
    </div>
  );
}

// ─── SEARCH BAR ───────────────────────────────────────────────────────────────
function SearchBar({ stokSearch, onStokSearch, reqSearch, onReqSearch, pageTab }) {
  const value = pageTab === 'stok' ? stokSearch : reqSearch;
  const onChange = pageTab === 'stok' ? onStokSearch : onReqSearch;
  const placeholder = pageTab === 'stok' ? 'Cari nama barang...' : 'Cari pengajuan...';

  return (
    <div style={{
      margin: '14px 16px 0',
      background: TOKENS.glassStrong,
      backdropFilter: 'blur(14px)',
      WebkitBackdropFilter: 'blur(14px)',
      border: '1px solid rgba(255,255,255,0.6)',
      borderRadius: 18,
      padding: '12px 15px',
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      boxShadow: `0 10px 22px -12px rgba(59,11,71,0.18), inset 0 1px 0 rgba(255,255,255,0.7)`,
    }}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={TOKENS.inkSoft} strokeWidth="2">
        <circle cx="11" cy="11" r="7" />
        <path d="M21 21l-4.3-4.3" />
      </svg>
      <input
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          border: 'none',
          background: 'none',
          outline: 'none',
          flex: 1,
          fontSize: 13,
          fontFamily: "'Plus Jakarta Sans', sans-serif",
          color: TOKENS.ink,
        }}
      />
    </div>
  );
}

// ─── CATEGORY CHIPS ────────────────────────────────────────────────────────────
function CategoryChips({ value, onChange }) {
  return (
    <div style={{ display: 'flex', gap: 8, overflowX: 'auto', margin: '14px 16px 4px', paddingBottom: 2 }}>
      {CATEGORIES.map(cat => {
        const active = value === cat.key;
        return (
          <button
            key={cat.key}
            onClick={() => onChange(cat.key)}
            style={{
              flexShrink: 0,
              fontSize: 11.5,
              fontWeight: 700,
              color: active ? '#fff' : TOKENS.inkSoft,
              background: active ? `linear-gradient(150deg, #C24FE0 0%, #7A1F8F 100%)` : `linear-gradient(145deg, #F7F0FB, #EDE0F5)`,
              padding: '8px 14px',
              borderRadius: 999,
              border: 'none',
              boxShadow: active ? `-2px -2px 5px rgba(255,255,255,0.25), 2px 4px 9px rgba(122,31,143,0.4)` : `-2px -2px 5px rgba(255,255,255,0.6), 2px 3px 7px rgba(59,11,71,0.1)`,
              whiteSpace: 'nowrap',
              cursor: 'pointer',
              fontFamily: "'Plus Jakarta Sans', sans-serif",
            }}
          >
            {cat.label}
          </button>
        );
      })}
    </div>
  );
}

// ─── STOCK ITEM CARD ──────────────────────────────────────────────────────────
function StockGroupedView({ rows, activeRequestById, onAjukan }) {
  // Grouping: 2 sections to keep list short
  // Section 1: stok habis/menipis
  // Section 2: stok aman
  const low = [];
  const safe = [];

  for (const r of rows) {
    const stockQty = Number(r.stockQty);
    const minStock = Number(r.minStock);
    const stockKey = stockQty === 0 ? 'habis' : stockQty <= minStock ? 'menipis' : 'aman';
    if (stockKey === 'aman') safe.push(r);
    else low.push(r);
  }

  const Section = ({ title, subtitle, items }) => (
    <div style={{ marginBottom: 14 }}>
      <div style={{
        position: 'sticky', top: 0,
        zIndex: 1,
        margin: '0 2px 8px',
        display: 'flex',
        alignItems: 'baseline',
        justifyContent: 'space-between',
        gap: 10,
      }}>
        <div style={{
          fontFamily: "'Outfit', sans-serif",
          fontSize: 12,
          fontWeight: 900,
          letterSpacing: 0.2,
          color: '#2B1130',
          background: 'rgba(255,255,255,0.65)',
          border: '1px solid rgba(255,255,255,0.85)',
          backdropFilter: 'blur(10px)',
          WebkitBackdropFilter: 'blur(10px)',
          padding: '8px 10px',
          borderRadius: 14,
        }}>
          {title}
        </div>
        <div style={{ fontSize: 10, color: TOKENS.inkSoft, fontWeight: 700 }}>{subtitle} · {items.length}</div>
      </div>

      {items.length === 0 ? (
        <div style={{ padding: 10 }} />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {items.slice(0, 10).map((r) => (
            <CompactStockItemCard
              key={r.id}
              item={r}
              activeRequest={activeRequestById.get(r.id) || null}
              onAjukan={() => onAjukan(r)}
            />
          ))}

          {items.length > 10 && (
            <div style={{ textAlign: 'center', fontSize: 11, color: TOKENS.inkSoft, fontWeight: 700, marginTop: 2 }}>
              + {items.length - 10} lainnya
            </div>
          )}
        </div>
      )}
    </div>
  );

  return (
    <>
      <Section
        title="⚠️ Perlu perhatian"
        subtitle="Stok menipis/habis"
        items={low}
      />
      <Section
        title="✅ Stok aman"
        subtitle="Lanjut produksi"
        items={safe}
      />
    </>
  );
}

function CompactStockItemCard({ item: r, activeRequest, onAjukan }) {
  // NOTE: legacy card (kept for potential reuse)
  // Compact UI below is used by StockGroupedView.
  

  const stockQty = Number(r.stockQty);
  const minStock = Number(r.minStock);
  const stockPct = minStock > 0 ? Math.min(1, stockQty / minStock) : 1;

  const stockKey = stockQty === 0 ? 'habis' : stockQty <= minStock ? 'menipis' : 'aman';
  const meta = STOCK_META[stockKey];
  const reqSt = activeRequest ? (REQ_STATUS_META[activeRequest.status] || REQ_STATUS_META.pending) : null;
  const hasRequest = !!activeRequest;
  const isLow = stockKey !== 'aman';

  return (
    <div style={{
      background: TOKENS.glassStrong,
      backdropFilter: 'blur(14px)',
      WebkitBackdropFilter: 'blur(14px)',
      border: '1px solid rgba(255,255,255,0.6)',
      borderRadius: 20,
      padding: 14,
      marginBottom: 12,
      boxShadow: `0 12px 26px -14px rgba(59,11,71,0.2), inset 0 1px 0 rgba(255,255,255,0.7)`,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {/* Icon */}
        <div style={{
          width: 46, height: 46, borderRadius: 16, flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: `linear-gradient(145deg, #F5E9FB, #E9D3F2)`,
          boxShadow: `-3px -3px 8px rgba(255,255,255,0.6), 3px 5px 10px rgba(59,11,71,0.16)`,
        }}>
          <ItemIcon categoryName={r.categoryName} />
        </div>

        {/* Body */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 700, fontSize: 14, color: TOKENS.ink }}>
            {r.name}
          </div>
          <div style={{ fontSize: 11, color: TOKENS.inkSoft, fontWeight: 500, marginTop: 2 }}>
            {r.categoryName} · {r.unit}
          </div>

          {/* Meta row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 7, flexWrap: 'wrap' }}>
            <span style={{
              fontSize: 10, fontWeight: 800,
              padding: '3px 10px', borderRadius: 999,
              display: 'flex', alignItems: 'center', gap: 4,
              background: stockKey === 'aman' ? 'rgba(31,158,117,0.15)' : stockKey === 'menipis' ? 'rgba(184,129,26,0.15)' : 'rgba(184,40,72,0.15)',
              color: meta.valColor,
            }}>
              <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'currentColor' }} />
              {meta.label}
            </span>
            {r.defaultCost && (
              <span style={{ fontSize: 10.5, color: TOKENS.inkSoft, fontWeight: 500 }}>
                Rp <b style={{ color: TOKENS.ink }}>{Number(r.defaultCost).toLocaleString('id-ID')}</b> / {r.unit}
              </span>
            )}
          </div>

          {/* Progress bar */}
          <div style={{ width: '100%', height: 4, borderRadius: 99, marginTop: 8, background: 'rgba(59,11,71,0.08)', overflow: 'hidden' }}>
            <div style={{
              height: '100%',
              width: `${Math.min(100, stockPct * 100)}%`,
              borderRadius: 99,
              background: `linear-gradient(90deg, ${meta.barColor}, ${meta.valColor})`,
              transition: 'width 0.4s',
            }} />
          </div>
        </div>

        {/* Qty right side */}
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 800, fontSize: 19, color: meta.valColor }}>
            {stockQty}
          </div>
          <div style={{ fontSize: 9.5, color: TOKENS.inkSoft, fontWeight: 600, marginTop: 1 }}>
            {r.unit}
          </div>
        </div>
      </div>

      {/* Request indicator */}
      {hasRequest && reqSt && (
        <div style={{
          marginTop: 10, padding: '8px 12px', borderRadius: 10,
          background: reqSt.bg, border: `1px solid ${reqSt.fg}33`,
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <span style={{ fontSize: 13 }}>{reqSt.icon}</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: reqSt.fg }}>
              Pengajuan {reqSt.label}
            </div>
            <div style={{ fontSize: 10, color: TOKENS.inkSoft, marginTop: 1 }}>
              {activeRequest.qty} {activeRequest.unit} · Lihat tab Pengajuan
            </div>
          </div>
        </div>
      )}

      {/* Ajukan button */}
      {isLow && !hasRequest && (
        <button
          onClick={onAjukan}
          style={{
            marginTop: 10,
            width: '100%',
            padding: '10px 14px',
            borderRadius: 14,
            border: 'none',
            background: `linear-gradient(150deg, ${TOKENS.magenta} 0%, ${TOKENS.purpleDeep} 100%)`,
            color: '#fff',
            fontFamily: "'Plus Jakarta Sans', sans-serif",
            fontSize: 12, fontWeight: 700,
            cursor: 'pointer',
            boxShadow: `0 4px 14px rgba(91,0,95,0.35)`,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M12 5v14M5 12h14" />
          </svg>
          Ajukan Pengadaan
        </button>
      )}
    </div>
  );
}

// ─── ITEM ICON by category ─────────────────────────────────────────────────────
function ItemIcon({ categoryName }) {
  const cat = (categoryName || '').toLowerCase();
  let d = 'M7 3h10l1 4H6l1-4zM6 7l-2 13a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2L18 7M9 12a3 3 0 0 0 6 0';
  if (cat.includes('deterjen')) {
    d = 'M4 4h16v4H4zM4 10h16v10H4zM9 14h6';
  } else if (cat.includes('pewang')) {
    d = 'M12 2c2 3 5 6 5 10a5 5 0 0 1-10 0c0-4 3-7 5-10z';
  } else if (cat.includes('plastik') || cat.includes('packing') || cat.includes('kantong')) {
    d = 'M3 6h18M6 6v14a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V6M10 10v6M14 10v6';
  } else if (cat.includes('peralatan') || cat.includes('hanger') || cat.includes('alat')) {
    d = 'M9 3H5a2 2 0 0 0-2 2v4m6-6h10a2 2 0 0 1 2 2v4M9 3v10m0 0H5m4 0h10m0-10v10m0 0h-4m4 0v4m-4-4v-4';
  }
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#6B2B7D" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d={d} /></svg>;
}

// ─── REQUEST CARD ─────────────────────────────────────────────────────────────
function RequestCard({ item: r }) {
  const st = REQ_STATUS_META[r.status] || REQ_STATUS_META.pending;
  const urgMap = { normal: null, urgent: { label: 'Urgent', color: '#B8811A' }, critical: { label: 'Kritis', color: '#B82848' } };
  const urg = urgMap[r.urgency];

  return (
    <div style={{
      background: TOKENS.glassStrong,
      backdropFilter: 'blur(14px)',
      WebkitBackdropFilter: 'blur(14px)',
      border: '1px solid rgba(255,255,255,0.6)',
      borderRadius: 20,
      padding: 14,
      marginBottom: 12,
      boxShadow: `0 12px 26px -14px rgba(59,11,71,0.2), inset 0 1px 0 rgba(255,255,255,0.7)`,
      borderLeft: `4px solid ${st.fg}`,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 700, fontSize: 14, color: TOKENS.ink }}>
            {r.itemName}
          </div>
          {r.brand && <div style={{ fontSize: 11, color: TOKENS.inkSoft, fontWeight: 500, marginTop: 2 }}>{r.brand}</div>}
          <div style={{ fontSize: 11, color: TOKENS.inkSoft, marginTop: 4 }}>
            {r.qty} {r.unit}
            {r.approvedQty != null && r.approvedQty !== r.qty && (
              <span style={{ color: '#1F9E75', fontWeight: 600 }}> · Disetujui {r.approvedQty} {r.unit}</span>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-end', flexShrink: 0 }}>
          <span style={{ fontSize: 9, fontWeight: 700, padding: '3px 8px', borderRadius: 999, background: st.bg, color: st.fg }}>
            {st.icon} {st.label}
          </span>
          {urg && (
            <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 999, background: 'rgba(122,101,132,0.12)', color: urg.color }}>
              {urg.label}
            </span>
          )}
        </div>
      </div>

      {r.reason && (
        <div style={{ marginTop: 8, padding: '6px 10px', borderRadius: 8, background: 'rgba(59,11,71,0.05)', fontSize: 11, color: TOKENS.inkSoft, lineHeight: 1.5 }}>
          {r.reason}
        </div>
      )}

      {r.adminNote && (
        <div style={{
          marginTop: 8, padding: '8px 10px', borderRadius: 8,
          background: r.status === 'revised' ? 'rgba(184,129,26,0.12)' : 'rgba(95,217,174,0.12)',
          borderLeft: `3px solid ${r.status === 'revised' ? '#B8811A' : '#1F9E75'}`,
          fontSize: 11, color: TOKENS.ink, lineHeight: 1.5,
        }}>
          📝 <strong>Catatan:</strong> {r.adminNote}
        </div>
      )}

      <div style={{ fontSize: 10, color: TOKENS.inkSoft, marginTop: 8 }}>
        Diajukan {fmtDate(r.createdAt)}
        {r.resolvedAt && ` · Diproses ${fmtDate(r.resolvedAt)}`}
        {r.approverName && ` · oleh ${r.approverName}`}
      </div>
    </div>
  );
}

// ─── ERROR PANEL ───────────────────────────────────────────────────────────────
function ErrorPanel({ message, onRetry }) {
  return (
    <div style={{ textAlign: 'center', padding: 24, background: 'rgba(184,40,72,0.08)', borderRadius: 16, border: '1px solid rgba(184,40,72,0.2)' }}>
      <div style={{ fontSize: 28, marginBottom: 8 }}>⚠️</div>
      <div style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 12, color: TOKENS.coralDeep, marginBottom: 12 }}>
        {message}
      </div>
      <button
        onClick={onRetry}
        style={{
          padding: '8px 16px', borderRadius: 10, border: 'none',
          background: `linear-gradient(150deg, ${TOKENS.magenta}, ${TOKENS.purpleDeep})`,
          color: 'white', fontFamily: "'Plus Jakarta Sans', sans-serif",
          fontSize: 12, fontWeight: 600, cursor: 'pointer',
        }}
      >
        Coba Lagi
      </button>
    </div>
  );
}

// ─── QUICK REQUEST MODAL ──────────────────────────────────────────────────────
function QuickRequestModal({ item, onClose, onSuccess }) {
  const [qty, setQty] = useState('');
  const [reason, setReason] = useState('');
  const [urgency, setUrgency] = useState('urgent');
  const [estimatedPrice, setEstimatedPrice] = useState('');
  const [loading, setLoading] = useState(false);

  const URGENCY_OPTS = [
    { key: 'normal', label: 'Normal', bg: 'rgba(122,101,132,0.12)', fg: TOKENS.inkSoft },
    { key: 'urgent', label: 'Urgent', bg: 'rgba(184,129,26,0.15)', fg: '#B8811A' },
    { key: 'critical', label: 'Kritis', bg: 'rgba(184,40,72,0.15)', fg: '#B82848' },
  ];

  const submit = async () => {
    const numQty = Number(qty);
    if (!Number.isFinite(numQty) || numQty <= 0) { alertWarning('Jumlah harus lebih dari 0.'); return; }
    if (!reason.trim()) { alertWarning('Alasan kenapa butuh wajib.'); return; }
    setLoading(true);
    try {
      await axios.post('/api/purchase-requests', {
        inventoryId: item.id,
        itemName: item.name,
        brand: null,
        category: item.categoryName,
        qty: numQty,
        unit: item.unit,
        estimatedPrice: estimatedPrice ? Number(estimatedPrice) : null,
        urgency,
        reason: reason.trim(),
      });
      alertSuccess('Pengajuan berhasil dikirim ke admin.');
      onSuccess();
    } catch (err) {
      if (err?.response?.status === 409) {
        alertError(err?.response?.data?.message || 'Sudah ada pengajuan aktif untuk item ini.');
      } else {
        alertError(err?.response?.data?.message || 'Gagal kirim pengajuan.');
      }
    } finally {
      setLoading(false);
    }
  };

  const suggestedQty = Math.max(1, Math.ceil(2 * Number(item.minStock || 0) - Number(item.stockQty || 0)));

  return (
    <Modal visible onClose={onClose} title="Ajukan Pengadaan">
      <div style={{ padding: '0 18px 18px' }}>
        {/* Item info */}
        <div style={{ background: 'rgba(59,11,71,0.04)', borderRadius: 14, padding: '12px 14px', marginBottom: 14 }}>
          <div style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 700, fontSize: 15, color: TOKENS.ink }}>
            {item.name}
          </div>
          <div style={{ fontSize: 11, color: TOKENS.inkSoft, fontWeight: 500, marginTop: 3 }}>
            {item.categoryName} · {item.unit}
          </div>
          <div style={{ fontSize: 12, color: TOKENS.inkSoft, marginTop: 6 }}>
            Stok sekarang:{' '}
            <strong style={{ color: TOKENS.coralDeep }}>
              {Number(item.stockQty).toLocaleString('id-ID')} {item.unit}
            </strong>
            {item.minStock && item.minStock > 0 && <> · Min: {Number(item.minStock).toLocaleString('id-ID')}</>}
          </div>
        </div>

        {/* Suggested qty */}
        <div style={{ background: 'rgba(184,129,26,0.12)', borderRadius: 10, padding: '8px 12px', marginBottom: 14, fontSize: 11, color: '#B8811A', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
          💡 Rekomendasi: <strong>{suggestedQty} {item.unit}</strong> (2× minimum − stok sekarang)
        </div>

        <Input
          label={`Jumlah (${item.unit}) *`}
          value={qty}
          onChange={(v) => setQty(v.replace(/[^\d.]/g, ''))}
          placeholder={`Contoh: ${suggestedQty}`}
          inputMode="decimal"
        />

        {/* Urgency */}
        <div style={{ marginBottom: 14 }}>
          <label style={{ display: 'block', fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 12, fontWeight: 600, color: TOKENS.ink, marginBottom: 8 }}>
            Tingkat Urgensi
          </label>
          <div style={{ display: 'flex', gap: 8 }}>
            {URGENCY_OPTS.map(opt => {
              const active = urgency === opt.key;
              return (
                <button
                  key={opt.key}
                  onClick={() => setUrgency(opt.key)}
                  style={{
                    flex: 1, padding: '8px 6px',
                    borderRadius: 12,
                    border: `1.5px solid ${active ? opt.fg : 'rgba(59,11,71,0.12)'}`,
                    background: active ? opt.bg : 'white',
                    color: active ? opt.fg : TOKENS.inkSoft,
                    fontFamily: "'Plus Jakarta Sans', sans-serif",
                    fontSize: 11, fontWeight: active ? 700 : 500,
                    cursor: 'pointer',
                  }}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>

        <Input
          label="Estimasi harga (opsional)"
          value={estimatedPrice}
          onChange={(v) => setEstimatedPrice(v.replace(/[^\d]/g, ''))}
          placeholder="250000"
          inputMode="numeric"
        />

        {/* Reason */}
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 12, fontWeight: 600, color: TOKENS.ink, marginBottom: 6 }}>
            Alasan / Kebutuhan *
          </label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            placeholder={`Stok ${item.name} tinggal ${item.stockQty} ${item.unit} — minimum ${item.minStock}. Butuh tambahan.`}
            style={{
              width: '100%', borderRadius: 12, padding: '10px 12px',
              border: `1.5px solid rgba(59,11,71,0.15)`,
              fontFamily: "'Plus Jakarta Sans', sans-serif",
              fontSize: 13, color: TOKENS.ink, background: 'white',
              outline: 'none', resize: 'none', boxSizing: 'border-box',
            }}
          />
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={onClose}
            style={{
              flex: 1, padding: '12px', borderRadius: 14,
              border: `1.5px solid rgba(59,11,71,0.15)`, background: 'white',
              color: TOKENS.inkSoft, fontFamily: "'Plus Jakarta Sans', sans-serif",
              fontSize: 13, fontWeight: 600, cursor: 'pointer',
            }}
          >
            Batal
          </button>
          <button
            onClick={submit}
            disabled={loading}
            style={{
              flex: 1, padding: '12px', borderRadius: 14, border: 'none',
              background: loading ? TOKENS.inkSoft : `linear-gradient(150deg, ${TOKENS.magenta}, ${TOKENS.purpleDeep})`,
              color: 'white', fontFamily: "'Plus Jakarta Sans', sans-serif",
              fontSize: 13, fontWeight: 700,
              cursor: loading ? 'not-allowed' : 'pointer',
              boxShadow: `0 4px 14px rgba(91,0,95,0.35)`,
            }}
          >
            {loading ? 'Mengirim...' : 'Kirim ke Admin'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
