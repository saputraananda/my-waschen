import { useState, useEffect, useCallback, useMemo } from 'react';
import axios from 'axios';
import { C } from '../../utils/theme';
import { TopBar, Btn, Chip, Input, Select } from '../../components/ui';
import { useApp } from '../../context/AppContext';
import { alertError, alertSuccess, alertWarning, confirmAction } from '../../utils/alert';

const F = { fontFamily: 'Poppins' };

const tabs = [
  { id: 'stok', label: '📦 Stok Outlet' },
  { id: 'inventaris', label: '🏷️ Master SKU' },
  { id: 'promo', label: '🎁 Promo' },
];

const titles = {
  stok: { title: 'Stok Outlet', subtitle: 'Pantauan stok bahan & minimum per outlet' },
  inventaris: { title: 'Master Inventaris', subtitle: 'Daftar SKU & pemakaian bahan per layanan' },
  promo: { title: 'Manajemen Promo', subtitle: 'Diskon per outlet atau global' },
};

const Card = ({ children, style = {}, accent }) => (
  <div style={{
    background: C.white, borderRadius: 14, padding: 14,
    boxShadow: '0 2px 8px rgba(15,23,42,0.06)',
    borderLeft: accent ? `4px solid ${accent}` : undefined,
    ...style,
  }}>{children}</div>
);

const SectionHeader = ({ icon, title, subtitle, action }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 4px 10px' }}>
    <div style={{
      width: 32, height: 32, borderRadius: 10, background: `${C.primary}14`,
      display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0,
    }}>{icon}</div>
    <div style={{ flex: 1 }}>
      <div style={{ ...F, fontSize: 14, fontWeight: 700, color: C.n900 }}>{title}</div>
      {subtitle && <div style={{ ...F, fontSize: 10, color: C.n500, marginTop: 1 }}>{subtitle}</div>}
    </div>
    {action}
  </div>
);

const Pill = ({ children, color = C.n100, textColor = C.n700 }) => (
  <span style={{
    ...F, fontSize: 10, fontWeight: 700, padding: '3px 10px', borderRadius: 999,
    background: color, color: textColor, letterSpacing: 0.3, whiteSpace: 'nowrap',
  }}>{children}</span>
);

const StatBox = ({ value, label, color = C.n900, bg }) => (
  <div style={{
    background: bg || C.n50, padding: '12px 14px', borderRadius: 10,
    textAlign: 'center', flex: 1, minWidth: 100,
  }}>
    <div style={{ ...F, fontSize: 20, fontWeight: 800, color, lineHeight: 1.1 }}>{value}</div>
    <div style={{ ...F, fontSize: 10, color: C.n500, fontWeight: 600, marginTop: 2, letterSpacing: 0.2 }}>{label}</div>
  </div>
);

