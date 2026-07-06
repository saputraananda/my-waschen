// ─────────────────────────────────────────────────────────────────────────────
// Admin: Stok Semua Outlet
// ─────────────────────────────────────────────────────────────────────────────
// Tampilan matrix: tiap baris = 1 item (SKU), kolom = stok per outlet.
// Bisa filter "hanya stok rendah" untuk fokus ke yang perlu action.
// ─────────────────────────────────────────────────────────────────────────────
import { useState, useEffect, useCallback, useMemo } from 'react';
import axios from 'axios';
import { C, SHADOW } from '../../utils/theme';
import { TopBar, useAppRefresh, SearchBar } from '../../components/ui';

const STATUS_META = {
  safe:  { color: C.success, bg: C.successBg, label: 'Aman' },
  low:   { color: C.warning, bg: C.warningBg, label: 'Tipis' },
  empty: { color: C.danger, bg: C.dangerBg, label: 'Habis' },
};

export default function AllOutletStocksPage({ goBack }) {
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
      console.error('[AllOutletStocks]', err);
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
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: C.n50, overflow: 'hidden' }}>
      <TopBar
        title="Stok Semua Outlet"
        subtitle={`${items.length} item · ${totalLow} perlu perhatian`}
        onBack={goBack}
      />

      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px 24px' }}>
        {/* Filter bar */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 12, alignItems: 'center' }}>
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
              marginBottom: 12,
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
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 600 }}>
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
