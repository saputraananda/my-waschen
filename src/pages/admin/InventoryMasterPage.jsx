// ─────────────────────────────────────────────────────────────────────────────
// InventoryMasterPage — Admin Inventory Management
// Features: Stock Matrix, SKU & Stok, Purchase Requests
// Design: Waschen Glassmorphism v2
// ─────────────────────────────────────────────────────────────────────────────
import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';
import { C, SHADOW } from '../../utils/theme';
import { rp } from '../../utils/helpers';
import { useIsMobile, useResponsive, useWindowSize } from '../../utils/hooks';
import { TopBar, Btn, SearchBar, Chip, useAppRefresh, EmptyState, Modal } from '../../components/ui';
import { alertError, alertSuccess } from '../../utils/alert';

// ─── Tab Config ─────────────────────────────────────────────────────────
const TABS = [
  { key: 'matrix', label: '📦 Matrix', icon: '📦' },
  { key: 'items', label: 'SKU & Stok', icon: '🏷️' },
  { key: 'requests', label: 'Pengajuan', icon: '📋' },
];

// ─── Stock Status ────────────────────────────────────────────────────────
const STOCK_META = {
  safe:  { color: C.success, bg: C.successBg, label: 'Aman', icon: '✅' },
  low:   { color: C.warning, bg: C.warningBg, label: 'Tipis', icon: '⚠️' },
  empty: { color: C.danger, bg: C.dangerBg, label: 'Habis', icon: '🔴' },
};

// ─── Status Badge ────────────────────────────────────────────────────────
function StatusBadge({ status }) {
  const meta = STOCK_META[status] || STOCK_META.safe;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '2px 8px', borderRadius: 999,
      background: meta.bg, color: meta.color,
      fontFamily: 'Poppins', fontSize: 9, fontWeight: 700,
    }}>
      {meta.icon} {meta.label}
    </span>
  );
}

// ─── Stat Card ───────────────────────────────────────────────────────────
function StatCard({ label, value, color, icon }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -2 }}
      style={{
        background: C.white,
        borderRadius: 14,
        padding: '12px 14px',
        boxShadow: SHADOW.sm,
        border: `1px solid ${C.n100}`,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <span style={{ fontSize: 16 }}>{icon}</span>
        <span style={{ fontFamily: 'Poppins', fontSize: 10, fontWeight: 600, color: C.n600 }}>{label}</span>
      </div>
      <div style={{ fontFamily: 'Poppins', fontSize: 20, fontWeight: 800, color }}>{value}</div>
    </motion.div>
  );
}

