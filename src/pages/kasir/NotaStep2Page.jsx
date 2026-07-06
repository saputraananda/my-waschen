import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { C, SHADOW } from '../../utils/theme';
import { rp, getCartLineSubtotal, getCartUnitPrice } from '../../utils/helpers';
import { TopBar, Btn, Chip, Avatar, SearchBar, EmptyState, Select } from '../../components/ui';
import { useApp } from '../../context/AppContext';
import { alertError, alertWarning } from '../../utils/alert';
import KeranjangPanel from '../../components/KeranjangPanel';

// ─── ItemDetailFields ─────────────────────────────────────────────────────
// Input bahan & merek per item + auto-detect alert khusus
const SPECIAL_BAHAN = {
  'sutra':       { color: C.materialSutra, alert: '⚠️ Bahan sutra — gunakan deterjen lembut, jangan diperas keras' },
  'silk':        { color: C.materialSutra, alert: '⚠️ Bahan silk — gunakan deterjen lembut, jangan diperas keras' },
  'wol':         { color: C.materialWol, alert: '⚠️ Bahan wol — cuci air dingin, jangan diperas atau ditarik' },
  'wool':        { color: C.materialWol, alert: '⚠️ Bahan wol — cuci air dingin, jangan diperas atau ditarik' },
  'kulit':       { color: C.materialKulit, alert: '🚨 Bahan kulit — JANGAN dicuci air, gunakan dry cleaning saja' },
  'leather':     { color: C.materialKulit, alert: '🚨 Bahan kulit — JANGAN dicuci air, gunakan dry cleaning saja' },
  'beludru':     { color: C.materialBeludru, alert: '⚠️ Beludru — hati-hati saat setrika, gunakan kain pelapis' },
  'velvet':      { color: C.materialBeludru, alert: '⚠️ Velvet — hati-hati saat setrika, gunakan kain pelapis' },
  'kaos polos':  { color: C.materialJeans, alert: '💧 Cek warna luntur sebelum pencampuran' },
  'jeans':       { color: C.materialJeans, alert: '💧 Jeans — kemungkinan luntur, cuci terpisah pertama kali' },
  'denim':       { color: C.materialJeans, alert: '💧 Denim — kemungkinan luntur, cuci terpisah pertama kali' },
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
    alerts.push({ color: C.materialPremium, alert: '✨ Merek premium — handle ekstra hati-hati, dokumentasi lengkap' });
  }
  return alerts;
}

