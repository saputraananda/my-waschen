import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { C } from '../../utils/theme';
import { rp, getCartLineSubtotal, getCartUnitPrice } from '../../utils/helpers';
import { TopBar, Btn, Chip, Avatar, SearchBar, EmptyState, Select } from '../../components/ui';
import { useApp } from '../../context/AppContext';
import { alertError, alertWarning } from '../../utils/alert';

// ─── ItemDetailFields ─────────────────────────────────────────────────────
// Input bahan & merek per item + auto-detect alert khusus
const SPECIAL_BAHAN = {
  'sutra':       { color: '#EC4899', alert: '⚠️ Bahan sutra — gunakan deterjen lembut, jangan diperas keras' },
  'silk':        { color: '#EC4899', alert: '⚠️ Bahan silk — gunakan deterjen lembut, jangan diperas keras' },
  'wol':         { color: '#92400E', alert: '⚠️ Bahan wol — cuci air dingin, jangan diperas atau ditarik' },
  'wool':        { color: '#92400E', alert: '⚠️ Bahan wol — cuci air dingin, jangan diperas atau ditarik' },
  'kulit':       { color: '#7F1D1D', alert: '🚨 Bahan kulit — JANGAN dicuci air, gunakan dry cleaning saja' },
  'leather':     { color: '#7F1D1D', alert: '🚨 Bahan kulit — JANGAN dicuci air, gunakan dry cleaning saja' },
  'beludru':     { color: '#581C87', alert: '⚠️ Beludru — hati-hati saat setrika, gunakan kain pelapis' },
  'velvet':      { color: '#581C87', alert: '⚠️ Velvet — hati-hati saat setrika, gunakan kain pelapis' },
  'kaos polos':  { color: '#0EA5E9', alert: '💧 Cek warna luntur sebelum pencampuran' },
  'jeans':       { color: '#1E40AF', alert: '💧 Jeans — kemungkinan luntur, cuci terpisah pertama kali' },
  'denim':       { color: '#1E40AF', alert: '💧 Denim — kemungkinan luntur, cuci terpisah pertama kali' },
};

const PREMIUM_MEREK = ['gucci', 'louis vuitton', 'lv', 'hermes', 'chanel', 'prada', 'dior', 'versace', 'burberry', 'fendi'];

function detectAlert(bahan, merek) {
  const alerts = [];
  const bLower = String(bahan || '').toLowerCase().trim();
  const mLower = String(merek || '').toLowerCase().trim();

  // Match bahan terhadap dictionary
  for (const [key, meta] of Object.entries(SPECIAL_BAHAN)) {
    if (bLower.includes(key)) { alerts.push(meta); break; }
  }
  if (PREMIUM_MEREK.some(brand => mLower.includes(brand))) {
    alerts.push({ color: '#B45309', alert: '✨ Merek premium — handle ekstra hati-hati, dokumentasi lengkap' });
  }
  return alerts;
}

function ItemDetailFields({ item, onChangeBahan, onChangeMerek, onChangeAlert }) {
  const detected = detectAlert(item.material, item.brand);
  return (
    <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <div>
          <div style={{ fontFamily: 'Poppins', fontSize: 10, fontWeight: 600, color: C.n600, marginBottom: 4 }}>🧵 Bahan (opsional)</div>
          <input
            value={item.material || ''}
            onChange={(e) => onChangeBahan(e.target.value)}
            placeholder="Sutra, wol, kulit..."
            style={{ width: '100%', height: 36, borderRadius: 8, border: `1.5px solid ${C.n300}`, fontFamily: 'Poppins', fontSize: 12, padding: '0 10px', boxSizing: 'border-box', outline: 'none' }}
          />
        </div>
        <div>
          <div style={{ fontFamily: 'Poppins', fontSize: 10, fontWeight: 600, color: C.n600, marginBottom: 4 }}>🏷️ Merek (opsional)</div>
          <input
            value={item.brand || ''}
            onChange={(e) => onChangeMerek(e.target.value)}
            placeholder="Gucci, Uniqlo, dll"
            style={{ width: '100%', height: 36, borderRadius: 8, border: `1.5px solid ${C.n300}`, fontFamily: 'Poppins', fontSize: 12, padding: '0 10px', boxSizing: 'border-box', outline: 'none' }}
          />
        </div>
      </div>

      {/* Auto-detected alerts */}
      {detected.map((a, i) => (
        <div key={i} style={{
          background: `${a.color}10`, borderLeft: `3px solid ${a.color}`,
          borderRadius: 6, padding: '6px 10px',
          fontFamily: 'Poppins', fontSize: 11, color: a.color, fontWeight: 600,
        }}>
          {a.alert}
        </div>
      ))}

      {/* Manual special alert input */}
      <div>
        <div style={{ fontFamily: 'Poppins', fontSize: 10, fontWeight: 600, color: C.n600, marginBottom: 4 }}>⚠️ Catatan khusus (untuk produksi)</div>
        <input
          value={item.specialCareAlert || ''}
          onChange={(e) => onChangeAlert(e.target.value)}
          placeholder="Mis. mudah luntur, jangan disetrika..."
          style={{ width: '100%', height: 36, borderRadius: 8, border: `1.5px solid ${C.n300}`, fontFamily: 'Poppins', fontSize: 12, padding: '0 10px', boxSizing: 'border-box', outline: 'none' }}
        />
      </div>
    </div>
  );
}

