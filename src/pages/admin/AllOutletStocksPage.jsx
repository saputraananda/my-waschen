// ─────────────────────────────────────────────────────────────────────────────
// Admin: Stok Semua Outlet
// ─────────────────────────────────────────────────────────────────────────────
// Tampilan matrix: tiap baris = 1 item (SKU), kolom = stok per outlet.
// Bisa filter "hanya stok rendah" untuk fokus ke yang perlu action.
// ─────────────────────────────────────────────────────────────────────────────
import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import axios from 'axios';
import { C, SHADOW } from '../../utils/theme';
import { useResponsive } from '../../utils/hooks';
import { TopBar, useAppRefresh, SearchBar } from '../../components/ui';
import { FloatingBubble, Sparkle, GlowOrb } from '../../components/ui/PremiumAnimations';
import bubbleIcon from '../../assets/Decorative icon/bubble-1.webp';
import bubble2Icon from '../../assets/Decorative icon/bubble-2.webp';

// ─── Mini Sparkline ─────────────────────────────────────────────────────────
function MiniSparkline({ data = [], color = '#10B981', width = 50, height = 28 }) {
  if (!data || data.length < 2) {
    return <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <path d={`M0 ${height/2} L${width} ${height/2}`} stroke={color} strokeWidth="2" fill="none" />
    </svg>;
  }
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const points = data.map((d, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((d - min) / range) * (height - 4) - 2;
    return `${x},${y}`;
  }).join(' ');
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <polygon points={`0,${height} ${points} ${width},${height}`} fill={`${color}20`} />
      <polyline points={points} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" />
      <circle cx={width} cy={points.split(' ').pop().split(',')[1]} r="2.5" fill={color} />
    </svg>
  );
}

// ─── Premium Stat Card ───────────────────────────────────────────────────────
function PremiumStatCard({ icon, label, value, color = '#5B005F', sparkline = [] }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -2 }}
      style={{
        background: 'linear-gradient(145deg, #FFFFFF, #F8F7FC)',
        borderRadius: 12,
        padding: '10px 12px',
        boxShadow: '4px 4px 10px rgba(91, 0, 95, 0.06), -2px -2px 6px rgba(255, 255, 255, 0.95)',
        border: '1px solid rgba(91, 0, 95, 0.04)',
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontFamily: 'Poppins', fontSize: 9, fontWeight: 600, color }}>{label}</span>
        <MiniSparkline data={sparkline} color={color} width={40} height={24} />
      </div>
      <div style={{ fontFamily: 'Poppins', fontSize: 16, fontWeight: 800, color: '#1E293B' }}>{value}</div>
    </motion.div>
  );
}

const STATUS_META = {
  safe:  { color: C.success, bg: C.successBg, label: 'Aman' },
  low:   { color: C.warning, bg: C.warningBg, label: 'Tipis' },
  empty: { color: C.danger, bg: C.dangerBg, label: 'Habis' },
};