function ItemDetailFields({ item, onChangeBahan, onChangeMerek, onChangeAlert }) {
  const detected = detectAlert(item.material, item.brand);
  return (
    <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <div>
          <div style={{ fontFamily: 'Poppins', fontSize: 10, fontWeight: 600, color: C.n700, marginBottom: 4 }}>🧵 Bahan (opsional)</div>
          <input
            value={item.material || ''}
            onChange={(e) => onChangeBahan(e.target.value)}
            placeholder="Sutra, wol, kulit..."
            style={{ width: '100%', height: 36, borderRadius: 8, border: `1.5px solid ${C.n300}`, fontFamily: 'Poppins', fontSize: 12, padding: '0 10px', boxSizing: 'border-box', outline: 'none' }}
          />
        </div>
        <div>
          <div style={{ fontFamily: 'Poppins', fontSize: 10, fontWeight: 600, color: C.n700, marginBottom: 4 }}>🏷️ Merek (opsional)</div>
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
        <div style={{ fontFamily: 'Poppins', fontSize: 10, fontWeight: 600, color: C.n700, marginBottom: 4 }}>⚠️ Catatan khusus (untuk produksi)</div>
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
  const [cartModalOpen, setCartModalOpen] = useState(false);
  // ─── Carpet (m2) measurement ────────────────────────────────────────────────
  const [measuringId, setMeasuringId] = useState(null);
  const [carpetInputs, setCarpetInputs] = useState({}); // { [serviceId]: { panjang: '', lebar: '' } } - in meters

  useEffect(() => {
    const fetchServices = async () => {
      setLoading(true);
      try {
        const [svcRes, matRes] = await Promise.all([
          axios.get(`/api/services${notaCustomer?.id ? `?customerId=${notaCustomer.id}&sort=popular` : '?sort=popular'}`),
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
// TODO: Hapus CLEANOX_DUMMY setelah API /api/services mengembalikan cleanox services dari backend
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
  //    2. POPULAR (top 5 by frekuensi transaksi 30 hari terakhir — auto, tidak perlu diklik manual)
  //    3. NORMAL (sisanya, urut by category + name)
  const orderedList = useMemo(() => {
    const pinned = filtered.filter((s) => s.pin_context);
    const pinnedIds = new Set(pinned.map((s) => s.id));

    // Popular: top 5 by popular_count (auto-calculated from 30-day transaction frequency)
    const popular = filtered
      .filter((s) => !pinnedIds.has(s.id) && Number(s.popular_count) > 0)
      .sort((a, b) => Number(b.popular_count) - Number(a.popular_count))
      .slice(0, 5); // Top5 only
    const popularIds = new Set(popular.map((s) => s.id));

    const others = filtered
      .filter((s) => !pinnedIds.has(s.id) && !popularIds.has(s.id))
      .sort((a, b) => {
        const catCmp = (a.category || '').localeCompare(b.category || '', 'id');
        return catCmp !== 0 ? catCmp : (a.name || '').localeCompare(b.name || '', 'id');
      });
    return { pinned, popular, others };
  }, [filtered]);

  const getQty = (id) => notaCart.find((c) => c.id === id)?.qty || 0;

  const addItem = (service) => {
    setNotaCart((prev) => {
      const existing = prev.find((c) => c.id === service.id);
      if (existing) return prev.map((c) => (c.id === service.id ? { ...c, qty: c.qty + 1 } : c));
      return [...prev, { ...service, qty: 1, express: false }];
    });
  };

  const addCarpetItem = (service, panjangM, lebarM) => {
    const p = Number(panjangM);
    const l = Number(lebarM);
    if (!p || !l || p <= 0 || l <= 0) return;
    
    // Calculate area in m²
    const luas = Math.round((p * l) * 100) / 100;
    
    // Convert to cm for storage (backend compatibility)
    const pCm = Math.round(p * 100);
    const lCm = Math.round(l * 100);
    
    setNotaCart((prev) => {
      const existing = prev.find((c) => c.id === service.id);
      const carpetData = { carpetPanjangCm: pCm, carpetLebarCm: lCm, carpetInputUnit: 'm' };
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

  const total = notaCart.reduce((sum, c) => sum + getCartLineSubtotal(c), 0);

  // ── Validation: Check if all services requiring material have material selected ──
  const validateMaterialSelection = () => {
    const itemsMissingMaterial = notaCart.filter(item => {
      // Check if service requires material (requires_material = 1)
      return item.requiresMaterial === 1 && !item.materialId;
    });
    return itemsMissingMaterial;
  };

  const missingMaterialItems = validateMaterialSelection();
  const canProceed = missingMaterialItems.length === 0;

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: C.n50, overflow: 'hidden' }}>
      <TopBar title="Buat Nota" subtitle={`Langkah 2 dari 3 — Pilih Layanan (Cart: ${notaCart.length})`} onBack={goBack} />

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
            { id: 'cleanox', label: 'Cleanox Cleaning', sub: 'Home cleaning', icon: '🏠',  color: C.info },
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
                  boxShadow: active ? SHADOW.md : 'none',
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
                  <div style={{ fontFamily: 'Poppins', fontSize: 12, fontWeight: 600, color: active ? opt.color : C.n700 }}>
                    {opt.label}
                  </div>
                  <div style={{ fontFamily: 'Poppins', fontSize: 9, color: C.n600, marginTop: 1 }}>
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
        <div style={{ fontFamily: 'Poppins', fontSize: 11, fontWeight: 600, color: C.n700, marginBottom: 6 }}>Genre / kategori</div>
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
            <span style={{ fontFamily: 'Poppins', fontSize: 13, color: C.n600 }}>Memuat layanan...</span>
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
              <div style={{ fontFamily: 'Poppins', fontSize: 11, fontWeight: 600, color: C.sectionPinned, display: 'flex', alignItems: 'center', gap: 4, marginTop: 4, marginBottom: 2 }}>
                <span>📌</span> DI PIN
              </div>
            )}
            {/* SECTION: Popular (top 5 auto-calculated by 30-day transaction frequency) */}
            {orderedList.popular.length > 0 && (
              <div style={{ fontFamily: 'Poppins', fontSize: 11, fontWeight: 600, color: C.sectionPopular, display: 'flex', alignItems: 'center', gap: 4, marginTop: orderedList.pinned.length > 0 ? 8 : 4, marginBottom: 2 }}>
                <span>🔥</span> SERING DIGUNAKAN
              </div>
            )}
            {/* Render: pinned → popular → others */}
            {[...orderedList.pinned, ...orderedList.popular, ...orderedList.others].map((s, idx) => {
              const isM2     = s.unit === 'm2';
              const qty      = getQty(s.id);
              const inCart   = notaCart.find((c) => c.id === s.id);
              const isMeasuring = measuringId === s.id;
              const inp      = carpetInputs[s.id] || { panjang: '', lebar: '' };
              const isPinned = !!s.pin_context;
              const isPopular = !isPinned && Number(s.popular_count) > 0;
              // Calculate area in m² (inputs are in meters)
              const luas     = (inp.panjang && inp.lebar)
                ? Math.round((Number(inp.panjang) * Number(inp.lebar)) * 100) / 100
                : 0;

              // Inject section divider between sections
              const pinnedEnd = orderedList.pinned.length;
              const popularEnd = pinnedEnd + orderedList.popular.length;

              const showPopularHeader = idx === pinnedEnd && orderedList.popular.length > 0;
              const showOthersHeader = idx === popularEnd && (orderedList.pinned.length > 0 || orderedList.popular.length > 0) && orderedList.others.length > 0;

              return (
                <React.Fragment key={s.id}>
                  {showPopularHeader && (
                    <div style={{ fontFamily: 'Poppins', fontSize: 11, fontWeight: 600, color: C.sectionPopular, display: 'flex', alignItems: 'center', gap: 4, marginTop: 8, marginBottom: 2 }}>
                      <span>🔥</span> SERING DIGUNAKAN
                    </div>
                  )}
                  {showOthersHeader && (
                    <div style={{ fontFamily: 'Poppins', fontSize: 11, fontWeight: 600, color: C.sectionOther, display: 'flex', alignItems: 'center', gap: 4, marginTop: 8, marginBottom: 2 }}>
                      <span>🧺</span> LAINNYA
                    </div>
                  )}
                <div
                  style={{
                    background: C.white,
                    borderRadius: 14,
                    padding: '12px 14px',
                    boxShadow: isPinned ? SHADOW.pinned : isPopular ? SHADOW.popular : SHADOW.sm,
                    border: isPinned ? `2px solid ${C.sectionPinned}` : isPopular ? `2px solid ${C.sectionPopular}30` : inCart ? `1.5px solid ${C.primary}30` : '1.5px solid transparent',
                  }}
                >
                  {/* ── Header row ── */}
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        <div style={{ fontFamily: 'Poppins', fontSize: 13, fontWeight: 600, color: C.n900 }}>{s.name}</div>
                        {isPinned && (
                          <span style={{ background: C.primaryTint, color: C.primary, fontFamily: 'Poppins', fontSize: 9, fontWeight: 600, padding: '2px 6px', borderRadius: 999 }}>
                            📌 PINNED
                          </span>
                        )}
                        {isPopular && !isPinned && (
                          <span style={{ background: C.infoBg, color: C.infoDark, fontFamily: 'Poppins', fontSize: 9, fontWeight: 600, padding: '2px 6px', borderRadius: 999 }}>
                            🔥 POPULER
                          </span>
                        )}
                      </div>
                      <div style={{ fontFamily: 'Poppins', fontSize: 11, color: C.n600, marginTop: 2 }}>
                        {isM2 ? 'per m²' : s.unit}
                        {s.category ? <span> · {s.category}</span> : null}
                        {isM2 && <span style={{ marginLeft: 6, background: C.carpetBg, color: C.carpetText, borderRadius: 6, padding: '1px 7px', fontSize: 10, fontWeight: 600 }}>📐 Ukuran m²</span>}
                      </div>
                      <div style={{ fontFamily: 'Poppins', fontSize: 14, fontWeight: 600, color: C.n900, marginTop: 4 }}>
                        {rp(s.price)}{isM2 ? <span style={{ fontFamily: 'Poppins', fontSize: 10, fontWeight: 500, color: C.n600 }}> / m²</span> : null}
                      </div>
                    </div>

                    {/* ── RIGHT SIDE ── */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      {isM2 ? (
                        inCart ? (
                          // In cart: show remove button
                          <button
                            onClick={() => removeItem(s.id)}
                            style={{ width: 28, height: 28, borderRadius: 8, border: `1.5px solid ${C.danger}40`, background: C.dangerBg, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.danger, fontSize: 16 }}
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
                            <span style={{ fontFamily: 'Poppins', fontSize: 11, fontWeight: 600 }}>Ukur</span>
                          </button>
                        )
                      ) : (
                        // Normal +/- counter
                        <>
                          {qty > 0 && (
                            <button onClick={() => removeItem(s.id)} style={{ width: 28, height: 28, borderRadius: 8, border: `1.5px solid ${C.n300}`, background: C.white, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.n700, fontSize: 18 }}>−</button>
                          )}
                          {qty > 0 && <span style={{ fontFamily: 'Poppins', fontWeight: 600, fontSize: 15, minWidth: 20, textAlign: 'center', color: C.n900 }}>{qty}</span>}
                          <button onClick={() => addItem(s)} style={{ width: 28, height: 28, borderRadius: 8, border: 'none', background: C.primary, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 18 }}>+</button>
                        </>
                      )}
                    </div>
                  </div>

              {/* ── Carpet: in-cart summary ── */}
              {isM2 && inCart && (
                <div style={{ marginTop: 8, background: `linear-gradient(135deg, ${C.carpetBg} 0%, ${C.carpetBgEnd} 100%)`, borderRadius: 10, padding: '10px 14px', boxShadow: SHADOW.carpet }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontFamily: 'Poppins', fontSize: 12, color: C.carpetText, fontWeight: 600 }}>
                      📏 <strong>{(inCart.carpetPanjangCm / 100).toFixed(2)} m × {(inCart.carpetLebarCm / 100).toFixed(2)} m</strong>
                      {' = '}<strong>{Number(inCart.qty).toFixed(2)} m²</strong>
                    </div>
                    <div style={{ fontFamily: 'Poppins', fontSize: 13, fontWeight: 700, color: C.primary }}>
                      {rp(s.price * Number(inCart.qty))}
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setMeasuringId(s.id);
                      // Convert cm back to meters for editing
                      setCarpetInputs((prev) => ({
                        ...prev,
                        [s.id]: { 
                          panjang: String((inCart.carpetPanjangCm / 100).toFixed(2)), 
                          lebar: String((inCart.carpetLebarCm / 100).toFixed(2))
                        },
                      }));
                    }}
                    style={{ marginTop: 6, background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'Poppins', fontSize: 11, color: C.carpetText, padding: 0, textDecoration: 'underline', fontWeight: 600 }}
                  >✏️ Ubah ukuran</button>
                </div>
              )}

              {/* ── Carpet: measurement input ── */}
              {isM2 && isMeasuring && (
                <div style={{ marginTop: 10, background: 'rgba(255, 255, 255, 0.7)', backdropFilter: 'blur(10px)', borderRadius: 12, padding: '12px 14px', border: `1.5px solid ${C.primary}30`, boxShadow: '0 4px 12px rgba(110, 46, 120, 0.1)' }}>
                  <div style={{ fontFamily: 'Poppins', fontSize: 12, fontWeight: 600, color: C.primary, marginBottom: 10 }}>
                    📐 Ukur Karpet (dalam meter)
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
                    <div>
                      <div style={{ fontFamily: 'Poppins', fontSize: 11, fontWeight: 600, color: C.n700, marginBottom: 4 }}>Panjang (m)</div>
                      <input
                        type="number"
                        inputMode="decimal"
                        step="0.1"
                        value={inp.panjang}
                        onChange={(e) => setCarpetInputs((prev) => ({ ...prev, [s.id]: { ...prev[s.id], panjang: e.target.value } }))}
                        placeholder="mis. 2.5"
                        style={{
                          width: '100%',
                          height: 48,
                          borderRadius: 10,
                          border: `1.5px solid ${C.n300}`,
                          fontFamily: 'Poppins',
                          fontSize: 14,
                          padding: '0 12px',
                          boxSizing: 'border-box',
                          outline: 'none',
                          transition: 'border 0.2s',
                        }}
                        onFocus={(e) => e.target.style.border = `2px solid ${C.primary}`}
                        onBlur={(e) => e.target.style.border = `1.5px solid ${C.n300}`}
                      />
                    </div>
                    <div>
                      <div style={{ fontFamily: 'Poppins', fontSize: 11, fontWeight: 600, color: C.n700, marginBottom: 4 }}>Lebar (m)</div>
                      <input
                        type="number"
                        inputMode="decimal"
                        step="0.1"
                        value={inp.lebar}
                        onChange={(e) => setCarpetInputs((prev) => ({ ...prev, [s.id]: { ...prev[s.id], lebar: e.target.value } }))}
                        placeholder="mis. 1.5"
                        style={{
                          width: '100%',
                          height: 48,
                          borderRadius: 10,
                          border: `1.5px solid ${C.n300}`,
                          fontFamily: 'Poppins',
                          fontSize: 14,
                          padding: '0 12px',
                          boxSizing: 'border-box',
                          outline: 'none',
                          transition: 'border 0.2s',
                        }}
                        onFocus={(e) => e.target.style.border = `2px solid ${C.primary}`}
                        onBlur={(e) => e.target.style.border = `1.5px solid ${C.n300}`}
                      />
                    </div>
                  </div>
                  {luas > 0 && (
                    <div style={{ background: `linear-gradient(135deg, ${C.carpetBgEnd} 0%, ${C.infoBg} 100%)`, borderRadius: 10, padding: '10px 14px', marginBottom: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 2px 8px rgba(14, 165, 233, 0.15)' }}>
                      <span style={{ fontFamily: 'Poppins', fontSize: 13, color: C.carpetText, fontWeight: 600 }}>
                        📏 Luas: <strong>{luas.toFixed(2)} m²</strong>
                        <span style={{ fontSize: 11, opacity: 0.8, marginLeft: 4 }}>({inp.panjang} × {inp.lebar} m)</span>
                      </span>
                      <span style={{ fontFamily: 'Poppins', fontSize: 14, fontWeight: 700, color: C.primary }}>
                        {rp(s.price * luas)}
                      </span>
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      onClick={() => { setMeasuringId(null); setCarpetInputs((prev) => ({ ...prev, [s.id]: { panjang: '', lebar: '' } })); }}
                      style={{ flex: 1, height: 48, borderRadius: 10, border: `1.5px solid ${C.n300}`, background: C.white, fontFamily: 'Poppins', fontSize: 13, fontWeight: 600, cursor: 'pointer', color: C.n700 }}
                    >Batal</button>
                    <button
                      onClick={() => addCarpetItem(s, inp.panjang, inp.lebar)}
                      disabled={!luas}
                      style={{ flex: 2, height: 48, borderRadius: 10, border: 'none', background: luas ? C.primary : C.n300, fontFamily: 'Poppins', fontSize: 13, fontWeight: 600, cursor: luas ? 'pointer' : 'not-allowed', color: 'white', boxShadow: luas ? SHADOW.carpetButton : 'none' }}
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
                        style={{ display: 'flex', alignItems: 'center', gap: 6, background: inCart?.express ? C.validationWarningBg : C.n50, border: `1.5px solid ${inCart?.express ? C.warning : C.n300}`, borderRadius: 8, padding: '4px 10px', cursor: 'pointer', color: inCart?.express ? C.warning : C.n700 }}
                      >
                        <span style={{ fontSize: 14 }}>⚡</span>
                        <span style={{ fontFamily: 'Poppins', fontSize: 11, fontWeight: 600 }}>
                          Express ({Number(s.expressMultiplier).toFixed(0)}× → {rp(getCartUnitPrice({ ...s, express: true }))})
                        </span>
                      </button>
                    </div>
                  )}
                  {/* Show material dropdown only for services with requires_material = 1 */}
                  {s.requiresMaterial === 1 && (
                    <div>
                      <div style={{ fontFamily: 'Poppins', fontSize: 10, fontWeight: 600, color: C.n700, marginBottom: 4 }}>
                        Jenis Bahan <span style={{ color: C.danger }}>*</span>
                      </div>
                      <Select 
                        value={inCart?.materialId || ''} 
                        onChange={(val) => updateMaterial(s.id, val)} 
                        options={[{ value: '', label: 'Pilih Jenis Bahan...' }, ...materials.map(m => ({ value: m.id, label: m.name }))]}
                      />
                      {/* Inline error message if material not selected */}
                      {inCart && !inCart.materialId && (
                        <div style={{
                          marginTop: 4,
                          padding: '6px 10px',
                          background: C.validationErrorBg,
                          border: `1.5px solid ${C.validationErrorBorder}`,
                          borderRadius: 8,
                          fontFamily: 'Poppins',
                          fontSize: 11,
                          color: C.validationErrorText,
                          fontWeight: 600
                        }}>
                          ⚠️ Pilih jenis bahan untuk layanan ini
                        </div>
                      )}
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
                    style={{ display: 'flex', alignItems: 'center', gap: 6, background: inCart?.express ? C.validationWarningBg : C.n50, border: `1.5px solid ${inCart?.express ? C.warning : C.n300}`, borderRadius: 8, padding: '4px 10px', cursor: 'pointer', color: inCart?.express ? C.warning : C.n700 }}
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
        <>
          {/* Cart Trigger Button */}
          <div 
            onClick={() => setCartModalOpen(true)}
            style={{
              background: C.white,
              borderTop: `1px solid ${C.n200}`,
              padding: '12px 16px',
              boxShadow: SHADOW.sm,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div>
              <div style={{ fontFamily: 'Poppins', fontSize: 13, fontWeight: 600, color: C.n900, display: 'flex', alignItems: 'center', gap: 6 }}>
                🛒 Keranjang ({notaCart.length} item)
                {notaCart.some(c => c.express) && (
                  <span style={{
                    fontSize: 10, padding: '1px 6px', borderRadius: 999,
                    background: C.validationWarningBg, color: C.validationWarningText, fontWeight: 700,
                  }}>⚡ Express</span>
                )}
              </div>
              <div style={{ fontFamily: 'Poppins', fontSize: 12, color: C.n600 }}>
                Total: {rp(total)}
              </div>
            </div>
            <div style={{ 
              background: C.primary, 
              color: 'white', 
              borderRadius: '50%', 
              width: 32, 
              height: 32, 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              fontSize: 18,
            }}>
              ›
            </div>
          </div>

          {/* Bottom Total & Continue Bar */}
          <div style={{
            padding: '14px 16px 16px',
            background: C.n900,
            color: 'white',
            borderTop: `3px solid ${C.primary}`,
            boxShadow: SHADOW.lg,
          }}>
            {/* Validation Error Message */}
            {!canProceed && (
              <div style={{
                marginBottom: 10,
                padding: '8px 12px',
                background: C.validationErrorBg,
                border: `1.5px solid ${C.validationErrorBorder}`,
                borderRadius: 10,
                fontFamily: 'Poppins',
                fontSize: 12,
                color: C.validationErrorText,
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: 6
              }}>
                ⚠️ {missingMaterialItems.length} layanan belum memilih jenis bahan
              </div>
            )}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: 'Poppins', fontSize: 10, color: 'rgba(255,255,255,0.6)', letterSpacing: 0.5, fontWeight: 600 }}>
                  {serviceKind === 'cleanox' ? 'Cleanox 🏠' : 'Waschen 🧺'}
                </div>
                <div style={{ fontFamily: 'Poppins', fontSize: 24, fontWeight: 800, color: 'white', lineHeight: 1.15, marginTop: 2 }}>
                  {rp(total)}
                </div>
              </div>
              <button
                onClick={() => { 
                  if (!canProceed) {
                    alertError('Mohon pilih jenis bahan untuk semua layanan yang memerlukan');
                    return;
                  }
                  if (!notaCustomer?.id) { 
                    alertWarning('Customer belum dipilih. Kembali ke langkah 1.'); 
                    navigate('nota_step1'); 
                    return; 
                  } 
                  navigate('nota_step3'); 
                }}
                disabled={!canProceed}
                style={{
                  background: canProceed ? C.primary : C.n400, 
                  color: 'white',
                  border: 'none', 
                  borderRadius: 12,
                  padding: '12px 18px',
                  fontFamily: 'Poppins', 
                  fontSize: 14, 
                  fontWeight: 800,
                  cursor: canProceed ? 'pointer' : 'not-allowed',
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: 6,
                  boxShadow: canProceed ? `0 4px 12px ${C.primary}55` : 'none',
                  opacity: canProceed ? 1 : 0.6,
                }}
              >
                Lanjut
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </button>
            </div>
          </div>

          {/* Cart Modal */}
          {cartModalOpen && (
            <div style={{
              position: 'fixed',
              top: 0, left: 0, right: 0, bottom: 0,
              background: 'rgba(0,0,0,0.5)',
              display: 'flex',
              flexDirection: 'column',
              zIndex: 1000,
            }}>
              {/* Modal Header */}
              <div style={{
                background: C.white,
                padding: '16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                borderBottom: `1px solid ${C.n200}`,
              }}>
                <div>
                  <div style={{ fontFamily: 'Poppins', fontSize: 18, fontWeight: 700, color: C.n900 }}>
                    🛒 Keranjang Belanja
                  </div>
                  <div style={{ fontFamily: 'Poppins', fontSize: 12, color: C.n600 }}>
                    {notaCart.length} layanan · Total: {rp(total)}
                  </div>
                </div>
                <button
                  onClick={() => setCartModalOpen(false)}
                  style={{
                    width: 36, height: 36, borderRadius: 10,
                    background: C.n50, border: 'none', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 20, color: C.n700,
                  }}
                >
                  ×
                </button>
              </div>

              {/* Modal Content */}
              <div style={{
                flex: 1,
                overflowY: 'auto',
                padding: '16px',
                background: C.n50,
              }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {notaCart.map((item, idx) => {
                    const isM2 = item.unit === 'm2';
                    return (
                      <div key={idx} style={{
                        background: C.white,
                        borderRadius: 14,
                        padding: '14px 16px',
                        boxShadow: SHADOW.sm,
                      }}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                              <div style={{ fontFamily: 'Poppins', fontSize: 14, fontWeight: 700, color: C.n900 }}>{item.name}</div>
                              {item.express && (
                                <span style={{
                                  fontSize: 10, padding: '2px 8px', borderRadius: 999,
                                  background: C.validationWarningBg, color: C.validationWarningText, fontWeight: 700,
                                }}>⚡ Express</span>
                              )}
                            </div>
                            <div style={{ fontFamily: 'Poppins', fontSize: 11, color: C.n600, marginTop: 4 }}>
                              {isM2 
                                ? `${Number(item.qty).toFixed(2)} m²`
                                : `${item.qty} ${item.unit || 'item'}`}
                            </div>
                            <div style={{ fontFamily: 'Poppins', fontSize: 15, fontWeight: 700, color: C.primary, marginTop: 4 }}>
                              {rp(getCartLineSubtotal(item))}
                            </div>
                          </div>

                          {/* Remove Button */}
                          <button
                            onClick={() => removeItem(item.id)}
                            style={{
                              width: 32, height: 32, borderRadius: 10,
                              border: 'none', background: C.validationErrorBg, color: C.danger,
                              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                              fontSize: 18, fontWeight: 700,
                            }}
                          >
                            🗑️
                          </button>
                        </div>

                        {/* Quick Controls Row */}
                        <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
                          {!isM2 && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              {/* Quantity Controls */}
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: C.n50, padding: 4, borderRadius: 10 }}>
                                <button
                                  onClick={() => removeItem(item.id)}
                                  style={{ width: 36, height: 36, borderRadius: 8, border: `1.5px solid ${C.n300}`, background: C.white, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.n700, fontSize: 20 }}
                                >−</button>
                                <span style={{ fontFamily: 'Poppins', fontWeight: 600, fontSize: 16, minWidth: 28, textAlign: 'center', color: C.n900 }}>{item.qty}</span>
                                <button
                                  onClick={() => addItem(item)}
                                  style={{ width: 36, height: 36, borderRadius: 8, border: 'none', background: C.primary, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 20 }}
                                >+</button>
                              </div>
                              {/* Quick Presets */}
                              <div style={{ display: 'flex', gap: 4 }}>
                                {[2, 3, 5, 10].map(presetQty => (
                                  <button
                                    key={presetQty}
                                    onClick={() => setNotaCart(prev => prev.map(c => c.id === item.id ? { ...c, qty: presetQty } : c))}
                                    style={{
                                      padding: '4px 8px',
                                      borderRadius: 8,
                                      border: `1.5px solid ${C.n200}`,
                                      background: C.white,
                                      cursor: 'pointer',
                                      fontSize: 11,
                                      fontWeight: 600,
                                      color: C.n700,
                                      fontFamily: 'Poppins',
                                    }}
                                  >
                                    {presetQty}
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Express Toggle (if available) */}
                          {Number(item.expressMultiplier || 0) > 1 && (
                            <button
                              onClick={() => toggleExpress(item.id)}
                              style={{
                                width: '100%',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 6,
                                background: item.express ? C.validationWarningBg : C.n50,
                                border: `1.5px solid ${item.express ? C.warning : C.n300}`,
                                borderRadius: 10,
                                padding: '8px 12px',
                                cursor: 'pointer',
                                color: item.express ? C.warning : C.n700,
                                justifyContent: 'center',
                              }}
                            >
                              <span style={{ fontSize: 16 }}>⚡</span>
                              <span style={{ fontFamily: 'Poppins', fontSize: 12, fontWeight: 600 }}>
                                {item.express ? 'Express Aktif' : 'Aktifkan Express'}
                              </span>
                            </button>
                          )}
                        </div>

                        {/* Expandable Details */}
                        {!isM2 && (
                          <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${C.n100}` }}>
                            {/* Show material dropdown only for services with requires_material = 1 */}
                            {item.requiresMaterial === 1 && (
                              <div style={{ marginBottom: 8 }}>
                                <div style={{ fontFamily: 'Poppins', fontSize: 10, fontWeight: 600, color: C.n700, marginBottom: 4 }}>
                                  Jenis Bahan <span style={{ color: C.danger }}>*</span>
                                </div>
                                <Select 
                                  value={item.materialId || ''} 
                                  onChange={(val) => updateMaterial(item.id, val)} 
                                  options={[{ value: '', label: 'Pilih Jenis Bahan...' }, ...materials.map(m => ({ value: m.id, label: m.name }))]}
                                />
                                {/* Inline error message if material not selected */}
                                {!item.materialId && (
                                  <div style={{
                                    marginTop: 4,
                                    padding: '6px 10px',
                                    background: C.validationErrorBg,
                                    border: `1.5px solid ${C.validationErrorBorder}`,
                                    borderRadius: 8,
                                    fontFamily: 'Poppins',
                                    fontSize: 11,
                                    color: C.validationErrorText,
                                    fontWeight: 600
                                  }}>
                                    ⚠️ Pilih jenis bahan untuk layanan ini
                                  </div>
                                )}
                              </div>
                            )}
                            <ItemDetailFields
                              item={item}
                              onChangeBahan={(v) => updateBahan(item.id, v)}
                              onChangeMerek={(v) => updateMerek(item.id, v)}
                              onChangeAlert={(v) => updateSpecialAlert(item.id, v)}
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Modal Footer */}
              <div style={{
                background: C.white,
                padding: '14px 16px',
                borderTop: `1px solid ${C.n200}`,
                boxShadow: SHADOW.md,
              }}>
                {/* Validation Error Message */}
                {!canProceed && (
                  <div style={{
                    marginBottom: 10,
                    padding: '8px 12px',
                    background: C.validationErrorBg,
                    border: `1.5px solid ${C.validationErrorBorder}`,
                    borderRadius: 10,
                    fontFamily: 'Poppins',
                    fontSize: 12,
                    color: C.validationErrorText,
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6
                  }}>
                    ⚠️ {missingMaterialItems.length} layanan belum memilih jenis bahan
                  </div>
                )}
                <div style={{ marginBottom: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontFamily: 'Poppins', fontSize: 12, fontWeight: 600, color: C.n700 }}>Total Keranjang</div>
                  <div style={{ fontFamily: 'Poppins', fontSize: 20, fontWeight: 800, color: C.n900 }}>{rp(total)}</div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    onClick={() => setCartModalOpen(false)}
                    style={{
                      flex: 1,
                      background: C.n50,
                      color: C.n700,
                      border: `1.5px solid ${C.n200}`,
                      borderRadius: 12,
                      padding: '12px 16px',
                      fontFamily: 'Poppins',
                      fontSize: 14,
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    Tutup
                  </button>
                  <button
                    onClick={() => { 
                      if (!canProceed) {
                        alertError('Mohon pilih jenis bahan untuk semua layanan yang memerlukan');
                        return;
                      }
                      setCartModalOpen(false); 
                      if (!notaCustomer?.id) { 
                        alertWarning('Customer belum dipilih. Kembali ke langkah 1.'); 
                        navigate('nota_step1'); 
                        return; 
                      } 
                      navigate('nota_step3'); 
                    }}
                    disabled={!canProceed}
                    style={{
                      flex: 2,
                      background: canProceed ? C.primary : C.n400,
                      color: 'white',
                      border: 'none',
                      borderRadius: 12,
                      padding: '12px 16px',
                      fontFamily: 'Poppins',
                      fontSize: 14,
                      fontWeight: 700,
                      cursor: canProceed ? 'pointer' : 'not-allowed',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6,
                      opacity: canProceed ? 1 : 0.6,
                    }}
                  >
                    Lanjut ke Pembayaran
                    ›
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
