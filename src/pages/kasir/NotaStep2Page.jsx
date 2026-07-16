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
  // ─── Carpet (m2) measurement ────────────────────────────────────────────────
  const [measuringId, setMeasuringId] = useState(null);
  const [carpetInputs, setCarpetInputs] = useState({}); // { [serviceId]: { panjang: '', lebar: '' } } - in meters

  // ─── Block back: redirect if customer is gone (from successful checkout) ──
  useEffect(() => {
    if (!notaCustomer?.id) {
      navigate('nota_step1', null, { replace: true });
    }
  }, [notaCustomer, navigate]);

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

  const [showMobileCart, setShowMobileCart] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);

  // ── Render single service card ──
  const renderServiceCard = (s) => {
    const isM2 = s.unit === 'm2';
    const qty = getQty(s.id);
    const inCart = notaCart.find((c) => c.id === s.id);
    const isMeasuring = measuringId === s.id;
    const inp = carpetInputs[s.id] || { panjang: '', lebar: '' };
    const luas = (inp.panjang && inp.lebar)
      ? Math.round((Number(inp.panjang) * Number(inp.lebar)) * 100) / 100 : 0;
    const isPinned = !!s.pin_context;

    return (
      <div key={s.id} style={{
        background: C.white, borderRadius: 14, padding: '12px 14px',
        boxShadow: SHADOW.sm,
        border: inCart ? '1.5px solid ' + C.primary + '30' : '1.5px solid transparent',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <div style={{ fontFamily: 'Poppins', fontSize: 13, fontWeight: 600, color: C.n900 }}>{s.name}</div>
            </div>
            <div style={{ fontFamily: 'Poppins', fontSize: 11, color: C.n600, marginTop: 2 }}>
              {isM2 ? 'per m²' : s.unit}
              {s.category ? <span> · {s.category}</span> : null}
              {isM2 && <span style={{ marginLeft: 6, background: '#FFF3E0', color: '#E65100', borderRadius: 6, padding: '1px 7px', fontSize: 10, fontWeight: 600 }}>📐 m²</span>}
            </div>
            <div style={{ fontFamily: 'Poppins', fontSize: 14, fontWeight: 600, color: C.n900, marginTop: 4 }}>
              {rp(s.price)}{isM2 ? <span style={{ fontFamily: 'Poppins', fontSize: 10, fontWeight: 500, color: C.n600 }}> / m²</span> : null}
            </div>
          </div>

          {/* + / - controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {isM2 ? (
              inCart ? (
                <button onClick={() => removeItem(s.id)} style={{ width: 28, height: 28, borderRadius: 8, border: '1.5px solid ' + C.danger + '40', background: C.dangerBg, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.danger, fontSize: 16 }}>×</button>
              ) : isMeasuring ? null : (
                <button onClick={() => { setMeasuringId(s.id); setCarpetInputs((prev) => ({ ...prev, [s.id]: { panjang: '', lebar: '' } })); }} style={{ display: 'flex', alignItems: 'center', gap: 5, background: C.primary, border: 'none', borderRadius: 10, padding: '6px 12px', cursor: 'pointer', color: 'white' }}>
                  <span style={{ fontSize: 14 }}>📐</span>
                  <span style={{ fontFamily: 'Poppins', fontSize: 11, fontWeight: 600 }}>Ukur</span>
                </button>
              )
            ) : (
              <>
                {qty > 0 && <button onClick={() => removeItem(s.id)} style={{ width: 28, height: 28, borderRadius: 8, border: '1.5px solid ' + C.n300, background: C.white, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.n700, fontSize: 18 }}>−</button>}
                {qty > 0 && <span style={{ fontFamily: 'Poppins', fontWeight: 600, fontSize: 15, minWidth: 20, textAlign: 'center', color: C.n900 }}>{qty}</span>}
                <button onClick={() => addItem(s)} style={{ width: 28, height: 28, borderRadius: 8, border: 'none', background: C.primary, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 18 }}>+</button>
              </>
            )}
          </div>
        </div>

        {/* Carpet in-cart summary */}
        {isM2 && inCart && (
          <div style={{ marginTop: 8, background: 'linear-gradient(135deg, #FFF3E0 0%, #FFE0B2 100%)', borderRadius: 10, padding: '10px 14px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontFamily: 'Poppins', fontSize: 12, color: '#E65100', fontWeight: 600 }}>
                📏 <strong>{(inCart.carpetPanjangCm / 100).toFixed(2)} m × {(inCart.carpetLebarCm / 100).toFixed(2)} m</strong>
                {' = '}<strong>{Number(inCart.qty).toFixed(2)} m²</strong>
              </div>
              <div style={{ fontFamily: 'Poppins', fontSize: 13, fontWeight: 700, color: C.primary }}>
                {rp(s.price * Number(inCart.qty))}
              </div>
            </div>
            <button onClick={() => { setMeasuringId(s.id); setCarpetInputs((prev) => ({ ...prev, [s.id]: { panjang: String((inCart.carpetPanjangCm / 100).toFixed(2)), lebar: String((inCart.carpetLebarCm / 100).toFixed(2)) } })); }} style={{ marginTop: 6, background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'Poppins', fontSize: 11, color: '#E65100', padding: 0, textDecoration: 'underline', fontWeight: 600 }}>✏️ Ubah ukuran</button>
          </div>
        )}

        {/* Carpet measurement inputs */}
        {isM2 && isMeasuring && (
          <div style={{ marginTop: 10, background: 'rgba(255,255,255,0.7)', borderRadius: 12, padding: '12px 14px', border: '1.5px solid ' + C.primary + '30' }}>
            <div style={{ fontFamily: 'Poppins', fontSize: 12, fontWeight: 600, color: C.primary, marginBottom: 10 }}>📐 Ukur Karpet (meter)</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
              <div><div style={{ fontFamily: 'Poppins', fontSize: 11, fontWeight: 600, color: C.n700, marginBottom: 4 }}>Panjang (m)</div>
                <input type="number" inputMode="decimal" step="0.1" value={inp.panjang} onChange={(e) => setCarpetInputs((prev) => ({ ...prev, [s.id]: { ...prev[s.id], panjang: e.target.value } }))} placeholder="mis. 2.5" style={{ width: '100%', height: 48, borderRadius: 10, border: '1.5px solid ' + C.n300, fontFamily: 'Poppins', fontSize: 14, padding: '0 12px', boxSizing: 'border-box', outline: 'none' }} />
              </div>
              <div><div style={{ fontFamily: 'Poppins', fontSize: 11, fontWeight: 600, color: C.n700, marginBottom: 4 }}>Lebar (m)</div>
                <input type="number" inputMode="decimal" step="0.1" value={inp.lebar} onChange={(e) => setCarpetInputs((prev) => ({ ...prev, [s.id]: { ...prev[s.id], lebar: e.target.value } }))} placeholder="mis. 1.5" style={{ width: '100%', height: 48, borderRadius: 10, border: '1.5px solid ' + C.n300, fontFamily: 'Poppins', fontSize: 14, padding: '0 12px', boxSizing: 'border-box', outline: 'none' }} />
              </div>
            </div>
            {luas > 0 && (
              <div style={{ background: '#E3F2FD', borderRadius: 10, padding: '10px 14px', marginBottom: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontFamily: 'Poppins', fontSize: 13, color: '#1565C0', fontWeight: 600 }}>📏 Luas: <strong>{luas.toFixed(2)} m²</strong></span>
                <span style={{ fontFamily: 'Poppins', fontSize: 14, fontWeight: 700, color: C.primary }}>{rp(s.price * luas)}</span>
              </div>
            )}
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => { setMeasuringId(null); setCarpetInputs((prev) => ({ ...prev, [s.id]: { panjang: '', lebar: '' } })); }} style={{ flex: 1, height: 48, borderRadius: 10, border: '1.5px solid ' + C.n300, background: C.white, fontFamily: 'Poppins', fontSize: 13, fontWeight: 600, cursor: 'pointer', color: C.n700 }}>Batal</button>
              <button onClick={() => addCarpetItem(s, inp.panjang, inp.lebar)} disabled={!luas} style={{ flex: 2, height: 48, borderRadius: 10, border: 'none', background: luas ? C.primary : C.n300, fontFamily: 'Poppins', fontSize: 13, fontWeight: 600, cursor: luas ? 'pointer' : 'not-allowed', color: 'white' }}>{inCart ? '✓ Perbarui' : '+ Tambah'} {luas ? luas.toFixed(2) + ' m²' : ''}</button>
            </div>
          </div>
        )}

        {/* Express + Material (non-m2) */}
        {!isM2 && qty > 0 && (
          <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {Number(s.expressMultiplier || 0) > 1 && (
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <button onClick={() => toggleExpress(s.id)} style={{ display: 'flex', alignItems: 'center', gap: 6, background: inCart?.express ? C.validationWarningBg : C.n50, border: '1.5px solid ' + (inCart?.express ? C.warning : C.n300), borderRadius: 8, padding: '4px 10px', cursor: 'pointer', color: inCart?.express ? C.warning : C.n700 }}>
                  <span style={{ fontSize: 14 }}>⚡</span>
                  <span style={{ fontFamily: 'Poppins', fontSize: 11, fontWeight: 600 }}>Express ({Number(s.expressMultiplier).toFixed(0)}× → {rp(getCartUnitPrice({ ...s, express: true }))})</span>
                </button>
              </div>
            )}
            {s.requiresMaterial === 1 && (
              <div>
                <div style={{ fontFamily: 'Poppins', fontSize: 10, fontWeight: 600, color: C.n700, marginBottom: 4 }}>Jenis Bahan <span style={{ color: C.danger }}>*</span></div>
                <Select value={inCart?.materialId || ''} onChange={(val) => updateMaterial(s.id, val)} options={[{ value: '', label: 'Pilih Jenis Bahan...' }, ...materials.map(m => ({ value: m.id, label: m.name }))]} />
                {inCart && !inCart.materialId && (
                  <div style={{ marginTop: 4, padding: '6px 10px', background: C.validationErrorBg, border: '1.5px solid ' + C.validationErrorBorder, borderRadius: 8, fontFamily: 'Poppins', fontSize: 11, color: C.validationErrorText, fontWeight: 600 }}>⚠️ Pilih jenis bahan untuk layanan ini</div>
                )}
              </div>
            )}
            {inCart && (
              <ItemDetailFields item={inCart} onChangeBahan={(v) => updateBahan(s.id, v)} onChangeMerek={(v) => updateMerek(s.id, v)} onChangeAlert={(v) => updateSpecialAlert(s.id, v)} />
            )}
          </div>
        )}

        {/* Express toggle for m2 in cart */}
        {isM2 && inCart && Number(s.expressMultiplier || 0) > 1 && (
          <div style={{ marginTop: 8 }}>
            <button onClick={() => toggleExpress(s.id)} style={{ display: 'flex', alignItems: 'center', gap: 6, background: inCart?.express ? C.validationWarningBg : C.n50, border: '1.5px solid ' + (inCart?.express ? C.warning : C.n300), borderRadius: 8, padding: '4px 10px', cursor: 'pointer', color: inCart?.express ? C.warning : C.n700 }}>
              <span style={{ fontSize: 14 }}>⚡</span>
              <span style={{ fontFamily: 'Poppins', fontSize: 11, fontWeight: 600 }}>Express ({Number(s.expressMultiplier).toFixed(0)}× → {rp(getCartUnitPrice({ ...s, express: true }))} / m²)</span>
            </button>
          </div>
        )}
      </div>
    );
  };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#F3EEF7', overflow: 'hidden', height: '100vh' }}>
      {/* Header */}
      <div style={{ background: C.primary, padding: '10px 12px', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <button onClick={goBack} style={{ background: 'none', border: 'none', padding: 4, cursor: 'pointer' }} aria-label="Kembali">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round"><polyline points="15 18 9 12 15 6" /></svg>
          </button>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontFamily: 'Poppins', fontSize: 14, fontWeight: 700, color: 'white' }}>Pilih Layanan</div>
            <div style={{ fontFamily: 'Poppins', fontSize: 11, color: 'rgba(255,255,255,0.7)' }}>Langkah 2 dari 3</div>
          </div>
          <div style={{ width: 32 }} />
        </div>
        <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
          {[1, 2, 3].map((s) => (
            <div key={s} style={{ flex: 1, height: 4, borderRadius: 2, background: s <= 2 ? '#5FD9AE' : 'rgba(255,255,255,0.3)' }} />
          ))}
        </div>
      </div>

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0 }}>
        {/* LEFT COLUMN */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#F3EEF7', minWidth: 0 }}>
          {/* Customer info */}
          {notaCustomer && (
            <div style={{
              margin: '6px 10px 0',
              background: 'linear-gradient(135deg, ' + C.primary + ' 0%, ' + C.primaryDark + ' 100%)',
              borderRadius: 12, padding: '10px 14px',
              display: 'flex', alignItems: 'center', gap: 10,
              boxShadow: '0 4px 16px ' + C.primary + '30',
              flexShrink: 0,
            }}>
              <Avatar initials={notaCustomer.avatar} size={36} />
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: 'Poppins', fontSize: 13, fontWeight: 700, color: 'white' }}>{notaCustomer.name}</div>
                <div style={{ fontFamily: 'Poppins', fontSize: 11, color: 'rgba(255,255,255,0.8)' }}>Deposit: {rp(notaCustomer.deposit || 0)}</div>
              </div>
              <div style={{ background: 'rgba(255,255,255,0.2)', borderRadius: 8, padding: '4px 10px' }}>
                <div style={{ fontFamily: 'Poppins', fontSize: 10, color: 'rgba(255,255,255,0.8)' }}>Layanan</div>
                <div style={{ fontFamily: 'Poppins', fontSize: 14, fontWeight: 700, color: 'white' }}>{notaCart.length}</div>
              </div>
            </div>
          )}

          {/* Service Kind Toggle */}
          <div style={{ padding: '6px 10px 0', flexShrink: 0 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, background: C.white, padding: 3, borderRadius: 10, boxShadow: '0 2px 8px rgba(92,26,107,0.06)' }}>
              {[
                { id: 'waschen', label: 'Waschen', icon: '🧺', color: '#5C1A6B' },
                { id: 'cleanox', label: 'Cleanox', icon: '🏠', color: '#26A69A' },
              ].map(opt => {
                const active = serviceKind === opt.id;
                return (
                  <button key={opt.id} onClick={() => { setServiceKind(opt.id); setActiveCategory('Semua'); }} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '8px', borderRadius: 8, border: 'none', background: active ? opt.color : 'transparent', cursor: 'pointer', transition: 'all 0.15s' }}>
                    <span style={{ fontSize: 16 }}>{opt.icon}</span>
                    <div style={{ fontFamily: 'Poppins', fontSize: 11, fontWeight: 600, color: active ? 'white' : '#5C1A6B' }}>{opt.label}</div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Search + Category */}
          <div style={{ padding: '6px 10px 0', display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
            <button onClick={() => setShowCategoryModal(true)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 38, height: 38, borderRadius: 10, border: 'none', background: C.white, cursor: 'pointer', boxShadow: '0 2px 6px rgba(92,26,107,0.1)' }} aria-label="Pilih kategori">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#5C1A6B" strokeWidth="2"><line x1="4" y1="6" x2="20" y2="6" /><line x1="4" y1="12" x2="20" y2="12" /><line x1="4" y1="18" x2="20" y2="18" /></svg>
            </button>
            <div style={{ flex: 1 }}>
              <SearchBar value={searchQuery} onChange={setSearchQuery} placeholder="Cari layanan..." />
            </div>
          </div>

          {activeCategory !== 'Semua' && (
            <div style={{ padding: '4px 10px 0', display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
              <span style={{ fontFamily: 'Poppins', fontSize: 11, fontWeight: 600, color: C.primary, background: C.primary + '15', padding: '4px 12px', borderRadius: 999 }}>📂 {activeCategory}</span>
              <button onClick={() => setActiveCategory('Semua')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#5C1A6B', fontSize: 16, padding: 2 }}>×</button>
            </div>
          )}

          {/* Scrollable services */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '6px 10px 100px', minHeight: 0 }}>
            {loading ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 200, gap: 12 }}>
                <div style={{ width: 32, height: 32, border: '3px solid #E9D3F2', borderTop: '3px solid #5C1A6B', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                <span style={{ fontFamily: 'Poppins', fontSize: 12, color: '#7A6584' }}>Memuat...</span>
              </div>
            ) : filtered.length === 0 ? (
              <EmptyState title="Tidak ada layanan" subtitle="Ubah pencarian atau pilih kategori lain." />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {/* Pinned */}
                {orderedList.pinned.length > 0 && (
                  <div>
                    <div style={{ fontFamily: 'Poppins', fontSize: 12, fontWeight: 700, color: '#3B0B47', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ background: 'linear-gradient(135deg, #5C1A6B, #3B0B47)', color: 'white', padding: '4px 12px', borderRadius: 8, fontSize: 11 }}>📌 Pinned</span>
                      <span style={{ color: '#7A6584', fontSize: 11, fontWeight: 500 }}>{orderedList.pinned.length} layanan</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {orderedList.pinned.map((s) => (
                        renderServiceCard(s)
                      ))}
                    </div>
                  </div>
                )}

                {/* Popular */}
                {orderedList.popular.length > 0 && (
                  <div>
                    <div style={{ fontFamily: 'Poppins', fontSize: 12, fontWeight: 700, color: '#3B0B47', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ background: '#FFF3E0', color: '#E65100', padding: '4px 12px', borderRadius: 8, fontSize: 11 }}>🔥 Sering Digunakan</span>
                      <span style={{ color: '#7A6584', fontSize: 11, fontWeight: 500 }}>{orderedList.popular.length} layanan</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {orderedList.popular.map((s) => (
                        renderServiceCard(s)
                      ))}
                    </div>
                  </div>
                )}

                {/* Others */}
                {orderedList.others.length > 0 && (
                  <div>
                    {(orderedList.pinned.length > 0 || orderedList.popular.length > 0) && (
                      <div style={{ fontFamily: 'Poppins', fontSize: 11, fontWeight: 600, color: '#7A6584', marginBottom: 8 }}>🧺 Lainnya ({orderedList.others.length})</div>
                    )}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {orderedList.others.map((s) => (
                        renderServiceCard(s)
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: Keranjang */}
        <div style={{ width: 360, flexShrink: 0, display: 'flex', flexDirection: 'column', background: C.white, borderLeft: '1px solid ' + C.n100 }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid ' + C.n100, flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontFamily: 'Poppins', fontSize: 14, fontWeight: 700, color: C.n900 }}>🛒 Keranjang</div>
                <div style={{ fontFamily: 'Poppins', fontSize: 11, color: C.n500 }}>{notaCart.length} layanan</div>
              </div>
              {notaCart.length > 0 && (
                <button onClick={() => setNotaCart([])} style={{ background: C.coral + '10', border: '1px solid ' + C.coral + '30', borderRadius: 6, padding: '4px 8px', fontFamily: 'Poppins', fontSize: 10, fontWeight: 600, color: C.coral, cursor: 'pointer' }}>Hapus Semua</button>
              )}
            </div>
          </div>

          {/* Total */}
          <div style={{ padding: '12px 16px', background: C.white, borderTop: '1px solid ' + C.n100, flexShrink: 0 }}>
            {!canProceed && (
              <div style={{ marginBottom: 8, padding: '6px 10px', background: C.coral + '10', border: '1px solid ' + C.coral + '30', borderRadius: 8, fontFamily: 'Poppins', fontSize: 11, color: C.coral, fontWeight: 600 }}>
                ⚠️ {missingMaterialItems.length} layanan belum pilih bahan
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontFamily: 'Poppins', fontSize: 10, color: C.n500 }}>Total</div>
                <div style={{ fontFamily: 'Poppins', fontSize: 20, fontWeight: 800, color: C.n900 }}>{rp(total)}</div>
              </div>
              <button
                onClick={() => {
                  if (!canProceed) { alertError('Mohon pilih jenis bahan untuk semua layanan'); return; }
                  if (!notaCustomer?.id) { alertWarning('Customer belum dipilih'); navigate('nota_step1'); return; }
                  if (notaCart.length === 0) { alertWarning('Belum ada layanan yang dipilih'); return; }
                  navigate('nota_step3');
                }}
                disabled={notaCart.length === 0}
                style={{ background: notaCart.length > 0 && canProceed ? C.primary : C.n300, color: 'white', border: 'none', borderRadius: 10, padding: '10px 20px', fontFamily: 'Poppins', fontSize: 13, fontWeight: 700, cursor: notaCart.length > 0 && canProceed ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', gap: 4, boxShadow: notaCart.length > 0 && canProceed ? '0 4px 12px ' + C.primary + '50' : 'none' }}
              >
                Lanjut
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6" /></svg>
              </button>
            </div>
          </div>

          {/* Cart items */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '8px 16px', minHeight: 0 }}>
            {notaCart.length === 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 200, gap: 8 }}>
                <span style={{ fontSize: 40 }}>🛒</span>
                <div style={{ fontFamily: 'Poppins', fontSize: 12, color: C.n500, textAlign: 'center' }}>Keranjang kosong<br />Pilih layanan di sebelah kiri</div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {notaCart.map((item, idx) => {
                  const subtotal = getCartLineSubtotal(item);
                  const isM2 = item.unit === 'm2';
                  return (
                    <div key={idx} style={{ background: C.n50, borderRadius: 10, padding: '10px 12px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontFamily: 'Poppins', fontSize: 12, fontWeight: 600, color: C.n900, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</div>
                          <div style={{ fontFamily: 'Poppins', fontSize: 10, color: C.n500, marginTop: 1 }}>
                            {isM2 ? Number(item.qty).toFixed(2) + ' m²' : item.qty + ' ' + item.unit} × {rp(item.price)}
                            {item.express && <span style={{ marginLeft: 4, background: C.warning + '15', color: C.warning, padding: '0 4px', borderRadius: 3, fontSize: 9, fontWeight: 600 }}>⚡</span>}
                          </div>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                          <span style={{ fontFamily: 'Poppins', fontSize: 12, fontWeight: 700, color: C.coral }}>{rp(subtotal)}</span>
                          <div style={{ display: 'flex', gap: 4 }}>
                            <button onClick={() => removeItem(item.id)} style={{ width: 22, height: 22, borderRadius: 6, border: '1px solid ' + C.n200, background: C.white, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.primary, fontSize: 14 }}>−</button>
                            {!isM2 && <button onClick={() => addItem(item)} style={{ width: 22, height: 22, borderRadius: 6, border: 'none', background: C.primary, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 14 }}>+</button>}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Mobile FAB */}
      <button
        onClick={() => setShowMobileCart(true)}
        style={{
          position: 'fixed', bottom: 24, right: 16,
          background: '#5C1A6B', color: 'white', border: 'none',
          borderRadius: 28, padding: '12px 18px', display: 'flex', alignItems: 'center', gap: 8,
          boxShadow: '0 4px 16px rgba(92,26,107,0.4)',
          zIndex: 100, fontFamily: 'Poppins', fontSize: 13, fontWeight: 700,
          opacity: window.innerWidth >= 768 ? 0 : 1,
          pointerEvents: window.innerWidth >= 768 ? 'none' : 'auto',
        }}
        aria-label="Lihat keranjang"
      >
        <span style={{ fontSize: 18 }}>🛒</span>
        <span>{notaCart.length}</span>
      </button>

      {/* Mobile Cart Bottom Sheet */}
      {showMobileCart && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'flex-end' }} onClick={() => setShowMobileCart(false)}>
          <div style={{ background: 'white', borderRadius: '20px 20px 0 0', width: '100%', maxHeight: '85vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ padding: '12px 0', display: 'flex', justifyContent: 'center' }}>
              <div style={{ width: 40, height: 4, background: '#E9D3F2', borderRadius: 2 }} />
            </div>
            <div style={{ padding: '0 16px 12px', borderBottom: '1px solid #F3EEF7' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontFamily: 'Poppins', fontSize: 16, fontWeight: 700, color: '#2B1130' }}>🛒 Keranjang</div>
                  <div style={{ fontFamily: 'Poppins', fontSize: 12, color: '#7A6584' }}>{notaCart.length} layanan</div>
                </div>
                <button onClick={() => setShowMobileCart(false)} style={{ background: 'none', border: 'none', padding: 8, cursor: 'pointer' }} aria-label="Tutup">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#2B1130" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                </button>
              </div>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px' }}>
              {notaCart.map((item, idx) => {
                const subtotal = getCartLineSubtotal(item);
                const isM2 = item.unit === 'm2';
                return (
                  <div key={idx} style={{ background: '#F3EEF7', borderRadius: 12, padding: '12px', marginBottom: 8 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontFamily: 'Poppins', fontSize: 13, fontWeight: 600, color: '#2B1130', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</div>
                        <div style={{ fontFamily: 'Poppins', fontSize: 11, color: '#7A6584', marginTop: 2 }}>
                          {isM2 ? Number(item.qty).toFixed(2) + ' m²' : item.qty + ' ' + item.unit} × {rp(item.price)}
                        </div>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
                        <span style={{ fontFamily: 'Poppins', fontSize: 13, fontWeight: 700, color: '#C0247D' }}>{rp(subtotal)}</span>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button onClick={() => removeItem(item.id)} style={{ width: 28, height: 28, borderRadius: 8, border: '1px solid #E9D3F2', background: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#5C1A6B', fontSize: 16 }}>−</button>
                          {!isM2 && <button onClick={() => addItem(item)} style={{ width: 28, height: 28, borderRadius: 8, border: 'none', background: '#5C1A6B', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 16 }}>+</button>}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            <div style={{ padding: '16px', borderTop: '1px solid #F3EEF7', background: 'white' }}>
              {!canProceed && (
                <div style={{ marginBottom: 8, padding: '8px 12px', background: '#FFF5F5', border: '1px solid rgba(240,70,107,0.3)', borderRadius: 8, fontFamily: 'Poppins', fontSize: 11, color: '#F0466B', fontWeight: 600 }}>⚠️ {missingMaterialItems.length} layanan belum pilih bahan</div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <div>
                  <div style={{ fontFamily: 'Poppins', fontSize: 11, color: '#7A6584' }}>Total</div>
                  <div style={{ fontFamily: 'Poppins', fontSize: 24, fontWeight: 800, color: '#2B1130' }}>{rp(total)}</div>
                </div>
                <button
                  onClick={() => {
                    if (!canProceed) { alertError('Mohon pilih jenis bahan untuk semua layanan'); return; }
                    if (!notaCustomer?.id) { alertWarning('Customer belum dipilih'); navigate('nota_step1'); return; }
                    if (notaCart.length === 0) { alertWarning('Belum ada layanan yang dipilih'); return; }
                    setShowMobileCart(false);
                    navigate('nota_step3');
                  }}
                  disabled={notaCart.length === 0}
                  style={{ background: notaCart.length > 0 && canProceed ? '#5C1A6B' : '#E9D3F2', color: 'white', border: 'none', borderRadius: 12, padding: '12px 20px', fontFamily: 'Poppins', fontSize: 14, fontWeight: 700, cursor: notaCart.length > 0 && canProceed ? 'pointer' : 'not-allowed' }}
                >Lanjut <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ marginLeft: 6 }}><polyline points="9 18 15 12 9 6" /></svg></button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Category Modal */}
      {showCategoryModal && (
        <div onClick={() => setShowCategoryModal(false)} style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'flex-end' }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: 'white', borderRadius: '20px 20px 0 0', width: '100%', padding: '20px 16px 32px' }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
              <div style={{ width: 40, height: 4, background: '#E9D3F2', borderRadius: 2 }} />
            </div>
            <div style={{ fontFamily: 'Poppins', fontSize: 16, fontWeight: 700, color: '#2B1130', marginBottom: 16, textAlign: 'center' }}>📂 Pilih Kategori</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              <button onClick={() => { setActiveCategory('Semua'); setShowCategoryModal(false); }} style={{ fontFamily: 'Poppins', fontSize: 12, fontWeight: 600, padding: '8px 16px', borderRadius: 999, border: 'none', background: activeCategory === 'Semua' ? '#5C1A6B' : '#F3EEF7', color: activeCategory === 'Semua' ? 'white' : '#5C1A6B', cursor: 'pointer' }}>
                Semua ({activeServices.length})
              </button>
              {categoryChips.filter(c => c !== 'Semua').map(cat => (
                <button key={cat} onClick={() => { setActiveCategory(cat); setShowCategoryModal(false); }} style={{ fontFamily: 'Poppins', fontSize: 12, fontWeight: 600, padding: '8px 16px', borderRadius: 999, border: 'none', background: activeCategory === cat ? '#5C1A6B' : '#F3EEF7', color: activeCategory === cat ? 'white' : '#5C1A6B', cursor: 'pointer' }}>
                  {cat} ({activeServices.filter(s => s.category === cat).length})
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}