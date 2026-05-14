import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { C } from '../../utils/theme';
import { TopBar, Btn, Chip, Input } from '../../components/ui';

const tabs = [
  { id: 'stok', label: 'Stok outlet' },
  { id: 'inventaris', label: 'Master SKU' },
  { id: 'promo', label: 'Promo' },
];

const titles = {
  stok: { title: 'Stok outlet (pusat)', subtitle: 'Ringkasan & pantauan lintas outlet' },
  inventaris: { title: 'Master inventaris', subtitle: 'SKU, minimum per outlet, pemakaian bahan per layanan' },
  promo: { title: 'Manajemen promo', subtitle: 'Diskon per outlet / global' },
};

export default function AdminPromoSlaStokPage({ navigate, goBack, initialTab = 'stok' }) {
  const validTabs = ['stok', 'inventaris', 'promo'];
  const [tab, setTab] = useState(validTabs.includes(initialTab) ? initialTab : 'stok');

  useEffect(() => {
    if (validTabs.includes(initialTab)) setTab(initialTab);
  }, [initialTab]);

  const [outlets, setOutlets] = useState([]);
  const [pickOutlet, setPickOutlet] = useState('');
  const [summary, setSummary] = useState([]);
  const [stockRows, setStockRows] = useState([]);
  const [minEdits, setMinEdits] = useState({});
  const [promos, setPromos] = useState([]);
  const [loading, setLoading] = useState(false);

  const [promoForm, setPromoForm] = useState({
    code: '', name: '', type: 'percent', value: '', validFrom: '', validUntil: '', isGlobal: true,
  });

  const [categories, setCategories] = useState([]);
  const [items, setItems] = useState([]);
  const [itemForm, setItemForm] = useState({
    categoryId: '', name: '', unit: 'kg', itemCode: '', minStockDefault: '0',
  });
  const [services, setServices] = useState([]);
  const [pickService, setPickService] = useState('');
  const [usageRows, setUsageRows] = useState([]);
  const [usageForm, setUsageForm] = useState({ inventoryId: '', qtyPerUnit: '' });

  useEffect(() => {
    axios.get('/api/master/outlets').then((r) => setOutlets(r?.data?.data || [])).catch(() => setOutlets([]));
  }, []);

  const loadSummary = useCallback(async () => {
    try {
      const res = await axios.get('/api/inventory/summary-outlets');
      setSummary(res?.data?.data || []);
    } catch {
      setSummary([]);
    }
  }, []);

  const loadStockOutlet = useCallback(async () => {
    if (!pickOutlet) {
      setStockRows([]);
      return;
    }
    setLoading(true);
    try {
      const res = await axios.get(`/api/inventory/stock?outletId=${pickOutlet}`);
      setStockRows(res?.data?.data || []);
      setMinEdits({});
    } catch {
      setStockRows([]);
    } finally {
      setLoading(false);
    }
  }, [pickOutlet]);

  const loadPromos = useCallback(async () => {
    try {
      const res = await axios.get('/api/promos?includeInactive=1');
      setPromos(res?.data?.data || []);
    } catch {
      setPromos([]);
    }
  }, []);

  const loadCategoriesItems = useCallback(async () => {
    try {
      const [c, i] = await Promise.all([
        axios.get('/api/inventory/categories'),
        axios.get('/api/inventory/items?includeInactive=1'),
      ]);
      setCategories(c?.data?.data || []);
      setItems(i?.data?.data || []);
    } catch {
      setCategories([]);
      setItems([]);
    }
  }, []);

  const loadServicesUsage = useCallback(async () => {
    if (!pickOutlet) {
      setServices([]);
      setUsageRows([]);
      return;
    }
    try {
      const [svc, usage] = await Promise.all([
        axios.get(`/api/services?outletId=${pickOutlet}`),
        pickService ? axios.get(`/api/inventory/service-usage?serviceId=${pickService}`) : Promise.resolve({ data: { data: [] } }),
      ]);
      setServices(svc?.data?.data || []);
      setUsageRows(usage?.data?.data || []);
    } catch {
      setServices([]);
      setUsageRows([]);
    }
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
    } catch (e) {
      alert(e?.response?.data?.message || 'Gagal');
    }
  };

  const createPromo = async () => {
    try {
      await axios.post('/api/promos', {
        code: promoForm.code,
        name: promoForm.name,
        type: promoForm.type,
        value: Number(promoForm.value),
        validFrom: promoForm.validFrom,
        validUntil: promoForm.validUntil,
        isGlobal: !!promoForm.isGlobal,
      });
      setPromoForm({ code: '', name: '', type: 'percent', value: '', validFrom: '', validUntil: '', isGlobal: true });
      loadPromos();
    } catch (e) {
      alert(e?.response?.data?.message || 'Gagal buat promo');
    }
  };

  const saveMinStock = async (inventoryId) => {
    const raw = minEdits[inventoryId];
    if (raw === undefined || raw === '') {
      alert('Isi angka minimum');
      return;
    }
    const minStock = Number(String(raw).replace(',', '.'));
    if (!Number.isFinite(minStock) || minStock < 0) {
      alert('Minimum tidak valid');
      return;
    }
    try {
      await axios.patch('/api/inventory/outlet-min', { outletId: pickOutlet, inventoryId, minStock });
      loadStockOutlet();
    } catch (e) {
      alert(e?.response?.data?.message || 'Gagal simpan min');
    }
  };

  const createItem = async () => {
    if (!itemForm.categoryId || !itemForm.name.trim()) {
      alert('Kategori dan nama wajib');
      return;
    }
    try {
      await axios.post('/api/inventory/items', {
        categoryId: itemForm.categoryId,
        name: itemForm.name.trim(),
        unit: itemForm.unit || 'kg',
        itemCode: itemForm.itemCode?.trim() || undefined,
        minStockDefault: Number(itemForm.minStockDefault) || 0,
      });
      setItemForm({ categoryId: itemForm.categoryId, name: '', unit: 'kg', itemCode: '', minStockDefault: '0' });
      loadCategoriesItems();
    } catch (e) {
      alert(e?.response?.data?.message || 'Gagal buat SKU');
    }
  };

  const saveUsage = async () => {
    if (!pickService || !usageForm.inventoryId || usageForm.qtyPerUnit === '') {
      alert('Pilih layanan, bahan, dan qty per unit');
      return;
    }
    try {
      await axios.post('/api/inventory/service-usage', {
        serviceId: pickService,
        inventoryId: usageForm.inventoryId,
        qtyPerUnit: Number(usageForm.qtyPerUnit),
        usageType: 'auto_deduct',
      });
      setUsageForm({ inventoryId: '', qtyPerUnit: '' });
      loadServicesUsage();
    } catch (e) {
      alert(e?.response?.data?.message || 'Gagal simpan pemakaian');
    }
  };

  const removeUsage = async (id) => {
    if (!window.confirm('Nonaktifkan baris pemakaian ini?')) return;
    try {
      await axios.delete(`/api/inventory/service-usage/${id}`);
      loadServicesUsage();
    } catch (e) {
      alert(e?.response?.data?.message || 'Gagal');
    }
  };

  const head = titles[tab] || titles.stok;

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: C.n50, overflow: 'hidden' }}>
      <TopBar title={head.title} subtitle={head.subtitle} onBack={goBack} />

      <div style={{ padding: '8px 16px', display: 'flex', gap: 8, overflowX: 'auto' }}>
        {tabs.map((t) => (
          <Chip key={t.id} label={t.label} active={tab === t.id} onClick={() => setTab(t.id)} />
        ))}
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px 24px' }}>
        {tab === 'stok' && (
          <>
            <div style={{ fontFamily: 'Poppins', fontSize: 12, color: C.n600, marginBottom: 12 }}>
              Ringkasan SKU di bawah minimum per outlet. Pilih outlet untuk set minimum per SKU dan penyesuaian stok.
            </div>
            {summary.map((s) => (
              <div key={s.outletId} style={{ background: C.white, borderRadius: 12, padding: 12, marginBottom: 8, display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontFamily: 'Poppins', fontWeight: 600 }}>{s.outletName}</span>
                <span style={{ fontFamily: 'Poppins', fontSize: 12, color: s.lowStockCount > 0 ? C.warning : C.n600 }}>
                  {s.lowStockCount} rendah / {s.skuCount} SKU
                </span>
              </div>
            ))}
            <div style={{ marginTop: 16 }}>
              <div style={{ fontFamily: 'Poppins', fontSize: 12, fontWeight: 600, marginBottom: 6 }}>Detail outlet</div>
              <select
                value={pickOutlet}
                onChange={(e) => setPickOutlet(e.target.value)}
                style={{ width: '100%', height: 44, borderRadius: 10, border: `1.5px solid ${C.n300}`, fontFamily: 'Poppins', marginBottom: 12 }}
              >
                <option value="">Pilih outlet...</option>
                {outlets.map((o) => (
                  <option key={o.id} value={o.id}>{o.name}</option>
                ))}
              </select>
              {loading ? <div style={{ color: C.n500 }}>Memuat...</div> : stockRows.map((r) => (
                <div key={r.id} style={{ background: C.white, borderRadius: 10, padding: 10, marginBottom: 8, fontFamily: 'Poppins', fontSize: 12 }}>
                  <div><strong>{r.name}</strong> — stok {Number(r.stockQty).toLocaleString('id-ID')} {r.unit}</div>
                  <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ color: C.n600 }}>Min outlet:</span>
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      value={minEdits[r.id] !== undefined ? minEdits[r.id] : String(r.minStock)}
                      onChange={(e) => setMinEdits((m) => ({ ...m, [r.id]: e.target.value }))}
                      style={{ width: 100, height: 36, borderRadius: 8, border: `1px solid ${C.n300}`, padding: '0 8px' }}
                    />
                    <Btn size="sm" variant="secondary" onClick={() => saveMinStock(r.id)}>Simpan min</Btn>
                    {r.lowStock && <span style={{ color: C.warning }}>di bawah min</span>}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {tab === 'inventaris' && (
          <>
            <div style={{ background: C.white, borderRadius: 14, padding: 14, marginBottom: 14 }}>
              <div style={{ fontFamily: 'Poppins', fontSize: 13, fontWeight: 600, marginBottom: 10 }}>SKU baru</div>
              <select
                value={itemForm.categoryId}
                onChange={(e) => setItemForm((f) => ({ ...f, categoryId: e.target.value }))}
                style={{ width: '100%', height: 44, borderRadius: 10, border: `1.5px solid ${C.n300}`, fontFamily: 'Poppins', marginBottom: 10 }}
              >
                <option value="">Pilih kategori...</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name} ({c.code})</option>
                ))}
              </select>
              <Input label="Nama barang" value={itemForm.name} onChange={(v) => setItemForm((f) => ({ ...f, name: v }))} />
              <Input label="Satuan" value={itemForm.unit} onChange={(v) => setItemForm((f) => ({ ...f, unit: v }))} />
              <Input label="Kode (opsional)" value={itemForm.itemCode} onChange={(v) => setItemForm((f) => ({ ...f, itemCode: v }))} placeholder="Auto jika kosong" />
              <Input label="Min default global" value={itemForm.minStockDefault} onChange={(v) => setItemForm((f) => ({ ...f, minStockDefault: v }))} type="number" />
              <Btn variant="primary" fullWidth style={{ marginTop: 10 }} onClick={createItem}>Simpan SKU</Btn>
            </div>
            <div style={{ fontFamily: 'Poppins', fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Daftar SKU</div>
            {items.map((it) => (
              <div key={it.id} style={{ background: C.white, borderRadius: 10, padding: 10, marginBottom: 6, fontSize: 12, opacity: it.isActive ? 1 : 0.55 }}>
                <strong>{it.name}</strong> · {it.itemCode} · {it.unit}
                <div style={{ color: C.n600 }}>{it.categoryName} · min global {it.minStockDefault}</div>
              </div>
            ))}

            <div style={{ marginTop: 20, paddingTop: 16, borderTop: `1px solid ${C.n200}` }}>
              <div style={{ fontFamily: 'Poppins', fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Pemakaian bahan per layanan</div>
              <select
                value={pickOutlet}
                onChange={(e) => setPickOutlet(e.target.value)}
                style={{ width: '100%', height: 44, borderRadius: 10, border: `1.5px solid ${C.n300}`, fontFamily: 'Poppins', marginBottom: 10 }}
              >
                <option value="">Pilih outlet (filter layanan)...</option>
                {outlets.map((o) => (
                  <option key={o.id} value={o.id}>{o.name}</option>
                ))}
              </select>
              <select
                value={pickService}
                onChange={(e) => setPickService(e.target.value)}
                style={{ width: '100%', height: 44, borderRadius: 10, border: `1.5px solid ${C.n300}`, fontFamily: 'Poppins', marginBottom: 10 }}
              >
                <option value="">Pilih layanan...</option>
                {services.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
              {pickService && (
                <>
                  <select
                    value={usageForm.inventoryId}
                    onChange={(e) => setUsageForm((u) => ({ ...u, inventoryId: e.target.value }))}
                    style={{ width: '100%', height: 44, borderRadius: 10, border: `1.5px solid ${C.n300}`, fontFamily: 'Poppins', marginBottom: 8 }}
                  >
                    <option value="">Pilih bahan...</option>
                    {items.filter((x) => x.isActive).map((x) => (
                      <option key={x.id} value={x.id}>{x.name} ({x.unit})</option>
                    ))}
                  </select>
                  <Input label="Qty per unit layanan" value={usageForm.qtyPerUnit} onChange={(v) => setUsageForm((u) => ({ ...u, qtyPerUnit: v }))} type="number" />
                  <Btn variant="primary" fullWidth style={{ marginTop: 8 }} onClick={saveUsage}>Tambah / update pemakaian</Btn>
                  <div style={{ marginTop: 12, fontWeight: 600, fontSize: 12 }}>Aktif untuk layanan ini</div>
                  {usageRows.map((u) => (
                    <div key={u.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: `1px solid ${C.n100}` }}>
                      <span>{u.inventoryName}: {u.qtyPerUnit} {u.unit}</span>
                      <Btn size="sm" variant="secondary" onClick={() => removeUsage(u.id)}>Hapus</Btn>
                    </div>
                  ))}
                </>
              )}
            </div>
          </>
        )}

        {tab === 'promo' && (
          <>
            <div style={{ background: C.white, borderRadius: 14, padding: 14, marginBottom: 14 }}>
              <div style={{ fontFamily: 'Poppins', fontSize: 13, fontWeight: 600, marginBottom: 10 }}>Promo baru</div>
              <Input label="Kode" value={promoForm.code} onChange={(v) => setPromoForm((p) => ({ ...p, code: v }))} />
              <Input label="Nama" value={promoForm.name} onChange={(v) => setPromoForm((p) => ({ ...p, name: v }))} />
              <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                <Chip label="%" active={promoForm.type === 'percent'} onClick={() => setPromoForm((p) => ({ ...p, type: 'percent' }))} />
                <Chip label="Nominal" active={promoForm.type === 'fixed'} onClick={() => setPromoForm((p) => ({ ...p, type: 'fixed' }))} />
              </div>
              <Input label="Nilai" value={promoForm.value} onChange={(v) => setPromoForm((p) => ({ ...p, value: v }))} type="number" />
              <Input label="Berlaku mulai (datetime)" value={promoForm.validFrom} onChange={(v) => setPromoForm((p) => ({ ...p, validFrom: v }))} placeholder="2026-06-01 00:00:00" />
              <Input label="Berlaku s/d" value={promoForm.validUntil} onChange={(v) => setPromoForm((p) => ({ ...p, validUntil: v }))} placeholder="2026-08-31 23:59:59" />
              <label style={{ fontFamily: 'Poppins', fontSize: 12, display: 'flex', alignItems: 'center', gap: 8, margin: '10px 0' }}>
                <input type="checkbox" checked={promoForm.isGlobal} onChange={(e) => setPromoForm((p) => ({ ...p, isGlobal: e.target.checked }))} />
                Berlaku semua outlet
              </label>
              <Btn variant="primary" fullWidth onClick={createPromo}>Simpan promo</Btn>
            </div>
            {promos.map((p) => (
              <div key={p.id} style={{ background: C.white, borderRadius: 12, padding: 12, marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontFamily: 'Poppins', fontWeight: 700 }}>{p.code}</div>
                  <div style={{ fontSize: 11, color: C.n600 }}>{p.name} · {p.type} {p.value}{p.type === 'percent' ? '%' : ''}</div>
                </div>
                <Btn size="sm" variant="secondary" onClick={() => togglePromo(p.id, p.isActive)}>{p.isActive ? 'Nonaktifkan' : 'Aktifkan'}</Btn>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}