export default function AdminPromoSlaStokPage({ navigate, goBack, initialTab = 'stok' }) {
  const validTabs = ['stok', 'inventaris', 'promo'];
  const [tab, setTab] = useState(validTabs.includes(initialTab) ? initialTab : 'stok');

  useEffect(() => {
    if (validTabs.includes(initialTab)) setTab(initialTab);
  }, [initialTab]);

  const { adminOutletId } = useApp();
  const [outlets, setOutlets] = useState([]);
  const [pickOutlet, setPickOutlet] = useState(adminOutletId && adminOutletId !== '_all' ? adminOutletId : '');
  const [summary, setSummary] = useState([]);
  const [stockRows, setStockRows] = useState([]);
  const [minEdits, setMinEdits] = useState({});
  const [promos, setPromos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [stockSearch, setStockSearch] = useState('');
  const [showLowOnly, setShowLowOnly] = useState(false);

  const [promoForm, setPromoForm] = useState({
    code: '', name: '', type: 'percent', value: '', validFrom: '', validUntil: '', isGlobal: true,
  });
  const [showPromoForm, setShowPromoForm] = useState(false);

  const [categories, setCategories] = useState([]);
  const [items, setItems] = useState([]);
  const [itemForm, setItemForm] = useState({
    categoryId: '', name: '', unit: 'kg', itemCode: '', minStockDefault: '0',
  });
  const [showItemForm, setShowItemForm] = useState(false);
  const [services, setServices] = useState([]);
  const [pickService, setPickService] = useState('');
  const [usageRows, setUsageRows] = useState([]);
  const [usageForm, setUsageForm] = useState({ inventoryId: '', qtyPerUnit: '' });
  const [itemSearch, setItemSearch] = useState('');

  useEffect(() => {
    axios.get('/api/master/outlets').then((r) => setOutlets(r?.data?.data || [])).catch(() => setOutlets([]));
  }, []);

  const loadSummary = useCallback(async () => {
    try {
      const res = await axios.get('/api/inventory/summary-outlets');
      setSummary(res?.data?.data || []);
    } catch { setSummary([]); }
  }, []);

  const loadStockOutlet = useCallback(async () => {
    if (!pickOutlet) { setStockRows([]); return; }
    setLoading(true);
    try {
      const res = await axios.get(`/api/inventory/stock?outletId=${pickOutlet}`);
      setStockRows(res?.data?.data || []);
      setMinEdits({});
    } catch { setStockRows([]); }
    finally { setLoading(false); }
  }, [pickOutlet]);

  const loadPromos = useCallback(async () => {
    try {
      const res = await axios.get('/api/promos?includeInactive=1');
      setPromos(res?.data?.data || []);
    } catch { setPromos([]); }
  }, []);

  const loadCategoriesItems = useCallback(async () => {
    try {
      const [c, i] = await Promise.all([
        axios.get('/api/inventory/categories'),
        axios.get('/api/inventory/items?includeInactive=1'),
      ]);
      setCategories(c?.data?.data || []);
      setItems(i?.data?.data || []);
    } catch { setCategories([]); setItems([]); }
  }, []);

  const loadServicesUsage = useCallback(async () => {
    if (!pickOutlet) { setServices([]); setUsageRows([]); return; }
    try {
      const [svc, usage] = await Promise.all([
        axios.get(`/api/services?outletId=${pickOutlet}`),
        pickService ? axios.get(`/api/inventory/service-usage?serviceId=${pickService}`) : Promise.resolve({ data: { data: [] } }),
      ]);
      setServices(svc?.data?.data || []);
      setUsageRows(usage?.data?.data || []);
    } catch { setServices([]); setUsageRows([]); }
  }, [pickOutlet, pickService]);

  useEffect(() => {
    if (tab === 'stok') loadSummary();
    if (tab === 'stok' && pickOutlet) loadStockOutlet();
    if (tab === 'promo') loadPromos();
    if (tab === 'inventaris') loadCategoriesItems();
  }, [tab, pickOutlet, loadSummary, loadStockOutlet, loadPromos, loadCategoriesItems]);

  useEffect(() => {
    if (tab === 'inventaris') loadServicesUsage();
  }, [tab, pickOutlet, pickService, loadServicesUsage]);

  const togglePromo = async (id, isActive) => {
    try {
      await axios.patch(`/api/promos/${id}`, { isActive: !isActive });
      loadPromos();
      alertSuccess('Status promo berhasil diperbarui.');
    }
    catch (e) { alertError(e?.response?.data?.message || 'Gagal'); }
  };

  const createPromo = async () => {
    try {
      await axios.post('/api/promos', {
        code: promoForm.code, name: promoForm.name, type: promoForm.type,
        value: Number(promoForm.value), validFrom: promoForm.validFrom,
        validUntil: promoForm.validUntil, isGlobal: !!promoForm.isGlobal,
      });
      setPromoForm({ code: '', name: '', type: 'percent', value: '', validFrom: '', validUntil: '', isGlobal: true });
      setShowPromoForm(false); loadPromos();
      alertSuccess('Promo berhasil dibuat.');
    } catch (e) { alertError(e?.response?.data?.message || 'Gagal buat promo'); }
  };

  const saveMinStock = async (inventoryId) => {
    const raw = minEdits[inventoryId];
    if (raw === undefined || raw === '') { alertWarning('Isi angka minimum'); return; }
    const minStock = Number(String(raw).replace(',', '.'));
    if (!Number.isFinite(minStock) || minStock < 0) { alertWarning('Minimum tidak valid'); return; }
    try {
      await axios.patch('/api/inventory/outlet-min', { outletId: pickOutlet, inventoryId, minStock });
      loadStockOutlet();
      alertSuccess('Minimum stok berhasil disimpan.');
    }
    catch (e) { alertError(e?.response?.data?.message || 'Gagal simpan min'); }
  };

  const createItem = async () => {
    if (!itemForm.categoryId || !itemForm.name.trim()) { alertWarning('Kategori dan nama wajib'); return; }
    try {
      await axios.post('/api/inventory/items', {
        categoryId: itemForm.categoryId, name: itemForm.name.trim(),
        unit: itemForm.unit || 'kg', itemCode: itemForm.itemCode?.trim() || undefined,
        minStockDefault: Number(itemForm.minStockDefault) || 0,
      });
      setItemForm({ categoryId: itemForm.categoryId, name: '', unit: 'kg', itemCode: '', minStockDefault: '0' });
      setShowItemForm(false); loadCategoriesItems();
      alertSuccess('SKU berhasil dibuat.');
    } catch (e) { alertError(e?.response?.data?.message || 'Gagal buat SKU'); }
  };

  const saveUsage = async () => {
    if (!pickService || !usageForm.inventoryId || usageForm.qtyPerUnit === '') {
      alertWarning('Pilih layanan, bahan, dan qty per unit'); return;
    }
    try {
      await axios.post('/api/inventory/service-usage', {
        serviceId: pickService, inventoryId: usageForm.inventoryId,
        qtyPerUnit: Number(usageForm.qtyPerUnit), usageType: 'auto_deduct',
      });
      setUsageForm({ inventoryId: '', qtyPerUnit: '' }); loadServicesUsage();
      alertSuccess('Pemakaian bahan berhasil disimpan.');
    } catch (e) { alertError(e?.response?.data?.message || 'Gagal simpan pemakaian'); }
  };

  const removeUsage = async (id) => {
    const ok = await confirmAction({ text: 'Nonaktifkan baris pemakaian ini?' });
    if (!ok) return;
    try { await axios.delete(`/api/inventory/service-usage/${id}`); loadServicesUsage(); alertSuccess('Baris pemakaian dinonaktifkan.'); }
    catch (e) { alertError(e?.response?.data?.message || 'Gagal'); }
  };

  const head = titles[tab] || titles.stok;

  // ─── STOCK TAB COMPUTED ───────────────────────────────────────────────────
  const totalLowStock = summary.reduce((s, o) => s + Number(o.lowStockCount || 0), 0);
  const totalSku = summary.reduce((s, o) => s + Number(o.skuCount || 0), 0);
  const criticalOutlets = summary.filter(s => s.lowStockCount > 0).length;

  const filteredStock = useMemo(() => {
    let rows = stockRows;
    if (stockSearch.trim()) {
      const q = stockSearch.toLowerCase();
      rows = rows.filter(r => (r.name || '').toLowerCase().includes(q));
    }
    if (showLowOnly) rows = rows.filter(r => r.lowStock);
    return rows;
  }, [stockRows, stockSearch, showLowOnly]);

  // ─── INVENTORY TAB COMPUTED ───────────────────────────────────────────────
  const filteredItems = useMemo(() => {
    let arr = items;
    if (itemSearch.trim()) {
      const q = itemSearch.toLowerCase();
      arr = arr.filter(it => (it.name || '').toLowerCase().includes(q) || (it.itemCode || '').toLowerCase().includes(q));
    }
    return arr;
  }, [items, itemSearch]);

  const itemsByCategory = useMemo(() => {
    const grouped = {};
    filteredItems.forEach(it => {
      const key = it.categoryName || 'Tanpa kategori';
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(it);
    });
    return grouped;
  }, [filteredItems]);

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: C.n50, overflow: 'hidden' }}>
      <TopBar title={head.title} subtitle={head.subtitle} onBack={goBack} />

      <div style={{ padding: '10px 16px 4px', display: 'flex', gap: 8, overflowX: 'auto', background: C.white, borderBottom: `1px solid ${C.n100}` }}>
        {tabs.map((t) => (
          <Chip key={t.id} label={t.label} active={tab === t.id} onClick={() => setTab(t.id)} />
        ))}
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px 24px' }}>
        {/* ═══════════════ STOK TAB ═══════════════ */}
        {tab === 'stok' && (
          <>
            {/* Hero stats */}
            <Card style={{
              background: `linear-gradient(135deg, ${C.primary} 0%, ${C.primaryDark} 100%)`,
              borderRadius: 16, padding: '16px 18px', color: C.white, marginBottom: 14,
              boxShadow: '0 4px 16px rgba(91,0,95,0.18)', position: 'relative', overflow: 'hidden',
            }}>
              <div style={{ position: 'absolute', top: -20, right: -20, width: 80, height: 80, borderRadius: 40, background: 'rgba(255,255,255,0.1)' }} />
              <div style={{ ...F, fontSize: 11, fontWeight: 600, opacity: 0.92, marginBottom: 4, letterSpacing: 0.5 }}>📦 RINGKASAN STOK LINTAS OUTLET</div>
              <div style={{ display: 'flex', gap: 16, marginTop: 8, position: 'relative' }}>
                <div>
                  <div style={{ ...F, fontSize: 22, fontWeight: 800 }}>{outlets.length}</div>
                  <div style={{ ...F, fontSize: 10, opacity: 0.9 }}>Outlet aktif</div>
                </div>
                <div>
                  <div style={{ ...F, fontSize: 22, fontWeight: 800 }}>{totalSku}</div>
                  <div style={{ ...F, fontSize: 10, opacity: 0.9 }}>Total SKU</div>
                </div>
                <div>
                  <div style={{ ...F, fontSize: 22, fontWeight: 800, color: totalLowStock > 0 ? '#FBBF24' : '#86EFAC' }}>{totalLowStock}</div>
                  <div style={{ ...F, fontSize: 10, opacity: 0.9 }}>Stok rendah</div>
                </div>
              </div>
            </Card>

            {/* Outlet leaderboard */}
            <SectionHeader
              icon="🏪"
              title="Stok Per Outlet"
              subtitle={criticalOutlets > 0 ? `⚠️ ${criticalOutlets} outlet butuh perhatian` : '✅ Semua outlet aman'}
            />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
              {summary.length === 0 ? (
                <Card style={{ textAlign: 'center', padding: 24 }}>
                  <div style={{ fontSize: 36, marginBottom: 6, opacity: 0.4 }}>📭</div>
                  <div style={{ ...F, fontSize: 13, color: C.n500 }}>Belum ada data stok.</div>
                </Card>
              ) : summary.map((s) => {
                const isLow = s.lowStockCount > 0;
                const pct = s.skuCount > 0 ? ((s.skuCount - s.lowStockCount) / s.skuCount) * 100 : 100;
                return (
                  <Card key={s.outletId} accent={isLow ? '#F59E0B' : C.success} style={{ padding: '12px 14px', cursor: 'pointer' }}
                    onClick={() => setPickOutlet(s.outletId)}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                      <div style={{
                        width: 36, height: 36, borderRadius: 10,
                        background: `${isLow ? '#F59E0B' : C.success}14`, display: 'flex',
                        alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0,
                      }}>{isLow ? '⚠️' : '✅'}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ ...F, fontSize: 13, fontWeight: 700, color: C.n900 }}>{s.outletName}</div>
                        <div style={{ ...F, fontSize: 10, color: C.n500, marginTop: 1 }}>
                          {s.skuCount - s.lowStockCount}/{s.skuCount} SKU di atas minimum
                        </div>
                      </div>
                      {isLow ? (
                        <Pill color="#FEF3C7" textColor="#92400E">⚠️ {s.lowStockCount} rendah</Pill>
                      ) : (
                        <Pill color="#DCFCE7" textColor="#166534">✓ AMAN</Pill>
                      )}
                    </div>
                    {/* Health bar */}
                    <div style={{ height: 6, background: C.n100, borderRadius: 3, overflow: 'hidden' }}>
                      <div style={{
                        height: '100%', width: `${pct}%`,
                        background: pct >= 90 ? C.success : pct >= 70 ? '#F59E0B' : C.danger,
                        transition: 'width 0.4s',
                      }} />
                    </div>
                  </Card>
                );
              })}
            </div>

            {/* Detail outlet */}
            <SectionHeader
              icon="🔍"
              title="Detail Stok Outlet"
              subtitle="Pilih outlet untuk lihat & atur minimum SKU"
            />
            <Card style={{ marginBottom: 12 }}>
              <Select
                label="Outlet"
                value={pickOutlet}
                onChange={(val) => setPickOutlet(val)}
                placeholder="Pilih outlet..."
                options={[
                  { value: '', label: 'Pilih outlet...' },
                  ...outlets.map((o) => ({ value: o.id, label: o.name })),
                ]}
              />
              {pickOutlet && (
                <div style={{ display: 'flex', gap: 8, marginTop: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: 160 }}>
                    <Input label="Cari SKU" value={stockSearch} onChange={setStockSearch} placeholder="Nama bahan..." />
                  </div>
                  <div style={{ paddingTop: 18 }}>
                    <Chip label="🔴 Stok rendah saja" active={showLowOnly} onClick={() => setShowLowOnly(!showLowOnly)} />
                  </div>
                </div>
              )}
            </Card>

            {pickOutlet && (
              loading ? (
                <div style={{ textAlign: 'center', padding: 32, ...F, fontSize: 13, color: C.n500 }}>
                  <div style={{ width: 24, height: 24, border: `3px solid ${C.n200}`, borderTopColor: C.primary, borderRadius: '50%', margin: '0 auto 8px', animation: 'spin 0.8s linear infinite' }} />
                  Memuat stok outlet...
                  <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
                </div>
              ) : filteredStock.length === 0 ? (
                <Card style={{ textAlign: 'center', padding: 24 }}>
                  <div style={{ fontSize: 36, marginBottom: 6, opacity: 0.4 }}>📦</div>
                  <div style={{ ...F, fontSize: 13, color: C.n500 }}>{showLowOnly ? 'Tidak ada SKU di bawah minimum.' : 'Belum ada SKU di outlet ini.'}</div>
                </Card>
              ) : (
                <Card style={{ padding: 0, overflow: 'hidden' }}>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', ...F, fontSize: 12 }}>
                      <thead>
                        <tr style={{ background: C.n50, borderBottom: `1.5px solid ${C.n200}` }}>
                          <th style={thStyle}>SKU</th>
                          <th style={{ ...thStyle, textAlign: 'right' }}>Stok</th>
                          <th style={{ ...thStyle, textAlign: 'right' }}>Min</th>
                          <th style={{ ...thStyle, textAlign: 'right' }}>Aksi</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredStock.map((r) => {
                          const stockNum = Number(r.stockQty);
                          const minNum = Number(r.minStock || 0);
                          const ratio = minNum > 0 ? stockNum / minNum : 999;
                          const stockColor = r.lowStock ? C.danger : ratio < 1.5 ? '#F59E0B' : C.success;
                          return (
                            <tr key={r.id} style={{
                              borderBottom: `1px solid ${C.n100}`,
                              background: r.lowStock ? '#FEF2F2' : 'transparent',
                            }}>
                              <td style={tdStyle}>
                                <div style={{ ...F, fontSize: 12, fontWeight: 700, color: C.n900 }}>{r.name}</div>
                                <div style={{ ...F, fontSize: 9, color: C.n500 }}>{r.itemCode}</div>
                              </td>
                              <td style={{ ...tdStyle, textAlign: 'right' }}>
                                <div style={{ ...F, fontSize: 13, fontWeight: 700, color: stockColor }}>
                                  {stockNum.toLocaleString('id-ID')}
                                </div>
                                <div style={{ ...F, fontSize: 9, color: C.n500 }}>{r.unit}</div>
                              </td>
                              <td style={{ ...tdStyle, textAlign: 'right', padding: 6 }}>
                                <input
                                  type="number" min={0} step="0.01"
                                  value={minEdits[r.id] !== undefined ? minEdits[r.id] : String(r.minStock)}
                                  onChange={(e) => setMinEdits((m) => ({ ...m, [r.id]: e.target.value }))}
                                  style={{
                                    width: 70, height: 32, borderRadius: 8,
                                    border: `1px solid ${C.n300}`, padding: '0 8px',
                                    ...F, fontSize: 12, textAlign: 'right',
                                  }}
                                />
                              </td>
                              <td style={{ ...tdStyle, textAlign: 'right', padding: 6 }}>
                                <Btn size="sm" variant="secondary" onClick={() => saveMinStock(r.id)}>💾</Btn>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </Card>
              )
            )}
          </>
        )}

        {/* ═══════════════ INVENTARIS TAB ═══════════════ */}
        {tab === 'inventaris' && (
          <>
            {/* Stats */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 8, marginBottom: 14 }}>
              <StatBox value={items.filter(i => i.isActive).length} label="SKU AKTIF" color={C.success} bg="#F0FDF4" />
              <StatBox value={items.filter(i => !i.isActive).length} label="NONAKTIF" color={C.n500} />
              <StatBox value={categories.length} label="KATEGORI" color={C.info} bg="#F0F9FF" />
              <StatBox value={items.length} label="TOTAL SKU" color={C.primary} bg={C.primaryLight} />
            </div>

            {/* Quick Add Form (collapsible) */}
            <Card style={{ marginBottom: 14 }}>
              <button onClick={() => setShowItemForm(!showItemForm)} style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                background: 'none', border: 'none', cursor: 'pointer', padding: 0, textAlign: 'left',
              }}>
                <div style={{
                  width: 32, height: 32, borderRadius: 10, background: `${C.primary}14`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18,
                }}>➕</div>
                <div style={{ flex: 1 }}>
                  <div style={{ ...F, fontSize: 13, fontWeight: 700, color: C.n900 }}>Tambah SKU Baru</div>
                  <div style={{ ...F, fontSize: 10, color: C.n500 }}>{showItemForm ? 'Tutup form' : 'Buka form pembuatan SKU'}</div>
                </div>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={C.n400} strokeWidth="2" style={{ transform: showItemForm ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 0.2s' }}>
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </button>
              {showItemForm && (
                <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${C.n100}` }}>
                  <Select
                    label="Kategori"
                    value={itemForm.categoryId}
                    onChange={(val) => setItemForm((f) => ({ ...f, categoryId: val }))}
                    placeholder="Pilih kategori..."
                    options={[
                      { value: '', label: 'Pilih kategori...' },
                      ...categories.map((c) => ({ value: c.id, label: `${c.name} (${c.code})` })),
                    ]}
                  />
                  <Input label="Nama barang" value={itemForm.name} onChange={(v) => setItemForm((f) => ({ ...f, name: v }))} />
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    <Input label="Satuan" value={itemForm.unit} onChange={(v) => setItemForm((f) => ({ ...f, unit: v }))} />
                    <Input label="Kode (opsional)" value={itemForm.itemCode} onChange={(v) => setItemForm((f) => ({ ...f, itemCode: v }))} placeholder="Auto jika kosong" />
                  </div>
                  <Input label="Min default global" value={itemForm.minStockDefault} onChange={(v) => setItemForm((f) => ({ ...f, minStockDefault: v }))} type="number" />
                  <Btn variant="primary" fullWidth style={{ marginTop: 10 }} onClick={createItem}>💾 Simpan SKU</Btn>
                </div>
              )}
            </Card>

            <SectionHeader
              icon="🏷️"
              title="Daftar SKU"
              subtitle={`${filteredItems.length} dari ${items.length} item`}
            />
            <div style={{ marginBottom: 10 }}>
              <Input label="Cari SKU" value={itemSearch} onChange={setItemSearch} placeholder="Nama atau kode..." />
            </div>

            {Object.keys(itemsByCategory).length === 0 ? (
              <Card style={{ textAlign: 'center', padding: 24 }}>
                <div style={{ fontSize: 36, marginBottom: 6, opacity: 0.4 }}>🏷️</div>
                <div style={{ ...F, fontSize: 13, color: C.n500 }}>Belum ada SKU.</div>
              </Card>
            ) : Object.entries(itemsByCategory).map(([catName, list]) => (
              <div key={catName} style={{ marginBottom: 12 }}>
                <div style={{
                  ...F, fontSize: 11, fontWeight: 700, color: C.n600,
                  padding: '4px 6px', marginBottom: 6, letterSpacing: 0.3,
                }}>
                  📁 {catName} ({list.length})
                </div>
                <Card style={{ padding: 0, overflow: 'hidden' }}>
                  {list.map((it, i) => (
                    <div key={it.id} style={{
                      padding: '10px 14px',
                      borderBottom: i < list.length - 1 ? `1px solid ${C.n100}` : 'none',
                      opacity: it.isActive ? 1 : 0.5,
                      display: 'flex', alignItems: 'center', gap: 10,
                    }}>
                      <div style={{
                        width: 36, height: 36, borderRadius: 10, background: `${C.primary}10`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16,
                      }}>📦</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ ...F, fontSize: 13, fontWeight: 700, color: C.n900 }}>{it.name}</div>
                        <div style={{ ...F, fontSize: 10, color: C.n500 }}>
                          {it.itemCode} · {it.unit} · min global {it.minStockDefault}
                        </div>
                      </div>
                      {!it.isActive && <Pill>NONAKTIF</Pill>}
                    </div>
                  ))}
                </Card>
              </div>
            ))}

            {/* Service usage */}
            <div style={{ marginTop: 24, paddingTop: 16, borderTop: `2px solid ${C.n200}` }}>
              <SectionHeader
                icon="🔗"
                title="Pemakaian Bahan per Layanan"
                subtitle="Atur kebutuhan bahan otomatis per unit layanan"
              />
              <Card style={{ marginBottom: 12 }}>
                <Select
                  label="Outlet"
                  value={pickOutlet}
                  onChange={(val) => setPickOutlet(val)}
                  placeholder="Pilih outlet (filter layanan)..."
                  options={[
                    { value: '', label: 'Pilih outlet...' },
                    ...outlets.map((o) => ({ value: o.id, label: o.name })),
                  ]}
                />
                <Select
                  label="Layanan"
                  value={pickService}
                  onChange={(val) => setPickService(val)}
                  placeholder="Pilih layanan..."
                  options={[
                    { value: '', label: 'Pilih layanan...' },
                    ...services.map((s) => ({ value: s.id, label: s.name })),
                  ]}
                />
              </Card>

              {pickService && (
                <>
                  <Card style={{ marginBottom: 12 }}>
                    <div style={{ ...F, fontSize: 12, fontWeight: 700, color: C.n900, marginBottom: 8 }}>➕ Tambah Pemakaian Bahan</div>
                    <Select
                      label="Bahan"
                      value={usageForm.inventoryId}
                      onChange={(val) => setUsageForm((u) => ({ ...u, inventoryId: val }))}
                      placeholder="Pilih bahan..."
                      options={[
                        { value: '', label: 'Pilih bahan...' },
                        ...items.filter((x) => x.isActive).map((x) => ({ value: x.id, label: `${x.name} (${x.unit})` })),
                      ]}
                    />
                    <Input label="Qty per unit layanan" value={usageForm.qtyPerUnit} onChange={(v) => setUsageForm((u) => ({ ...u, qtyPerUnit: v }))} type="number" />
                    <Btn variant="primary" fullWidth style={{ marginTop: 8 }} onClick={saveUsage}>💾 Simpan Pemakaian</Btn>
                  </Card>

                  <div style={{ ...F, fontSize: 12, fontWeight: 700, color: C.n700, marginBottom: 8 }}>
                    Bahan aktif untuk layanan ini ({usageRows.length})
                  </div>
                  {usageRows.length === 0 ? (
                    <Card style={{ textAlign: 'center', padding: 20 }}>
                      <div style={{ ...F, fontSize: 12, color: C.n500 }}>Belum ada pemakaian bahan untuk layanan ini.</div>
                    </Card>
                  ) : (
                    <Card style={{ padding: 0, overflow: 'hidden' }}>
                      {usageRows.map((u, i) => (
                        <div key={u.id} style={{
                          display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px',
                          borderBottom: i < usageRows.length - 1 ? `1px solid ${C.n100}` : 'none',
                        }}>
                          <div style={{
                            width: 32, height: 32, borderRadius: 8, background: `${C.info}14`,
                            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14,
                          }}>🧪</div>
                          <div style={{ flex: 1 }}>
                            <div style={{ ...F, fontSize: 12, fontWeight: 700, color: C.n900 }}>{u.inventoryName}</div>
                            <div style={{ ...F, fontSize: 10, color: C.n500 }}>{u.qtyPerUnit} {u.unit} / unit layanan</div>
                          </div>
                          <Btn size="sm" variant="secondary" onClick={() => removeUsage(u.id)}>🗑️</Btn>
                        </div>
                      ))}
                    </Card>
                  )}
                </>
              )}
            </div>
          </>
        )}

        {/* ═══════════════ PROMO TAB ═══════════════ */}
        {tab === 'promo' && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 8, marginBottom: 14 }}>
              <StatBox value={promos.filter(p => p.isActive).length} label="PROMO AKTIF" color={C.success} bg="#F0FDF4" />
              <StatBox value={promos.filter(p => !p.isActive).length} label="NONAKTIF" color={C.n500} />
              <StatBox value={promos.filter(p => p.isGlobal).length} label="GLOBAL" color={C.primary} bg={C.primaryLight} />
            </div>

            <Card style={{ marginBottom: 14 }}>
              <button onClick={() => setShowPromoForm(!showPromoForm)} style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                background: 'none', border: 'none', cursor: 'pointer', padding: 0, textAlign: 'left',
              }}>
                <div style={{
                  width: 32, height: 32, borderRadius: 10, background: `${C.primary}14`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18,
                }}>🎁</div>
                <div style={{ flex: 1 }}>
                  <div style={{ ...F, fontSize: 13, fontWeight: 700, color: C.n900 }}>Buat Promo Baru</div>
                  <div style={{ ...F, fontSize: 10, color: C.n500 }}>{showPromoForm ? 'Tutup form' : 'Buka form promo'}</div>
                </div>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={C.n400} strokeWidth="2" style={{ transform: showPromoForm ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 0.2s' }}>
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </button>
              {showPromoForm && (
                <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${C.n100}` }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    <Input label="Kode" value={promoForm.code} onChange={(v) => setPromoForm((p) => ({ ...p, code: v }))} />
                    <Input label="Nama" value={promoForm.name} onChange={(v) => setPromoForm((p) => ({ ...p, name: v }))} />
                  </div>
                  <div style={{ ...F, fontSize: 11, fontWeight: 600, color: C.n600, marginBottom: 6, marginTop: 8 }}>Tipe diskon</div>
                  <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                    <Chip label="% Persen" active={promoForm.type === 'percent'} onClick={() => setPromoForm((p) => ({ ...p, type: 'percent' }))} />
                    <Chip label="💰 Nominal" active={promoForm.type === 'fixed'} onClick={() => setPromoForm((p) => ({ ...p, type: 'fixed' }))} />
                  </div>
                  <Input label="Nilai" value={promoForm.value} onChange={(v) => setPromoForm((p) => ({ ...p, value: v }))} type="number" />
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    <Input label="Mulai" value={promoForm.validFrom} onChange={(v) => setPromoForm((p) => ({ ...p, validFrom: v }))} placeholder="2026-06-01 00:00:00" />
                    <Input label="Sampai" value={promoForm.validUntil} onChange={(v) => setPromoForm((p) => ({ ...p, validUntil: v }))} placeholder="2026-08-31 23:59:59" />
                  </div>
                  <label style={{ ...F, fontSize: 12, display: 'flex', alignItems: 'center', gap: 8, margin: '10px 0' }}>
                    <input type="checkbox" checked={promoForm.isGlobal} onChange={(e) => setPromoForm((p) => ({ ...p, isGlobal: e.target.checked }))} />
                    🌍 Berlaku semua outlet
                  </label>
                  <Btn variant="primary" fullWidth onClick={createPromo}>💾 Simpan Promo</Btn>
                </div>
              )}
            </Card>

            <SectionHeader icon="🎁" title="Daftar Promo" subtitle={`${promos.length} promo terdaftar`} />
            {promos.length === 0 ? (
              <Card style={{ textAlign: 'center', padding: 24 }}>
                <div style={{ fontSize: 36, marginBottom: 6, opacity: 0.4 }}>🎁</div>
                <div style={{ ...F, fontSize: 13, color: C.n500 }}>Belum ada promo terdaftar.</div>
              </Card>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {promos.map((p) => (
                  <Card key={p.id} accent={p.isActive ? C.success : C.n300} style={{ opacity: p.isActive ? 1 : 0.65 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{
                        width: 40, height: 40, borderRadius: 10,
                        background: p.isActive ? `${C.primary}14` : C.n100,
                        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18,
                      }}>{p.type === 'percent' ? '%' : '💰'}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                          <span style={{ ...F, fontSize: 14, fontWeight: 800, color: C.primary }}>{p.code}</span>
                          {p.isGlobal && <Pill color="#E0E7FF" textColor="#3730A3">🌍 Global</Pill>}
                          {p.isActive ? <Pill color="#DCFCE7" textColor="#166534">AKTIF</Pill> : <Pill>NONAKTIF</Pill>}
                        </div>
                        <div style={{ ...F, fontSize: 11, color: C.n600, marginTop: 2 }}>
                          {p.name} · {p.type === 'percent' ? `${p.value}%` : `Rp ${Number(p.value).toLocaleString('id-ID')}`}
                        </div>
                      </div>
                      <Btn size="sm" variant={p.isActive ? 'secondary' : 'primary'} onClick={() => togglePromo(p.id, p.isActive)}>
                        {p.isActive ? 'Nonaktifkan' : 'Aktifkan'}
                      </Btn>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

const thStyle = { ...F, fontSize: 10, fontWeight: 700, color: C.n500, padding: '10px 12px', textAlign: 'left', letterSpacing: 0.3, whiteSpace: 'nowrap' };
const tdStyle = { ...F, fontSize: 12, color: C.n800, padding: '10px 12px', whiteSpace: 'nowrap' };
