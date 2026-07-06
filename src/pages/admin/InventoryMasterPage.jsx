// ─────────────────────────────────────────────────────────────────────────────
// Admin: Inventory Master — All-in-One Stock Management
// Tabs: Matrix · SKU & Stok · Bahan · Promo
// ─────────────────────────────────────────────────────────────────────────────
import { useState, useEffect, useCallback, useMemo } from 'react';
import axios from 'axios';
import { C, SHADOW } from '../../utils/theme';
import { rp } from '../../utils/helpers';
import { TopBar, Btn, SearchBar, Chip, useAppRefresh, EmptyState } from '../../components/ui';
import { alertError, alertSuccess } from '../../utils/alert';

// ─── Status badges ───────────────────────────────────────────────────────
const STOCK_META = {
  safe:  { color: C.success, bg: C.successBg, label: 'Aman' },
  low:   { color: C.warning, bg: C.warningBg, label: 'Tipis' },
  empty: { color: C.danger, bg: C.dangerBg, label: 'Habis' },
};

// ─── Tab: Stok Matrix (cross-outlet overview) ───────────────────────────
function StockMatrix({ goBack }) {
  const [items, setItems]   = useState([]);
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
    } catch {} finally { setLoading(false); }
  }, [onlyLow, search]);

  useEffect(() => { fetchData(); }, [fetchData]);
  useAppRefresh(() => fetchData(), [fetchData]);

  const outlets = useMemo(() => {
    if (!items.length) return [];
    return items[0].outlets.map(o => ({ id: o.outletId, name: o.outletName }));
  }, [items]);

  const totalLow = items.filter(i => i.lowStockOutletCount > 0).length;

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '10px 16px 24px' }}>
      {/* Filters */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, alignItems: 'center' }}>
        <div style={{ flex: 1 }}>
          <SearchBar value={search} onChange={setSearch} placeholder="Cari item..." compact />
        </div>
        <button
          onClick={() => setOnlyLow(v => !v)}
          style={{
            padding: '8px 12px', borderRadius: 10,
            border: `1.5px solid ${onlyLow ? C.warning : C.n200}`,
            background: onlyLow ? C.warningBg : C.white,
            fontFamily: 'Poppins', fontSize: 11, fontWeight: 600,
            color: onlyLow ? C.warningDark : C.n700,
            cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0,
          }}
        >
          ⚠️ {onlyLow ? 'Semua' : 'Tipis/Habis'}
        </button>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 14 }}>
        {[
          { label: 'Total Item', value: items.length, icon: '📦', color: C.primary },
          { label: 'Butuh Perhatian', value: totalLow, icon: '⚠️', color: C.warning },
          { label: 'Aman', value: items.length - totalLow, icon: '✅', color: C.success },
        ].map(s => (
          <div key={s.label} style={{
            background: 'white', borderRadius: 12, padding: '12px 10px',
            textAlign: 'center', boxShadow: SHADOW.sm,
          }}>
            <div style={{ fontSize: 20 }}>{s.icon}</div>
            <div style={{ fontFamily: 'Poppins', fontSize: 18, fontWeight: 800, color: s.color, marginTop: 2 }}>{s.value}</div>
            <div style={{ fontFamily: 'Poppins', fontSize: 9, color: C.n500, marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {loading && (
        <div style={{ textAlign: 'center', padding: 30, fontFamily: 'Poppins', fontSize: 13, color: C.n500 }}>Memuat...</div>
      )}

      {!loading && items.length === 0 && (
        <EmptyState
          title="Stok kosong"
          subtitle="Tidak ada item inventori ditemukan."
          icon={<span style={{ fontSize: 40 }}>📦</span>}
        />
      )}

      {/* Matrix table */}
      {!loading && items.length > 0 && (
        <div style={{ background: 'white', borderRadius: 14, overflow: 'hidden', boxShadow: SHADOW.sm }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 500 }}>
              <thead>
                <tr style={{ background: C.n50 }}>
                  <th style={th}>Item</th>
                  {outlets.map(o => (
                    <th key={o.id} style={{ ...th, textAlign: 'center', minWidth: 100 }}>
                      {o.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {items.map(it => (
                  <tr key={it.inventoryId} style={{ borderTop: `1px solid ${C.n100}` }}>
                    <td style={{ ...td }}>
                      <div style={{ fontFamily: 'Poppins', fontSize: 10, color: C.n500 }}>{it.categoryName}</div>
                      <div style={{ fontFamily: 'Poppins', fontSize: 13, fontWeight: 700, color: C.n900 }}>{it.itemName}</div>
                      <div style={{ fontFamily: 'Poppins', fontSize: 9, color: C.n500 }}>{it.itemCode} · {it.unit}</div>
                    </td>
                    {it.outlets.map(o => {
                      const meta = STOCK_META[o.status] || STOCK_META.safe;
                      return (
                        <td key={o.outletId} style={{ ...td, textAlign: 'center' }}>
                          <div style={{
                            display: 'inline-flex', flexDirection: 'column', alignItems: 'center',
                            padding: '6px 8px', borderRadius: 10, background: meta.bg, minWidth: 70,
                          }}>
                            <span style={{ fontFamily: 'Poppins', fontSize: 16, fontWeight: 800, color: meta.color }}>
                              {Number(o.stockQty).toLocaleString('id-ID')}
                            </span>
                            <span style={{ fontFamily: 'Poppins', fontSize: 8, fontWeight: 700, color: meta.color, textTransform: 'uppercase' }}>
                              {meta.label}
                            </span>
                            <span style={{ fontFamily: 'Poppins', fontSize: 8, color: C.n500 }}>
                              min {Number(o.minStock).toLocaleString('id-ID')}
                            </span>
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
        <div style={{ marginTop: 12, padding: '10px 14px', background: 'white', borderRadius: 10, display: 'flex', gap: 14, flexWrap: 'wrap', boxShadow: SHADOW.sm }}>
          {Object.entries(STOCK_META).map(([k, m]) => (
            <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{ width: 10, height: 10, borderRadius: 3, background: m.color }} />
              <span style={{ fontFamily: 'Poppins', fontSize: 10, color: C.n600 }}>{m.label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Tab: SKU & Stok (CRUD items + inline min-stock edit) ─────────────
function SkuStokTab({ goBack }) {
  const [items, setItems]       = useState([]);
  const [categories, setCategories] = useState([]);
  const [outlets, setOutlets]   = useState([]);
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState('');
  const [selectedOutlet, setSelectedOutlet] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [form, setForm] = useState({ name: '', categoryId: '', unit: '', minStock: '' });
  const [saving, setSaving]     = useState(false);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (search.trim()) params.search = search.trim();
      if (selectedOutlet) params.outletId = selectedOutlet;
      const r = await axios.get('/api/inventory/items', { params });
      setItems(r?.data?.data || []);
    } catch {} finally { setLoading(false); }
  }, [search, selectedOutlet]);

  const fetchMeta = useCallback(async () => {
    try {
      const [catR, outR] = await Promise.all([
        axios.get('/api/master/outlets'),
        axios.get('/api/inventory/categories'),
      ]);
      setOutlets(catR?.data?.data || []);
      setCategories(outR?.data?.data || []);
    } catch {}
  }, []);

  useEffect(() => { fetchItems(); fetchMeta(); }, [fetchItems, fetchMeta]);
  useAppRefresh(() => fetchItems(), [fetchItems]);

  const openNew = () => {
    setForm({ name: '', categoryId: '', unit: '', minStock: '' });
    setEditingItem(null);
    setShowForm(true);
  };

  const openEdit = (item) => {
    setForm({ name: item.name, categoryId: item.categoryId || item.category_id || '', unit: item.unit || '', minStock: String(item.minStock || item.min_stock || '') });
    setEditingItem(item);
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) { alertError('Nama item wajib diisi.'); return; }
    setSaving(true);
    try {
      if (editingItem) {
        await axios.patch(`/api/inventory/items/${editingItem.id}`, {
          name: form.name,
          unit: form.unit,
          minStock: Number(form.minStock) || 0,
        });
        alertSuccess('Item diperbarui.');
      } else {
        await axios.post('/api/inventory/items', {
          name: form.name,
          categoryId: form.categoryId || null,
          unit: form.unit,
          minStock: Number(form.minStock) || 0,
        });
        alertSuccess('Item baru ditambahkan.');
      }
      setShowForm(false);
      fetchItems();
    } catch (err) {
      alertError(err?.response?.data?.message || 'Gagal menyimpan.');
    } finally {
      setSaving(false);
    }
  };

  const [minStockEdits, setMinStockEdits] = useState({}); // { itemId: { outletId: newVal } }

  const handleMinStockChange = (itemId, outletId, val) => {
    setMinStockEdits(prev => ({
      ...prev,
      [itemId]: { ...(prev[itemId] || {}), [outletId]: val },
    }));
  };

  const saveMinStock = async (itemId) => {
    const edits = minStockEdits[itemId];
    if (!edits) return;
    setSaving(true);
    try {
      await Promise.all(
        Object.entries(edits).map(([outletId, val]) =>
          axios.patch('/api/inventory/outlet-min', {
            inventoryItemId: itemId,
            outletId: Number(outletId),
            minStock: Number(val) || 0,
          })
        )
      );
      alertSuccess('Min stok disimpan.');
      setMinStockEdits(prev => ({ ...prev, [itemId]: undefined }));
      fetchItems();
    } catch (err) {
      alertError(err?.response?.data?.message || 'Gagal menyimpan min stok.');
    } finally {
      setSaving(false);
    }
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
    <div style={{ flex: 1, overflowY: 'auto', padding: '10px 16px 24px' }}>
      {/* Search + Add */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, alignItems: 'center' }}>
        <div style={{ flex: 1 }}>
          <SearchBar value={search} onChange={setSearch} placeholder="Cari item..." compact />
        </div>
        <Btn variant="primary" onClick={openNew} size="sm">+ Item</Btn>
      </div>

      {loading && <div style={{ textAlign: 'center', padding: 30, fontFamily: 'Poppins', fontSize: 13, color: C.n500 }}>Memuat...</div>}

      {!loading && items.length === 0 && (
        <EmptyState
          title="Belum ada item"
          subtitle="Tambah item pertama di tombol + Item di atas."
          icon={<span style={{ fontSize: 40 }}>📦</span>}
          action={openNew} actionLabel="+ Tambah Item"
        />
      )}

      {/* Item list grouped by category */}
      {!loading && grouped.map(([category, rows]) => (
        <div key={category} style={{ marginBottom: 16 }}>
          <div style={{
            fontFamily: 'Poppins', fontSize: 11, fontWeight: 700, color: C.primary,
            textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8,
            display: 'flex', alignItems: 'center', gap: 6,
          }}>
            <span>{rows.length}</span>
            <span>{category}</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {rows.map(item => (
              <div key={item.id} style={{ background: 'white', borderRadius: 14, padding: '12px 14px', boxShadow: SHADOW.sm }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                  <div>
                    <div style={{ fontFamily: 'Poppins', fontSize: 14, fontWeight: 700, color: C.n900 }}>{item.name}</div>
                    <div style={{ fontFamily: 'Poppins', fontSize: 11, color: C.n500, marginTop: 2 }}>{item.unit || '—'} · {item.itemCode || item.code || '—'}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button
                      onClick={() => openEdit(item)}
                      style={{ padding: '4px 10px', borderRadius: 8, border: `1px solid ${C.n200}`, background: C.n50, cursor: 'pointer', fontFamily: 'Poppins', fontSize: 11, color: C.n600 }}
                    >
                      Edit
                    </button>
                  </div>
                </div>
                {/* Per-outlet stock */}
                {item.outletStocks?.length > 0 && (
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {item.outletStocks.map(s => {
                      const meta = s.stockQty <= 0 ? STOCK_META.empty : s.stockQty <= (minStockEdits[item.id]?.[s.outletId] || s.minStock || 0) ? STOCK_META.low : STOCK_META.safe;
                      return (
                        <div key={s.outletId} style={{
                          flex: '1 1 auto', minWidth: 100,
                          background: meta.bg, borderRadius: 10, padding: '8px 10px',
                        }}>
                          <div style={{ fontFamily: 'Poppins', fontSize: 10, fontWeight: 600, color: C.n500, marginBottom: 4 }}>
                            {s.outletName || `Outlet ${s.outletId}`}
                          </div>
                          <div style={{ fontFamily: 'Poppins', fontSize: 16, fontWeight: 800, color: meta.color }}>
                            {Number(s.stockQty).toLocaleString('id-ID')}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 4 }}>
                            <span style={{ fontFamily: 'Poppins', fontSize: 9, color: C.n500 }}>min</span>
                            <input
                              type="number"
                              value={minStockEdits[item.id]?.[s.outletId] ?? s.minStock ?? ''}
                              onChange={e => handleMinStockChange(item.id, s.outletId, e.target.value)}
                              style={{
                                width: 40, height: 22, borderRadius: 6, border: `1px solid ${C.n200}`,
                                padding: '0 4px', fontFamily: 'Poppins', fontSize: 9, color: C.n700,
                                background: 'white', outline: 'none', textAlign: 'center',
                              }}
                            />
                          </div>
                          {minStockEdits[item.id]?.[s.outletId] != null && (
                            <button
                              onClick={() => saveMinStock(item.id)}
                              style={{
                                marginTop: 4, width: '100%', padding: '3px',
                                borderRadius: 6, border: 'none', background: C.primary, color: 'white',
                                fontFamily: 'Poppins', fontSize: 9, fontWeight: 700, cursor: 'pointer',
                              }}
                            >
                              Simpan
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
                {(!item.outletStocks || item.outletStocks.length === 0) && (
                  <div style={{ fontFamily: 'Poppins', fontSize: 11, color: C.n400 }}>Tidak ada data stok per outlet.</div>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* Add/Edit form modal */}
      {showForm && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 9999,
          background: 'rgba(15,23,42,0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
        }}
          onClick={() => setShowForm(false)}
        >
          <div onClick={e => e.stopPropagation()} style={{
            background: 'white', borderRadius: 20, padding: '24px 20px', width: '100%', maxWidth: 380,
            boxShadow: SHADOW.xl,
          }}>
            <div style={{ fontFamily: 'Poppins', fontSize: 16, fontWeight: 800, color: C.n900, marginBottom: 20 }}>
              {editingItem ? 'Edit Item' : 'Item Baru'}
            </div>
            {[
              { key: 'name', label: 'Nama Item', placeholder: 'cth: Deterjen 5L' },
              { key: 'unit', label: 'Satuan', placeholder: 'cth: unit, liter, kg' },
              { key: 'minStock', label: 'Min Stok Default', placeholder: '0' },
            ].map(field => (
              <div key={field.key} style={{ marginBottom: 14 }}>
                <div style={{ fontFamily: 'Poppins', fontSize: 11, fontWeight: 600, color: C.n700, marginBottom: 5 }}>
                  {field.label} {field.key === 'name' && '*'}
                </div>
                <input
                  type={field.key === 'minStock' ? 'number' : 'text'}
                  value={form[field.key]}
                  onChange={(e) => setForm((f) => ({ ...f, [field.key]: e.target.value }))}
                  placeholder={field.placeholder}
                  style={{
                    width: '100%', height: 44, borderRadius: 10,
                    border: `1.5px solid ${C.n200}`, padding: '0 12px',
                    fontFamily: 'Poppins', fontSize: 13, color: C.n900, background: 'white', outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
              </div>
            ))}
            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              <Btn variant="secondary" onClick={() => setShowForm(false)} style={{ flex: 1 }}>Batal</Btn>
              <Btn variant="primary" onClick={handleSave} loading={saving} style={{ flex: 1 }}>
                {editingItem ? 'Simpan' : 'Tambah'}
              </Btn>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Tab: Bahan & Layanan (service-material mapping) ───────────────────
function BahanLayananTab() {
  const [services, setServices]   = useState([]);
  const [mappings, setMappings]   = useState([]);
  const [selectedService, setSelectedService] = useState(null);
  const [loading, setLoading]   = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [svcR] = await Promise.all([axios.get('/api/services')]);
      setServices(svcR?.data?.data || []);
    } catch {} finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);
  useAppRefresh(() => fetchData(), [fetchData]);

  const fetchMappings = useCallback(async (serviceId) => {
    if (!serviceId) { setMappings([]); return; }
    try {
      const r = await axios.get(`/api/inventory/service-usage?serviceId=${serviceId}`);
      setMappings(r?.data?.data || []);
    } catch { setMappings([]); }
  }, []);

  const handleServiceSelect = (svcId) => {
    setSelectedService(svcId);
    fetchMappings(svcId);
  };

  const [addingItem, setAddingItem]   = useState(false);
  const [addForm, setAddForm]       = useState({ inventoryItemId: '', qty: '' });
  const [inventoryItems, setInventoryItems] = useState([]);

  const openAdd = async () => {
    setAddingItem(true);
    setAddForm({ inventoryItemId: '', qty: '' });
    try {
      const r = await axios.get('/api/inventory/items');
      setInventoryItems(r?.data?.data || []);
    } catch { setInventoryItems([]); }
  };

  const handleAddMapping = async () => {
    if (!addForm.inventoryItemId || !addForm.qty) { alertError('Lengkapi form.'); return; }
    try {
      await axios.post('/api/inventory/service-usage', {
        serviceId: selectedService,
        inventoryItemId: addForm.inventoryItemId,
        qty: Number(addForm.qty),
      });
      alertSuccess('Bahan ditambahkan.');
      setAddingItem(false);
      fetchMappings(selectedService);
    } catch (err) {
      alertError(err?.response?.data?.message || 'Gagal menambah bahan.');
    }
  };

  const handleRemoveMapping = async (mappingId) => {
    try {
      await axios.delete(`/api/inventory/service-usage/${mappingId}`);
      alertSuccess('Bahan dihapus.');
      fetchMappings(selectedService);
    } catch (err) {
      alertError(err?.response?.data?.message || 'Gagal menghapus.');
    }
  };

  const selectedSvc = services.find(s => s.id === selectedService);

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '10px 16px 24px' }}>
      {/* Service selector */}
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontFamily: 'Poppins', fontSize: 11, fontWeight: 600, color: C.n700, marginBottom: 6 }}>Pilih Layanan</div>
        <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 4, scrollbarWidth: 'none' }}>
          {services.map(s => (
            <button
              key={s.id}
              onClick={() => handleServiceSelect(s.id)}
              style={{
                padding: '8px 14px', borderRadius: 10, flexShrink: 0,
                border: `1.5px solid ${selectedService === s.id ? C.primary : C.n200}`,
                background: selectedService === s.id ? `${C.primary}14` : 'white',
                fontFamily: 'Poppins', fontSize: 12, fontWeight: selectedService === s.id ? 700 : 400,
                color: selectedService === s.id ? C.primary : C.n700,
                cursor: 'pointer',
              }}
            >
              {s.name}
            </button>
          ))}
        </div>
      </div>

      {loading && <div style={{ textAlign: 'center', padding: 30, fontFamily: 'Poppins', fontSize: 13, color: C.n500 }}>Memuat...</div>}

      {!loading && !selectedService && (
        <EmptyState
          title="Pilih layanan dulu"
          subtitle="Pilih layanan di atas untuk mengatur bahan yang dipakai."
          icon={<span style={{ fontSize: 40 }}>🧪</span>}
        />
      )}

      {!loading && selectedService && (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div>
              <div style={{ fontFamily: 'Poppins', fontSize: 14, fontWeight: 700, color: C.n900 }}>{selectedSvc?.name}</div>
              <div style={{ fontFamily: 'Poppins', fontSize: 11, color: C.n500 }}>{mappings.length} bahan terpakai</div>
            </div>
            <Btn variant="secondary" size="sm" onClick={openAdd}>+ Bahan</Btn>
          </div>

          {mappings.length === 0 && (
            <EmptyState
              title="Belum ada bahan"
              subtitle="Tambahkan bahan/material yang dipakai layanan ini."
              action={openAdd} actionLabel="+ Tambah Bahan"
              icon={<span style={{ fontSize: 40 }}>🧪</span>}
            />
          )}

          {mappings.map(m => (
            <div key={m.id} style={{
              background: 'white', borderRadius: 14, padding: '12px 14px', marginBottom: 8, boxShadow: SHADOW.sm,
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <div>
                <div style={{ fontFamily: 'Poppins', fontSize: 13, fontWeight: 700, color: C.n900 }}>{m.itemName}</div>
                <div style={{ fontFamily: 'Poppins', fontSize: 11, color: C.n500, marginTop: 2 }}>
                  Pakai: {m.qty} {m.unit || 'unit'} per satuan layanan
                </div>
              </div>
              <button
                onClick={() => handleRemoveMapping(m.id)}
                style={{
                  padding: '6px 12px', borderRadius: 8, border: 'none',
                  background: C.dangerBg, color: C.danger,
                  fontFamily: 'Poppins', fontSize: 11, fontWeight: 600, cursor: 'pointer',
                }}
              >
                Hapus
              </button>
            </div>
          ))}
        </>
      )}

      {/* Add mapping modal */}
      {addingItem && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(15,23,42,0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
        }}
          onClick={() => setAddingItem(false)}
        >
          <div onClick={e => e.stopPropagation()} style={{
            background: 'white', borderRadius: 20, padding: '24px 20px', width: '100%', maxWidth: 380, boxShadow: SHADOW.xl,
          }}>
            <div style={{ fontFamily: 'Poppins', fontSize: 16, fontWeight: 800, color: C.n900, marginBottom: 16 }}>Tambah Bahan ke {selectedSvc?.name}</div>
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontFamily: 'Poppins', fontSize: 11, fontWeight: 600, color: C.n700, marginBottom: 5 }}>Pilih Bahan</div>
              <select
                value={addForm.inventoryItemId}
                onChange={e => setAddForm(f => ({ ...f, inventoryItemId: e.target.value }))}
                style={{
                  width: '100%', height: 44, borderRadius: 10, padding: '0 12px',
                  border: `1.5px solid ${C.n200}`, fontFamily: 'Poppins', fontSize: 13, color: C.n900, background: 'white', outline: 'none',
                }}
              >
                <option value="">— Pilih bahan —</option>
                {inventoryItems.map(i => (
                  <option key={i.id} value={i.id}>{i.name} ({i.unit || 'unit'})</option>
                ))}
              </select>
            </div>
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontFamily: 'Poppins', fontSize: 11, fontWeight: 600, color: C.n700, marginBottom: 5 }}>Jumlah per satuan layanan</div>
              <input
                type="number"
                value={addForm.qty}
                onChange={(e) => setAddForm((f) => ({ ...f, qty: e.target.value }))}
                placeholder="cth: 0.5"
                style={{
                  width: '100%', height: 44, borderRadius: 10, padding: '0 12px',
                  border: `1.5px solid ${C.n200}`, fontFamily: 'Poppins', fontSize: 13, color: C.n900, outline: 'none', boxSizing: 'border-box',
                }}
              />
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <Btn variant="secondary" onClick={() => setAddingItem(false)} style={{ flex: 1 }}>Batal</Btn>
              <Btn variant="primary" onClick={handleAddMapping} style={{ flex: 1 }}>Tambah</Btn>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Tab: Promo ───────────────────────────────────────────────────────────────
function PromoTab() {
  const [promos, setPromos]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ code: '', name: '', type: 'percentage', value: '', startDate: '', endDate: '' });
  const [saving, setSaving]     = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const r = await axios.get('/api/promos');
      setPromos(r?.data?.data || []);
    } catch {} finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);
  useAppRefresh(() => fetchData(), [fetchData]);

  const handleToggle = async (id, isActive) => {
    try {
      await axios.patch(`/api/promos/${id}`, { isActive: !isActive });
      fetchData();
    } catch (err) {
      alertError(err?.response?.data?.message || 'Gagal update promo.');
    }
  };

  const handleSave = async () => {
    if (!form.code.trim() || !form.name.trim()) { alertError('Code & Nama wajib diisi.'); return; }
    setSaving(true);
    try {
      await axios.post('/api/promos', {
        code: form.code.toUpperCase(),
        name: form.name,
        type: form.type,
        value: Number(form.value) || 0,
        startDate: form.startDate || null,
        endDate: form.endDate || null,
      });
      alertSuccess('Promo dibuat.');
      setShowForm(false);
      fetchData();
    } catch (err) {
      alertError(err?.response?.data?.message || 'Gagal membuat promo.');
    } finally { setSaving(false); }
  };

  const activePromos  = promos.filter(p => p.isActive);
  const inactivePromos = promos.filter(p => !p.isActive);

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '10px 16px 24px' }}>
      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 14 }}>
        {[
          { label: 'Promo Aktif', value: activePromos.length, color: C.success },
          { label: 'Nonaktif', value: inactivePromos.length, color: C.n400 },
        ].map(s => (
          <div key={s.label} style={{
            background: 'white', borderRadius: 12, padding: '12px 14px', textAlign: 'center', boxShadow: SHADOW.sm,
          }}>
            <div style={{ fontFamily: 'Poppins', fontSize: 22, fontWeight: 800, color: s.color }}>{s.value}</div>
            <div style={{ fontFamily: 'Poppins', fontSize: 10, color: C.n500, marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ fontFamily: 'Poppins', fontSize: 13, fontWeight: 700, color: C.n900 }}>Daftar Promo</div>
        <Btn variant="primary" size="sm" onClick={() => setShowForm(true)}>+ Promo</Btn>
      </div>

      {loading && <div style={{ textAlign: 'center', padding: 30, fontFamily: 'Poppins', fontSize: 13, color: C.n500 }}>Memuat...</div>}

      {promos.map(p => (
        <div key={p.id} style={{
          background: 'white', borderRadius: 14, padding: '12px 14px', marginBottom: 8, boxShadow: SHADOW.sm,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{
                  fontFamily: 'Poppins', fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 6,
                  background: p.isActive ? C.successBg : C.n100, color: p.isActive ? C.success : C.n500,
                }}>
                  {p.isActive ? 'AKTIF' : 'NONAKTIF'}
                </span>
                <span style={{ fontFamily: 'Poppins', fontSize: 13, fontWeight: 700, color: C.n900 }}>{p.code}</span>
              </div>
              <div style={{ fontFamily: 'Poppins', fontSize: 12, color: C.n700, marginTop: 4 }}>{p.name}</div>
              <div style={{ fontFamily: 'Poppins', fontSize: 11, color: C.n500, marginTop: 2 }}>
                {p.type === 'percentage' ? `${p.value}%` : rp(p.value)}
                {p.startDate && ` · ${p.startDate} - ${p.endDate || 'tanpa batas'}`}
              </div>
            </div>
            <button
              onClick={() => handleToggle(p.id, p.isActive)}
              style={{
                padding: '4px 10px', borderRadius: 8, cursor: 'pointer',
                border: 'none',
                background: p.isActive ? C.dangerBg : C.successBg,
                color: p.isActive ? C.danger : C.success,
                fontFamily: 'Poppins', fontSize: 11, fontWeight: 600,
              }}
            >
              {p.isActive ? 'Nonaktifkan' : 'Aktifkan'}
            </button>
          </div>
        </div>
      ))}

      {showForm && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(15,23,42,0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
        }}
          onClick={() => setShowForm(false)}
        >
          <div onClick={e => e.stopPropagation()} style={{
            background: 'white', borderRadius: 20, padding: '24px 20px', width: '100%', maxWidth: 380, boxShadow: SHADOW.xl,
          }}>
            <div style={{ fontFamily: 'Poppins', fontSize: 16, fontWeight: 800, color: C.n900, marginBottom: 16 }}>Promo Baru</div>
            {[
              { key: 'code', label: 'Kode Promo *' },
              { key: 'name', label: 'Nama Promo *' },
            ].map(f => (
              <div key={f.key} style={{ marginBottom: 12 }}>
                <div style={{ fontFamily: 'Poppins', fontSize: 11, fontWeight: 600, color: C.n700, marginBottom: 5 }}>{f.label}</div>
                <input
                  value={form[f.key]}
                  onChange={e => setForm(ff => ({ ...ff, [f.key]: e.target.value }))}
                  style={{
                    width: '100%', height: 44, borderRadius: 10, padding: '0 12px',
                    border: `1.5px solid ${C.n200}`, fontFamily: 'Poppins', fontSize: 13, color: C.n900, outline: 'none', boxSizing: 'border-box',
                  }}
                />
              </div>
            ))}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
              <div>
                <div style={{ fontFamily: 'Poppins', fontSize: 11, fontWeight: 600, color: C.n700, marginBottom: 5 }}>Tipe</div>
                <select
                  value={form.type}
                  onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
                  style={{ width: '100%', height: 44, borderRadius: 10, padding: '0 10px', border: `1.5px solid ${C.n200}`, fontFamily: 'Poppins', fontSize: 13, outline: 'none' }}
                >
                  <option value="percentage">Persen (%)</option>
                  <option value="fixed">Nominal (Rp)</option>
                </select>
              </div>
              <div>
                <div style={{ fontFamily: 'Poppins', fontSize: 11, fontWeight: 600, color: C.n700, marginBottom: 5 }}>Nilai</div>
                <input
                  type="number"
                  value={form.value}
                  onChange={(e) => setForm((f) => ({ ...f, value: e.target.value }))}
                  placeholder="cth: 10"
                  style={{ width: '100%', height: 44, borderRadius: 10, padding: '0 12px', border: `1.5px solid ${C.n200}`, fontFamily: 'Poppins', fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
                />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
              <Btn variant="secondary" onClick={() => setShowForm(false)} style={{ flex: 1 }}>Batal</Btn>
              <Btn variant="primary" onClick={handleSave} loading={saving} style={{ flex: 1 }}>Buat Promo</Btn>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main InventoryMasterPage ────────────────────────────────────────────
const TABS = [
  { id: 'matrix',  label: 'Matrix',   icon: '📊' },
  { id: 'sku',     label: 'SKU & Stok', icon: '📦' },
  { id: 'bahan',   label: 'Bahan',   icon: '🧪' },
  { id: 'promo',   label: 'Promo',   icon: '🏷️' },
];

export default function InventoryMasterPage({ goBack }) {
  const [activeTab, setActiveTab] = useState('matrix');

  const content = {
    matrix: <StockMatrix goBack={goBack} />,
    sku: <SkuStokTab goBack={goBack} />,
    bahan: <BahanLayananTab />,
    promo: <PromoTab />,
  }[activeTab];

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: C.n50, overflow: 'hidden' }}>
      <TopBar title="Inventori & Promo" subtitle="Kelola stok, SKU, bahan, promo" onBack={goBack} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Tab bar */}
        <div style={{
          display: 'flex', gap: 4, padding: '8px 16px 0',
          background: C.white, borderBottom: `1px solid ${C.n100}`,
          overflowX: 'auto', scrollbarWidth: 'none', flexShrink: 0,
        }}>
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                padding: '8px 14px', border: 'none', borderBottom: `2.5px solid ${activeTab === tab.id ? C.primary : 'transparent'}`,
                background: 'transparent', cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 5,
                transition: 'all 0.15s ease', flexShrink: 0,
              }}
            >
              <span style={{ fontSize: 14 }}>{tab.icon}</span>
              <span style={{
                fontFamily: 'Poppins', fontSize: 11, fontWeight: activeTab === tab.id ? 700 : 500,
                color: activeTab === tab.id ? C.primary : C.n500,
                borderBottom: 'none',
              }}>
                {tab.label}
              </span>
            </button>
          ))}
        </div>
        {content}
      </div>
    </div>
  );
}

const th = {
  fontFamily: 'Poppins', fontSize: 11, fontWeight: 600,
  color: C.n700, textAlign: 'left', padding: '10px 12px',
  textTransform: 'uppercase', letterSpacing: 0.3, whiteSpace: 'nowrap',
};
const td = {
  fontFamily: 'Poppins', fontSize: 12,
  color: C.n800, padding: '8px 12px',
  verticalAlign: 'middle',
};