export default function NotaStep2Page({ goBack }) {
  const { navigate, notaCustomer, notaCart, setNotaCart } = useApp();
  const [activeCategory, setActiveCategory] = useState('Semua');
  const [serviceKind, setServiceKind] = useState('waschen'); // waschen | cleanox
  const [searchQuery, setSearchQuery] = useState('');
  const [services, setServices] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [loading, setLoading] = useState(false);
  // ── Carpet (m2) measurement ───────────────────────────────────────────────
  const [measuringId, setMeasuringId] = useState(null);
  const [carpetInputs, setCarpetInputs] = useState({}); // { [serviceId]: { panjang: '', lebar: '' } }
  const [carpetUnit, setCarpetUnit] = useState('cm'); // 'cm' or 'm'
  const canFavorite = !!notaCustomer?.id;

  useEffect(() => {
    const fetchServices = async () => {
      setLoading(true);
      try {
        const [svcRes, matRes] = await Promise.all([
          axios.get(`/api/services${notaCustomer?.id ? `?customerId=${notaCustomer.id}` : ''}`),
          axios.get('/api/master/materials')
        ]);
        setServices(svcRes?.data?.data || []);
        if (matRes?.data?.data) setMaterials(matRes.data.data);
      } catch (error) {
        console.error('Failed to fetch data:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchServices();
  }, [notaCustomer?.id]);

  // ── Cleanox dummy services (Home Cleaning) — placeholder sampai admin set up ──
  const CLEANOX_DUMMY = useMemo(() => [
    { id: 'cnx-1', name: 'Cuci Sofa 2 Dudukan', category: 'Sofa & Kursi', categoryCode: 'CNX_SOFA', price: 150_000, unit: 'unit', minQty: 1, expressMultiplier: 1.5, expressExtra: 75_000, expressEligible: 1, active: 1, serviceKind: 'cleanox', _dummy: true },
    { id: 'cnx-2', name: 'Cuci Sofa 3 Dudukan', category: 'Sofa & Kursi', categoryCode: 'CNX_SOFA', price: 250_000, unit: 'unit', minQty: 1, expressMultiplier: 1.5, expressExtra: 125_000, expressEligible: 1, active: 1, serviceKind: 'cleanox', _dummy: true },
    { id: 'cnx-3', name: 'Cuci Kasur Spring Bed Single', category: 'Kasur', categoryCode: 'CNX_KASUR', price: 175_000, unit: 'unit', minQty: 1, expressMultiplier: 1.5, expressExtra: 87_500, expressEligible: 1, active: 1, serviceKind: 'cleanox', _dummy: true },
    { id: 'cnx-4', name: 'Cuci Kasur Spring Bed Queen', category: 'Kasur', categoryCode: 'CNX_KASUR', price: 250_000, unit: 'unit', minQty: 1, expressMultiplier: 1.5, expressExtra: 125_000, expressEligible: 1, active: 1, serviceKind: 'cleanox', _dummy: true },
    { id: 'cnx-5', name: 'Cuci Kasur Spring Bed King', category: 'Kasur', categoryCode: 'CNX_KASUR', price: 300_000, unit: 'unit', minQty: 1, expressMultiplier: 1.5, expressExtra: 150_000, expressEligible: 1, active: 1, serviceKind: 'cleanox', _dummy: true },
    { id: 'cnx-6', name: 'Cuci Karpet (per m²)', category: 'Karpet', categoryCode: 'CNX_KARPET', price: 35_000, unit: 'm2', minQty: 1, expressMultiplier: 1.5, expressExtra: 17_500, expressEligible: 1, active: 1, serviceKind: 'cleanox', _dummy: true },
    { id: 'cnx-7', name: 'General Cleaning Rumah Kecil (<60m²)', category: 'Rumah', categoryCode: 'CNX_RUMAH', price: 350_000, unit: 'unit', minQty: 1, expressMultiplier: 1.5, expressExtra: 175_000, expressEligible: 1, active: 1, serviceKind: 'cleanox', _dummy: true },
    { id: 'cnx-8', name: 'General Cleaning Rumah Sedang (60-100m²)', category: 'Rumah', categoryCode: 'CNX_RUMAH', price: 500_000, unit: 'unit', minQty: 1, expressMultiplier: 1.5, expressExtra: 250_000, expressEligible: 1, active: 1, serviceKind: 'cleanox', _dummy: true },
    { id: 'cnx-9', name: 'General Cleaning Rumah Besar (>100m²)', category: 'Rumah', categoryCode: 'CNX_RUMAH', price: 750_000, unit: 'unit', minQty: 1, expressMultiplier: 1.5, expressExtra: 375_000, expressEligible: 1, active: 1, serviceKind: 'cleanox', _dummy: true },
    { id: 'cnx-10', name: 'AC Service (Cuci Indoor + Outdoor)', category: 'Elektronik', categoryCode: 'CNX_AC', price: 100_000, unit: 'unit', minQty: 1, expressMultiplier: 1.5, expressExtra: 50_000, expressEligible: 1, active: 1, serviceKind: 'cleanox', _dummy: true },
  ], []);

  // ── Pisahkan services by kind ──
  const servicesByKind = useMemo(() => {
    // Services dari backend: kalau tidak ada serviceKind, anggap waschen
    const waschenServices = services.filter(s => !s.serviceKind || s.serviceKind === 'waschen');
    const realCleanox = services.filter(s => s.serviceKind === 'cleanox');
    // Kalau backend belum ada cleanox real, fallback ke dummy
    const cleanoxServices = realCleanox.length > 0 ? realCleanox : CLEANOX_DUMMY;
    return { waschen: waschenServices, cleanox: cleanoxServices };
  }, [services, CLEANOX_DUMMY]);

  const activeServices = serviceKind === 'cleanox' ? servicesByKind.cleanox : servicesByKind.waschen;

  const categoryChips = useMemo(() => {
    const uniqNames = [...new Set(activeServices.map((s) => s.category).filter(Boolean))];
    return ['Semua', ...uniqNames.sort((a, b) => a.localeCompare(b, 'id'))];
  }, [activeServices]);

  const categoryFiltered = useMemo(() => {
    if (activeCategory === 'Semua') return activeServices;
    return activeServices.filter((s) => s.category === activeCategory);
  }, [activeServices, activeCategory]);

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return categoryFiltered;
    return categoryFiltered.filter((s) => {
      const blob = `${s.name || ''} ${s.unit || ''} ${s.category || ''} ${s.categoryCode || ''}`.toLowerCase();
      return blob.includes(q);
    });
  }, [categoryFiltered, searchQuery]);

  // ── Ordering yang aman & informatif:
  //    1. PINNED (paling atas — diset admin sebagai promo/priority)
  //    2. FAVORITE (frekuensi pemakaian customer ini > 0, urut DESC)
  //    3. NORMAL (sisanya, urut by category + name)
  const orderedList = useMemo(() => {
    const pinned = filtered.filter((s) => s.pin_context);
    const pinnedIds = new Set(pinned.map((s) => s.id));
    const favorite = filtered
      .filter((s) => !pinnedIds.has(s.id) && Number(s.usage_count) > 0)
      .sort((a, b) => Number(b.usage_count) - Number(a.usage_count));
    const favIds = new Set(favorite.map((s) => s.id));
    const others = filtered
      .filter((s) => !pinnedIds.has(s.id) && !favIds.has(s.id))
      .sort((a, b) => {
        const catCmp = (a.category || '').localeCompare(b.category || '', 'id');
        return catCmp !== 0 ? catCmp : (a.name || '').localeCompare(b.name || '', 'id');
      });
    return { pinned, favorite, others };
  }, [filtered]);

  const getQty = (id) => notaCart.find((c) => c.id === id)?.qty || 0;

  const addItem = (service) => {
    setNotaCart((prev) => {
      const existing = prev.find((c) => c.id === service.id);
      if (existing) return prev.map((c) => (c.id === service.id ? { ...c, qty: c.qty + 1 } : c));
      return [...prev, { ...service, qty: 1, express: false }];
    });
  };

  const addCarpetItem = (service, panjangRaw, lebarRaw) => {
    const p = Number(panjangRaw);
    const l = Number(lebarRaw);
    if (!p || !l || p <= 0 || l <= 0) return;
    // Konversi ke m² berdasarkan unit yang dipilih
    let luas;
    let pCm, lCm;
    if (carpetUnit === 'm') {
      luas = Math.round((p * l) * 100) / 100; // sudah dalam meter
      pCm = Math.round(p * 100);
      lCm = Math.round(l * 100);
    } else {
      luas = Math.round((p * l / 10000) * 100) / 100; // cm → m²
      pCm = p;
      lCm = l;
    }
    setNotaCart((prev) => {
      const existing = prev.find((c) => c.id === service.id);
      const carpetData = { carpetPanjangCm: pCm, carpetLebarCm: lCm, carpetInputUnit: carpetUnit };
      if (existing) {
        return prev.map((c) => c.id === service.id ? { ...c, qty: luas, ...carpetData } : c);
      }
      return [...prev, { ...service, qty: luas, ...carpetData, express: false }];
    });
    setMeasuringId(null);
    setCarpetInputs((prev) => ({ ...prev, [service.id]: { panjang: '', lebar: '' } }));
  };

  const removeItem = (id) => {
    setNotaCart((prev) => {
      const existing = prev.find((c) => c.id === id);
      if (existing && existing.unit !== 'm2' && existing.qty > 1)
        return prev.map((c) => (c.id === id ? { ...c, qty: c.qty - 1 } : c));
      return prev.filter((c) => c.id !== id);
    });
    if (measuringId === id) setMeasuringId(null);
  };

  const toggleExpress = (id) => {
    setNotaCart((prev) => prev.map((c) => (c.id === id ? { ...c, express: !c.express } : c)));
  };

  const updateMaterial = (id, materialId) => {
    setNotaCart((prev) => prev.map((c) => (c.id === id ? { ...c, materialId } : c)));
  };

  // Update bahan & merek per item (untuk highlight care-needed)
  const updateBahan = (id, material) => {
    setNotaCart((prev) => prev.map((c) => (c.id === id ? { ...c, material } : c)));
  };
  const updateMerek = (id, brand) => {
    setNotaCart((prev) => prev.map((c) => (c.id === id ? { ...c, brand } : c)));
  };
  const updateSpecialAlert = (id, alert) => {
    setNotaCart((prev) => prev.map((c) => (c.id === id ? { ...c, specialCareAlert: alert } : c)));
  };

  const toggleFavorite = async (service) => {
    if (!notaCustomer?.id) {
      alertWarning('Pilih customer terlebih dahulu untuk favorit.');
      return;
    }
    try {
      const res = await axios.post(`/api/services/${service.id}/favorite`, { customerId: notaCustomer.id });
      const isFavorite = res?.data?.favorite;
      setServices((prev) => prev.map((s) => (
        s.id === service.id
          ? { ...s, usage_count: isFavorite ? Math.max(1, s.usage_count || 0) : 0 }
          : s
      )));
    } catch (error) {
      console.error('Failed to toggle favorite:', error);
      alertError(error?.response?.data?.message || 'Gagal mengubah favorit layanan.');
    }
  };

  const total = notaCart.reduce((sum, c) => sum + getCartLineSubtotal(c), 0);

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: C.n50, overflow: 'hidden' }}>
      <TopBar title="Buat Nota" subtitle="Langkah 2 dari 3 — Pilih Layanan" onBack={goBack} />

      <div style={{ padding: '8px 16px' }}>
        <div style={{ display: 'flex', gap: 6 }}>
          {[1, 2, 3].map((s) => (
            <div key={s} style={{ flex: 1, height: 4, borderRadius: 2, background: s <= 2 ? C.primary : C.n200 }} />
          ))}
        </div>
      </div>

      {notaCustomer && (
        <div style={{ margin: '4px 16px 0', background: C.primaryLight, borderRadius: 12, padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 10 }}>
          <Avatar initials={notaCustomer.avatar} size={32} />
          <div>
            <div style={{ fontFamily: 'Poppins', fontSize: 13, fontWeight: 600, color: C.primary }}>{notaCustomer.name}</div>
            <div style={{ fontFamily: 'Poppins', fontSize: 11, color: C.primarySoft }}>Deposit: {rp(notaCustomer.deposit || 0)}</div>
          </div>
        </div>
      )}

      {/* ─── Service Kind Toggle: Waschen (laundry) vs Cleanox (home cleaning) ─── */}
      <div style={{ padding: '10px 16px 0' }}>
        <div style={{
          display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8,
          background: C.n50, padding: 4, borderRadius: 12, border: `1px solid ${C.n200}`,
        }}>
          {[
            { id: 'waschen', label: 'Waschen Laundry', sub: 'Cuci & setrika', icon: '🧺',  color: C.primary },
            { id: 'cleanox', label: 'Cleanox Cleaning', sub: 'Home cleaning', icon: '🏠',  color: '#0EA5E9' },
          ].map(opt => {
            const active = serviceKind === opt.id;
            return (
              <button
                key={opt.id}
                onClick={() => { setServiceKind(opt.id); setActiveCategory('Semua'); }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '10px 12px', borderRadius: 10,
                  border: 'none',
                  background: active ? 'white' : 'transparent',
                  boxShadow: active ? '0 2px 8px rgba(15,23,42,0.08)' : 'none',
                  cursor: 'pointer', textAlign: 'left',
                  transition: 'all 0.15s',
                }}
              >
                <div style={{
                  width: 36, height: 36, borderRadius: 10,
                  background: active ? `${opt.color}15` : C.n100,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18,
                }}>{opt.icon}</div>
                <div>
                  <div style={{ fontFamily: 'Poppins', fontSize: 12, fontWeight: 700, color: active ? opt.color : C.n700 }}>
                    {opt.label}
                  </div>
                  <div style={{ fontFamily: 'Poppins', fontSize: 9, color: C.n500, marginTop: 1 }}>
                    {opt.sub}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div style={{ padding: '8px 16px 0' }}>
        <SearchBar
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder="Cari nama layanan, satuan, atau kategori..."
        />
      </div>

      <div style={{ padding: '8px 16px 0' }}>
        <div style={{ fontFamily: 'Poppins', fontSize: 11, fontWeight: 600, color: C.n500, marginBottom: 6 }}>Genre / kategori</div>
        <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4, scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' }}>
          {categoryChips.map((cat) => (
            <Chip key={cat} label={cat} active={activeCategory === cat} onClick={() => setActiveCategory(cat)} />
          ))}
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '50%', gap: 12 }}>
            <div style={{ width: 40, height: 40, border: `3px solid ${C.n200}`, borderTop: `3px solid ${C.primary}`, borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
            <span style={{ fontFamily: 'Poppins', fontSize: 13, color: C.n500 }}>Memuat layanan...</span>
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            title="Tidak ada layanan"
            subtitle="Ubah pencarian atau pilih kategori lain. Jika kategori masih kosong, tambah master layanan & kategori di admin."
          />
        ) : (
          <>
            {/* SECTION: Pinned (selalu di atas — diset admin) */}
            {orderedList.pinned.length > 0 && (
              <div style={{ fontFamily: 'Poppins', fontSize: 11, fontWeight: 700, color: '#7C3AED', display: 'flex', alignItems: 'center', gap: 4, marginTop: 4, marginBottom: 2 }}>
                <span>📌</span> DI PIN
              </div>
            )}
            {/* SECTION: Favorite (frekuensi customer ini) */}
            {orderedList.favorite.length > 0 && (
              <div style={{ fontFamily: 'Poppins', fontSize: 11, fontWeight: 700, color: '#D97706', display: 'flex', alignItems: 'center', gap: 4, marginTop: orderedList.pinned.length > 0 ? 8 : 4, marginBottom: 2 }}>
                <span>⭐</span> SERING DIPAKAI
              </div>
            )}
            {/* Render: pinned dulu, lalu favorite, lalu others */}
            {[...orderedList.pinned, ...orderedList.favorite, ...orderedList.others].map((s, idx) => {
              const isM2     = s.unit === 'm2';
              const qty      = getQty(s.id);
              const inCart   = notaCart.find((c) => c.id === s.id);
              const isMeasuring = measuringId === s.id;
              const inp      = carpetInputs[s.id] || { panjang: '', lebar: '' };
              const isFavorite = Number(s.usage_count) > 0;
              const isPinned = !!s.pin_context;
              const luas     = (inp.panjang && inp.lebar)
                ? carpetUnit === 'm'
                  ? Math.round((Number(inp.panjang) * Number(inp.lebar)) * 100) / 100
                  : Math.round((Number(inp.panjang) * Number(inp.lebar) / 10000) * 100) / 100
                : 0;

              // Inject section divider antara pinned → favorite → others
              const showOthersHeader =
                idx === orderedList.pinned.length + orderedList.favorite.length &&
                (orderedList.pinned.length > 0 || orderedList.favorite.length > 0) &&
                orderedList.others.length > 0;

              return (
                <React.Fragment key={s.id}>
                  {showOthersHeader && (
                    <div style={{ fontFamily: 'Poppins', fontSize: 11, fontWeight: 700, color: C.n500, display: 'flex', alignItems: 'center', gap: 4, marginTop: 8, marginBottom: 2 }}>
                      <span>🧺</span> LAINNYA
                    </div>
                  )}
                <div
                  style={{
                    background: C.white,
                    borderRadius: 14,
                    padding: '12px 14px',
                    boxShadow: isPinned ? '0 2px 10px rgba(124,58,237,0.18)' : '0 2px 8px rgba(15,23,42,0.05)',
                    border: isPinned ? '2px solid #7C3AED' : inCart ? `1.5px solid ${C.primary}30` : '1.5px solid transparent',
                  }}
                >
                  {/* ── Header row ── */}
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        <div style={{ fontFamily: 'Poppins', fontSize: 13, fontWeight: 600, color: C.n900 }}>{s.name}</div>
                        {isPinned && (
                          <span style={{ background: '#EDE9FE', color: '#6D28D9', fontFamily: 'Poppins', fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 999 }}>
                            📌 PINNED
                          </span>
                        )}
                      </div>
                      <div style={{ fontFamily: 'Poppins', fontSize: 11, color: C.n600, marginTop: 2 }}>
                        {isM2 ? 'per m²' : s.unit}
                        {s.category ? <span> · {s.category}</span> : null}
                        {isM2 && <span style={{ marginLeft: 6, background: '#E0F2FE', color: '#0369A1', borderRadius: 6, padding: '1px 7px', fontSize: 10, fontWeight: 700 }}>📐 Karpet</span>}
                      </div>
                      <div style={{ fontFamily: 'Poppins', fontSize: 14, fontWeight: 700, color: C.primary, marginTop: 4 }}>
                        {rp(s.price)}{isM2 ? <span style={{ fontFamily: 'Poppins', fontSize: 10, fontWeight: 500, color: C.n500 }}> / m²</span> : null}
                      </div>
                    </div>

                    {/* ── RIGHT SIDE ── */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <button
                        onClick={() => toggleFavorite(s)}
                        disabled={!canFavorite}
                        title={canFavorite ? (isFavorite ? 'Hapus dari favorit' : 'Tambahkan ke favorit') : 'Pilih customer dulu'}
                        style={{
                          width: 28,
                          height: 28,
                          borderRadius: 8,
                          border: `1.5px solid ${isFavorite ? '#F59E0B' : C.n300}`,
                          background: isFavorite ? '#FFFBEB' : C.white,
                          cursor: canFavorite ? 'pointer' : 'not-allowed',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: isFavorite ? '#F59E0B' : C.n400,
                          fontSize: 14,
                          opacity: canFavorite ? 1 : 0.6,
                        }}
                      >
                        {isFavorite ? '⭐' : '☆'}
                      </button>
                      {isM2 ? (
                        inCart ? (
                          // In cart: show remove button
                          <button
                            onClick={() => removeItem(s.id)}
                            style={{ width: 28, height: 28, borderRadius: 8, border: `1.5px solid ${C.danger}40`, background: '#FEF2F2', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.danger, fontSize: 16 }}
                          >×</button>
                        ) : isMeasuring ? null : (
                          // Not in cart, not measuring: show Ukur button
                          <button
                            onClick={() => {
                              setMeasuringId(s.id);
                              setCarpetInputs((prev) => ({ ...prev, [s.id]: { panjang: '', lebar: '' } }));
                            }}
                            style={{ display: 'flex', alignItems: 'center', gap: 5, background: C.primary, border: 'none', borderRadius: 10, padding: '6px 12px', cursor: 'pointer', color: 'white' }}
                          >
                            <span style={{ fontSize: 14 }}>📐</span>
                            <span style={{ fontFamily: 'Poppins', fontSize: 11, fontWeight: 700 }}>Ukur</span>
                          </button>
                        )
                      ) : (
                        // Normal +/- counter
                        <>
                          {qty > 0 && (
                            <button onClick={() => removeItem(s.id)} style={{ width: 28, height: 28, borderRadius: 8, border: `1.5px solid ${C.n300}`, background: C.white, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.n600, fontSize: 18 }}>−</button>
                          )}
                          {qty > 0 && <span style={{ fontFamily: 'Poppins', fontWeight: 700, fontSize: 15, minWidth: 20, textAlign: 'center', color: C.n900 }}>{qty}</span>}
                          <button onClick={() => addItem(s)} style={{ width: 28, height: 28, borderRadius: 8, border: 'none', background: C.primary, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 18 }}>+</button>
                        </>
                      )}
                    </div>
                  </div>

              {/* ── Carpet: in-cart summary ── */}
              {isM2 && inCart && (
                <div style={{ marginTop: 8, background: '#EFF6FF', borderRadius: 10, padding: '8px 12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontFamily: 'Poppins', fontSize: 12, color: '#1E40AF' }}>
                      📏 <strong>{inCart.carpetPanjangCm} cm × {inCart.carpetLebarCm} cm</strong>
                      {' = '}<strong>{Number(inCart.qty).toFixed(2)} m²</strong>
                    </div>
                    <div style={{ fontFamily: 'Poppins', fontSize: 12, fontWeight: 700, color: C.primary }}>
                      {rp(s.price * Number(inCart.qty))}
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setMeasuringId(s.id);
                      setCarpetInputs((prev) => ({
                        ...prev,
                        [s.id]: { panjang: String(inCart.carpetPanjangCm || ''), lebar: String(inCart.carpetLebarCm || '') },
                      }));
                    }}
                    style={{ marginTop: 6, background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'Poppins', fontSize: 11, color: '#1E40AF', padding: 0, textDecoration: 'underline' }}
                  >✏️ Ubah ukuran</button>
                </div>
              )}

              {/* ── Carpet: measurement input ── */}
              {isM2 && isMeasuring && (
                <div style={{ marginTop: 10, background: C.n50, borderRadius: 12, padding: '12px 14px', border: `1.5px solid ${C.primary}30` }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                    <div style={{ fontFamily: 'Poppins', fontSize: 11, fontWeight: 700, color: C.n700 }}>📐 Ukur Karpet</div>
                    {/* Toggle cm / m */}
                    <div style={{ display: 'flex', borderRadius: 8, overflow: 'hidden', border: `1.5px solid ${C.primary}40` }}>
                      <button
                        type="button"
                        onClick={() => setCarpetUnit('cm')}
                        style={{
                          padding: '4px 12px', border: 'none', cursor: 'pointer',
                          fontFamily: 'Poppins', fontSize: 10, fontWeight: 700,
                          background: carpetUnit === 'cm' ? C.primary : 'white',
                          color: carpetUnit === 'cm' ? 'white' : C.n600,
                        }}
                      >cm</button>
                      <button
                        type="button"
                        onClick={() => setCarpetUnit('m')}
                        style={{
                          padding: '4px 12px', border: 'none', cursor: 'pointer',
                          fontFamily: 'Poppins', fontSize: 10, fontWeight: 700,
                          background: carpetUnit === 'm' ? C.primary : 'white',
                          color: carpetUnit === 'm' ? 'white' : C.n600,
                        }}
                      >m</button>
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
                    <div>
                      <div style={{ fontFamily: 'Poppins', fontSize: 10, fontWeight: 600, color: C.n600, marginBottom: 4 }}>Panjang ({carpetUnit})</div>
                      <input
                        type="number"
                        inputMode="decimal"
                        value={inp.panjang}
                        onChange={(e) => setCarpetInputs((prev) => ({ ...prev, [s.id]: { ...prev[s.id], panjang: e.target.value } }))}
                        placeholder={carpetUnit === 'cm' ? 'mis. 250' : 'mis. 2.5'}
                        style={{ width: '100%', height: 40, borderRadius: 8, border: `1.5px solid ${C.n300}`, fontFamily: 'Poppins', fontSize: 13, padding: '0 10px', boxSizing: 'border-box', outline: 'none' }}
                      />
                    </div>
                    <div>
                      <div style={{ fontFamily: 'Poppins', fontSize: 10, fontWeight: 600, color: C.n600, marginBottom: 4 }}>Lebar ({carpetUnit})</div>
                      <input
                        type="number"
                        inputMode="decimal"
                        value={inp.lebar}
                        onChange={(e) => setCarpetInputs((prev) => ({ ...prev, [s.id]: { ...prev[s.id], lebar: e.target.value } }))}
                        placeholder={carpetUnit === 'cm' ? 'mis. 150' : 'mis. 1.5'}
                        style={{ width: '100%', height: 40, borderRadius: 8, border: `1.5px solid ${C.n300}`, fontFamily: 'Poppins', fontSize: 13, padding: '0 10px', boxSizing: 'border-box', outline: 'none' }}
                      />
                    </div>
                  </div>
                  {luas > 0 && (
                    <div style={{ background: '#DBEAFE', borderRadius: 8, padding: '7px 12px', marginBottom: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontFamily: 'Poppins', fontSize: 12, color: '#1E40AF' }}>
                        Luas: <strong>{luas.toFixed(2)} m²</strong>
                        {carpetUnit === 'cm' && inp.panjang && inp.lebar && (
                          <span style={{ fontSize: 10, opacity: 0.8 }}> ({inp.panjang}×{inp.lebar} cm)</span>
                        )}
                        {carpetUnit === 'm' && inp.panjang && inp.lebar && (
                          <span style={{ fontSize: 10, opacity: 0.8 }}> ({inp.panjang}×{inp.lebar} m)</span>
                        )}
                      </span>
                      <span style={{ fontFamily: 'Poppins', fontSize: 13, fontWeight: 700, color: C.primary }}>
                        {rp(s.price * luas)}
                      </span>
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      onClick={() => { setMeasuringId(null); setCarpetInputs((prev) => ({ ...prev, [s.id]: { panjang: '', lebar: '' } })); }}
                      style={{ flex: 1, height: 36, borderRadius: 8, border: `1.5px solid ${C.n300}`, background: C.white, fontFamily: 'Poppins', fontSize: 12, fontWeight: 600, cursor: 'pointer', color: C.n600 }}
                    >Batal</button>
                    <button
                      onClick={() => addCarpetItem(s, inp.panjang, inp.lebar)}
                      disabled={!luas}
                      style={{ flex: 2, height: 36, borderRadius: 8, border: 'none', background: luas ? C.primary : C.n300, fontFamily: 'Poppins', fontSize: 12, fontWeight: 700, cursor: luas ? 'pointer' : 'not-allowed', color: 'white' }}
                    >
                      {inCart ? '✓ Perbarui' : '+ Tambah'} {luas ? `${luas.toFixed(2)} m²` : ''}
                    </button>
                  </div>
                </div>
              )}

              {/* ── Normal expanded: express + material (non-m2 only) ── */}
              {!isM2 && qty > 0 && (
                <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {Number(s.expressMultiplier || 0) > 1 && (
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                      <button
                        onClick={() => toggleExpress(s.id)}
                        style={{ display: 'flex', alignItems: 'center', gap: 6, background: inCart?.express ? '#FEF3C7' : C.n50, border: `1.5px solid ${inCart?.express ? C.warning : C.n300}`, borderRadius: 8, padding: '4px 10px', cursor: 'pointer', color: inCart?.express ? C.warning : C.n600 }}
                      >
                        <span style={{ fontSize: 14 }}>⚡</span>
                        <span style={{ fontFamily: 'Poppins', fontSize: 11, fontWeight: 600 }}>
                          Express ({Number(s.expressMultiplier).toFixed(0)}× → {rp(getCartUnitPrice({ ...s, express: true }))})
                        </span>
                      </button>
                    </div>
                  )}
                  {((s.category || '').toLowerCase().includes('satuan')) && (
                    <div>
                      <Select 
                        value={inCart?.materialId || ''} 
                        onChange={(val) => updateMaterial(s.id, val)} 
                        options={[{ value: '', label: 'Pilih Jenis Bahan...' }, ...materials.map(m => ({ value: m.id, label: m.name }))]}
                      />
                    </div>
                  )}

                  {/* ── Bahan & Merek (untuk semua item yang sudah di cart) ── */}
                  {inCart && (
                    <ItemDetailFields
                      item={inCart}
                      onChangeBahan={(v) => updateBahan(s.id, v)}
                      onChangeMerek={(v) => updateMerek(s.id, v)}
                      onChangeAlert={(v) => updateSpecialAlert(s.id, v)}
                    />
                  )}
                </div>
              )}

              {/* ── Express toggle for m2 (when in cart) ── */}
              {isM2 && inCart && Number(s.expressMultiplier || 0) > 1 && (
                <div style={{ marginTop: 8 }}>
                  <button
                    onClick={() => toggleExpress(s.id)}
                    style={{ display: 'flex', alignItems: 'center', gap: 6, background: inCart?.express ? '#FEF3C7' : C.n50, border: `1.5px solid ${inCart?.express ? C.warning : C.n300}`, borderRadius: 8, padding: '4px 10px', cursor: 'pointer', color: inCart?.express ? C.warning : C.n600 }}
                  >
                    <span style={{ fontSize: 14 }}>⚡</span>
                    <span style={{ fontFamily: 'Poppins', fontSize: 11, fontWeight: 600 }}>
                      Express ({Number(s.expressMultiplier).toFixed(0)}× → {rp(getCartUnitPrice({ ...s, express: true }))} / m²)
                    </span>
                  </button>
                </div>
              )}
            </div>
                </React.Fragment>
              );
            })}
          </>
        )}
      </div>

      {notaCart.length > 0 && (
        <div style={{
          padding: '14px 16px 16px',
          background: '#0F172A',
          color: 'white',
          borderTop: `3px solid ${C.primary}`,
          boxShadow: '0 -4px 16px rgba(15,23,42,0.15)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: 'Poppins', fontSize: 10, color: 'rgba(255,255,255,0.6)', letterSpacing: 0.5, fontWeight: 600 }}>
                {notaCart.reduce((s, c) => s + c.qty, 0)} item · {serviceKind === 'cleanox' ? 'Cleanox 🏠' : 'Waschen 🧺'}
                {notaCart.some(c => c.express) && (
                  <span style={{ marginLeft: 8, color: '#FBBF24', fontWeight: 700 }}>⚡ Express</span>
                )}
              </div>
              <div style={{ fontFamily: 'Poppins', fontSize: 24, fontWeight: 800, color: 'white', lineHeight: 1.15, marginTop: 2 }}>
                {rp(total)}
              </div>
            </div>
            <button
              onClick={() => { if (!notaCustomer?.id) { alertWarning('Customer belum dipilih. Kembali ke langkah 1.'); navigate('nota_step1'); return; } navigate('nota_step3'); }}
              style={{
                background: C.primary, color: 'white',
                border: 'none', borderRadius: 12,
                padding: '12px 18px',
                fontFamily: 'Poppins', fontSize: 14, fontWeight: 800,
                cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 6,
                boxShadow: `0 4px 12px ${C.primary}55`,
              }}
            >
              Lanjut
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