export default function AllOutletStocksPage({ goBack }) {
  const { isMobile } = useResponsive();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [onlyLow, setOnlyLow] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (onlyLow) params.onlyLowStock = '1';
      if (search.trim()) params.search = search.trim();
      const r = await axios.get('/api/inventory/all-outlet-stocks', { params });
      setItems(r?.data?.data || []);
    } catch (err) {
      // Error handled silently
    } finally {
      setLoading(false);
    }
  }, [onlyLow, search]);

  useEffect(() => { fetchData(); }, [fetchData]);
  useAppRefresh(() => fetchData(), [fetchData]);

  // Daftar outlet (kolom) dari item pertama supaya konsisten
  const outletColumns = useMemo(() => {
    if (!items.length) return [];
    return items[0].outlets.map(o => ({ id: o.outletId, name: o.outletName }));
  }, [items]);

  const totalLow = items.filter(i => i.lowStockOutletCount > 0).length;

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#F8F4FF', overflow: 'hidden' }}>
      {/* ── Premium Header ── */}
      <div style={{
        background: 'linear-gradient(135deg, #5B005F 0%, #4D0051 100%)',
        padding: '16px 20px 20px',
        position: 'relative',
        overflow: 'hidden',
        flexShrink: 0,
      }}>
        <GlowOrb color="rgba(140, 76, 143, 0.4)" size={200} top="-60px" left="-30px" blur={50} />
        <GlowOrb color="rgba(249, 62, 17, 0.25)" size={150} top="40px" right="-40px" blur={40} />
        <Sparkle top="10%" left="15%" size={8} delay={0} color="#FFD700" />
        <Sparkle top="20%" left="80%" size={6} delay={0.5} color="#FF6B6B" />
        <Sparkle top="60%" left="25%" size={7} delay={1} color="#4ECDC4" />
        <FloatingBubble src={bubbleIcon} size={18} top="15%" left="5%" delay={0} opacity={0.4} />
        <FloatingBubble src={bubble2Icon} size={14} top="35%" right="8%" delay={0.5} opacity={0.35} />

        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', position: 'relative' }}>
          <div>
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              style={{ fontFamily: 'Poppins', fontSize: 18, fontWeight: 800, color: 'white', letterSpacing: '-0.5px' }}
            >
              Stok Semua Outlet
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              style={{ fontFamily: 'Poppins', fontSize: 11, color: 'rgba(255,255,255,0.8)', marginTop: 4 }}
            >
              {items.length} item · {totalLow} perlu perhatian
            </motion.div>
          </div>
          {goBack && (
            <button
              onClick={goBack}
              style={{
                background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.25)',
                borderRadius: 10, padding: '8px 12px', cursor: 'pointer', color: 'white',
              }}
            >
              ← Kembali
            </button>
          )}
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '14px 16px 24px' }}>
        <style>{`
          @media (max-width: 480px) {
            .stock-stats-grid { grid-template-columns: repeat(2, 1fr) !important; }
            .stock-matrix-table { font-size: 10px !important; }
            .stock-filter-row { flex-direction: column !important; }
            .stock-filter-row > * { width: 100% !important; }
          }
        `}</style>

        {/* Premium Stats Grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 10,
          marginBottom: 14,
        }} className="stock-stats-grid">
          <PremiumStatCard label="📦 Total Item" value={items.length} color={C.primary} sparkline={[10, 15, 12, items.length || 1]} />
          <PremiumStatCard label="⚠️ Perlu Perhatian" value={totalLow} color={C.warning} sparkline={[2, 5, 3, totalLow || 1]} />
          <PremiumStatCard label="✅ Aman" value={items.length - totalLow} color={C.success} sparkline={[8, 10, 9, items.length - totalLow || 1]} />
        </div>

        {/* Filter bar */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 12, alignItems: 'center' }} className="stock-filter-row">
          <div style={{ flex: 1 }}>
            <SearchBar value={search} onChange={setSearch} placeholder="Cari item, kategori, kode..." />
          </div>
          <button
            onClick={() => setOnlyLow(!onlyLow)}
            style={{
              padding: '8px 12px', borderRadius: 10,
              border: `1.5px solid ${onlyLow ? C.warning : C.n200}`,
              background: onlyLow ? C.warningBg : C.white,
              fontFamily: 'Poppins', fontSize: 11, fontWeight: 600,
              color: onlyLow ? C.warningDark : C.n700,
              cursor: 'pointer', whiteSpace: 'nowrap',
            }}
          >
            ⚠️ {onlyLow ? 'Semua' : 'Hanya Tipis/Habis'}
          </button>
        </div>

        {loading && <div style={{ textAlign: 'center', padding: 30, fontFamily: 'Poppins', fontSize: 12, color: C.n600 }}>Memuat…</div>}

        {!loading && items.length === 0 && (
          <div style={{ textAlign: 'center', padding: 50 }}>
            <div style={{ fontSize: 40, marginBottom: 8 }}>✅</div>
            <div style={{ fontFamily: 'Poppins', fontSize: 13, color: C.n600 }}>
              {onlyLow ? 'Semua stok aman, tidak ada yang perlu perhatian!' : 'Tidak ada data.'}
            </div>
          </div>
        )}

        {/* Matrix table — horizontal scroll untuk banyak outlet */}
        {!loading && items.length > 0 && (
          <div style={{
            background: 'white', borderRadius: 12, overflow: 'hidden',
            boxShadow: SHADOW.sm,
          }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 600 }} className="stock-matrix-table">
                <thead>
                  <tr style={{ background: C.n50 }}>
                    <th style={th}>Item</th>
                    {outletColumns.map(o => (
                      <th key={o.id} style={{ ...th, textAlign: 'center', minWidth: 90 }}>
                        {o.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {items.map((it) => (
                    <tr key={it.inventoryId} style={{ borderTop: `1px solid ${C.n100}` }}>
                      <td style={{ ...td, fontWeight: 600 }}>
                        <div style={{ fontFamily: 'Poppins', fontSize: 11, color: C.n600 }}>{it.categoryName}</div>
                        <div style={{ fontFamily: 'Poppins', fontSize: 13, color: C.n900 }}>{it.itemName}</div>
                        <div style={{ fontFamily: 'Poppins', fontSize: 9, color: C.n600 }}>{it.itemCode} · {it.unit}</div>
                      </td>
                      {it.outlets.map((o) => {
                        const meta = STATUS_META[o.status];
                        return (
                          <td key={o.outletId} style={{ ...td, textAlign: 'center' }}>
                            <div style={{
                              display: 'inline-flex', flexDirection: 'column', alignItems: 'center',
                              padding: '6px 10px', borderRadius: 8,
                              background: meta.bg,
                              minWidth: 70,
                            }}>
                              <div style={{
                                fontFamily: 'Poppins', fontSize: 14, fontWeight: 600,
                                color: meta.color,
                              }}>
                                {Number(o.stockQty).toLocaleString('id-ID')}
                              </div>
                              <div style={{
                                fontFamily: 'Poppins', fontSize: 8, fontWeight: 600,
                                color: meta.color, textTransform: 'uppercase',
                              }}>
                                {meta.label}
                              </div>
                              <div style={{
                                fontFamily: 'Poppins', fontSize: 8, color: C.n600,
                                marginTop: 1,
                              }}>
                                min {Number(o.minStock).toLocaleString('id-ID')}
                              </div>
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Legend */}
        <div style={{ marginTop: 14, padding: '10px 12px', background: C.white, borderRadius: 10, fontFamily: 'Poppins', fontSize: 10, color: C.n600 }}>
          <div style={{ fontWeight: 600, marginBottom: 6 }}>Keterangan status:</div>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            {Object.entries(STATUS_META).map(([k, m]) => (
              <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 12, height: 12, borderRadius: 3, background: m.color }} />
                <span>{m.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

const th = {
  fontFamily: 'Poppins', fontSize: 11, fontWeight: 600,
  color: C.n700, textAlign: 'left', padding: '12px 14px',
  textTransform: 'uppercase', letterSpacing: 0.3,
};
const td = {
  fontFamily: 'Poppins', fontSize: 12,
  color: C.n800, padding: '10px 14px',
  verticalAlign: 'middle',
};