// ─── Tab 1: Stock Matrix ────────────────────────────────────────────────
function StockMatrix() {
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
    } catch (err) { console.error('[StockMatrix] fetchData error:', err); } finally { setLoading(false); }
  }, [onlyLow, search]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const outlets = useMemo(() => {
    if (!items.length) return [];
    return items[0]?.outlets?.map(o => ({ id: o.outletId, name: o.outletName })) || [];
  }, [items]);

  const totalLow = items.filter(i => i.lowStockOutletCount > 0).length;
  const totalSafe = items.length - totalLow;
  const totalEmpty = items.filter(i => i.outlets?.some(o => o.stockQty <= 0)).length;

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '0 16px 24px' }}>
      {/* Stats Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, padding: '16px 0' }} className="inventory-stats-grid">
        <StatCard label="Total Item" value={items.length} color={C.primary} icon="📦" />
        <StatCard label="Butuh Perhatian" value={totalLow} color={C.warning} icon="⚠️" />
        <StatCard label="Aman" value={totalSafe} color={C.success} icon="✅" />
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <div style={{ flex: 1 }}>
          <SearchBar value={search} onChange={setSearch} placeholder="Cari item..." compact />
        </div>
        <Chip
          label={onlyLow ? '🔴 Tipis/Habis' : 'Semua'}
          active={onlyLow}
          onClick={() => setOnlyLow(v => !v)}
        />
      </div>

      {/* Low Stock Alerts */}
      {totalLow > 0 && (
        <div style={{
          background: `${C.warning}10`,
          border: `1px solid ${C.warning}30`,
          borderRadius: 12,
          padding: '12px 14px',
          marginBottom: 12,
        }}>
          <div style={{ fontFamily: 'Poppins', fontSize: 11, fontWeight: 700, color: C.warning, marginBottom: 8 }}>
            🔔 {totalLow} item stok rendah atau habis
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {items.filter(i => i.lowStockOutletCount > 0).slice(0, 5).map(item => (
              <span key={item.inventoryId} style={{
                padding: '4px 10px',
                background: C.white,
                borderRadius: 8,
                fontFamily: 'Poppins', fontSize: 10, fontWeight: 600, color: C.n800,
              }}>
                {item.itemName}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Matrix Table */}
      {loading && (
        <div style={{ textAlign: 'center', padding: 40, fontFamily: 'Poppins', fontSize: 13, color: C.n500 }}>
          Memuat...
        </div>
      )}

      {!loading && items.length === 0 && (
        <EmptyState title="Stok kosong" subtitle="Tidak ada item inventori ditemukan." icon="📦" />
      )}

      {!loading && items.length > 0 && (
        <div style={{ background: C.white, borderRadius: 14, overflow: 'hidden', boxShadow: SHADOW.sm }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 400 }} className="inventory-matrix-table">
              <thead>
                <tr style={{ background: C.n50 }}>
                  <th style={{ padding: '10px 12px', textAlign: 'left', fontFamily: 'Poppins', fontSize: 10, fontWeight: 700, color: C.n600 }}>Item</th>
                  {outlets.map(o => (
                    <th key={o.id} style={{ padding: '10px 8px', textAlign: 'center', fontFamily: 'Poppins', fontSize: 10, fontWeight: 700, color: C.n600 }}>{o.name}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {items.map(it => (
                  <tr key={it.inventoryId} style={{ borderTop: `1px solid ${C.n100}` }}>
                    <td style={{ padding: '10px 12px' }}>
                      <div style={{ fontFamily: 'Poppins', fontSize: 9, color: C.n500 }}>{it.categoryName}</div>
                      <div style={{ fontFamily: 'Poppins', fontSize: 13, fontWeight: 700, color: C.n900 }}>{it.itemName}</div>
                      <div style={{ fontFamily: 'Poppins', fontSize: 9, color: C.n400 }}>{it.unit}</div>
                    </td>
                    {it.outlets.map(o => {
                      const status = o.stockQty <= 0 ? 'empty' : o.stockQty <= (o.minStock || 0) ? 'low' : 'safe';
                      const meta = STOCK_META[status];
                      return (
                        <td key={o.outletId} style={{ padding: '8px', textAlign: 'center' }}>
                          <div style={{
                            display: 'inline-flex', flexDirection: 'column', alignItems: 'center',
                            padding: '6px 10px', borderRadius: 10, background: meta.bg, minWidth: 60,
                          }}>
                            <span style={{ fontFamily: 'Poppins', fontSize: 15, fontWeight: 800, color: meta.color }}>
                              {Number(o.stockQty).toLocaleString('id-ID')}
                            </span>
                            <span style={{ fontFamily: 'Poppins', fontSize: 7, fontWeight: 700, color: meta.color }}>{meta.label}</span>
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
      {items.length > 0 && (
        <div style={{ display: 'flex', gap: 16, justifyContent: 'center', padding: '12px 0' }}>
          {Object.entries(STOCK_META).map(([k, m]) => (
            <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ width: 8, height: 8, borderRadius: 2, background: m.color }} />
              <span style={{ fontFamily: 'Poppins', fontSize: 10, color: C.n600 }}>{m.label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Tab 2: SKU & Stok ─────────────────────────────────────────────────
function SkuStokTab() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [form, setForm] = useState({ name: '', unit: '', minStock: '', categoryId: '' });
  const [categories, setCategories] = useState([]);
  const [saving, setSaving] = useState(false);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (search.trim()) params.search = search.trim();
      const r = await axios.get('/api/inventory/items', { params });
      setItems(r?.data?.data || []);
    } catch (err) { console.error('[SkuStokTab] fetchItems error:', err); } finally { setLoading(false); }
  }, [search]);

  const fetchMeta = useCallback(async () => {
    try {
      const r = await axios.get('/api/inventory/categories');
      setCategories(r?.data?.data || []);
    } catch (err) { console.error('[SkuStokTab] fetchMeta error:', err); }
  }, []);

  useEffect(() => { fetchItems(); fetchMeta(); }, [fetchItems, fetchMeta]);

  const openNew = () => {
    setForm({ name: '', unit: '', minStock: '', categoryId: '' });
    setEditingItem(null);
    setShowForm(true);
  };

  const openEdit = (item) => {
    setForm({ name: item.name, unit: item.unit || '', minStock: String(item.minStock || item.min_stock || ''), categoryId: item.categoryId || item.category_id || '' });
    setEditingItem(item);
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) { alertError('Nama item wajib diisi.'); return; }
    setSaving(true);
    try {
      if (editingItem) {
        await axios.patch(`/api/inventory/items/${editingItem.id}`, { name: form.name, unit: form.unit, minStock: Number(form.minStock) || 0 });
        alertSuccess('Item diperbarui.');
      } else {
        await axios.post('/api/inventory/items', { name: form.name, unit: form.unit, minStock: Number(form.minStock) || 0, categoryId: form.categoryId || null });
        alertSuccess('Item baru ditambahkan.');
      }
      setShowForm(false);
      fetchItems();
    } catch (err) {
      alertError(err?.response?.data?.message || 'Gagal menyimpan.');
    } finally { setSaving(false); }
  };

  const grouped = useMemo(() => {
    const map = {};
    items.forEach(i => {
      const cat = i.categoryName || i.category || 'Lainnya';
      if (!map[cat]) map[cat] = [];
      map[cat].push(i);
    });
    return Object.entries(map).sort((a, b) => a[0].localeCompare(b[0]));
  }, [items]);

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '0 16px 24px' }}>
      {/* Header */}
      <div style={{ display: 'flex', gap: 8, padding: '16px 0 12px', alignItems: 'center' }}>
        <div style={{ flex: 1 }}>
          <SearchBar value={search} onChange={setSearch} placeholder="Cari item..." compact />
        </div>
        <Btn variant="primary" onClick={openNew} size="sm">+ Item</Btn>
      </div>

      {/* Item List */}
      {loading && <div style={{ textAlign: 'center', padding: 40, color: C.n500 }}>Memuat...</div>}

      {!loading && items.length === 0 && (
        <EmptyState title="Belum ada item" subtitle="Tambah item pertama dengan tombol + Item." icon="🏷️" action={openNew} actionLabel="+ Tambah Item" />
      )}

      {!loading && grouped.map(([category, rows]) => (
        <div key={category} style={{ marginBottom: 16 }}>
          <div style={{ fontFamily: 'Poppins', fontSize: 11, fontWeight: 700, color: C.primary, marginBottom: 8, textTransform: 'uppercase' }}>
            {category} ({rows.length})
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {rows.map(item => (
              <div key={item.id} style={{ background: C.white, borderRadius: 12, padding: '12px 14px', boxShadow: SHADOW.sm }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ fontFamily: 'Poppins', fontSize: 14, fontWeight: 700, color: C.n900 }}>{item.name}</div>
                    <div style={{ fontFamily: 'Poppins', fontSize: 11, color: C.n500, marginTop: 2 }}>{item.unit || '—'} · {item.itemCode || '—'}</div>
                  </div>
                  <Btn variant="ghost" size="sm" onClick={() => openEdit(item)}>Edit</Btn>
                </div>
                {/* Outlet Stocks */}
                {item.outletStocks?.length > 0 && (
                  <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                    {item.outletStocks.map(s => {
                      const status = s.stockQty <= 0 ? 'empty' : s.stockQty <= (s.minStock || 0) ? 'low' : 'safe';
                      const meta = STOCK_META[status];
                      return (
                        <div key={s.outletId} style={{ flex: '1 1 auto', minWidth: 80, background: meta.bg, borderRadius: 8, padding: '8px 10px', textAlign: 'center' }}>
                          <div style={{ fontFamily: 'Poppins', fontSize: 9, color: C.n500, marginBottom: 2 }}>{s.outletName || `Outlet ${s.outletId}`}</div>
                          <div style={{ fontFamily: 'Poppins', fontSize: 16, fontWeight: 800, color: meta.color }}>{Number(s.stockQty).toLocaleString('id-ID')}</div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* Add/Edit Modal */}
      <Modal open={showForm} onClose={() => setShowForm(false)} title={editingItem ? 'Edit Item' : 'Item Baru'}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }} className="inventory-form-inputs inventory-form-grid">
          <div>
            <div style={{ fontFamily: 'Poppins', fontSize: 11, fontWeight: 600, color: C.n700, marginBottom: 4 }}>Nama Item *</div>
            <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="cth: Deterjen 5L" style={{ width: '100%', height: 44, borderRadius: 10, border: `1.5px solid ${C.n200}`, padding: '0 12px', fontFamily: 'Poppins', fontSize: 13 }} />
          </div>
          <div>
            <div style={{ fontFamily: 'Poppins', fontSize: 11, fontWeight: 600, color: C.n700, marginBottom: 4 }}>Satuan</div>
            <input value={form.unit} onChange={e => setForm(f => ({ ...f, unit: e.target.value }))} placeholder="cth: liter, kg, pcs" style={{ width: '100%', height: 44, borderRadius: 10, border: `1.5px solid ${C.n200}`, padding: '0 12px', fontFamily: 'Poppins', fontSize: 13 }} />
          </div>
          <div>
            <div style={{ fontFamily: 'Poppins', fontSize: 11, fontWeight: 600, color: C.n700, marginBottom: 4 }}>Min Stok Default</div>
            <input type="number" value={form.minStock} onChange={e => setForm(f => ({ ...f, minStock: e.target.value }))} placeholder="0" style={{ width: '100%', height: 44, borderRadius: 10, border: `1.5px solid ${C.n200}`, padding: '0 12px', fontFamily: 'Poppins', fontSize: 13 }} />
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
            <Btn variant="secondary" onClick={() => setShowForm(false)} style={{ flex: 1 }}>Batal</Btn>
            <Btn variant="primary" onClick={handleSave} loading={saving} style={{ flex: 1 }}>{editingItem ? 'Simpan' : 'Tambah'}</Btn>
          </div>
        </div>
      </Modal>
    </div>
  );
}

// ─── Tab 3: Purchase Requests ─────────────────────────────────────────
function RequestsTab() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (statusFilter !== 'all') params.status = statusFilter;
      const r = await axios.get('/api/purchase-requests', { params });
      setRequests(r?.data?.data || []);
    } catch (err) { console.error('[RequestsTab] fetchData error:', err); } finally { setLoading(false); }
  }, [statusFilter]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const STATUS_META = {
    pending:   { label: 'Menunggu', bg: C.warningBg, color: C.warningDark },
    approved:  { label: 'Disetujui', bg: C.infoBg, color: C.infoDark },
    fulfilled: { label: 'Selesai', bg: C.successBg, color: C.successDark },
    rejected:  { label: 'Ditolak', bg: C.dangerBg, color: C.danger },
    cancelled: { label: 'Dibatalkan', bg: C.n100, color: C.n600 },
  };

  const formatDate = (v) => {
    if (!v) return '-';
    try { return new Date(v).toLocaleString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit' }); }
    catch (err) { console.error('[RequestsTab] formatDate error:', err); return '-'; }
  };

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '0 16px 24px' }}>
      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, padding: '16px 0 12px' }}>
        {['pending', 'approved', 'fulfilled', 'rejected'].map(s => {
          const count = requests.filter(r => r.status === s).length;
          const meta = STATUS_META[s];
          return (
            <div key={s} style={{ background: C.white, borderRadius: 10, padding: '10px 12px', textAlign: 'center', boxShadow: SHADOW.sm }}>
              <div style={{ fontFamily: 'Poppins', fontSize: 18, fontWeight: 800, color: meta.color }}>{count}</div>
              <div style={{ fontFamily: 'Poppins', fontSize: 9, color: C.n500, marginTop: 2 }}>{meta.label}</div>
            </div>
          );
        })}
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 12, overflowX: 'auto', paddingBottom: 4 }}>
        {['all', 'pending', 'approved', 'fulfilled', 'rejected'].map(s => (
          <Chip key={s} label={s === 'all' ? 'Semua' : STATUS_META[s]?.label || s} active={statusFilter === s} onClick={() => setStatusFilter(s)} />
        ))}
      </div>

      {/* List */}
      {loading && <div style={{ textAlign: 'center', padding: 40, color: C.n500 }}>Memuat...</div>}

      {!loading && requests.length === 0 && (
        <EmptyState title="Tidak ada pengajuan" subtitle="Belum ada pengajuan barang." icon="📋" />
      )}

      {!loading && requests.map(req => {
        const meta = STATUS_META[req.status] || STATUS_META.pending;
        return (
          <div key={req.id} style={{ background: C.white, borderRadius: 12, padding: '12px 14px', marginBottom: 8, boxShadow: SHADOW.sm }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontFamily: 'Poppins', fontSize: 14, fontWeight: 700, color: C.n900 }}>{req.itemName || req.name}</div>
                <div style={{ fontFamily: 'Poppins', fontSize: 11, color: C.n500, marginTop: 2 }}>
                  {req.qty} {req.unit} · {formatDate(req.createdAt)}
                </div>
              </div>
              <span style={{ padding: '2px 8px', borderRadius: 999, background: meta.bg, color: meta.color, fontFamily: 'Poppins', fontSize: 10, fontWeight: 700 }}>
                {meta.label}
              </span>
            </div>
            {req.notes && (
              <div style={{ marginTop: 8, fontFamily: 'Poppins', fontSize: 11, color: C.n600 }}>{req.notes}</div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────
export default function InventoryMasterPage({ goBack }) {
  const isMobile = useIsMobile();
  const [activeTab, setActiveTab] = useState('matrix');
  useAppRefresh(() => {}, []);

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: C.n50, overflow: 'hidden' }}>
      <style>{`
        @media (max-width: 480px) {
          .inventory-stats-grid { grid-template-columns: repeat(2, 1fr) !important; }
          .inventory-matrix-table { font-size: 11px !important; }
          .inventory-form-inputs { gap: 8px !important; }
          .inventory-tabs { flex-wrap: nowrap !important; overflow-x: auto !important; }
          .inventory-form-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
      {/* Header */}
      <div style={{ background: C.white, borderBottom: `1px solid ${C.n100}`, padding: '12px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <button onClick={goBack} style={{ background: 'none', border: 'none', padding: 4, cursor: 'pointer' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={C.n700} strokeWidth="2" strokeLinecap="round"><polyline points="15 18 9 12 15 6" /></svg>
          </button>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontFamily: 'Poppins', fontSize: 16, fontWeight: 700, color: C.n900 }}>📦 Inventory</div>
            <div style={{ fontFamily: 'Poppins', fontSize: 11, color: C.n500 }}>Kelola stok & pengajuan</div>
          </div>
          <div style={{ width: 32 }} />
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 6, marginTop: 12, background: C.n100, borderRadius: 10, padding: 3, flexWrap: 'nowrap', overflowX: 'auto' }} className="inventory-tabs">
          {TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              style={{
                flex: 1, padding: '8px 12px', borderRadius: 8,
                border: 'none', cursor: 'pointer',
                background: activeTab === tab.key ? C.white : 'transparent',
                boxShadow: activeTab === tab.key ? SHADOW.sm : 'none',
                transition: 'all 0.15s',
              }}
            >
              <span style={{ fontFamily: 'Poppins', fontSize: 11, fontWeight: activeTab === tab.key ? 700 : 500, color: activeTab === tab.key ? C.primary : C.n600 }}>
                {tab.label}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.15 }}
          style={{ flex: 1, overflowY: 'auto' }}
        >
          {activeTab === 'matrix' && <StockMatrix />}
          {activeTab === 'items' && <SkuStokTab />}
          {activeTab === 'requests' && <RequestsTab />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
